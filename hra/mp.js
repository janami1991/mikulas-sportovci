/* Mikulášská obchůzka – hra více hráčů (družina proti napalovačům řízeným počítačem).
   Server: Cloudflare Durable Object (mp_server/). Jeden z hráčů je „hostitel“ – jeho prohlížeč počítá
   napalovače, auta, postavy za chybějící hráče, čas a body; ostatní posílají jen svou polohu a akce.
   Když hostitel odejde nebo schová kartu, řízení převezme další hráč. */
'use strict';
(()=>{
const SERVER=new URLSearchParams(location.search).get('server')||'wss://mikulas-mp.janami1991.workers.dev';
const SEND_DT=.125;                 /* 8 zpráv za sekundu */
const IDLE_KICK=60, IDLE_WARN=45;   /* nečinnost ve hře (s) */
const ROLE_N={mikulas:'Mikuláš',cert:'Čert',konik:'Koník',smrtka:'Smrtka',prda:'Prďa'};
const LIMIT={mikulas:1,smrtka:1,konik:1,prda:1,cert:8};
const CODE_CH='ABCDEFGHJKLMNPRSTUVXYZ23456789';
const r2=v=>Math.round(v*100)/100, r1=v=>Math.round(v*10)/10;

let ws=null,code='',lobby=null,myRole='',myVar=+store('obchuzka-cert')||1,inGame=false,sendT=0,snapN=0,evQ=[],lastAct=performance.now(),joinT=0,boardT=0,lastSnap=null;
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const open=()=>ws&&ws.readyState===1;
const entBy=pid=>ents.find(e=>e.pid===pid);

/* ---------- NET pro hra.js ---------- */
NET.send=o=>{if(open())ws.send(JSON.stringify(o))};
NET.ev=e=>{if(NET.on&&NET.host)evQ.push(e)};
NET.endGame=reason=>{NET.send({t:'end',reason,board:NET.board});showEnd(reason)};
NET.leave=msg=>{const was=NET.on&&state==='play';disconnect();if(was)showEnd('left',msg);else showScreen('menu')};

/* ---------- obrazovky ---------- */
function showScreen(id){for(const s of['menu','mp','end'])$(s).classList.toggle('hide',s!==id);if(id!=='end')$('ui').classList.add('hide')}
function mpMsg(t){$('mpMsg').textContent=t||''}
/* červená hláška pod tlačítkem „Vyjít na stranu“ */
let errT=0;function mpErr(t,hl){const e=$('mpErr');e.textContent=t||'';e.classList.toggle('hide',!t);clearTimeout(errT);
  const c=$('mpChar');c.classList.remove('need');if(hl){void c.offsetWidth;c.classList.add('need');(t?e:c).scrollIntoView({block:'center',behavior:'smooth'})}
  if(t)errT=setTimeout(()=>{e.classList.add('hide');c.classList.remove('need')},4000)}
$('bMulti').onclick=()=>{showScreen('mp');renderMp()};
$('mpBack').onclick=()=>{disconnect();showScreen('menu')};
$('mpName').value=store('obchuzka-jmeno')||'';
const nameOk=()=>{const n=$('mpName').value.trim();if(!n){mpMsg('Napiš přezdívku.');$('mpName').focus();return null}store('obchuzka-jmeno',n);return n};
$('mpCreate').onclick=()=>{const n=nameOk();if(!n)return;let c='';for(let i=0;i<4;i++)c+=CODE_CH[Math.floor(Math.random()*CODE_CH.length)];connect(c,n)};
$('mpJoinB').onclick=()=>{const n=nameOk();if(!n)return;const c=$('mpCode').value.trim().toUpperCase().replace(/[^A-Z0-9]/g,'');if(c.length<3){mpMsg('Zadej kód místnosti.');return}connect(c,n)};
$('mpCode').addEventListener('keydown',e=>{if(e.key==='Enter')$('mpJoinB').click()});
$('mpCopy').onclick=()=>{const u=location.origin+location.pathname+'?mistnost='+code;
  (navigator.clipboard?navigator.clipboard.writeText(u):Promise.reject()).then(()=>mpMsg('Odkaz zkopírován – pošli ho ostatním.'),()=>mpMsg('Odkaz: '+u))};
$('mpStart').onclick=()=>{if(!lobby)return;
  if(!myRole){mpErr('Vyber si postavu.',1);return}
  if(lobby.hraje){joinT=performance.now();NET.send({t:'join',to:lobby.host});mpMsg('Připojuji do rozehrané hry…');return}
  if(lobby.host===NET.me)hostStart()};
/* po konci hry: „Hrát znovu“ vrátí do místnosti, když je spojení otevřené */
{const sp=$('bAgain').onclick;$('bAgain').onclick=()=>{if(open()){showScreen('mp');renderMp()}else sp()}}
$('bMenu').onclick=()=>{disconnect();showScreen('menu')};
const urlRoom=new URLSearchParams(location.search).get('mistnost');
if(urlRoom){$('mpCode').value=urlRoom.toUpperCase();showScreen('mp');renderMp()}

/* ---------- spojení ---------- */
function connect(c,name){disconnect();code=c;mpMsg('Připojuji…');
  try{ws=new WebSocket(`${SERVER}/mistnost/${encodeURIComponent(c)}?jmeno=${encodeURIComponent(name)}`)}catch(e){mpMsg('Server není dostupný.');return}
  const me=ws;
  ws.onmessage=e=>{if(ws!==me)return;let m;try{m=JSON.parse(e.data)}catch(_){return}onMsg(m)};
  ws.onclose=()=>{if(ws!==me)return;ws=null;const was=NET.on&&state==='play';NET.on=false;inGame=false;lobby=null;
    if(was)showEnd('left','Spojení se serverem se přerušilo.');else{mpMsg(mpFull?'Místnost je plná – můžeš hrát sám (Zpět → Hrát sám).':'Spojení se serverem se přerušilo.');renderMp()}mpFull=false};
  ws.onerror=()=>{if(ws===me)mpMsg('Server není dostupný.')}}
let mpFull=false;
function disconnect(){if(ws){const w=ws;ws=null;try{w.close()}catch(e){}}NET.on=false;inGame=false;lobby=null;myRole='';hideTags()}

function onMsg(m){
  switch(m.t){
  case 'ahoj':NET.me=m.id;mpMsg('');break;
  case 'plno':mpFull=true;break;
  case 'chyba':mpErr(m.m,1);myRole=(lobby&&(lobby.hraci.find(p=>p.id===NET.me)||{}).r)||'';renderMp();break;
  case 'lobby':onLobby(m);break;
  case 'go':if(myRole&&m.team.some(t=>t.pid===NET.me))startNet(m.team,m.board);break;
  case 'team':if(inGame)syncTeam(m.team,m.board);else if(m.team.some(t=>t.pid===NET.me))startNet(m.team,m.board);break;
  case 'end':if(inGame)showEnd(m.reason,null,m.board);break;
  case 'p':onPlayer(m);break;
  case 's':if(inGame&&!NET.host)applySnap(m);break;
  case 'pts':onPts(m);break;
  case 'hit':if(inGame&&NET.host){const e=entBy(m.from);if(!e)break;const R=ROLE[e.role];
    for(const i of m.k||[]){const k=kids[i];if(k&&k.st!=='down'&&!(k.gone>0)&&Math.hypot(k.pos.x-e.pos.x,k.pos.z-e.pos.z)<R.dosah+2.5)hitKid(e,k)}}break;
  case 'scare':if(inGame&&NET.host){const e=entBy(m.from);if(e)doScare(e)}break;
  case 'join':if(inGame&&NET.host)hostJoin(m.from);break;
  }}

/* ---------- místnost (výběr postavy) ---------- */
function onLobby(m){const wasHost=NET.host;lobby=m;
  const mine=m.hraci.find(p=>p.id===NET.me);if(mine&&!inGame){myRole=mine.r}
  NET.host=m.host===NET.me;
  if(inGame&&state==='play'){if(NET.host&&!wasHost)becomeHost();if(NET.host)reconcile()}
  renderMp()}
function renderMp(){const on=!!lobby;$('mpJoin').classList.toggle('hide',on);$('mpRoom').classList.toggle('hide',!on);if(!on)return;
  $('mpRoomCode').textContent=code;
  $('mpList').innerHTML=lobby.hraci.map(p=>`<span>${esc(p.n)}${p.id===NET.me?' (ty)':''}${p.id===lobby.host?' ★':''}</span><b>${p.r?ROLE_N[p.r]:'vybírá…'}</b>`).join('');
  const taken={};for(const p of lobby.hraci)if(p.r&&p.id!==NET.me)taken[p.r]=(taken[p.r]||0)+1;
  const total=lobby.hraci.filter(p=>p.r&&p.id!==NET.me).length;
  const list=POSTAVY.filter(o=>o.id in LIMIT).map(o=>{const left=LIMIT[o.id]-(taken[o.id]||0),off=(left<=0||total>=12)&&myRole!==o.id;
    return {id:o.id,n:o.n,d:off?'obsazeno':o.id==='cert'?`volno ${left}×`:o.d,off:off?1:0}});
  const lock=inGame;
  opts($('mpChar'),list,myRole,v=>{if(lock)return;myRole=v;mpErr('');NET.send({t:'role',r:v,v:myVar});$('mpVarW').classList.toggle('hide',v!=='cert')},o=>o.id+':'+(o.id==='cert'?myVar:1),
    v=>mpErr(total>=12?'Hra je plná (12 hráčů).':(v==='cert'?'Všichni čerti jsou obsazení.':(ROLE_N[v]||'Postava')+' je už obsazen'+(v==='smrtka'?'á.':'ý.'))+' Vyber si jinou postavu.'));
  opts($('mpVar'),VARIANTY,myVar,v=>{myVar=+v;store('obchuzka-cert',myVar);if(myRole==='cert')NET.send({t:'role',r:'cert',v:myVar});const im=$('mpChar').querySelector('[data-id=cert] img');if(im)im.src=thumbs('cert:'+myVar)},o=>'cert:'+o.id+':h');
  $('mpVarW').classList.toggle('hide',myRole!=='cert');fillThumbs($('mpChar'));fillThumbs($('mpVar'));
  const host=lobby.host===NET.me,n=lobby.hraci.filter(p=>p.r).length;
  if(lobby.hraje){$('mpStart').classList.remove('hide');$('mpStart').textContent='Připojit se do rozehrané hry';$('mpInfo').textContent='Hra už běží – vyber volnou postavu a připoj se.'}
  else if(host){$('mpStart').classList.remove('hide');$('mpStart').textContent=`Vyjít na stranu (${n} ${n===1?'hráč':n<5?'hráči':'hráčů'})`;
    $('mpInfo').textContent='Ty hru zakládáš (★). Chybějící Mikuláše, Smrtku, Koníka, Prďu a čerty doplní počítač.'}
  else{$('mpStart').classList.add('hide');$('mpInfo').textContent='Čeká se, až zakladatel (★) vyjde na stranu.'}}

/* ---------- start hry ---------- */
function hostStart(){const ps=lobby.hraci.filter(p=>p.r),team=[],s=M.start||[0,0];
  const pick=r=>ps.filter(p=>p.r===r);const add=(r,p,v)=>team.push({r,v:p?p.v:v,pid:p?p.id:null,n:p?p.n:''});
  add('mikulas',pick('mikulas')[0],1);
  const hc=pick('cert'),nC=Math.max(5,hc.length),freeV=[1,2,3,4,5].filter(v=>!hc.some(p=>p.v===v));let fi=0;
  for(let i=0;i<nC;i++)add('cert',hc[i],freeV.length?freeV[fi++%freeV.length]:1+i%5);
  for(const r of['konik','smrtka','prda'])add(r,pick(r)[0],1);
  team.forEach((t,i)=>{const a=i/team.length*Math.PI*2,p=new THREE.Vector3(s[0]+Math.cos(a)*2.5,0,s[1]+Math.sin(a)*2.5);pushOut(p,.45);t.x=r2(p.x);t.z=r2(p.z);t.f=r2(Math.PI)});
  const board={};for(const t of team)if(t.pid)board[t.pid]=newRow(t);
  NET.send({t:'go',team,board});startNet(team,board)}
const newRow=t=>({n:t.n,r:t.r,score:0,houses:0,caught:0,scareP:0,penalty:0});
function startNet(team,board){NET.on=true;inGame=true;NET.host=!!lobby&&lobby.host===NET.me;NET.board=board||{};evQ=[];sendT=0;snapN=0;lastSnap=null;lastAct=performance.now();
  resetGame(team);for(const e of ents)if(e.tx===undefined){e.tx=e.pos.x;e.tz=e.pos.z;e.tf=e.face}
  const b=NET.board[NET.me];if(b)myStats(b);
  state='play';navNear=false;setMapBig(false);showScreen('none');$('ui').classList.remove('hide');$('touch').classList.toggle('hide',!isTouch);
  $('bPause').classList.add('hide');$('bEnd').textContent='Odejít ze hry';boardT=0;renderBoard();
  toast(player.role==='mikulas'?'Jsi Mikuláš – veď družinu k domům se žlutým světlem.':'Drž se družiny u domů a chytej napalovače! Body sbíráš sám za sebe.',3500);last=performance.now();
  if(isTouch&&document.documentElement.requestFullscreen)document.documentElement.requestFullscreen().catch(()=>{})}

/* ---------- hostitel: příchody a odchody hráčů ---------- */
function replaceMesh(e,r,v){scene.remove(e.mesh);e.mesh=makeRole(r,v);scene.add(e.mesh);e.role=r;e.v=v;e.topH=undefined}
function teamMsg(){return ents.map(e=>({r:e.role,v:e.v,pid:e.pid,n:e.name,x:r2(e.pos.x),z:r2(e.pos.z),f:r2(e.face)}))}
function sendTeam(){NET.send({t:'team',team:teamMsg(),board:NET.board});renderBoard()}
function hostJoin(pid){if(entBy(pid))return sendTeam();const p=lobby&&lobby.hraci.find(x=>x.id===pid);if(!p||!p.r)return;
  let e=ents.find(x=>!x.human&&x.role===p.r);
  if(!e){const L=leader(),[x,z]=spawnPoint(L.pos.x,L.pos.z,2,5);e=newEnt(p.r,false,ents.length,p.v);e.pos.set(x,0,z);ents.push(e)}
  else if(e.v!==p.v)replaceMesh(e,p.r,p.v);
  e.human=true;e.pid=pid;e.name=p.n;e.tx=e.pos.x;e.tz=e.pos.z;e.tf=e.face;e.st='follow';
  NET.board[pid]=NET.board[pid]||newRow({n:p.n,r:p.r});toast(`${p.n} se připojil(a) jako ${ROLE_N[p.r]}`,2000);sendTeam()}
function reconcile(){if(!lobby)return;const ids=new Set(lobby.hraci.map(p=>p.id));let ch=false;
  for(const e of ents)if(e.human&&!ids.has(e.pid)){const b=NET.board[e.pid];if(b)b.left=1;toast(`${e.name||'Hráč'} odešel – postavu převzal počítač`,2000);
    e.human=false;e.pid=null;e.name='';e.st='return';e.target=null;e.chaseCd=rnd(2,5);ch=true}
  if(ch)sendTeam()}
function syncTeam(team,board){if(board)NET.board=board;
  team.forEach((t,i)=>{let e=ents[i];if(!e){e=addEnt(t,i);e.tx=e.pos.x;e.tz=e.pos.z;e.tf=e.face;return}
    if(e.role!==t.r||e.v!==t.v)replaceMesh(e,t.r,t.v);e.human=t.pid!=null;e.pid=t.pid;e.name=t.n||'';
    const isP=t.pid===NET.me;if(isP&&!e.isPlayer){e.isPlayer=true;player=e}else if(!isP)e.isPlayer=false});
  const b=NET.board[NET.me];if(b)myStats(b);renderBoard()}
/* převzetí řízení: napalovači, postavy počítače a čas pokračují z posledního stavu */
function becomeHost(){
  for(const k of kids){const c=k.code||0;k.st=c===2?'down':c===1?'flee':'roam';k.t=c===2?3:rnd(1,3);k.gone=c===3?2:0;k.stamina=100;k.throwCd=rnd(2,5);k.hp=1;k.freeze=0;k.turn=0;k.turnT=0;
    if(c!==2){k.mesh.rotation.set(0,k.face,0);k.star.visible=false}}
  for(const e of ents){if(e.human)continue;e.st='return';e.target=null;e.chaseCd=rnd(2,5);e.attack=0}
  for(const c of cars)scene.remove(c.mesh);cars=[];carT=rnd(3,8);
  const o=route[ri];if(o){grp.house=o.b;grp.door=o.d;if(grp.phase==='walk')planTo(ri)}
  toast('Hru teď řídí tvůj počítač (původní hostitel odešel)',2200)}

/* ---------- stav hráčů ---------- */
function setTarget(e,a){e.tx=a[0];e.tz=a[1];e.tf=a[2];e.tspd=a[3];e.running=!!a[4];
  if(a[5]>e.atkN){attack(e);e.atkN=a[5]}if(a[6]>e.scN){e.scareT=1.2;e.scN=a[6]}}
function onPlayer(m){if(!inGame)return;const e=entBy(m.from);if(!e||e.isPlayer)return;setTarget(e,[m.x,m.z,m.f,m.s,m.r,m.a,m.c])}
function myState(){const P=player;return [r2(P.pos.x),r2(P.pos.z),r2(P.face),r1(P.spd||0),P.running?1:0,P.atkN,P.scN]}
function onPts(m){const b=m.b;if(b)NET.board[m.pid]=b;if(m.pid===NET.me){if(b)myStats(b);if(m.m)toast(m.m,m.ms||1500)}renderBoard()}

/* ---------- snímek stavu od hostitele ---------- */
const ST=['follow','chase','hold','return'];
function buildSnap(){const s={t:'s',tm:r1(timeLeft),ri,ph:grp.phase==='visit'?1:0,gt:r1(grp.t),me:myState(),
    e:ents.map(e=>e.human?0:[r2(e.pos.x),r2(e.pos.z),r2(e.face),r1(e.spd||0),e.running?1:0,e.atkN,0,Math.max(0,ST.indexOf(e.st))]),
    k:kids.map(k=>[r2(k.pos.x),r2(k.pos.z),r2(k.face),k.gone>0?3:k.st==='down'?2:k.st==='flee'?1:0]),
    c:cars.map(c=>{if(!c.id)c.id=++carSeq;return [c.id,r2(c.pos.x),r2(c.pos.z),r2(c.face),r1(c.spd)]})};
  if(evQ.length){s.ev=evQ;evQ=[]}if(snapN++%16===0)s.b=NET.board;return s}
let carSeq=0;
function applySnap(m){lastSnap=m;joinT=0;timeLeft=m.tm;m.ri=Math.min(m.ri,route.length-1);
  if(m.ri!==ri){for(let i=ri;i<m.ri&&i<route.length;i++)route[i].with=i===m.ri-1&&Math.hypot(player.pos.x-route[i].b.cx,player.pos.z-route[i].b.cz)<18;ri=m.ri;updMarks()}
  grp.phase=m.ph?'visit':'walk';grp.t=m.gt;const o=route[ri];if(o){grp.house=o.b;grp.door=o.d}
  const H=entBy(m.from);if(H&&!H.isPlayer)setTarget(H,m.me);
  m.e.forEach((a,i)=>{const e=ents[i];if(!a||!e||e.human)return;setTarget(e,a);e.st=ST[a[7]]||'follow'});
  while(kids.length<m.k.length){const k=newKid(kids.length);kids.push(k)}
  while(kids.length>m.k.length){const k=kids.pop();scene.remove(k.mesh);scene.remove(k.star);k.bub.remove()}
  m.k.forEach((a,i)=>{const k=kids[i];if(k.tx===undefined){k.pos.x=a[0];k.pos.z=a[1]}k.tx=a[0];k.tz=a[1];k.tf=a[2];if(k.code!==a[3]){if(a[3]===2)k.t=0;k.code=a[3]}});
  const seen=new Set();
  for(const a of m.c){seen.add(a[0]);let c=cars.find(x=>x.id===a[0]);if(!c){const mesh=makeCar();scene.add(mesh);c={id:a[0],mesh,pos:new THREE.Vector3(a[1],0,a[2]),face:a[3],spd:a[4],honk:0};cars.push(c)}c.tx=a[1];c.tz=a[2];c.tf=a[3];c.spd=a[4]}
  for(let i=cars.length-1;i>=0;i--)if(!seen.has(cars[i].id)){scene.remove(cars[i].mesh);cars.splice(i,1)}
  for(const ev of m.ev||[]){
    if(ev[0]==='s'){const k=kids[ev[1]];if(k)say(k,ev[2],ev[3]||undefined)}
    else if(ev[0]==='b')addBall(ev[1],ev[2],ev[3],ev[4],ev[5],ev[6]);
    else if(ev[0]==='z'){const r=route[ev[1]];if(r)toast(`Zastávka: ${r.b.adr||'dům '+(ev[1]+1)}`,1400)}}
  if(m.b){NET.board=m.b;const b=m.b[NET.me];if(b)myStats(b);renderBoard()}}

/* ---------- každý snímek (volá hra.js) ---------- */
const lerpA=(a,b,k)=>{let d=b-a;d=Math.atan2(Math.sin(d),Math.cos(d));return a+d*k};
window.netLocal=function(dt){
  const k=Math.min(1,dt*10);
  for(const e of ents){if(e.isPlayer||e.tx===undefined||(NET.host&&!e.human))continue;
    const ox=e.pos.x,oz=e.pos.z;if(Math.hypot(e.tx-ox,e.tz-oz)>10){e.pos.x=e.tx;e.pos.z=e.tz}else{e.pos.x+=(e.tx-ox)*k;e.pos.z+=(e.tz-oz)*k}
    e.face=lerpA(e.face,e.tf,k);const mv=Math.hypot(e.pos.x-ox,e.pos.z-oz);e.phase+=mv*2.4;e.spd=e.tspd!==undefined?e.tspd:mv/Math.max(dt,1e-3)}
  const now=performance.now();if(now-sendT>=SEND_DT*1000&&open()){sendT=now;if(NET.host)NET.send(buildSnap());else{const s=myState();NET.send({t:'p',x:s[0],z:s[1],f:s[2],s:s[3],r:s[4],a:s[5],c:s[6]})}}
  if(!NET.host&&lastSnap===null&&joinT&&performance.now()-joinT>3000){joinT=performance.now();NET.send({t:'join',to:lobby&&lobby.host})}
  tags()};
/* napalovač u ostatních hráčů: jen plynule přejde na polohu od hostitele */
window.viewKid=function(k,dt){const c=k.code||0;
  if(c===3){k.mesh.visible=false;k.star.visible=false;k.bub.classList.add('hide');return}k.mesh.visible=true;
  const ox=k.pos.x,oz=k.pos.z;if(k.tx!==undefined){const a=Math.min(1,dt*10);if(Math.hypot(k.tx-ox,k.tz-oz)>8){k.pos.x=k.tx;k.pos.z=k.tz}else{k.pos.x+=(k.tx-ox)*a;k.pos.z+=(k.tz-oz)*a}k.face=lerpA(k.face,k.tf,a)}
  k.pos.y=groundH(k.pos.x,k.pos.z)+.08;const spd=Math.hypot(k.pos.x-ox,k.pos.z-oz)/Math.max(dt,1e-3);k.phase+=dt*spd*2.8;
  if(c===2){k.t+=dt;const u=k.mesh.userData,kk=Math.sin(k.t*16);k.mesh.position.copy(k.pos);k.mesh.position.y=k.pos.y+.22;k.mesh.rotation.set(-Math.PI/2,k.face,0,'YXZ');
    u.legL.rotation.x=kk*.8;u.legR.rotation.x=-kk*.8;u.armL.rotation.x=Math.sin(k.t*11)*1.2-1.5;u.armR.rotation.x=-Math.sin(k.t*11)*1.2-1.5;
    k.star.visible=true;k.star.position.set(k.pos.x+Math.cos(k.t*6)*.45,k.pos.y+.8,k.pos.z+Math.sin(k.t*6)*.45)}
  else{k.star.visible=false;k.mesh.position.copy(k.pos);k.mesh.rotation.set(0,k.face,0);animWalk(k.mesh,k.phase,spd>0.1?Math.min(1,spd/5)*.9:0)}
  if(k.bubT>0){k.bubT-=dt*1000;if(k.bubT<=0)k.bub.classList.add('hide')}};
/* auta u ostatních hráčů: poloha od hostitele; troubí a odsune jen vlastního hráče */
window.viewCars=function(dt){const P=player,a=Math.min(1,dt*8);
  for(const c of cars){if(c.tx!==undefined){if(Math.hypot(c.tx-c.pos.x,c.tz-c.pos.z)>12){c.pos.x=c.tx;c.pos.z=c.tz}else{c.pos.x+=(c.tx-c.pos.x)*a;c.pos.z+=(c.tz-c.pos.z)*a}c.face=lerpA(c.face,c.tf,a)}
    const fx=Math.sin(c.face),fz=Math.cos(c.face);c.pos.y=groundH(c.pos.x,c.pos.z)+.08;c.mesh.position.copy(c.pos);
    const hf=groundH(c.pos.x+fx*1.4,c.pos.z+fz*1.4),hb=groundH(c.pos.x-fx*1.4,c.pos.z-fz*1.4);c.mesh.rotation.set(-Math.atan2(hf-hb,2.8),c.face,0,'YXZ');c.mesh.userData.wheels.forEach(w=>w.rotation.x+=c.spd*dt/.34);
    const ox=P.pos.x-c.pos.x,oz=P.pos.z-c.pos.z,ahead=ox*fx+oz*fz,side=Math.abs(ox*fz-oz*fx);c.honk=(c.honk||0)-dt;
    if(ahead>0&&ahead<10&&side<2.2&&c.honk<=0){c.honk=4;toast('Túúút! Pozor, auto!',1200)}
    const lz=ahead,lx=ox*fz-oz*fx;if(Math.abs(lz)<2.6&&Math.abs(lx)<1.3){const push=(1.4-Math.abs(lx))*(lx<0?-1:1);P.pos.x+=fz*push;P.pos.z-=fx*push}}};

/* ---------- jmenovky ostatních hráčů ---------- */
const tagV=new THREE.Vector3(),TAGS=new Map();
function tags(){const live=new Set();
  for(const e of ents){if(!e.human||e.isPlayer)continue;live.add(e);let t=TAGS.get(e);if(!t){t=document.createElement('div');t.className='tag';$('bubbles').appendChild(t);TAGS.set(e,t)}
    t.textContent=e.name;tagV.set(e.pos.x,e.pos.y+2.45,e.pos.z).project(camera);
    if(tagV.z>1||Math.abs(tagV.x)>1.1||Math.abs(tagV.y)>1.1||Math.hypot(e.pos.x-player.pos.x,e.pos.z-player.pos.z)>45){t.style.display='none';continue}
    t.style.display='';t.style.left=((tagV.x+1)/2*innerWidth)+'px';t.style.top=((1-tagV.y)/2*innerHeight)+'px'}
  for(const[e,t]of TAGS)if(!live.has(e)||!ents.includes(e)){t.remove();TAGS.delete(e)}}
function hideTags(){for(const t of TAGS.values())t.remove();TAGS.clear()}

/* ---------- tabulka bodů ---------- */
function rows(board){return Object.entries(board||{}).map(([id,b])=>({id,...b})).sort((a,b)=>b.score-a.score)}
function renderBoard(){const now=performance.now();if(now-boardT<300){clearTimeout(renderBoard.t);renderBoard.t=setTimeout(renderBoard,320);return}boardT=now;
  /* žebříček: nejlepší nahoře; klik / Tab = zmenšit jen na moje pořadí; víc než 5 hráčů = prvních 5 + já */
  const rs=rows(NET.board),el=$('board'),mini=!!store('obchuzka-board-mini'),mi=rs.findIndex(r=>r.id===NET.me);
  el.classList.toggle('hide',rs.length<2);el.classList.toggle('mini',mini);
  const row=(r,i)=>`<div class="${r.id===NET.me?'me':''}${r.left?' left':''}${i===0&&r.score>0?' top':''}"><span>${i+1}. ${esc(r.n)}</span><b>${r.score}</b></div>`;
  if(mini){el.innerHTML=mi<0?'':`<div class="me"><span>${mi===0?'🏆 ':''}${mi+1}. z ${rs.length}</span><b>${rs[mi].score}</b></div>`;return}
  const show=rs.map((r,i)=>[r,i]).filter(([r,i])=>i<5||r.id===NET.me);
  el.innerHTML='<h4>Pořadí <small>▲</small></h4>'+show.map(([r,i],k)=>(k&&i!==show[k-1][1]+1?'<div class="gap">…</div>':'')+row(r,i)).join('')}
$('board').addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();store('obchuzka-board-mini',!store('obchuzka-board-mini'));boardT=0;renderBoard()});
addEventListener('keydown',e=>{if(e.key==='Tab'&&inGame){e.preventDefault();store('obchuzka-board-mini',!store('obchuzka-board-mini'));boardT=0;renderBoard()}});
function showEnd(reason,msg,board){if(board)NET.board=board;const b=NET.board[NET.me];if(b)myStats(b);
  inGame=false;NET.on=false;hideTags();navArrow.visible=false;setMapBig(false);keys.clear();state='end';
  for(const k of kids)k.bub.classList.add('hide');
  $('ui').classList.add('hide');$('end').classList.remove('hide');$('bPause').classList.remove('hide');$('bEnd').textContent='Ukončit obchůzku';$('board').classList.add('hide');
  $('endT').textContent=msg||(reason==='done'?'Strana obejitá!':reason==='time'?'Čas vypršel':'Obchůzka skončila');
  const rs=rows(NET.board);
  $('endRes').innerHTML=rs.map((r,i)=>`<span class="${r.id===NET.me?'me':''}">${i+1}. ${esc(r.n)} · ${ROLE_N[r.r]||''}${r.left?' (odešel)':''}</span><b class="${r.id===NET.me?'me':''}">${r.score}</b>`).join('')+
    (b?`<span class="tot">Tvoje body: domy ${b.houses} · strašení ${b.scareP} · chycení ${b.caught}${b.penalty?` · pokuta −${b.penalty}`:''}</span><b class="tot">${b.score}</b>`:'');
  $('endBest').textContent='';$('bMenu').classList.remove('hide');$('bAgain').textContent=open()?'Zpět do místnosti':'Hrát znovu'}

/* ---------- nečinnost a skrytá karta ---------- */
const act=()=>{lastAct=performance.now()};
for(const ev of['keydown','pointerdown','wheel','touchstart'])addEventListener(ev,act,{capture:true,passive:true});
addEventListener('pointermove',e=>{if(e.buttons)act()},{capture:true,passive:true});
setInterval(()=>{if(!(NET.on&&inGame&&state==='play'))return;const idle=(performance.now()-lastAct)/1000;
  if(idle>=IDLE_KICK){NET.leave('Byl jsi odpojen kvůli nečinnosti (60 s).');return}
  if(idle>=IDLE_WARN)toast(`Nečinnost – za ${Math.ceil(IDLE_KICK-idle)} s tě hra odpojí`,1100)},1000);
document.addEventListener('visibilitychange',()=>{if(open())NET.send({t:'vis',away:document.hidden?1:0})});

window.__mp={renderBoard:()=>{boardT=0;renderBoard()},get lobby(){return lobby},get code(){return code},connect,hostStart,get ws(){return ws},setRole:(r,v)=>{myRole=r;if(v)myVar=v;NET.send({t:'role',r,v:myVar})},act};
})();
