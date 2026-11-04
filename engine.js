/* ===== ENGINE (pure rules, no DOM) ===== */
const COL=['#2b95d6','#f2bf4a','#e4604d','#1d2634','#eaf2ee'],SYM='��儵������',NAMES=['Blue','Yellow','Red','Black','White'],PEN=[1,1,2,2,2,3,3];
const wallCol=(r,c)=>(c-r+5)%5, wallPos=(r,col)=>(col+r)%5;
const shuffle=a=>{for(let i=a.length-1;i>0;i--){const j=Math.random()*(i+1)|0;[a[i],a[j]]=[a[j],a[i]]}return a};
function newGame(names,opts){const bag=[];for(let c=0;c<5;c++)for(let i=0;i<20;i++)bag.push(c);
 const g={n:names.length,opts,bag:shuffle(bag),discard:[],factories:[],center:[],marker:true,round:1,turn:0,next:0,over:false,rounds:[],bonus:null,
  players:names.map(name=>({name,score:0,wall:Array.from({length:5},()=>Array(5).fill(false)),lines:Array.from({length:5},()=>({c:-1,k:0})),floor:[]}))};
 fill(g);return g}
function draw(g){if(!g.bag.length){g.bag=shuffle(g.discard);g.discard=[]}return g.bag.length?g.bag.pop():null}
function fill(g){g.factories=Array.from({length:[0,0,5,7,9][g.n]},()=>{const f=[];for(let i=0;i<4;i++){const t=draw(g);if(t!==null)f.push(t)}return f});g.center=[];g.marker=true}
function canPlace(g,p,c,row){if(row===5)return true;const P=g.players[p],L=P.lines[row];
 if(P.wall[row][wallPos(row,c)])return `Your wall row ${row+1} already has ${NAMES[c]}.`;
 if(L.k>0&&L.c!==c)return `Row ${row+1} already holds ${NAMES[L.c]} tiles.`;
 if(L.k>=row+1)return `Row ${row+1} is already full.`;return true}
function pts(w,r,c){let h=1,v=1;for(let i=c-1;i>=0&&w[r][i];i--)h++;for(let i=c+1;i<5&&w[r][i];i++)h++;for(let i=r-1;i>=0&&w[i][c];i--)v++;for(let i=r+1;i<5&&w[i][c];i++)v++;return h>1&&v>1?h+v:h>1?h:v>1?v:1}
function move(g,src,c,row){const p=g.turn,P=g.players[p],ok=canPlace(g,p,c,row);if(ok!==true)return ok;
 const pool=src==='c'?g.center:g.factories[src];if(!pool||!pool.includes(c))return 'No such tiles there.';
 const take=pool.filter(t=>t===c),rest=pool.filter(t=>t!==c);
 if(src==='c'){g.center=rest;if(g.marker){g.marker=false;P.floor.unshift(5);g.next=p;if(P.floor.length>7)g.discard.push(P.floor.pop())}}
 else{g.center.push(...rest);g.factories[src]=[]}
 let k=take.length;
 if(row<5){const L=P.lines[row],put=Math.min(row+1-L.k,k);L.c=c;L.k+=put;k-=put}
 while(k-->0){if(P.floor.length<7)P.floor.push(c);else g.discard.push(c)}
 g.mv=(g.mv||0)+1;
 if(g.factories.every(f=>!f.length)&&!g.center.length)endRound(g);else g.turn=(p+1)%g.n;return true}
function endRound(g){const rs=[];
 g.players.forEach(P=>{let gain=0,pen=0;
  P.lines.forEach((L,r)=>{if(L.k===r+1){const col=wallPos(r,L.c);P.wall[r][col]=true;gain+=pts(P.wall,r,col);for(let i=0;i<r;i++)g.discard.push(L.c);P.lines[r]={c:-1,k:0}}});
  P.floor.forEach((t,j)=>{pen+=PEN[j];if(t!==5)g.discard.push(t)});P.floor=[];
  P.score=Math.max(0,P.score+gain-pen);rs.push({gain,pen,score:P.score})});
 g.rounds.push(rs);
 if(g.players.some(P=>P.wall.some(r=>r.every(Boolean))))finish(g);else{g.round++;g.turn=g.next;fill(g)}}
function finish(g){g.over=true;g.bonus=g.players.map(P=>{const w=P.wall;let rows=0,cols=0,sets=0;
 for(let i=0;i<5;i++){if(w[i].every(Boolean))rows++;if(w.every(r=>r[i]))cols++}
 for(let c=0;c<5;c++)if(w.every((r,i)=>r[wallPos(i,c)]))sets++;
 P.score+=rows*2+cols*7+sets*10;return{rows,cols,sets}})}
function autoMove(g){const p=g.turn,o=[];
 for(const s of [...g.factories.keys(),'c']){const pool=s==='c'?g.center:g.factories[s];
  for(const c of new Set(pool)){const n=pool.filter(t=>t===c).length;
   if(g.opts.timeout!=='floor')for(let r=0;r<5;r++)if(canPlace(g,p,c,r)===true)o.push([s,c,r,Math.max(0,n-(r+1-g.players[p].lines[r].k))]);
   o.push([s,c,5,n+9])}}
 const best=Math.min(...o.map(x=>x[3])),pick=shuffle(o.filter(x=>x[3]===best))[0];return move(g,pick[0],pick[1],pick[2])}
function runTests(){const A=(c,m)=>console[c?'log':'error']((c?'PASS ':'FAIL ')+m),W=()=>Array.from({length:5},()=>Array(5).fill(false));
 let x=W();x[2][2]=true;A(pts(x,2,2)===1,'isolated tile = 1');x[2][1]=true;A(pts(x,2,2)===2,'horizontal pair = 2');x[1][2]=true;A(pts(x,2,2)===4,'both directions add');
 A(wallCol(0,0)===0&&wallCol(1,0)===4&&wallPos(1,4)===0,'wall pattern shifts per row');
 [2,3,4].forEach(n=>{const g=newGame(Array(n).fill('x'),{});A(g.factories.length===[0,0,5,7,9][n]&&g.bag.length===100-4*g.factories.length,n+' players: factories filled')});
 let g=newGame(['a','b'],{});g.factories[0]=[0,0,1,1];A(move(g,0,0,2)===true&&g.players[0].lines[2].k===2&&g.center.length===2&&g.turn===1,'draft moves rest to centre, passes turn');
 g=newGame(['a','b'],{});g.factories[0]=[0,0,0,0];move(g,0,0,0);A(g.players[0].floor.length===3,'overflow goes to floor');
 g=newGame(['a','b'],{});g.players[0].lines[1]={c:1,k:1};g.factories[0]=[0,0,0,0];A(typeof move(g,0,0,1)==='string','cannot mix colours in a line');
 g=newGame(['a','b'],{});g.players[0].wall[0][0]=true;g.factories[0]=[0,0,1,1];A(typeof move(g,0,0,0)==='string','cannot place a colour already on the wall row');
 g=newGame(['a','b'],{});g.factories=[[],[],[],[],[]];g.center=[1];g.players[0].floor=[1,1,1];g.players[0].score=2;move(g,'c',1,5);A(g.round===1||g.over||g.players[0].score===0,'score never below zero');
 g=newGame(['a'],{});g.players[0].wall=Array.from({length:5},()=>Array(5).fill(true));finish(g);A(g.players[0].score===95,'full wall bonuses = 5*2+5*7+5*10')}

/* ===== BOTS: noob = mostly random, enthusiast = greedy with mistakes, expert = scores wall bonuses and penalties ===== */
const penSum=(from,cnt)=>{let s=0;for(let j=from;j<Math.min(7,from+cnt);j++)s+=PEN[j];return s};
function botMove(g,level){const p=g.turn,P=g.players[p],o=[];
 for(const s of [...g.factories.keys(),'c']){const pool=s==='c'?g.center:g.factories[s];
  for(const c of new Set(pool)){const n=pool.filter(t=>t===c).length;
   for(let r=0;r<6;r++)if(canPlace(g,p,c,r)===true){const sp=r<5?r+1-P.lines[r].k:0;o.push({s,c,r,n,put:r<5?Math.min(sp,n):0,over:r<5?Math.max(0,n-sp):n,mk:s==='c'&&g.marker})}}}
 if(level==='noob'){const pool=o.filter(m=>m.r<5),use=pool.length&&Math.random()<.7?pool:o;return use[Math.random()*use.length|0]}
 const ex=level==='expert',sc=m=>{
  let v=-penSum(P.floor.length,(m.mk?1:0)+m.over)*(ex?1.3:1);
  if(m.r===5)return v-(ex?.5:0)+Math.random()*.05;
  const k=P.lines[m.r].k+m.put,size=m.r+1,col=wallPos(m.r,m.c);
  if(k===size){const w=P.wall.map(x=>x.slice());w[m.r][col]=true;v+=pts(w,m.r,col)*1.5;
   if(ex){let cs=0;for(let i=0;i<5;i++)if(w[i][wallPos(i,m.c)])cs++;v+=w[m.r].filter(Boolean).length*.8+w.filter(x=>x[col]).length*1.2+cs*.8}}
  else v+=(k/size)*2-(size-k)*.1;
  return v+m.put*.25+Math.random()*(ex?.05:1.2)};
 return o.map(m=>[sc(m),m]).sort((a,b)=>b[0]-a[0])[0][1]}

export{COL,SYM,NAMES,PEN,wallCol,wallPos,newGame,canPlace,pts,move,autoMove,botMove,runTests};
