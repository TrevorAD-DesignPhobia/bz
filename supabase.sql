-- Run once in Supabase: SQL Editor > New query
create table games (
  code text primary key, state jsonb not null, status text not null default 'lobby',
  version int not null default 0, created_at timestamptz default now());
create table seats (   -- player secrets: never readable from the browser
  code text references games(code) on delete cascade, idx int, token text not null, primary key (code, idx));
create table secrets ( -- tile bag order: never readable from the browser
  code text primary key references games(code) on delete cascade, bag jsonb not null, discard jsonb not null);
alter table games enable row level security;
alter table seats enable row level security;
alter table secrets enable row level security;
create policy "anyone can watch a room" on games for select using (true); -- writes only via the API (service role)
alter publication supabase_realtime add table games;
-- optional cleanup of old rooms: delete from games where created_at < now() - interval '3 days';
