/* Zvuky obchůzky z nahrávek (složka hra/zvuky/). Dokud tu žádné nahrávky nejsou, hra je tichá a tlačítko zvuku se neukáže.
   Hlasitost a strana podle vzdálenosti postavy od hráče. */
'use strict';
(()=>{
const H=window.__hra;if(!H)return;
/* názvy souborů ve složce zvuky/ – víc souborů = hra střídá varianty
   zvonce_chuze / zvonce_beh: smyčky zvonců čerta (hrají dokola, podle rychlosti)
   cert: vrčení u domu · prda · smrtka · konik · mikulas: hlášky */
const SOUBORY={zvonce_chuze:[],zvonce_beh:[],cert:[],prda:[],smrtka:[],konik:[],mikulas:[]};
const KEY='obchuzka-zvuk';
const any=Object.values(SOUBORY).some(l=>l.length);
const btn=document.getElementById('bSound');
if(!any){if(btn)btn.remove();return}
let on=(()=>{try{return localStorage.getItem(KEY)!=='0'}catch(e){return true}})();
let ctx=null,master=null;const FILE={};
async function loadFiles(){await Promise.all(Object.entries(SOUBORY).map(async([k,list])=>{const out=[];
  for(const f of list){try{const r=await fetch('zvuky/'+f);if(r.ok)out.push(await ctx.decodeAudioData(await r.arrayBuffer()))}catch(e){console.warn('Zvuk',f,e)}}if(out.length)FILE[k]=out}))}
const R=Math.random,pick=a=>a[Math.floor(R()*a.length)];

/* ---------- prostor: hlasitost a strana ---------- */
const _r=new THREE.Vector3();
function spatial(pos){const P=H.player;if(!P)return {g:0,pan:0};const d=Math.hypot(pos.x-P.pos.x,pos.z-P.pos.z);
  const g=d>70?0:1/(1+(d/7)**2),cam=H.camera;_r.setFromMatrixColumn(cam.matrixWorld,0);const dx=pos.x-cam.position.x,dz=pos.z-cam.position.z,l=Math.hypot(dx,dz)||1;
  return {g,pan:Math.max(-1,Math.min(1,(dx*_r.x+dz*_r.z)/l))*Math.min(1,d/4)}}
function chain(g0){const g=ctx.createGain();g.gain.value=g0;let last=g;let p=null;if(ctx.createStereoPanner){p=ctx.createStereoPanner();g.connect(p);last=p}last.connect(master);return {g,p}}
function shot(k,pos,vol){const f=FILE[k];if(!ctx||!on||!f)return false;const s=spatial(pos);if(s.g*vol<.01)return false;
  const src=ctx.createBufferSource();src.buffer=pick(f);src.playbackRate.value=.97+R()*.06;const c=chain(s.g*vol);if(c.p)c.p.pan.value=s.pan;src.connect(c.g);src.start();return true}
/* smyčky zvonců: každý čert má svoje, hlasitost podle chůze/běhu */
function loop(k){if(!FILE.zvonce_chuze&&!FILE.zvonce_beh)return null;const b=FILE[k]||FILE.zvonce_chuze||FILE.zvonce_beh;
  const src=ctx.createBufferSource();src.buffer=pick(b);src.loop=true;const c=chain(0);src.connect(c.g);src.start(0,R()*src.buffer.duration);return {src,...c}}
const T=new WeakMap();
function tm(e){let t=T.get(e);if(!t){t={say:2+R()*6,growl:1+R()*4,prd:8+R()*20,scare:0,walk:null,run:null,wv:0,rv:0};T.set(e,t)}return t}
let lastPhase=null,growlGap=0,liveEnts=[];
function stopLoops(){for(const e of liveEnts){const t=T.get(e);if(!t)continue;for(const l of[t.walk,t.run])if(l)try{l.src.stop()}catch(_){}t.walk=t.run=null}liveEnts=[]}
function update(dt){const st=H.state();if(!ctx)return;
  if(st!=='play'){if(ctx.state==='running')ctx.suspend();return}if(ctx.state==='suspended')ctx.resume();
  if(liveEnts!==H.ents){stopLoops();liveEnts=H.ents}
  const g=H.grp,visit=g.phase==='visit',arrived=visit&&lastPhase!=='visit';lastPhase=g.phase;growlGap-=dt;
  for(const e of H.ents){const t=tm(e),sp=e.spd||0,atHouse=visit&&!e.isPlayer&&e.st==='follow',scared=e.isPlayer&&e.scareT>t.scare+.01;t.scare=e.scareT||0;
    const shaking=(atHouse&&e.role!=='mikulas')||(e.isPlayer&&e.scareT>0);
    if(e.role==='cert'){
      if(!t.walk&&(FILE.zvonce_chuze||FILE.zvonce_beh)){t.walk=loop('zvonce_chuze');t.run=loop('zvonce_beh')}
      if(t.walk){const s=spatial(e.pos),wantR=e.running||shaking?1:0,wantW=!wantR&&sp>.3?1:0,k=Math.min(1,dt*6);t.wv+=(wantW-t.wv)*k;t.rv+=(wantR-t.rv)*k;
        const v=(e.isPlayer?.8:.55)*s.g;t.walk.g.gain.value=t.wv*v;t.run.g.gain.value=t.rv*v;if(t.walk.p){t.walk.p.pan.value=s.pan;t.run.p.pan.value=s.pan}}
      t.growl-=dt;if(scared||(atHouse&&t.growl<=0&&growlGap<=0)){shot('cert',e.pos,e.isPlayer?1:.8);t.growl=3+R()*5;growlGap=1.2}}
    else if(e.role==='prda'){t.prd-=dt;if(atHouse&&t.prd>8)t.prd=1+R()*2;
      if(scared||t.prd<=0){shot('prda',e.pos,1);t.prd=atHouse?5+R()*5:15+R()*25}}
    else if(e.role==='smrtka'){t.say-=dt;if(scared||(atHouse&&t.say<=0)){shot('smrtka',e.pos,1);t.say=5+R()*5}}
    else if(e.role==='konik'){t.say-=dt;if(scared||(atHouse&&t.say<=0)){shot('konik',e.pos,1);t.say=6+R()*5}}
    else if(e.role==='mikulas'){t.say-=dt;if(arrived)t.say=Math.min(t.say,.8);
      if(scared||t.say<=0){shot('mikulas',e.pos,1);t.say=visit?7+R()*4:9+R()*7}}}}

/* ---------- zapnutí (prohlížeč pustí zvuk až po kliknutí) a přepínač ---------- */
function unlock(){if(!ctx){const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;ctx=new AC();master=ctx.createGain();master.gain.value=on?1:0;
    const comp=ctx.createDynamicsCompressor();master.connect(comp);comp.connect(ctx.destination);loadFiles()}
  if(ctx.state==='suspended')ctx.resume()}
addEventListener('pointerdown',unlock,true);addEventListener('keydown',unlock,true);
function upd(){if(btn)btn.textContent=on?'Zvuk: zap':'Zvuk: vyp';if(master)master.gain.value=on?1:0}
if(btn)btn.onclick=()=>{on=!on;try{localStorage.setItem(KEY,on?'1':'0')}catch(e){}upd()};upd();
let last=performance.now();
(function frame(now){requestAnimationFrame(frame);const dt=Math.min(.05,(now-last)/1000);last=now;try{update(dt)}catch(e){console.warn(e)}})(last);
window.__zvuky={get ctx(){return ctx},FILE,update};
})();
