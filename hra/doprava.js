/* Mikulášská obchůzka – DOPRAVA: hlavní silnice (auta, nákladní auta, autobusy oběma směry) a parní vlak na železnici.
   Načítá se po hra.js (sdílí jeho proměnné). Hlavní silnice = cesty typu primary, železnice = M.rail (vybere se nejdelší souvislá trasa v rámci mapy).
   – vozidla na silnici jen projedou (od kraje mapy ke kraji); kvůli družině zastaví (vzniká kolona), napalovače srazí (odletí ~20 m, −10)
   – vlak projede ~10× za hru, srazí kohokoli (odletí ~20 m, −10)
   – nehratelné postavy (napalovači a družina počítače) se vozidlům vyhýbají
   Počítá hostitel (jeden hráč = vždy), ostatní dostávají polohy ve snímku (dp). Srážku vlastního hráče hlídá každý prohlížeč sám. */
'use strict';
const DPC={lane:1.7,spawn:[7,13],maxVeh:20,carV:13.5,truckV:11,busV:11.5,trainV:16,trainN:10,fly:{h:9.5,vy:8},bodySraz:10};
const DP={rd:null,rl:null,veh:[],vid:0,spT:[2,4],train:null,trT:0,trDir:1,trN:0,smoke:[],pool:{0:[],1:[],2:[]}};

/* ---------- trasa: nejdelší souvislý řetěz úseků, převzorkovaný po 2 m a oříznutý na mapu ---------- */
function dpChain(segs){
  const S=segs.filter(p=>p&&p.length>1).map(p=>p.map(q=>[q[0],q[1]]));if(!S.length)return null;
  const ang=(ax,az,bx,bz)=>{const la=Math.hypot(ax,az)||1,lb=Math.hypot(bx,bz)||1;return Math.acos(clamp((ax*bx+az*bz)/la/lb,-1,1))};
  function grow(seed){const used=new Set([seed]);let ch=S[seed].slice();
    for(let side=0;side<2;side++){
      for(;;){const e=ch[ch.length-1],pe=ch[ch.length-2];let bi=-1,bs=1e9,br=false;
        S.forEach((s,i)=>{if(used.has(i))return;for(const r of[false,true]){const a=r?s[s.length-1]:s[0],b=r?s[s.length-2]:s[1];const d=Math.hypot(a[0]-e[0],a[1]-e[1]);if(d>3)continue;
          const t=ang(e[0]-pe[0],e[1]-pe[1],b[0]-a[0],b[1]-a[1]);if(t>1.05)continue;const sc=d+t*6;if(sc<bs){bs=sc;bi=i;br=r}}});
        if(bi<0)break;used.add(bi);const s=br?S[bi].slice().reverse():S[bi];ch=ch.concat(s.slice(1))}
      ch.reverse()}
    return ch}
  let best=null,bl=0;
  for(let i=0;i<S.length;i++){const c=grow(i);let l=0;for(let k=1;k<c.length;k++)l+=Math.hypot(c[k][0]-c[k-1][0],c[k][1]-c[k-1][1]);if(l>bl){bl=l;best=c}}
  /* převzorkovat po 2 m */
  const X=[],Z=[];let acc=0;X.push(best[0][0]);Z.push(best[0][1]);
  for(let k=1;k<best.length;k++){const[ax,az]=best[k-1],[bx,bz]=best[k];const d=Math.hypot(bx-ax,bz-az);let t=2-acc;
    while(t<=d){X.push(ax+(bx-ax)*t/d);Z.push(az+(bz-az)*t/d);t+=2}acc=d-(t-2)}
  /* jen nejdelší souvislý kus uvnitř mapy (terénu) */
  const bx=M.box,inb=i=>X[i]>bx[0]+4&&X[i]<bx[2]-4&&Z[i]>bx[1]+4&&Z[i]<bx[3]-4;let a0=-1,a1=-1,c0=-1;
  for(let i=0;i<=X.length;i++){if(i<X.length&&inb(i)){if(c0<0)c0=i}else if(c0>=0){if(i-c0>a1-a0){a0=c0;a1=i}c0=-1}}
  if(a0<0||a1-a0<40)return null;
  const P={x:X.slice(a0,a1),z:Z.slice(a0,a1)};P.n=P.x.length;P.L=(P.n-1)*2;
  P.x0=Math.min(...P.x)-8;P.x1=Math.max(...P.x)+8;P.z0=Math.min(...P.z)-8;P.z1=Math.max(...P.z)+8;return P}
/* bod a směr ve vzdálenosti s (mimo konce prodlouží rovně) */
function dpAt(P,s){const f=s/2;let i=Math.floor(f);i=clamp(i,0,P.n-2);const u=f-i,x=P.x[i]+(P.x[i+1]-P.x[i])*u,z=P.z[i]+(P.z[i+1]-P.z[i])*u;
  let tx=P.x[i+1]-P.x[i],tz=P.z[i+1]-P.z[i];const l=Math.hypot(tx,tz)||1;return {x,z,tx:tx/l,tz:tz/l}}
/* průmět bodu: s podél trasy, lat = vzdálenost do strany (+ = vpravo ve směru trasy), nx,nz = směr „vpravo“ */
function dpProj(P,x,z){if(!P||x<P.x0||x>P.x1||z<P.z0||z>P.z1)return null;let bi=-1,bd=1e9;
  for(let i=0;i<P.n;i+=2){const d=(P.x[i]-x)**2+(P.z[i]-z)**2;if(d<bd){bd=d;bi=i}}
  for(let i=Math.max(0,bi-2);i<=Math.min(P.n-1,bi+2);i++){const d=(P.x[i]-x)**2+(P.z[i]-z)**2;if(d<bd){bd=d;bi=i}}
  if(bd>60*60)return null;const i=clamp(bi,0,P.n-2),a=dpAt(P,i*2),dx=x-a.x,dz=z-a.z;
  return {s:i*2+dx*a.tx+dz*a.tz,lat:dx*-a.tz+dz*a.tx,nx:-a.tz,nz:a.tx}}

/* ---------- modely ---------- */
const DPM=(()=>{const m={};const L=c=>new THREE.MeshLambertMaterial({color:c}),B=c=>new THREE.MeshBasicMaterial({color:c});
  m.blk=L(0x111111);m.dk=L(0x2a2a2a);m.snow=L(0xf3f6fb);m.glass=new THREE.MeshStandardMaterial({color:0x141c28,metalness:.8,roughness:.15});
  m.win=B(0xe9c98a);m.red=L(0x8b1a1a);m.lamp=B(0xfdfbf0);m.tail=B(0xff2a2a);m.steel=L(0x6b6f75);m.wood=L(0x4a3528);
  m.wheel=new THREE.CylinderGeometry(.5,.5,.32,14);m.wheel.rotateZ(Math.PI/2);m.wheelT=new THREE.CylinderGeometry(.45,.45,.14,14);m.wheelT.rotateZ(Math.PI/2);
  m.wheelL=new THREE.CylinderGeometry(.8,.8,.14,18);m.wheelL.rotateZ(Math.PI/2);return m})();
function dpBox(g,w,h,d,mat,x,y,z){const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);o.position.set(x,y,z);g.add(o);return o}
function dpGlow(g,x,y,z,s,c){const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:GLOW,color:c||0xfff3d0,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false}));sp.scale.set(s,s,1);sp.position.set(x,y,z);g.add(sp)}
function dpLights(g,w,y,zf,zb){for(const x of[-w/2+.35,w/2-.35]){dpBox(g,.4,.14,.06,DPM.lamp,x,y,zf);dpGlow(g,x,y,zf+.12,1.8);dpBox(g,.36,.12,.06,DPM.tail,x,y+.1,zb)}
  const pg=new THREE.PlaneGeometry(5.5,12);pg.rotateX(-Math.PI/2);const pool=new THREE.Mesh(pg,new THREE.MeshBasicMaterial({map:GLOW,color:0xfff0c8,transparent:true,opacity:.65,blending:THREE.AdditiveBlending,depthWrite:false}));pool.position.set(0,.06,zf+6.5);g.add(pool)}
const TRUCK_C=[0xb71c1c,0x1e3a8a,0xe0e0e0,0x2e7d32,0xf59e0b],BOX_C=[0xd9d9d9,0x9aa3ad,0x6d4c41,0x1f2933],BUS_C=[0x1d4ed8,0xd97706,0x15803d,0xb91c1c];
function makeTruck(seed){const g=new THREE.Group(),cab=new THREE.MeshLambertMaterial({color:TRUCK_C[seed%TRUCK_C.length]}),box=new THREE.MeshLambertMaterial({color:BOX_C[(seed>>2)%BOX_C.length]}),wh=[];
  dpBox(g,2.2,.4,9.4,DPM.blk,0,.75,0);
  dpBox(g,2.45,2.3,2.1,cab,0,2.05,3.85);dpBox(g,2.3,.9,.06,DPM.glass,0,2.55,4.92);dpBox(g,2.46,.7,1.1,DPM.glass,0,2.6,3.9);
  dpBox(g,2.3,.08,1.9,DPM.snow,0,3.24,3.85);dpBox(g,2.45,.35,.1,DPM.dk,0,1.15,4.92);
  dpBox(g,2.55,2.9,6.9,box,0,2.45,-.7);dpBox(g,2.45,.08,6.8,DPM.snow,0,3.94,-.7);
  for(const z of[3.6,-1.9,-3.1])for(const x of[-1.05,1.05]){const w=new THREE.Mesh(DPM.wheel,DPM.blk);w.position.set(x,.5,z);g.add(w);wh.push(w)}
  dpLights(g,2.45,1.15,4.96,-4.17);g.userData.wheels=wh;g.userData.r=.5;return g}
function makeBus(seed){const g=new THREE.Group(),c=new THREE.MeshLambertMaterial({color:BUS_C[seed%BUS_C.length]}),wht=new THREE.MeshLambertMaterial({color:0xeeeeee}),wh=[];
  dpBox(g,2.5,1.1,11.6,c,0,1.0,0);dpBox(g,2.5,1.2,11.6,wht,0,2.15,0);dpBox(g,2.52,.95,9.6,DPM.win,0,2.2,-.6);
  for(let i=0;i<7;i++)dpBox(g,2.54,.95,.12,wht,0,2.2,-5.3+i*1.5);
  dpBox(g,2.4,1.5,.06,DPM.glass,0,2.15,5.81);dpBox(g,2.5,.35,11.6,c,0,2.92,0);dpBox(g,2.35,.08,11.2,DPM.snow,0,3.13,0);
  dpBox(g,1.4,.22,.06,new THREE.MeshBasicMaterial({color:0xff9a2a}),0,2.82,5.83);
  for(const z of[3.7,-3.4])for(const x of[-1.1,1.1]){const w=new THREE.Mesh(DPM.wheel,DPM.blk);w.position.set(x,.5,z);g.add(w);wh.push(w)}
  dpLights(g,2.5,.75,5.83,-5.83);g.userData.wheels=wh;g.userData.r=.5;return g}
const VT=[{n:'auto',len:4.9,w:1.85,v:DPC.carV},{n:'nákladní auto',len:9.9,w:2.55,v:DPC.truckV},{n:'autobus',len:11.7,w:2.5,v:DPC.busV}];
function dpMesh(t,seed){const p=DP.pool[t];let m=p.pop();if(!m)m=t===1?makeTruck(seed):t===2?makeBus(seed):makeCar(CAR_COL[seed%CAR_COL.length]);m.visible=true;scene.add(m);return m}
function dpFree(v){scene.remove(v.mesh);DP.pool[v.t].push(v.mesh)}

/* vlak: parní lokomotiva, tendr, 3 vagony */
function makeLoco(){const g=new THREE.Group(),blk=new THREE.MeshLambertMaterial({color:0x1b1b1e}),gold=new THREE.MeshLambertMaterial({color:0xb8892e});
  dpBox(g,2.7,.45,10.2,blk,0,1.15,0);dpBox(g,2.9,.5,.3,DPM.red,0,1.15,5.2);
  const boil=new THREE.Mesh(new THREE.CylinderGeometry(.95,.95,6.4,18),blk);boil.rotation.x=Math.PI/2;boil.position.set(0,2.35,1.5);g.add(boil);
  const sbox=new THREE.Mesh(new THREE.CylinderGeometry(1.0,1.0,1.2,18),new THREE.MeshLambertMaterial({color:0x101012}));sbox.rotation.x=Math.PI/2;sbox.position.set(0,2.35,4.4);g.add(sbox);
  for(const z of[0,2.6])dpBox(g,2.0,.08,.12,gold,0,3.3,z);
  const ch=new THREE.Mesh(new THREE.CylinderGeometry(.32,.25,1.2,12),blk);ch.position.set(0,3.75,4.3);g.add(ch);
  const dome=new THREE.Mesh(new THREE.SphereGeometry(.45,12,8),gold);dome.position.set(0,3.25,1.6);g.add(dome);
  dpBox(g,2.8,2.6,2.9,blk,0,2.65,-3.4);dpBox(g,3.0,.15,3.2,DPM.dk,0,4.0,-3.4);dpBox(g,2.82,.8,1.2,DPM.win,0,3.0,-3.3);dpBox(g,2.6,.08,3.0,DPM.snow,0,4.1,-3.4);
  const wh=[];for(const z of[-1.6,0,1.6])for(const x of[-1.2,1.2]){const w=new THREE.Mesh(DPM.wheelL,DPM.red);w.position.set(x,.8,z);g.add(w);wh.push(w)}
  for(const z of[3.7,-4.4])for(const x of[-1.2,1.2]){const w=new THREE.Mesh(DPM.wheelT,DPM.red);w.position.set(x,.45,z);g.add(w)}
  for(const x of[-1.25,1.25])dpBox(g,.08,.1,3.4,DPM.steel,x,.85,0);
  dpBox(g,.5,.5,.1,DPM.lamp,0,2.35,5.02);dpGlow(g,0,2.35,5.2,3.2);for(const x of[-.9,.9]){dpBox(g,.3,.3,.08,DPM.lamp,x,1.6,5.36);dpGlow(g,x,1.6,5.5,1.6)}
  g.userData.wheels=wh;g.userData.r=.8;g.userData.chim=new THREE.Vector3(0,4.4,4.3);return g}
function makeTender(){const g=new THREE.Group(),blk=new THREE.MeshLambertMaterial({color:0x1b1b1e});dpBox(g,2.7,2.1,5.4,blk,0,1.95,0);dpBox(g,2.4,.3,5.0,new THREE.MeshLambertMaterial({color:0x0c0c0c}),0,3.1,0);dpBox(g,2.3,.08,4.8,DPM.snow,0,3.26,0);
  const wh=[];for(const z of[-1.8,1.8])for(const x of[-1.2,1.2]){const w=new THREE.Mesh(DPM.wheelT,DPM.red);w.position.set(x,.45,z);g.add(w);wh.push(w)}g.userData.wheels=wh;g.userData.r=.45;return g}
function makeWagon(){const g=new THREE.Group(),grn=new THREE.MeshLambertMaterial({color:0x2e5e3a});dpBox(g,2.8,2.4,12.4,grn,0,2.15,0);
  dpBox(g,2.82,.75,11,DPM.win,0,2.55,0);for(let i=0;i<=10;i++)dpBox(g,2.84,.77,.16,grn,0,2.55,-5.5+i*1.1);
  dpBox(g,2.6,.35,12.6,DPM.dk,0,3.5,0);dpBox(g,2.4,.08,12.2,DPM.snow,0,3.7,0);dpBox(g,2.5,.3,12,DPM.blk,0,.8,0);
  const wh=[];for(const z of[-5,-3.8,3.8,5])for(const x of[-1.2,1.2]){const w=new THREE.Mesh(DPM.wheelT,DPM.blk);w.position.set(x,.45,z);g.add(w);wh.push(w)}g.userData.wheels=wh;g.userData.r=.45;return g}
const TRAIN_P=[{len:10.5,mk:makeLoco},{len:5.6,mk:makeTender},{len:12.8,mk:makeWagon},{len:12.8,mk:makeWagon},{len:12.8,mk:makeWagon}];
const TRAIN_LEN=TRAIN_P.reduce((a,p)=>a+p.len+.6,0);
const smokeTex=(()=>{const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d'),g=x.createRadialGradient(32,32,2,32,32,31);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.5,'rgba(255,255,255,.5)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,64,64);return new THREE.CanvasTexture(c)})();

/* ---------- start / reset ---------- */
function dpInit(){if(DP.init)return;DP.init=true;
  DP.rd=dpChain(M.r.filter(r=>r.t==='primary').map(r=>r.p));DP.rl=dpChain(M.rail.map(r=>r.p));
  if(DP.rl){const H=[];for(let i=0;i<DP.rl.n;i++)H.push(gy(DP.rl.x[i],DP.rl.z[i]));DP.rl.h=H.map((_,i)=>{let s=0,n=0;for(let k=-2;k<=2;k++){const j=i+k;if(j>=0&&j<H.length){s+=H[j];n++}}return s/n})}
  DP.tr=TRAIN_P.map(p=>{const m=p.mk();m.visible=false;scene.add(m);return m})}
function dpReset(){dpInit();for(const v of DP.veh)dpFree(v);DP.veh=[];DP.spT=[rnd(.5,2),rnd(.5,2)];
  DP.train=null;DP.trN=0;DP.trDir=Math.random()<.5?1:-1;DP.trT=rnd(15,40);DP.whistle=0;for(const m of DP.tr)m.visible=false;
  for(const p of DP.smoke)scene.remove(p.m);DP.smoke=[];
  /* na začátku už po silnici něco jede */
  if(DP.rd&&isHost())for(let i=0;i<Math.min(8,DPC.maxVeh);i++){const dir=i%2?1:-1;dpSpawn(dir,rnd(30,DP.rd.L-30))}}
function dpType(){const r=Math.random();return r<.68?0:r<.86?1:2}
function dpSpawn(dir,s){const P=DP.rd;if(!P||DP.veh.length>=DPC.maxVeh)return;const t=dpType(),T=VT[t];
  if(s===undefined)s=dir>0?-T.len:P.L+T.len;
  for(const o of DP.veh)if(o.dir===dir&&Math.abs(o.s-s)<(o.len+T.len)/2+6)return;   /* kolona sahá až na začátek – počkat */
  const seed=Math.floor(Math.random()*1000);DP.veh.push({id:++DP.vid,t,seed,dir,s,len:T.len,w:T.w,max:T.v*rnd(.9,1.08),spd:T.v*.9,pos:new THREE.Vector3(),face:0,mesh:dpMesh(t,seed),honk:0,wait:0})}
/* vozidla na silnici pro ostatní kód (auta a traktory je berou jako překážku) */
function dpVeh(){return DP.veh}

/* ---------- let „jako hvězda“ (člen družiny); napalovači letí po svém (nesFly / napFly) ---------- */
function dpFly(e,x,y,z,vx,vy,vz){if(e.bike)dismountBike(e);e.dpf=true;e.fp=new THREE.Vector3(x,y,z);e.fv=new THREE.Vector3(vx,vy,vz);e.fT=0;e.spin=Math.atan2(vx,vz)+Math.PI/2;e.pos.x=x;e.pos.z=z;e.attack=0;e.scareT=0}
function dpFlyStep(e,dt){const landed=nesStep(e,dt);if(!landed)return;
  e.dpf=false;nesLimbs(e);e.pos.set(e.fp.x,0,e.fp.z);pushOut(e.pos,.45);e.pos.y=groundH(e.pos.x,e.pos.z)+.08;e.face=e.spin;
  e.mesh.rotation.set(0,e.face,0);e.mesh.position.copy(e.pos);puff(e.pos.x,e.pos.z);e.dpImm=1.5;
  if(e.isPlayer){cam.shake=.25;e.stamina=Math.max(0,(e.stamina||0)-30);e.slow=1.5}
  else if(player&&Math.hypot(e.pos.x-player.pos.x,e.pos.z-player.pos.z)<25)cam.shake=Math.max(cam.shake||0,.06)}
/* rychlost odletu: ve směru jízdy, odkloněná na stranu, kde zasažený stál */
function dpVel(fx,fz,side){const a=side*.65,c=Math.cos(a),s=Math.sin(a);let x=fx*c+fz*s,z=-fx*s+fz*c;const l=Math.hypot(x,z)||1;
  return [q2(x/l*DPC.fly.h*rnd(.92,1.08)),q2(DPC.fly.vy),q2(z/l*DPC.fly.h*rnd(.92,1.08))]}
const dpMsgT=co=>`Srazil${co==='vlak'||co==='autobus'?'':'o'} tě ${co}! −${DPC.bodySraz}`;
/* srážka: o = hráč / člen družiny / napalovač (ents) nebo napalovač počítače (kids); co = text */
function dpHit(o,fx,fz,side,co){const v=dpVel(fx,fz,side),X=q2(o.pos.x),Y=q2(groundH(o.pos.x,o.pos.z)+1),Z=q2(o.pos.z),msg=dpMsgT(co);
  if(kids.includes(o)){if(!isHost())return;const i=kids.indexOf(o);nesFly(o,null,X,Y,Z,v[0],v[1],v[2]);o.spin=Math.atan2(v[0],v[2])+Math.PI/2;say(o,'Áááá!',1200);NET.ev(['kt',i,X,Y,Z,v[0],v[1],v[2],'']);return}
  const pid=o.pid||(o.isPlayer?NET.me:'');
  if(o.nap){napFly(o,null,X,Y,Z,v[0],v[1],v[2]);o.by=null;
    if(o.isPlayer&&!isHost()){NET.send({t:'dp',a:'hit',co,x:X,y:Y,z:Z,vx:v[0],vy:v[1],vz:v[2]});toast(msg,1800);return}
    NET.ev(['nt',pid,X,Y,Z,v[0],v[1],v[2],pid]);award(o,'dp',DPC.bodySraz,msg,1800);return}
  dpFly(o,X,Y,Z,v[0],v[1],v[2]);
  if(o.isPlayer&&!isHost()){NET.send({t:'dp',a:'hit',co,x:X,y:Y,z:Z,vx:v[0],vy:v[1],vz:v[2]});toast(msg,1800);return}
  NET.ev(['df',pid,ents.indexOf(o),X,Y,Z,v[0],v[1],v[2]]);award(o,'dp',DPC.bodySraz,msg,1800)}
/* hostitel: srážka vzdáleného hráče (hlásí ji jeho prohlížeč) */
function dpMsg(m,e){if(!e||m.a!=='hit')return;  if(e.nap){napFly(e,null,m.x,m.y,m.z,m.vx,m.vy,m.vz);e.by=null;NET.ev(['nt',e.pid,m.x,m.y,m.z,m.vx,m.vy,m.vz,e.pid])}
  else{dpFly(e,m.x,m.y,m.z,m.vx,m.vy,m.vz);NET.ev(['df',e.pid,-1,m.x,m.y,m.z,m.vx,m.vy,m.vz])}
  const b=NET.board[e.pid];if(b){applyPts(b,'dp',DPC.bodySraz);NET.bDirty=true}NET.send({t:'pts',pid:e.pid,f:'dp',p:DPC.bodySraz,m:'',ms:0,b:b||null})}
/* ostatní: let člena družiny podle hostitele */
function dpEv(ev){const e=ev[1]?ents.find(x=>x.pid===ev[1]):ents[ev[2]];if(!e||e.isPlayer)return;dpFly(e,ev[3],ev[4],ev[5],ev[6],ev[7],ev[8])}

/* kdo může být sražen / komu vozidlo zastaví */
const dpFree2=o=>!(o.gone>0)&&!o.dpf&&!(o.dpImm>0)&&!o.ride;
const dpMember=e=>!e.nap&&!(e.gone>0);
function dpTargets(){const L=[],P=player;
  if(P&&dpFree2(P)&&!(P.nap&&napBusy(P)))L.push(P);
  if(isHost()){for(const e of ents)if(!e.isPlayer&&!e.human&&!e.nap&&dpFree2(e))L.push(e);
    for(const k of kids)if(!(k.gone>0)&&k.st!=='fly'&&k.st!=='held'&&!(k.dpImm>0))L.push(k)}
  return L}
const isNapO=o=>!!o.nap||kids.includes(o);

/* ---------- aktualizace (každý snímek) ---------- */
function dpUpd(dt){if(!DP.init)return;const host=isHost(),RD=DP.rd;
  for(const o of ents.concat(kids))if(o.dpImm>0)o.dpImm-=dt;
  /* --- silnice --- */
  if(RD){
    if(host){for(let d=0;d<2;d++){DP.spT[d]-=dt;if(DP.spT[d]<=0){DP.spT[d]=rnd(DPC.spawn[0],DPC.spawn[1]);dpSpawn(d?1:-1)}}
      const mem=[];for(const e of ents)if(dpMember(e)&&!e.dpf){const q=dpProj(RD,e.pos.x,e.pos.z);if(q&&Math.abs(q.lat)<6)mem.push({e,q})}
      const oth=[];for(const o of cars.concat(tractors)){const q=dpProj(RD,o.pos.x,o.pos.z);if(q&&Math.abs(q.lat)<4)oth.push({o,q})}
      for(const v of DP.veh){let want=v.max,byP=false,byO=false;const lc=v.dir*DPC.lane;
        for(const o of DP.veh){if(o===v||o.dir!==v.dir)continue;const gap=v.dir*(o.s-v.s)-(o.len+v.len)/2;if(gap>-2&&gap<16)want=Math.min(want,gap<3?0:Math.max(0,Math.min(o.spd+1,(gap-3)*1.3)))}
        for(const m of mem){const ah=v.dir*(m.q.s-v.s)-v.len/2;if(ah<-.6||ah>10)continue;if(Math.abs(m.q.lat-lc)>2.4)continue;want=0;if(m.e===player)byP=true}
        if(v.wait<6)for(const m of oth){const ah=v.dir*(m.q.s-v.s)-v.len/2;if(ah<-.5||ah>8||Math.abs(m.q.lat-lc)>1.6)continue;want=0;byO=true}
        v.wait=byO&&want===0?v.wait+dt:0;
        if(byP&&v.honk<=0&&v.spd<1){v.honk=6;toast(v.t===0?'Túúút! Pusť auto!':v.t===1?'Túúúúút! Uhni náklaďáku!':'Túút! Autobus potřebuje projet!',1400)}v.honk-=dt;
        v.spd+=Math.max(-12*dt,Math.min(2.6*dt,want-v.spd));if(v.spd<0)v.spd=0;v.s+=v.dir*v.spd*dt}
      for(let i=DP.veh.length-1;i>=0;i--){const v=DP.veh[i];if(v.s<-v.len-20||v.s>RD.L+v.len+20){dpFree(v);DP.veh.splice(i,1)}}}
    else for(const v of DP.veh){if(v.ts===undefined)continue;v.s+=v.dir*v.spd*dt;const d=v.ts-v.s;if(Math.abs(d)>15)v.s=v.ts;else v.s+=d*Math.min(1,dt*4)}
    /* poloha a natočení */
    for(const v of DP.veh){const f=dpAt(RD,v.s+v.dir*v.len*.4),b=dpAt(RD,v.s-v.dir*v.len*.4),lc=v.dir*DPC.lane;
      const fx=f.x-f.tz*lc,fz=f.z+f.tx*lc,bx=b.x-b.tz*lc,bz=b.z+b.tx*lc;v.pos.x=(fx+bx)/2;v.pos.z=(fz+bz)/2;v.face=Math.atan2(fx-bx,fz-bz);
      const hf=groundH(fx,fz),hb=groundH(bx,bz);v.pos.y=Math.max((hf+hb)/2,groundH(v.pos.x,v.pos.z))+.06;
      const m=v.mesh;m.visible=!player||Math.abs(v.pos.x-player.pos.x)+Math.abs(v.pos.z-player.pos.z)<300;m.position.copy(v.pos);m.rotation.set(-Math.atan2(hf-hb,Math.hypot(fx-bx,fz-bz)||1),v.face,0,'YXZ');const r=m.userData.r||.34;m.userData.wheels.forEach(w=>w.rotation.x+=v.spd*dt/r)}}
  /* --- vlak (hostitel plánuje, ostatní dostávají polohu) --- */
  const RL=DP.rl,T=DP.train;
  if(RL&&host){if(!T){DP.trT-=dt;if(DP.trT<=0&&DPC.trainN>0&&DP.trN<DPC.trainN+2){DP.trN++;const dir=DP.trDir;DP.trDir=-dir;DP.train={dir,s:dir>0?-5:RL.L+5,spd:DPC.trainV};DP.whistle=0}}
    else{T.s+=T.dir*T.spd*dt;const back=T.s-T.dir*TRAIN_LEN;if(T.dir>0?back>RL.L+30:back<-30){DP.train=null;DP.trT=Math.max(20,CFG.limit/DPC.trainN-(RL.L+TRAIN_LEN)/DPC.trainV)*rnd(.8,1.2)}}}
  else if(RL&&T&&T.ts!==undefined){T.s+=T.dir*T.spd*dt;const d=T.ts-T.s;if(Math.abs(d)>30)T.s=T.ts;else T.s+=d*Math.min(1,dt*3)}
  const TT=DP.train;
  if(RL){if(!TT){for(const m of DP.tr)m.visible=false}
    else{let off=0;TRAIN_P.forEach((p,i)=>{const m=DP.tr[i],c=TT.s-TT.dir*(off+p.len/2),a=c+TT.dir*(p.len/2-1.6),b=c-TT.dir*(p.len/2-1.6);off+=p.len+.6;
        const A=dpAt(RL,a),Bq=dpAt(RL,b),ha=dpRailH(a),hb=dpRailH(b);
        m.visible=true;m.position.set((A.x+Bq.x)/2,(ha+hb)/2+.07,(A.z+Bq.z)/2);m.rotation.set(-Math.atan2(ha-hb,Math.hypot(A.x-Bq.x,A.z-Bq.z)||1),Math.atan2(A.x-Bq.x,A.z-Bq.z),0,'YXZ');
        const u=m.userData;if(u.wheels)u.wheels.forEach(w=>w.rotation.x+=TT.spd*dt/u.r)});
      /* kouř z komína */
      DP.smT=(DP.smT||0)-dt;if(DP.smT<=0){DP.smT=.07;const L0=DP.tr[0];L0.updateMatrixWorld();const p=L0.userData.chim.clone().applyMatrix4(L0.matrixWorld);
        let sp=DP.smoke.length>=70?DP.smoke.shift():(DP.smFree||(DP.smFree=[])).pop();if(!sp){sp={m:new THREE.Sprite(new THREE.SpriteMaterial({map:smokeTex,color:0x9a9a9a,transparent:true,depthWrite:false}))};}
        sp.m.position.copy(p);sp.t=0;sp.life=rnd(2.2,3);sp.v=new THREE.Vector3(rnd(-.4,.4),rnd(1.4,2.2),rnd(-.4,.4));scene.add(sp.m);DP.smoke.push(sp)}
      /* písknutí, když je hráč blízko trati */
      const P=player;if(P&&!DP.whistle){const q=dpProj(RL,P.pos.x,P.pos.z);if(q&&Math.abs(q.lat)<70&&TT.dir*(q.s-TT.s)>0&&TT.dir*(q.s-TT.s)<200){DP.whistle=1;toast('Húúú! Jede vlak – pozor na koleje!',2200)}}}}
  for(let i=DP.smoke.length-1;i>=0;i--){const p=DP.smoke[i];p.t+=dt;const k=p.t/p.life;if(k>=1){scene.remove(p.m);DP.smoke.splice(i,1);(DP.smFree||(DP.smFree=[])).push(p);continue}
    p.m.position.addScaledVector(p.v,dt);p.v.multiplyScalar(1-dt*.3);const s=.9+k*4.2;p.m.scale.set(s,s,1);p.m.material.opacity=.55*(1-k)}
  /* --- srážky --- */
  if(state!=='play')return;
  for(const o of dpTargets()){
    if(RD){const q=dpProj(RD,o.pos.x,o.pos.z);if(q&&Math.abs(q.lat)<5)for(const v of DP.veh){const al=v.dir*(q.s-v.s),lc=v.dir*DPC.lane,dl=q.lat-lc;
        if(Math.abs(al)>v.len/2+.35||Math.abs(dl)>v.w/2+.35)continue;
        const fx=Math.sin(v.face),fz=Math.cos(v.face);
        if(isNapO(o)&&v.spd>1.5){dpHit(o,fx,fz,(dl*v.dir>=0)?1:-1,VT[v.t].n);break}
        /* člena družiny (nebo napalovače u stojícího vozidla) jen odsune stranou */
        const need=(v.w/2+.4-Math.abs(dl))*(dl>=0?1:-1);o.pos.x+=q.nx*need;o.pos.z+=q.nz*need;break}}
    if(RL&&TT&&dpFree2(o)&&!(o.nap&&napBusy(o))&&!(kids.includes(o)&&(o.st==='fly'||o.st==='held'))){const q=dpProj(RL,o.pos.x,o.pos.z);
      if(q&&Math.abs(q.lat)<1.75){const al=TT.dir*(q.s-TT.s);if(al<.3&&al>-TRAIN_LEN){dpHit(o,TT.dir*dpAt(RL,q.s).tx,TT.dir*dpAt(RL,q.s).tz,q.lat*TT.dir>=0?1:-1,'vlak')}}}}
  /* --- nehratelné postavy se vyhýbají (hostitel) --- */
  if(host){for(const o of ents)if(!o.human&&!o.nap&&!o.dpf&&!(o.gone>0))dpAvoid(o,dt);for(const k of kids)if(!(k.gone>0)&&!['fly','held','down'].includes(k.st))dpAvoid(k,dt)}}
function dpRailH(s){const P=DP.rl,f=clamp(s/2,0,P.n-1.001),i=Math.floor(f),u=f-i;return P.h[i]+(P.h[Math.min(P.n-1,i+1)]-P.h[i])*u}
function dpAvoid(o,dt){let moved=false;
  if(DP.rd){const q=dpProj(DP.rd,o.pos.x,o.pos.z);if(q&&Math.abs(q.lat)<6)for(const v of DP.veh){if(v.spd<2)continue;const ah=v.dir*(q.s-v.s),lc=v.dir*DPC.lane;
      if(ah<-v.len/2-1||ah>v.len/2+14)continue;const dl=q.lat-lc,lim=v.w/2+1.1;if(Math.abs(dl)>lim)continue;
      const side=dl>=0?1:-1,need=(lim-Math.abs(dl))*side,st=Math.min(Math.abs(need),(ah<v.len/2+5?25:7)*dt)*side;o.pos.x+=q.nx*st;o.pos.z+=q.nz*st;moved=true;break}}
  const T=DP.train;if(DP.rl&&T){const q=dpProj(DP.rl,o.pos.x,o.pos.z);if(q&&Math.abs(q.lat)<3.4){const ah=T.dir*(q.s-T.s);
      if(ah>-TRAIN_LEN-2&&ah<80){const side=q.lat>=0?1:-1,need=(3.4-Math.abs(q.lat))*side,st=Math.min(Math.abs(need),(ah<25?30:7)*dt)*side;o.pos.x+=q.nx*st;o.pos.z+=q.nz*st;moved=true}}}
  if(moved)pushOut(o.pos,.45)}

/* ---------- více hráčů: snímek ---------- */
function dpSnap(){const T=DP.train;return {v:DP.veh.map(v=>[v.id,v.t,v.dir,Math.round(v.s*10)/10,Math.round(v.spd*10)/10,v.seed]),t:T?[T.dir,Math.round(T.s*10)/10,T.spd]:0,n:DP.trN}}
function dpApply(d){if(!DP.init)dpInit();const seen=new Set();
  for(const a of d.v||[]){seen.add(a[0]);let v=DP.veh.find(x=>x.id===a[0]);
    if(!v){const T=VT[a[1]];v={id:a[0],t:a[1],seed:a[5],dir:a[2],s:a[3],len:T.len,w:T.w,max:T.v,spd:a[4],pos:new THREE.Vector3(),face:0,mesh:dpMesh(a[1],a[5]),honk:0,wait:0};DP.veh.push(v)}
    v.ts=a[3];v.spd=a[4];if(a[0]>DP.vid)DP.vid=a[0]}
  for(let i=DP.veh.length-1;i>=0;i--)if(!seen.has(DP.veh[i].id)){dpFree(DP.veh[i]);DP.veh.splice(i,1)}
  if(d.t){if(!DP.train||DP.train.dir!==d.t[0]){DP.train={dir:d.t[0],s:d.t[1],spd:d.t[2]};DP.whistle=0}DP.train.ts=d.t[1];DP.train.spd=d.t[2]}else DP.train=null;
  DP.trN=d.n||DP.trN}

/* ---------- minimapa ---------- */
function dpMap(mx,bx,f){mx.fillStyle='#cbd5e1';for(const v of DP.veh){mx.save();mx.translate(v.pos.x-bx[0],v.pos.z-bx[1]);mx.rotate(-v.face);const w=Math.max(1.6,v.w*.9)*f;mx.fillRect(-w/2,-v.len/2,w,v.len);mx.restore()}
  const T=DP.train;if(T&&DP.rl){mx.strokeStyle='#f97316';mx.lineWidth=3.2*f;mx.beginPath();for(let k=0;k<=12;k++){const p=dpAt(DP.rl,T.s-T.dir*TRAIN_LEN*k/12);if(k)mx.lineTo(p.x-bx[0],p.z-bx[1]);else mx.moveTo(p.x-bx[0],p.z-bx[1])}mx.stroke()}}
window.__dp=DP;
