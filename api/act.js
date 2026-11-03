import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { newGame, move, autoMove } from '../engine.js';

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const rid = () => Array.from({ length: 5 }, () => ALPHA[Math.random() * ALPHA.length | 0]).join('');
const clean = s => String(s || '').replace(/[<>&"]/g, '').trim().slice(0, 14) || 'Player';
const E = (c, m) => Object.assign(new Error(m), { c });
const view = S => (S.g ? { ...S, g: { ...S.g, bag: [], discard: [] } } : S); // bag order never leaves the server

async function load(code) {
  const { data: row } = await db.from('games').select('*').eq('code', code).maybeSingle();
  if (!row) throw E(404, 'Room not found');
  const [{ data: seats }, { data: sec }] = await Promise.all([
    db.from('seats').select('idx,token').eq('code', code),
    db.from('secrets').select('*').eq('code', code).maybeSingle(),
  ]);
  const S = row.state;
  if (S.g && sec) { S.g.bag = sec.bag; S.g.discard = sec.discard; }
  return { row, S, seats: seats || [] };
}

async function persist(code, row, S) {
  const pub = view(S);
  pub.v = row.version + 1;
  const { data, error } = await db.from('games')
    .update({ state: pub, status: S.status, version: row.version + 1 })
    .eq('code', code).eq('version', row.version).select('version'); // optimistic lock: no simultaneous moves
  if (error) throw error;
  if (!data.length) throw E(409, 'Someone else acted first — try again');
  if (S.g) await db.from('secrets').upsert({ code, bag: S.g.bag, discard: S.g.discard });
  return pub;
}

function after(S, r0, now, msg) {
  const g = S.g, parts = msg ? [msg] : [];
  if (g.over) S.status = 'over';
  S.deadline = S.status === 'playing' && S.opts.t ? now + S.opts.t * 1000 : null;
  if (g.round !== r0 || g.over) {
    const rs = g.rounds[g.rounds.length - 1];
    parts.push('Round scored — ' + g.players.map((P, i) => `${P.name} +${rs[i].gain}/−${rs[i].pen}`).join(', '));
  }
  if (parts.length) S.note = { id: now, msg: parts.join(' ') };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const b = req.body || {}, A = b.action, now = Date.now();
  try {
    if (A === 'create') {
      const token = randomUUID();
      for (let i = 0; i < 5; i++) {
        const code = rid();
        const S = { status: 'lobby', players: [clean(b.name)], opts: { t: 30, timeout: 'auto' }, seen: { 0: now }, g: null, deadline: null, v: 0 };
        const { error } = await db.from('games').insert({ code, state: S, status: 'lobby', version: 0 });
        if (!error) {
          await db.from('seats').insert({ code, idx: 0, token });
          return res.json({ code, token, me: 0, state: S, now });
        }
      }
      throw E(500, 'Could not create a room');
    }

    const code = String(b.code || '').toUpperCase();
    const { row, S, seats } = await load(code);
    const seat = seats.find(s => b.token && s.token === b.token);
    let me = seat ? seat.idx : -1, dirty = false, token;
    const g = S.g;

    if (A === 'join') {
      if (me < 0) {
        if (S.status !== 'lobby') throw E(400, 'This game has already started');
        if (S.players.length >= 4) throw E(400, 'This room is full (4 players)');
        const idx = S.players.length; token = randomUUID();
        const { error } = await db.from('seats').insert({ code, idx, token });
        if (error) throw E(409, 'Someone joined at the same moment — try again');
        S.players.push(clean(b.name)); S.seen[idx] = now; me = idx; dirty = true;
      }
    } else if (A === 'ping') {
      if (me >= 0 && now - (S.seen[me] || 0) > 10000) { S.seen[me] = now; dirty = true; }
    } else if (A === 'settings') {
      if (me !== 0 || S.status !== 'lobby') throw E(403, 'Only the host can change settings');
      const t = +b.t;
      if (![0, 15, 30, 45, 60, 90, 120].includes(t)) throw E(400, 'Invalid timer');
      S.opts = { t, timeout: b.timeout === 'floor' ? 'floor' : 'auto' }; dirty = true;
    } else if (A === 'start' || A === 'again') {
      if (me !== 0) throw E(403, 'Only the host can start the game');
      if ((A === 'start' && S.status !== 'lobby') || (A === 'again' && S.status !== 'over')) throw E(400, 'Not available right now');
      if (S.players.length < 2) throw E(400, 'Wait for at least one more player');
      S.g = newGame(S.players, S.opts); S.status = 'playing'; S.note = null;
      S.deadline = S.opts.t ? now + S.opts.t * 1000 : null; dirty = true;
    } else if (A === 'move') {
      if (S.status !== 'playing') throw E(400, 'The game is not running');
      if (me < 0 || me !== g.turn) throw E(403, "It's not your turn");
      const r0 = g.round, r = move(g, b.src === 'c' ? 'c' : +b.src, +b.c, +b.row);
      if (r !== true) throw E(400, r);
      after(S, r0, now); dirty = true;
    } else if (A === 'tick') { // any client may ask; the server alone decides whether the clock has expired
      if (S.status === 'playing' && S.opts.t && S.deadline && now >= S.deadline) {
        const nm = g.players[g.turn].name, r0 = g.round;
        autoMove(g); after(S, r0, now, `Time's up — automatic move for ${nm}.`); dirty = true;
      }
    } else if (A !== 'state') throw E(400, 'Unknown action');

    const out = dirty ? await persist(code, row, S) : view(S);
    res.json({ state: out, me, token, now: Date.now() });
  } catch (e) {
    if (!e.c) console.error(e);
    res.status(e.c || 500).json({ error: e.c ? e.message : 'Server error' });
  }
}
