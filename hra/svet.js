/* Svět Lidečka pro hru i editor: terén, potoky s mosty, silnice, domy, stromy, ploty, vlastní objekty a úpravy z editoru.
   Data: © přispěvatelé OpenStreetMap (ODbL), ČÚZK (CC BY 4.0) – viz polnak.js. Grafika: three.js r128 (MIT). */
'use strict';
const M = window.MAPA;
const $ = id => document.getElementById(id);
const rnd=(a,b)=>a+Math.random()*(b-a);
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const isTouch = matchMedia('(pointer:coarse)').matches || 'ontouchstart' in window;
function inPoly(x,z,P){let c=false;for(let i=0,j=P.length-1;i<P.length;j=i++){const xi=P[i][0],zi=P[i][1],xj=P[j][0],zj=P[j][1];
  if((zi>z)!==(zj>z)&&x<(xj-xi)*(z-zi)/(zj-zi)+xi)c=!c}return c}
function closestOnSeg(px,pz,ax,az,bx,bz){const dx=bx-ax,dz=bz-az,l=dx*dx+dz*dz;let t=l?((px-ax)*dx+(pz-az)*dz)/l:0;t=clamp(t,0,1);return [ax+dx*t,az+dz*t,t]}
function toast(t,ms){const e=$('toast');if(!e)return;e.textContent=t;e.classList.add('on');clearTimeout(toast.t);toast.t=setTimeout(()=>e.classList.remove('on'),ms||1800)}
function store(k,v){try{if(v===undefined)return JSON.parse(localStorage.getItem(k));localStorage.setItem(k,JSON.stringify(v))}catch(e){return null}}

/* ===================== ÚPRAVY Z EDITORU ===================== */
/* uložené v prohlížeči (localStorage) nebo v souboru upravy.js (window.UPRAVY); použije se novější */
const UPR_KEY='lidecko-upravy';
function normUpr(u){u=u&&typeof u==='object'?u:{};u.v=1;u.t=u.t||0;u.b=u.b||{};u.r=u.r||{};u.nr=u.nr||[];u.cesty=u.cesty||{};u.o=u.o||[];u.mod=u.mod||{};u.st=u.st||[];return u}
const UPR=(()=>{let a=null,b=null;try{a=JSON.parse(localStorage.getItem(UPR_KEY))}catch(e){}
  if(window.UPRAVY)try{b=JSON.parse(JSON.stringify(window.UPRAVY))}catch(e){}
  return normUpr(a&&b?((b.t||0)>(a.t||0)?b:a):(a||b))})();
function saveUpr(){UPR.t=Date.now();try{localStorage.setItem(UPR_KEY,JSON.stringify(UPR));return true}catch(e){return false}}

/* ===================== TERÉN ===================== */
/* digitální model reliéfu ČÚZK (DMR 5G), mřížka 10 m; gy(x,z) = výška nad místem startu */
const TER=(()=>{const T=M.ter;if(!T)return null;const bin=atob(T.d),a=new Float32Array(bin.length);for(let i=0;i<bin.length;i++)a[i]=T.min+bin.charCodeAt(i)*T.step;return {...T,a}})();
function tNode(i,j){const T=TER;i=i<0?0:i>=T.nx?T.nx-1:i;j=j<0?0:j>=T.nz?T.nz-1:j;return T.a[j*T.nx+i]}
function gyRaw(x,z){const T=TER;if(!T)return 0;const fx=(x-T.x0)/T.s,fz=(z-T.z0)/T.s,i=Math.floor(fx),j=Math.floor(fz),u=fx-i,v=fz-j;
  const h00=tNode(i,j),h10=tNode(i+1,j),h01=tNode(i,j+1),h11=tNode(i+1,j+1);
  return u+v<1?h00+(h10-h00)*u+(h01-h00)*v:h11+(h01-h11)*(1-u)+(h10-h11)*(1-v)}
const H0=M.start?gyRaw(M.start[0],M.start[1]):0;
function gy(x,z){return gyRaw(x,z)-H0}

/* koryta potoků: hladina cca 1,5 m (řeka 2 m) pod okolním terénem, svahy břehů */
const WS=[],WGC=12,WG=new Map();
const wKey=(x,z)=>Math.floor(x/WGC)+','+Math.floor(z/WGC);
for(const w of M.w){const hw=w.w/2,d=w.d||1.5,bank=w.w>5?3.2:2.6;
  for(let i=1;i<w.p.length;i++){const[ax,az]=w.p[i-1],[bx,bz]=w.p[i];const s={ax,az,bx,bz,hw,d,bank,R:hw+bank,deep:d+.35};WS.push(s);
    for(let gx=Math.floor((Math.min(ax,bx)-s.R)/WGC);gx<=Math.floor((Math.max(ax,bx)+s.R)/WGC);gx++)for(let gz=Math.floor((Math.min(az,bz)-s.R)/WGC);gz<=Math.floor((Math.max(az,bz)+s.R)/WGC);gz++){
      const k=gx+','+gz;if(!WG.has(k))WG.set(k,[]);WG.get(k).push(s)}}}
const smooth=t=>t<=0?0:t>=1?1:t*t*(3-2*t);
function carve(x,z){const l=WG.get(wKey(x,z));if(!l)return 0;let best=0;
  for(const s of l){const q=closestOnSeg(x,z,s.ax,s.az,s.bx,s.bz),dd=Math.hypot(x-q[0],z-q[1]);if(dd>=s.R)continue;
    const c=dd<=s.hw?s.deep:s.deep*(1-smooth((dd-s.hw)/s.bank));if(c>best)best=c}return best}
function gyC(x,z){return gy(x,z)-carve(x,z)}
/* výška pro postavy a auta: na silnici/mostě nad korytem zůstává původní terén */
const RSEG=new Map(),RGC=10;
function onRoad(x,z){const l=RSEG.get(Math.floor(x/RGC)+','+Math.floor(z/RGC));if(!l)return false;
  for(const s of l){const q=closestOnSeg(x,z,s[0],s[1],s[2],s[3]);if(Math.hypot(x-q[0],z-q[1])<s[4])return true}return false}
let BRIDGES=[];
/* výška vozovky: na mostě rovně mezi oběma konci */
function roadH(x,z){for(const b of BRIDGES){if(Math.abs(x-b.px)>b.half+b.hw||Math.abs(z-b.pz)>b.half+b.hw)continue;const u=(x-b.px)*b.ux+(z-b.pz)*b.uz,v=-(x-b.px)*b.uz+(z-b.pz)*b.ux;
  if(Math.abs(u)<=b.half&&Math.abs(v)<=b.hw)return b.hA+(b.hB-b.hA)*(u+b.half)/(2*b.half)}return gy(x,z)}
function groundH(x,z){const c=carve(x,z);if(c<0.02)return gy(x,z);return onRoad(x,z)?roadH(x,z):gy(x,z)-c}

/* ===================== SILNICE (s úpravami) ===================== */
M.r0=M.r;
const ROAD_TYPES={primary:'Hlavní silnice',secondary:'Silnice II. třídy',tertiary:'Silnice III. třídy',residential:'Místní komunikace',unclassified:'Silnička',service:'Příjezdová cesta',living_street:'Obytná zóna',track:'Polní cesta',footway:'Chodník',path:'Pěšina',steps:'Schody'};
function roadsEff(){const out=[];
  for(const r of M.r0){const o=UPR.r[r.id];if(o&&o.del)continue;out.push(o?{...r,...o,id:r.id}:r)}
  for(const r of UPR.nr)if(!r.del)out.push(r);return out}
M.r=roadsEff();

/* ===================== BUDOVY: data, mřížka pro kolize ===================== */
const CELL=16, grid=new Map();
let B=[];
function makeB(){B=[];grid.clear();
  M.b.forEach((b0,i)=>{const ov=UPR.b[b0.id]||{};if(ov.del)return;const b={...b0,i,ov};
    if(ov.h)b.h=+ov.h;if(ov.r!==undefined&&ov.r!=='')b.r=+ov.r;
    let x0=1e9,z0=1e9,x1=-1e9,z1=-1e9,cx=0,cz=0,gmin=1e9,gs=0;
    for(const[x,z]of b.p){x0=Math.min(x0,x);x1=Math.max(x1,x);z0=Math.min(z0,z);z1=Math.max(z1,z);cx+=x;cz+=z;const g=gyC(x,z);gmin=Math.min(gmin,g);gs+=g}
    Object.assign(b,{x0,z0,x1,z1,cx:cx/b.p.length,cz:cz/b.p.length,gmin,y0:gs/b.p.length,visited:false});b.top=b.y0+b.h;B.push(b)});
  for(const b of B){for(let gx=Math.floor(b.x0/CELL);gx<=Math.floor(b.x1/CELL);gx++)for(let gz=Math.floor(b.z0/CELL);gz<=Math.floor(b.z1/CELL);gz++){
    const k=gx+','+gz;if(!grid.has(k))grid.set(k,[]);grid.get(k).push(b)}}}
makeB();
function near(x,z){const out=new Set();const gx=Math.floor(x/CELL),gz=Math.floor(z/CELL);
  for(let a=-1;a<=1;a++)for(let c=-1;c<=1;c++){const l=grid.get((gx+a)+','+(gz+c));if(l)for(const b of l)out.add(b)}return out}
function distToBuilding(b,x,z){let best=1e9,cp=null,ei=0,et=0;const P=b.p;
  for(let i=0,j=P.length-1;i<P.length;j=i++){const q=closestOnSeg(x,z,P[j][0],P[j][1],P[i][0],P[i][1]);const d=Math.hypot(x-q[0],z-q[1]);if(d<best){best=d;cp=q;ei=i;et=q[2]}}
  return {d:best,cp,inside:inPoly(x,z,P),e:ei,t:et}}
function insideAny(x,z,pad){for(const b of near(x,z)){if(x<b.x0-pad||x>b.x1+pad||z<b.z0-pad||z>b.z1+pad)continue;const r=distToBuilding(b,x,z);if(r.inside||r.d<pad)return true}return false}
/* hrana domu i: z bodu p[i-1] do p[i]; vnější normála */
function edgeOf(b,i){const P=b.p,n=P.length,j=(i-1+n)%n,ax=P[j][0],az=P[j][1],bx=P[i][0],bz=P[i][1],l=Math.hypot(bx-ax,bz-az)||1,dx=(bx-ax)/l,dz=(bz-az)/l;
  let nx=dz,nz=-dx;const mx=(ax+bx)/2,mz=(az+bz)/2;if(inPoly(mx+nx*.3,mz+nz*.3,P)){nx=-nx;nz=-nz}return {ax,az,bx,bz,l,dx,dz,nx,nz}}

/* ===================== KOLIZE: zdi, ploty, zábradlí, objekty ===================== */
const WALLG=new Map(),WC=8;let CIRC=new Map();
function addWallSeg(ax,az,bx,bz,t){const s=[ax,az,bx,bz,t||.1];
  for(let gx=Math.floor((Math.min(ax,bx)-1)/WC);gx<=Math.floor((Math.max(ax,bx)+1)/WC);gx++)for(let gz=Math.floor((Math.min(az,bz)-1)/WC);gz<=Math.floor((Math.max(az,bz)+1)/WC);gz++){
    const k=gx+','+gz;if(!WALLG.has(k))WALLG.set(k,[]);WALLG.get(k).push(s)}}
function addCirc(x,z,r){const k=Math.floor(x/WC)+','+Math.floor(z/WC);if(!CIRC.has(k))CIRC.set(k,[]);CIRC.get(k).push([x,z,r])}
function pushOut(pos,r){
  for(let it=0;it<2;it++)for(const b of near(pos.x,pos.z)){
    if(pos.x<b.x0-r||pos.x>b.x1+r||pos.z<b.z0-r||pos.z>b.z1+r)continue;
    const q=distToBuilding(b,pos.x,pos.z);
    if(q.inside){const dx=q.cp[0]-pos.x,dz=q.cp[1]-pos.z,l=Math.hypot(dx,dz)||1;pos.x=q.cp[0]+dx/l*r;pos.z=q.cp[1]+dz/l*r}
    else if(q.d<r){const dx=pos.x-q.cp[0],dz=pos.z-q.cp[1],l=q.d||1;pos.x=q.cp[0]+dx/l*r;pos.z=q.cp[1]+dz/l*r}}
  const gx=Math.floor(pos.x/WC),gz=Math.floor(pos.z/WC);
  for(let a=-1;a<=1;a++)for(let c=-1;c<=1;c++){const k=(gx+a)+','+(gz+c);
    const wl=WALLG.get(k);if(wl)for(const s of wl){const q=closestOnSeg(pos.x,pos.z,s[0],s[1],s[2],s[3]);let dx=pos.x-q[0],dz=pos.z-q[1];const d=Math.hypot(dx,dz),m=r+s[4];
      if(d<m){if(d<1e-4){const l=Math.hypot(s[2]-s[0],s[3]-s[1])||1;dx=-(s[3]-s[1])/l;dz=(s[2]-s[0])/l}else{dx/=d;dz/=d}pos.x=q[0]+dx*m;pos.z=q[1]+dz*m}}
    const cl=CIRC.get(k);if(cl)for(const o of cl){const dx=pos.x-o[0],dz=pos.z-o[1],d=Math.hypot(dx,dz),m=r+o[2];if(d<m&&d>1e-4){pos.x=o[0]+dx/d*m;pos.z=o[1]+dz/d*m}}}
  treeBlock(pos,r);
  const bx=M.box;pos.x=clamp(pos.x,bx[0]+2,bx[2]-2);pos.z=clamp(pos.z,bx[1]+2,bx[3]-2);
}

/* ===================== SCÉNA ===================== */
const canvas=$('c');
const renderer=new THREE.WebGLRenderer({canvas,antialias:!isTouch,powerPreference:'high-performance',preserveDrawingBuffer:false});
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,isTouch?1.5:2));
const scene=new THREE.Scene();
const SKY=0x0d1830;
scene.background=new THREE.Color(SKY);
scene.fog=new THREE.FogExp2(SKY,0.0115);
const camera=new THREE.PerspectiveCamera(62,1,0.3,300);
const hemi=new THREE.HemisphereLight(0x9fb4e8,0x2a3550,0.5);scene.add(hemi);
const moon=new THREE.DirectionalLight(0xbfd0ff,0.42);moon.position.set(-60,120,-40);scene.add(moon);
const lantern=new THREE.PointLight(0xffc36b,1.3,20,1.6);scene.add(lantern);
function resize(){const w=innerWidth,h=innerHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix()}
addEventListener('resize',resize);resize();
/* denní světlo (editor) */
function setDay(on,fog){scene.background.set(on?0xbcd2ea:SKY);scene.fog.color.set(on?0xbcd2ea:SKY);scene.fog.density=fog!==undefined?fog:(on?0.004:0.0115);
  hemi.intensity=on?1.0:.5;hemi.color.set(on?0xffffff:0x9fb4e8);hemi.groundColor.set(on?0x8a8f99:0x2a3550);moon.intensity=on?.7:.42;moon.color.set(on?0xffffff:0xbfd0ff);lantern.intensity=on?0:1.3}

function glowTex(){const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d');const g=x.createRadialGradient(32,32,0,32,32,32);
  g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.35,'rgba(255,255,255,.45)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,64,64);
  return new THREE.CanvasTexture(c)}
const GLOW=glowTex();
const stdM=(c,o)=>new THREE.MeshStandardMaterial(Object.assign({color:c,roughness:.8},o||{}));

/* sloučení geometrií do jedné (rychlejší vykreslování) */
function merged(list){let n=0;for(const g of list)n+=g.attributes.position.count;
  const pos=new Float32Array(n*3),nor=new Float32Array(n*3),col=new Float32Array(n*3);let o=0;
  for(const g of list){pos.set(g.attributes.position.array,o*3);nor.set(g.attributes.normal.array,o*3);col.set(g.attributes.color.array,o*3);o+=g.attributes.position.count}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pos,3));g.setAttribute('normal',new THREE.BufferAttribute(nor,3));g.setAttribute('color',new THREE.BufferAttribute(col,3));return g}
function tris(arr,cols){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(arr,3));g.computeVertexNormals();
  g.setAttribute('color',new THREE.Float32BufferAttribute(cols,3));return g}
/* stavebnice tvarů: kvádry a tělesa do jedné geometrie */
const GB=()=>({p:[],n:[],c:[]});
const _m4=new THREE.Matrix4(),_m3=new THREE.Matrix3(),_q=new THREE.Quaternion(),_e=new THREE.Euler(),_v=new THREE.Vector3(),_s=new THREE.Vector3(),_w=new THREE.Vector3();
const PRIM={};
function prim(k){if(PRIM[k])return PRIM[k];let g;
  if(k==='box')g=new THREE.BoxGeometry(1,1,1);else if(k==='cyl')g=new THREE.CylinderGeometry(.5,.5,1,12);else if(k==='cone')g=new THREE.ConeGeometry(.5,1,10);
  else if(k==='sph')g=new THREE.SphereGeometry(.5,12,8);else if(k==='cyl6')g=new THREE.CylinderGeometry(.5,.5,1,6);
  g=g.toNonIndexed();return PRIM[k]={p:g.attributes.position.array,n:g.attributes.normal.array}}
function gbPrim(gb,k,x,y,z,sx,sy,sz,ry,rx,col,rz){const P=prim(k);_e.set(rx||0,ry||0,rz||0,'YXZ');_q.setFromEuler(_e);_m4.compose(_v.set(x,y,z),_q,_s.set(sx,sy,sz));_m3.getNormalMatrix(_m4);
  const c=col.isColor?col:new THREE.Color(col);
  for(let i=0;i<P.p.length;i+=3){_w.set(P.p[i],P.p[i+1],P.p[i+2]).applyMatrix4(_m4);gb.p.push(_w.x,_w.y,_w.z);_w.set(P.n[i],P.n[i+1],P.n[i+2]).applyMatrix3(_m3).normalize();gb.n.push(_w.x,_w.y,_w.z);gb.c.push(c.r,c.g,c.b)}}
function gbQuad(gb,a,b,c,d,col){const C=col.isColor?col:new THREE.Color(col);
  const ux=b[0]-a[0],uy=b[1]-a[1],uz=b[2]-a[2],vx=d[0]-a[0],vy=d[1]-a[1],vz=d[2]-a[2];let nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;const l=Math.hypot(nx,ny,nz)||1;nx/=l;ny/=l;nz/=l;
  for(const p of[a,b,c,a,c,d]){gb.p.push(p[0],p[1],p[2]);gb.n.push(nx,ny,nz);gb.c.push(C.r,C.g,C.b)}}
function gbMesh(gb,mat){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(gb.p,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(gb.n,3));
  g.setAttribute('color',new THREE.Float32BufferAttribute(gb.c,3));return new THREE.Mesh(g,mat||new THREE.MeshLambertMaterial({vertexColors:true,side:THREE.DoubleSide}))}

/* ===================== ZEM (s korytem potoků) ===================== */
let groundMesh=null;
{const bx=M.box,S=TER?TER.s:10,X0=TER?TER.x0:bx[0],Z0=TER?TER.z0:bx[1],SUB=5;
 const i0=Math.floor((bx[0]-250-X0)/S),i1=Math.ceil((bx[2]+250-X0)/S),j0=Math.floor((bx[1]-250-Z0)/S),j1=Math.ceil((bx[3]+250-Z0)/S),nx=i1-i0+1;
 const pos=[],idx=[],bank=new Map();for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){const x=X0+i*S,z=Z0+j*S;pos.push(x,TER?tNode(i,j)-H0:0,z)}
 const fine=c=>{const x=c[0]+S/2,z=c[1]+S/2;for(const s of WS){const q=closestOnSeg(x,z,s.ax,s.az,s.bx,s.bz);if(Math.hypot(x-q[0],z-q[1])<s.R+S*.75)return true}return false};
 /* jen buňky blízko vody mají jemnou síť */
 const nearW=new Set();for(const s of WS){for(let i=Math.floor((Math.min(s.ax,s.bx)-s.R-X0)/S)-1;i<=Math.floor((Math.max(s.ax,s.bx)+s.R-X0)/S)+1;i++)for(let j=Math.floor((Math.min(s.az,s.bz)-s.R-Z0)/S)-1;j<=Math.floor((Math.max(s.az,s.bz)+s.R-Z0)/S)+1;j++)nearW.add(i+','+j)}
 for(let j=j0;j<j1;j++)for(let i=i0;i<i1;i++){
   if(nearW.has(i+','+j)&&fine([X0+i*S,Z0+j*S])){const base=pos.length/3,n=SUB+1;
     for(let b=0;b<=SUB;b++)for(let a=0;a<=SUB;a++){const x=X0+(i+a/SUB)*S,z=Z0+(j+b/SUB)*S,c=carve(x,z);pos.push(x,gy(x,z)-c,z);bank.set(pos.length/3-1,Math.min(1,c/1.2))}
     for(let b=0;b<SUB;b++)for(let a=0;a<SUB;a++){const p=base+b*n+a,q=p+1,r=p+n,t=r+1;idx.push(p,r,q,q,r,t)}}
   else{const a=(j-j0)*nx+(i-i0),b=a+1,c=a+nx,d=c+1;idx.push(a,c,b,b,c,d)}}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();
 /* břehy potoků: tmavší (hlína a kamení pod sněhem) */
 const col=new Float32Array(pos.length),c0=new THREE.Color(0xdfe6ef),c1=new THREE.Color(0x7d776e),t=new THREE.Color();
 for(let i=0;i<pos.length/3;i++){const k=bank.get(i)||0;t.copy(c0).lerp(c1,k*.75);col[i*3]=t.r;col[i*3+1]=t.g;col[i*3+2]=t.b}
 g.setAttribute('color',new THREE.BufferAttribute(col,3));
 groundMesh=new THREE.Mesh(g,new THREE.MeshLambertMaterial({vertexColors:true}));scene.add(groundMesh)}

/* ===================== PÁSY: silnice, voda, koleje ===================== */
function ribbons(list,y,colorOf,widthOf,tile,hf){const P=[],C=[],U=[];tile=tile||6;hf=hf||gy;
  let wi=0,yo=0,cur=null;const V=(x,z)=>[x,hf(x,z,cur)+y+yo,z];
  for(const r0 of list){cur=r0;yo=(wi++%8)*0.01;   /* každá cesta o kousek výš, ať se v křižovatkách neprolínají */
    const w=widthOf(r0)/2,c=new THREE.Color(colorOf(r0));let acc=0;
    const pts=[],cut=[];for(let i=0;i<r0.p.length;i++){if(i>0){const[px,pz]=r0.p[i-1],[qx,qz]=r0.p[i],n=Math.ceil(Math.hypot(qx-px,qz-pz)/2);
        for(let k=1;k<n;k++){pts.push([px+(qx-px)*k/n,pz+(qz-pz)*k/n]);cut.push(true)}}pts.push(r0.p[i]);cut.push(false)}
    for(let i=1;i<pts.length;i++){const[ax,az]=pts[i-1],[bx,bz]=pts[i];let dx=bx-ax,dz=bz-az;const l=Math.hypot(dx,dz);if(l<0.05)continue;dx/=l;dz/=l;
      const ea=cut[i-1]?0:w*0.9,eb=cut[i]?0:w*0.9,nx=-dz*w,nz=dx*w,u0=(acc-ea)/tile,u1=(acc+l+eb)/tile;acc+=l;
      const a=V(ax-dx*ea+nx,az-dz*ea+nz),b=V(ax-dx*ea-nx,az-dz*ea-nz),c2=V(bx+dx*eb+nx,bz+dz*eb+nz),d=V(bx+dx*eb-nx,bz+dz*eb-nz);
      P.push(...a,...c2,...b,...b,...c2,...d);U.push(u0,1,u1,1,u0,0,u0,0,u1,1,u1,0);for(let k=0;k<6;k++)C.push(c.r,c.g,c.b)}}
  const g=tris(P,C);g.setAttribute('uv',new THREE.Float32BufferAttribute(U,2));return g}
/* prošlapaný sníh s vyjetými kolejemi, kde je vidět asfalt */
function roadTex(){const W=512,H=128,c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d');let r=5;const R=()=>{r=(r*16807)%2147483647;return r/2147483647};
  x.fillStyle='#c4ccd7';x.fillRect(0,0,W,H);
  for(let i=0;i<260;i++){x.fillStyle=`rgba(${120+R()*40|0},${125+R()*40|0},${135+R()*40|0},${.15+R()*.25})`;x.beginPath();x.ellipse(R()*W,R()*H,10+R()*40,2+R()*6,0,0,7);x.fill()}
  for(const yc of[.3,.7]){for(let i=0;i<70;i++){const px=R()*W,len=20+R()*60,w=6+R()*7;x.fillStyle=R()<.7?'#4b4f57':'#5d616a';x.globalAlpha=.55+R()*.45;
      x.beginPath();x.ellipse(px,yc*H+(R()-.5)*6,len,w,0,0,7);x.fill()}}
  x.globalAlpha=1;for(let i=0;i<500;i++){x.fillStyle=`rgba(255,255,255,${R()*.5})`;x.fillRect(R()*W,R()*H,2+R()*4,1+R()*2)}
  const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=4;return t}
/* dlažba se sněhem ve spárách */
function paveTex(){const S=256,c=document.createElement('canvas');c.width=c.height=S;const x=c.getContext('2d');let r=9;const R=()=>{r=(r*16807)%2147483647;return r/2147483647};
  x.fillStyle='#e9eef4';x.fillRect(0,0,S,S);const n=8,sz=S/n;
  for(let i=0;i<n;i++)for(let j=0;j<n;j++){const off=(j%2)*sz/2,g=120+R()*50|0;x.fillStyle=`rgb(${g+8},${g+2},${g-6})`;
    x.fillRect((i*sz+off)%S+2,j*sz+2,sz-4,sz-4);if(off)x.fillRect((i*sz+off)%S-S+2,j*sz+2,sz-4,sz-4);
    if(R()<.35){x.fillStyle='rgba(240,244,250,.75)';x.fillRect(i*sz+R()*sz*.5,j*sz+R()*sz*.5,sz*.5,sz*.4)}}
  const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;return t}
/* drátěné pletivo */
function meshTex(){const S=64,c=document.createElement('canvas');c.width=c.height=S;const x=c.getContext('2d');x.strokeStyle='rgba(70,76,84,1)';x.lineWidth=2;
  x.beginPath();x.moveTo(0,0);x.lineTo(S,S);x.moveTo(S,0);x.lineTo(0,S);x.stroke();const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;return t}
const ROADTEX=roadTex(),PAVETEX=paveTex(),MESHTEX=meshTex();
const PO=(m,f)=>Object.assign(m,{polygonOffset:true,polygonOffsetFactor:f,polygonOffsetUnits:f});
const MAT={pave:PO(new THREE.MeshLambertMaterial({map:PAVETEX}),-2),track:PO(new THREE.MeshLambertMaterial({map:ROADTEX,color:0xe6e2da}),-2),road:PO(new THREE.MeshLambertMaterial({map:ROADTEX}),-3),
  vc:new THREE.MeshLambertMaterial({vertexColors:true,side:THREE.DoubleSide}),mesh:new THREE.MeshLambertMaterial({map:MESHTEX,transparent:true,alphaTest:.3,side:THREE.DoubleSide})};
/* voda a koleje se nemění */
scene.add(new THREE.Mesh(ribbons(M.w,0,()=>0x3d5a78,r=>r.w+0.5,6,(x,z,r)=>gy(x,z)-(r.d||1.5)),PO(new THREE.MeshLambertMaterial({vertexColors:true,emissive:0x060c18}),-1)));
scene.add(new THREE.Mesh(ribbons(M.rail,0.07,()=>0x4a4038,()=>2.6),PO(new THREE.MeshLambertMaterial({vertexColors:true}),-3)));
{const P=M.poly.concat([M.poly[0]]);scene.add(new THREE.Mesh(ribbons([{p:P}],0.2,()=>0xd1495b,()=>0.7),new THREE.MeshBasicMaterial({vertexColors:true,transparent:true,opacity:.55})))}

/* silnice + mosty (přestavitelné z editoru) */
const FOOT=['footway','path','steps'];
let roadGroup=new THREE.Group();scene.add(roadGroup);let BRIDGEWALLS=[];
function buildRoads(){M.r=roadsEff();scene.remove(roadGroup);roadGroup.traverse(o=>{if(o.geometry)o.geometry.dispose()});roadGroup=new THREE.Group();scene.add(roadGroup);
  const R=M.r;
  /* mosty: kde cesta kříží potok */
  const gb=GB(),seen=new Set();BRIDGEWALLS=[];BRIDGES=[];
  for(const r of R){const foot=FOOT.includes(r.t)||r.t==='track',rw=Math.max(1.6,r.w);
    for(let i=1;i<r.p.length;i++){const[ax,az]=r.p[i-1],[bx,bz]=r.p[i];const ex=bx-ax,ez=bz-az,el=Math.hypot(ex,ez);if(el<.1)continue;const ux=ex/el,uz=ez/el;
      for(const s of WS){const fx=s.bx-s.ax,fz=s.bz-s.az,den=ex*fz-ez*fx;if(Math.abs(den)<1e-6)continue;
        const t=((s.ax-ax)*fz-(s.az-az)*fx)/den,u=((s.ax-ax)*ez-(s.az-az)*ex)/den;if(t<0||t>1||u<0||u>1)continue;
        const px=ax+ex*t,pz=az+ez*t,key=Math.round(px)+','+Math.round(pz);if(seen.has(key))continue;seen.add(key);
        const fl=Math.hypot(fx,fz)||1,sinA=Math.abs(ux*fz/fl-uz*fx/fl),half=Math.min(14,(s.hw+s.bank*.85)/Math.max(sinA,.4)+.4);
        const A=[px-ux*half,pz-uz*half],Bp=[px+ux*half,pz+uz*half],hA=gy(A[0],A[1]),hB=gy(Bp[0],Bp[1]),ry=Math.atan2(ux,uz),pitch=-Math.atan2(hB-hA,half*2);
        BRIDGES.push({px,pz,ux,uz,half,hw:rw/2+.4,hA,hB});const ym=(hA+hB)/2,deck=foot?0x6b4a32:0x8b9098,rail=foot?0x5a3d28:0x30353d,ww=rw+.5;
        gbPrim(gb,'box',px,ym-.33,pz,ww,.6,half*2,ry,pitch,deck);
        for(const sd of[-1,1]){const ox=uz*sd*(ww/2-.08),oz=-ux*sd*(ww/2-.08);
          if(foot){gbPrim(gb,'box',px+ox,ym+.95,pz+oz,.1,.1,half*2,ry,pitch,rail);gbPrim(gb,'box',px+ox,ym+.5,pz+oz,.06,.06,half*2,ry,pitch,rail);
            for(let k=0;k<=Math.ceil(half);k++){const f=-half+k*(half*2/Math.ceil(half));gbPrim(gb,'box',px+ox+ux*f,ym+.48+(hB-hA)/(2*half)*f,pz+oz+uz*f,.1,1,.1,ry,0,rail)}}
          else{gbPrim(gb,'box',px+ox,ym+.35,pz+oz,.25,.7,half*2,ry,pitch,0x9aa0a8);gbPrim(gb,'box',px+ox,ym+.73,pz+oz,.3,.06,half*2,ry,pitch,0xeef2f7);
            gbPrim(gb,'box',px+ox,ym+.95,pz+oz,.07,.07,half*2,ry,pitch,rail)}
          BRIDGEWALLS.push([A[0]+ox,A[1]+oz,Bp[0]+ox,Bp[1]+oz])}}}}
  roadGroup.add(new THREE.Mesh(ribbons(R.filter(r=>FOOT.includes(r.t)),0.05,()=>0xffffff,r=>Math.max(1.6,r.w),2.2,roadH),MAT.pave));
  roadGroup.add(new THREE.Mesh(ribbons(R.filter(r=>r.t==='track'),0.04,()=>0xffffff,r=>r.w,8,roadH),MAT.track));
  roadGroup.add(new THREE.Mesh(ribbons(R.filter(r=>!FOOT.includes(r.t)&&r.t!=='track'),0.06,()=>0xffffff,r=>r.w,10,roadH),MAT.road));
  /* mřížka úseků silnic (pro výšku na mostech) */
  RSEG.clear();for(const r of R)for(let i=1;i<r.p.length;i++){const[ax,az]=r.p[i-1],[bx,bz]=r.p[i],s=[ax,az,bx,bz,Math.max(1.6,r.w)/2+.25];
    for(let gx=Math.floor((Math.min(ax,bx)-s[4])/RGC);gx<=Math.floor((Math.max(ax,bx)+s[4])/RGC);gx++)for(let gz=Math.floor((Math.min(az,bz)-s[4])/RGC);gz<=Math.floor((Math.max(az,bz)+s[4])/RGC);gz++){
      const k=gx+','+gz;if(!RSEG.has(k))RSEG.set(k,[]);RSEG.get(k).push(s)}}
  if(gb.p.length)roadGroup.add(gbMesh(gb,MAT.vc));
  rebuildGR()}

/* ===================== GRAF CEST (chůze, trasy) ===================== */
const GR={n:[],adj:[],key:new Map()};
function gNode(x,z){const k=Math.round(x*2)+','+Math.round(z*2);let id=GR.key.get(k);if(id===undefined){id=GR.n.length;GR.key.set(k,id);GR.n.push([x,z]);GR.adj.push([])}return id}
function rebuildGR(){GR.n.length=0;GR.adj.length=0;GR.key.clear();
  for(const r of M.r){if(r.t==='steps')continue;let prev=null;
    for(let i=0;i<r.p.length;i++){const[x,z]=r.p[i];
      if(i>0){const[px,pz]=r.p[i-1];const d=Math.hypot(x-px,z-pz),n=Math.ceil(d/8);
        for(let k=1;k<=n;k++){const id=gNode(px+(x-px)*k/n,pz+(z-pz)*k/n);if(prev!==null&&prev!==id){const l=Math.hypot(GR.n[id][0]-GR.n[prev][0],GR.n[id][1]-GR.n[prev][1]);GR.adj[prev].push([id,l]);GR.adj[id].push([prev,l])}prev=id}}
      else prev=gNode(x,z)}}}
function nearestNode(x,z){let b=-1,bd=1e9;for(let i=0;i<GR.n.length;i++){const d=(GR.n[i][0]-x)**2+(GR.n[i][1]-z)**2;if(d<bd){bd=d;b=i}}return b}
function findPath(a,b,G){G=G||GR;/* A* */const N=G.n.length,g=new Float64Array(N).fill(Infinity),from=new Int32Array(N).fill(-1),open=new Set([a]),h=i=>Math.hypot(G.n[i][0]-G.n[b][0],G.n[i][1]-G.n[b][1]);
  const f=new Float64Array(N).fill(Infinity);g[a]=0;f[a]=h(a);
  while(open.size){let c=-1,cf=Infinity;for(const i of open)if(f[i]<cf){cf=f[i];c=i}if(c===b)break;open.delete(c);
    for(const[nb,l]of G.adj[c]){const t=g[c]+l;if(t<g[nb]){g[nb]=t;from[nb]=c;f[nb]=t+h(nb);open.add(nb)}}}
  if(from[b]===-1&&a!==b)return null;const out=[];for(let c=b;c!==-1;c=from[c])out.push(G.n[c]);return out.reverse()}
/* dveře: z editoru, jinak na kraji domu směrem k nejbližší cestě */
function doorOf(b){const dv=b.ov&&b.ov.dv;let e,t;
  if(dv&&dv.e<b.p.length){e=dv.e;t=dv.t}else{const ni=nearestNode(b.cx,b.cz),[nx,nz]=GR.n[ni]||[b.cx,b.cz+5];const q=distToBuilding(b,nx,nz);e=q.e;t=q.t}
  const E=edgeOf(b,e);t=clamp(t,Math.min(.5,.7/E.l),Math.max(.5,1-.7/E.l));const cx=E.ax+(E.bx-E.ax)*t,cz=E.az+(E.bz-E.az)*t;
  const x=cx+E.nx*1.4,z=cz+E.nz*1.4,ni=nearestNode(x,z),[nx,nz]=GR.n[ni]||[x,z];
  return {x,z,node:ni,road:Math.hypot(nx-cx,nz-cz),e,t,cp:[cx,cz],E}}

/* ===================== BUDOVY: vykreslení ===================== */
const WALLS=[0xf1e3c6,0xe8d1a8,0xd9dccf,0xf4efe6,0xcfd8c4,0xe9c9a6,0xd6c2b0,0xeadfcd];
const SNOW=new THREE.Color(0xf4f7fc);
const hash=i=>((i*2654435761)>>>0)%1000/1000;
const ROOF_OK=['house','residential','yes','detached','barn','semidetached_house','apartments'];
function wallColor(b){if(b.ov.cs)return new THREE.Color(b.ov.cs);
  return new THREE.Color(b.t==='barn'?0xa0826d:b.t==='garage'||b.t==='shed'?0xb8b8b8:b.t==='industrial'?0xbfc4cc:b.t==='apartments'?0xd9d4c7:WALLS[Math.floor(hash(b.i)*WALLS.length)])}
function roofColor(b){return b.ov.cr?new THREE.Color(b.ov.cr):b.rc?new THREE.Color('#'+b.rc).lerp(SNOW,.3):SNOW.clone()}
function houseParts(b){const ov=b.ov,geos=[],win=[],winC=[];
  const wall=wallColor(b),roofC=roofColor(b),st=ov.st||'a';
  const sh=new THREE.Shape(b.p.map(([x,z])=>new THREE.Vector2(x,-z)));
  const base=b.gmin-0.4;let g=new THREE.ExtrudeGeometry(sh,{depth:b.top-base,bevelEnabled:false});g.rotateX(-Math.PI/2);g.translate(0,base,0);if(g.index)g=g.toNonIndexed();
  const n=g.attributes.normal,cols=new Float32Array(n.count*3);
  for(let i=0;i<n.count;i++){const c=n.getY(i)>0.7?roofC:wall;cols[i*3]=c.r;cols[i*3+1]=c.g;cols[i*3+2]=c.b}
  g.setAttribute('color',new THREE.BufferAttribute(cols,3));geos.push(g);
  /* střecha: sedlová / valbová přes obdélník kolem domu */
  const autoRoof=ROOF_OK.includes(b.t)&&b.p.length<=8&&(b.r===undefined||b.r>=.8);
  if(st==='s'||st==='v'||(st==='a'&&autoRoof)){
    let best=0,ang=0;for(let i=0,j=b.p.length-1;i<b.p.length;j=i++){const dx=b.p[i][0]-b.p[j][0],dz=b.p[i][1]-b.p[j][1],l=Math.hypot(dx,dz);if(l>best){best=l;ang=Math.atan2(dz,dx)}}
    if(ov.ot)ang+=Math.PI/2;
    const ux=Math.cos(ang),uz=Math.sin(ang),vx=-uz,vz=ux;let u0=1e9,u1=-1e9,v0=1e9,v1=-1e9;
    for(const[x,z]of b.p){const u=(x-b.cx)*ux+(z-b.cz)*uz,v=(x-b.cx)*vx+(z-b.cz)*vz;u0=Math.min(u0,u);u1=Math.max(u1,u);v0=Math.min(v0,v);v1=Math.max(v1,v)}
    const W=v1-v0;
    if(st!=='a'||(Math.abs(b.a)/((u1-u0)*W)>0.72&&W<17)){
      const o=0.45;u0-=o;u1+=o;v0-=o;v1+=o;const vm=(v0+v1)/2,rh=(st!=='a'&&(b.r===undefined||b.r<.8))?Math.min(4.2,W*0.42):b.r!==undefined?(st==='a'?Math.min(b.r,W*.7):b.r):Math.min(4.2,W*0.42),y=b.top,P=(u,v,yy)=>[b.cx+u*ux+v*vx,yy,b.cz+u*uz+v*vz];
      const k=st==='v'?Math.min((v1-v0)/2,(u1-u0)/2-.1):0;
      const A=P(u0,v0,y),Bq=P(u1,v0,y),Cq=P(u1,v1,y),D=P(u0,v1,y),R0=P(u0+k,vm,y+rh),R1=P(u1-k,vm,y+rh);
      const pos=[...A,...Bq,...R1,...A,...R1,...R0,...D,...R0,...R1,...D,...R1,...Cq,...A,...R0,...D,...Bq,...Cq,...R1];
      const cc=[];for(let q=0;q<12;q++)cc.push(roofC.r,roofC.g,roofC.b);const gw=st==='v'?roofC:wall;for(let q=0;q<6;q++)cc.push(gw.r,gw.g,gw.b);
      geos.push(tris(pos,cc))}}
  /* dveře */
  let door=null;const hasDoor=ov.dv||b.adr;
  if(hasDoor&&!['garage','shed','garages'].includes(b.t)){const d=doorOf(b);door=d;const E=d.E,dc=new THREE.Color(ov.dv&&ov.dv.c||'#5a3a24'),fr=new THREE.Color('#d9d4c8');
    const gb=GB(),cx=d.cp[0]+E.nx*.04,cz=d.cp[1]+E.nz*.04,gh=gyC(d.cp[0],d.cp[1]),dw=(ov.dv&&ov.dv.w)||1,ry=Math.atan2(E.nx,E.nz);
    gbPrim(gb,'box',cx,gh+1.1,cz,dw+.16,2.32,.06,ry,0,fr);gbPrim(gb,'box',cx+E.nx*.03,gh+1.06,cz+E.nz*.03,dw,2.12,.06,ry,0,dc);
    gbPrim(gb,'box',cx+E.nx*.1,gh+1.0,cz+E.nz*.1,.08,.08,.06,ry,0,0xc9a227);                         /* klika */
    gbPrim(gb,'box',d.cp[0]+E.nx*.45,gh+.05,d.cp[1]+E.nz*.45,dw+.6,.3,.8,ry,0,0xb7b3ab);               /* schod */
    const dg=gbMesh(gb).geometry;geos.push(dg)}
  /* okna s rámy */
  if(b.h>=4&&!['garage','shed','garages'].includes(b.t)){const sz=+ov.ov||1,lit=ov.sv!==undefined&&ov.sv!==''?+ov.sv:.58,frame=new THREE.Color(ov.rm||'#dedbd2'),fgb=GB();
    for(let i=0;i<b.p.length;i++){const E=edgeOf(b,i);if(E.l<2)continue;
      const cnt=ov.ok&&ov.ok[i]!==undefined?+ov.ok[i]:(E.l<4?0:Math.min(3,Math.floor(E.l/4.2)));if(!cnt)continue;
      const rows=[];for(let yy=1.9;yy<b.h-.9;yy+=2.8)rows.push(yy);if(!rows.length)rows.push(Math.min(1.9,b.h*.5));
      const ry=Math.atan2(E.nx,E.nz),hw=0.55*sz,hh=0.6*sz;
      for(const yy of rows)for(let k=0;k<cnt;k++){const t=(k+1)/(cnt+1)*E.l;
        if(door&&door.e===i&&yy===rows[0]&&Math.abs(t-door.t*E.l)<hw+.8)continue;
        const cx=E.ax+E.dx*t+E.nx*0.07,cz=E.az+E.dz*t+E.nz*0.07,Y=yy+b.y0;
        const isLit=hash(b.i*7+i*3+k+yy*11)<lit;const c=new THREE.Color(isLit?0xffcf73:0x1c2638);
        const a=[cx-E.dx*hw,Y-hh,cz-E.dz*hw],bb=[cx+E.dx*hw,Y-hh,cz+E.dz*hw],c2=[cx+E.dx*hw,Y+hh,cz+E.dz*hw],d=[cx-E.dx*hw,Y+hh,cz-E.dz*hw];
        win.push(...a,...bb,...c2,...a,...c2,...d);for(let q=0;q<6;q++)winC.push(c.r,c.g,c.b);
        gbPrim(fgb,'box',cx-E.nx*.03,Y,cz-E.nz*.03,hw*2+.16,hh*2+.16,.06,ry,0,frame);
        gbPrim(fgb,'box',cx+E.nx*.02,Y,cz+E.nz*.02,.05,hh*2,.03,ry,0,frame);gbPrim(fgb,'box',cx+E.nx*.02,Y+hh*.25,cz+E.nz*.02,hw*2,.05,.03,ry,0,frame);
        gbPrim(fgb,'box',cx+E.nx*.1,Y-hh-.06,cz+E.nz*.1,hw*2+.25,.07,.2,ry,0,0xf2f5fa)}}           /* parapet se sněhem */
    if(fgb.p.length)geos.push(gbMesh(fgb).geometry)}
  return {geos,win,winC,door}}
/* cedulky s číslem popisným */
const plateCache=new Map();
function plateTex(t){if(plateCache.has(t))return plateCache.get(t);const c=document.createElement('canvas');c.width=256;c.height=112;const x=c.getContext('2d');
  x.fillStyle='#b3122e';x.beginPath();x.roundRect?x.roundRect(4,4,248,104,10):x.rect(4,4,248,104);x.fill();x.strokeStyle='#fff';x.lineWidth=6;x.stroke();
  x.fillStyle='#fff';x.textAlign='center';x.textBaseline='middle';x.font='bold 64px Arial';x.fillText(t,128,60);const tx=new THREE.CanvasTexture(c);plateCache.set(t,tx);return tx}
const houseNum=b=>b.adr?b.adr.split(',')[0].replace(/^č\. ?(p|ev)\. ?/,''):'';
let houseGroup=new THREE.Group(),selGroup=new THREE.Group();scene.add(houseGroup,selGroup);
const winMat=new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide});
function houseMesh(list){const geos=[],win=[],winC=[],g=new THREE.Group();
  for(const b of list){const r=houseParts(b);geos.push(...r.geos);win.push(...r.win);winC.push(...r.winC);b.door=r.door;
    if(b.adr&&r.door){const d=r.door,sp=new THREE.Sprite(new THREE.SpriteMaterial({map:plateTex(houseNum(b))}));sp.scale.set(.75,.33,1);
      const s=d.E.l>2.4?(d.t*d.E.l>1.3?-1:1):0;sp.position.set(d.cp[0]+d.E.nx*.15+d.E.dx*s*1.05,2.3+gyC(d.cp[0],d.cp[1]),d.cp[1]+d.E.nz*.15+d.E.dz*s*1.05);g.add(sp)}}
  if(geos.length){const m=new THREE.Mesh(merged(geos),MAT.vc);m.userData.houses=true;g.add(m)}
  if(win.length){const wg=new THREE.BufferGeometry();wg.setAttribute('position',new THREE.Float32BufferAttribute(win,3));wg.setAttribute('color',new THREE.Float32BufferAttribute(winC,3));g.add(new THREE.Mesh(wg,winMat))}
  return g}
function disposeG(g){g.traverse(o=>{if(o.geometry)o.geometry.dispose()})}
/* sel = dům, který se právě upravuje (kreslí se zvlášť, aby se rychle přestavoval) */
let SELB=null;
function buildHouses(sel){SELB=sel||null;scene.remove(houseGroup);disposeG(houseGroup);houseGroup=houseMesh(B.filter(b=>b!==SELB));scene.add(houseGroup);buildSel()}
function buildSel(){scene.remove(selGroup);disposeG(selGroup);selGroup=SELB?houseMesh([SELB]):new THREE.Group();scene.add(selGroup)}

/* přístupové cestičky k domům */
let pathGroup=new THREE.Group();scene.add(pathGroup);
function housePath(b){const c=UPR.cesty[b.id];if(c){if(c.del)return null;return {p:c.p,w:c.w||1.5,own:true}}
  if(!b.v||!b.door||b.door.road>=22)return null;const[nx,nz]=GR.n[b.door.node];return {p:[[nx,nz],[b.door.x,b.door.z]],w:1.5}}
function buildPaths(){scene.remove(pathGroup);disposeG(pathGroup);pathGroup=new THREE.Group();scene.add(pathGroup);
  const segs=[];for(const b of B){const p=housePath(b);if(p&&p.p.length>1)segs.push(p)}
  pathGroup.add(new THREE.Mesh(ribbons(segs,0.05,()=>0xffffff,s=>s.w,2),MAT.pave))}

/* ===================== LAMPY ===================== */
{const n=M.lamps.length,dummy=new THREE.Object3D();
 const pole=new THREE.InstancedMesh(new THREE.CylinderGeometry(0.07,0.09,5,6),new THREE.MeshLambertMaterial({color:0x2b2f38}),n);
 const head=new THREE.InstancedMesh(new THREE.SphereGeometry(0.28,8,6),new THREE.MeshBasicMaterial({color:0xffe2a8}),n);
 const pg=new THREE.PlaneGeometry(13,13);pg.rotateX(-Math.PI/2);
 const pool=new THREE.InstancedMesh(pg,new THREE.MeshBasicMaterial({map:GLOW,color:0xffb347,transparent:true,opacity:.55,blending:THREE.AdditiveBlending,depthWrite:false}),n);
 M.lamps.forEach(([x,z],i)=>{const gh=groundH(x,z);dummy.position.set(x,2.5+gh,z);dummy.updateMatrix();pole.setMatrixAt(i,dummy.matrix);
  dummy.position.set(x,5.05+gh,z);dummy.updateMatrix();head.setMatrixAt(i,dummy.matrix);
  dummy.position.set(x,0.08+gh,z);dummy.updateMatrix();pool.setMatrixAt(i,dummy.matrix);
  const s=new THREE.Sprite(new THREE.SpriteMaterial({map:GLOW,color:0xffd08a,transparent:true,opacity:.8,blending:THREE.AdditiveBlending,depthWrite:false}));s.scale.set(3,3,1);s.position.set(x,5.05+gh,z);scene.add(s)});
 scene.add(pole,head,pool)}

/* ===================== STROMY: skutečné polohy a výšky z ČÚZK (jehličnany, holé listnáče) ===================== */
const TREEGRID=new Map();let treeGroup=new THREE.Group();scene.add(treeGroup);
const treeKey=t=>t[0]+','+t[1];
const DECGEO=(()=>{const parts=[];const cyl=(r0,r1,l,x,y,z,rx,rz)=>{const g=new THREE.CylinderGeometry(r1,r0,l,5);g.translate(0,l/2,0);g.rotateX(rx);g.rotateZ(rz);g.translate(x,y,z);return g.index?g.toNonIndexed():g};
 parts.push(cyl(.18,.12,2.6,0,0,0,0,0));
 for(let i=0;i<6;i++){const a=i/6*Math.PI*2;parts.push(cyl(.09,.03,2.2,0,2.1+i%2*.4,0,Math.sin(a)*.75,Math.cos(a)*.75))}
 for(let i=0;i<8;i++){const a=i/8*Math.PI*2+.3;parts.push(cyl(.04,.015,1.4,Math.cos(a)*.9,3.4+(i%3)*.3,Math.sin(a)*.9,Math.sin(a)*1.1,Math.cos(a)*1.1))}
 let n=0;parts.forEach(g=>n+=g.attributes.position.count);const pos=new Float32Array(n*3);let o=0;parts.forEach(g=>{pos.set(g.attributes.position.array,o*3);o+=g.attributes.position.count});
 const dg=new THREE.BufferGeometry();dg.setAttribute('position',new THREE.BufferAttribute(pos,3));dg.computeVertexNormals();return dg})();
const hashT=i=>((i*2654435761)>>>0)%1000/1000;
function buildTrees(){scene.remove(treeGroup);treeGroup=new THREE.Group();scene.add(treeGroup);TREEGRID.clear();
 const gone=new Set(UPR.st),T=M.trees||[],con=[],dec=[];
 T.forEach((t,i)=>{if(gone.has(treeKey(t)))return;(hashT(i)<.45?con:dec).push([t,i]);const k=Math.floor(t[0]/8)+','+Math.floor(t[1]/8);if(!TREEGRID.has(k))TREEGRID.set(k,[]);TREEGRID.get(k).push(t)});
 const d=new THREE.Object3D();
 const tr=new THREE.InstancedMesh(new THREE.ConeGeometry(2.2,6,8),new THREE.MeshLambertMaterial({color:0x29523a}),con.length);
 const sn=new THREE.InstancedMesh(new THREE.ConeGeometry(1.25,2.4,8),new THREE.MeshLambertMaterial({color:0xf2f6fb}),con.length);
 const tk=new THREE.InstancedMesh(new THREE.CylinderGeometry(.22,.3,1.6,5),new THREE.MeshLambertMaterial({color:0x4b3527}),con.length);
 con.forEach(([[x,z,h],ti],i)=>{const s=Math.max(.5,h/7.6),gh=groundH(x,z)-.3;d.scale.set(s*(.85+hashT(ti+7)*.3),s,s*(.85+hashT(ti+3)*.3));d.rotation.set(0,0,0);d.position.set(x,(.8+3)*s+gh,z);d.updateMatrix();tr.setMatrixAt(i,d.matrix);
   d.position.set(x,(.8+5.3)*s+gh,z);d.updateMatrix();sn.setMatrixAt(i,d.matrix);d.position.set(x,.8*s+gh,z);d.updateMatrix();tk.setMatrixAt(i,d.matrix)});
 const dm=new THREE.InstancedMesh(DECGEO,new THREE.MeshLambertMaterial({color:0x4a3f38}),dec.length);
 dec.forEach(([[x,z,h],ti],i)=>{const s=Math.max(.6,h/4.6);d.scale.set(s,s,s);d.rotation.set(0,hashT(ti+11)*6.28,0);d.position.set(x,groundH(x,z)-.3,z);d.updateMatrix();dm.setMatrixAt(i,d.matrix)});
 for(const m of[tr,sn,tk])m.userData.trees=con.map(c=>c[0]);dm.userData.trees=dec.map(c=>c[0]);
 treeGroup.add(tr,sn,tk,dm)}
function treeBlock(pos,r){const gx=Math.floor(pos.x/8),gz=Math.floor(pos.z/8);
  for(let a=-1;a<=1;a++)for(let c=-1;c<=1;c++){const l=TREEGRID.get((gx+a)+','+(gz+c));if(!l)continue;
    for(const t of l){const dx=pos.x-t[0],dz=pos.z-t[1],d=Math.hypot(dx,dz),m=r+.35;if(d<m&&d>1e-4){pos.x=t[0]+dx/d*m;pos.z=t[1]+dz/d*m}}}}

/* ===================== AUTO (kombi, bez značky) ===================== */
const CAR_COL=[0x2b2f36,0xc9ccd1,0x1f2a44,0xf0f0f0,0x5a0f18,0x3b4a3f];
function makeCar(col,parked){const g=new THREE.Group();col=col!==undefined?col:CAR_COL[Math.floor(Math.random()*CAR_COL.length)];
  const paint=new THREE.MeshStandardMaterial({color:col,metalness:.6,roughness:.35}),glass=new THREE.MeshStandardMaterial({color:0x141c28,metalness:.8,roughness:.15}),blk=stdM(0x111111),snowM=stdM(0xf3f6fb,{roughness:1});
  const add=(geo,m,x,y,z)=>{const o=new THREE.Mesh(geo,m);o.position.set(x,y,z);g.add(o);return o};
  add(new THREE.BoxGeometry(1.84,.6,4.85),paint,0,.6,0);
  const hood=add(new THREE.BoxGeometry(1.8,.12,1.2),paint,0,.94,1.75);hood.rotation.x=.08;
  add(new THREE.BoxGeometry(1.64,.5,2.95),glass,0,1.15,-.4);
  add(new THREE.BoxGeometry(1.66,.07,2.9),paint,0,1.43,-.42);
  add(new THREE.BoxGeometry(1.5,.06,2.6),snowM,0,1.49,-.45);
  for(const x of[-.7,.7])add(new THREE.BoxGeometry(.04,.06,2.5),stdM(0x9aa0a6,{metalness:.8}),x,1.53,-.4);
  add(new THREE.BoxGeometry(1.5,.18,.05),blk,0,.66,2.43);
  const wheels=[];for(const x of[-.88,.88])for(const z of[-1.55,1.5]){const w=add(new THREE.CylinderGeometry(.34,.34,.25,14),blk,x,.34,z);w.rotation.z=Math.PI/2;wheels.push(w)}
  const hl=new THREE.MeshBasicMaterial({color:parked?0x8a8a80:0xfdfbf0}),tl=new THREE.MeshBasicMaterial({color:parked?0x6a1a1a:0xff2a2a});
  for(const x of[-.66,.66]){add(new THREE.BoxGeometry(.38,.1,.05),hl,x,.72,2.44);add(new THREE.BoxGeometry(.42,.08,.05),tl,x,.8,-2.44);
    if(!parked){const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:GLOW,color:0xfff3d0,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false}));sp.scale.set(1.6,1.6,1);sp.position.set(x,.72,2.55);g.add(sp)}}
  if(!parked){const pg=new THREE.PlaneGeometry(5,11);pg.rotateX(-Math.PI/2);const pool=new THREE.Mesh(pg,new THREE.MeshBasicMaterial({map:GLOW,color:0xfff0c8,transparent:true,opacity:.7,blending:THREE.AdditiveBlending,depthWrite:false}));pool.position.set(0,.06,8);g.add(pool)}
  else add(new THREE.BoxGeometry(1.7,.08,4.2),snowM,0,.95,.4);
  g.userData.wheels=wheels;return g}

/* ===================== PLOTY A VLASTNÍ OBJEKTY ===================== */
const OBJ_KINDS={
  plot:{n:'Plot',line:true,st:'latky',h:1.2,c:'#8a6a4a'},
  kvadr:{n:'Kvádr',w:2,h:2,d:2,c:'#b9b2a6'},valec:{n:'Válec',w:1,h:2,c:'#9aa0a8'},
  strom_j:{n:'Jehličnatý strom',h:9},strom_l:{n:'Listnatý strom',h:8},ker:{n:'Keř',s:1.5},
  lavicka:{n:'Lavička',c:'#7a5233'},snehulak:{n:'Sněhulák',s:1},auto:{n:'Zaparkované auto',c:'#2b2f36'},
  popelnice:{n:'Popelnice',c:'#3c5a3c'},lampa:{n:'Lampa'},kriz:{n:'Kříž',h:3,c:'#d8d4cc'},drevo:{n:'Hranice dřeva',w:2.5,h:1.2},
  branka:{n:'Branka / vrata',w:1.2,h:1.3,c:'#7a5a3a'},kaplicka:{n:'Kaplička',c:'#efe8dc'},model:{n:'Vlastní model (.obj)',s:3,c:'#c8c8c8'}};
const FENCE_ST={latky:'Laťkový (dřevěný)',prkna:'Prkenný',pletivo:'Pletivo',zed:'Zděný / zeď',zivy:'Živý plot'};
const objOpt=(o,k)=>o[k]!==undefined&&o[k]!==''?o[k]:OBJ_KINDS[o.k][k];
/* jednoduchý načítač OBJ (v / f) */
const objCache=new Map();
function parseOBJ(txt){const v=[],P=[];for(const ln of txt.split('\n')){const t=ln.trim().split(/\s+/);
  if(t[0]==='v')v.push([+t[1],+t[2],+t[3]]);else if(t[0]==='f'){const ix=t.slice(1).map(s=>{const i=parseInt(s.split('/')[0],10);return i<0?v.length+i:i-1});
    for(let k=1;k+1<ix.length;k++)for(const q of[ix[0],ix[k],ix[k+1]]){const p=v[q];if(p)P.push(p[0],p[1],p[2]);else P.push(0,0,0)}}}
  let mn=[1e9,1e9,1e9],mx=[-1e9,-1e9,-1e9];for(let i=0;i<P.length;i+=3)for(let a=0;a<3;a++){mn[a]=Math.min(mn[a],P[i+a]);mx[a]=Math.max(mx[a],P[i+a])}
  const sc=1/Math.max(1e-6,mx[0]-mn[0],mx[1]-mn[1],mx[2]-mn[2]),cx=(mn[0]+mx[0])/2,cz=(mn[2]+mx[2])/2;
  for(let i=0;i<P.length;i+=3){P[i]=(P[i]-cx)*sc;P[i+1]=(P[i+1]-mn[1])*sc;P[i+2]=(P[i+2]-cz)*sc}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(P,3));g.computeVertexNormals();return g}
function fenceMesh(o,gb,glass){const p=o.p,st=o.st||'latky',h=+objOpt(o,'h'),col=new THREE.Color(o.c||({zed:'#b9b2a6',zivy:'#2f4a2f',pletivo:'#50555c'}[st]||OBJ_KINDS.plot.c)),snow=0xf2f6fb;
  for(let i=1;i<p.length;i++){const[ax,az]=p[i-1],[bx,bz]=p[i],l=Math.hypot(bx-ax,bz-az);if(l<.05)continue;const ux=(bx-ax)/l,uz=(bz-az)/l,ry=Math.atan2(ux,uz);
    const H=(x,z)=>groundH(x,z),ha=H(ax,az),hb=H(bx,bz),pitch=-Math.atan2(hb-ha,l),mx=(ax+bx)/2,mz=(az+bz)/2,hm=(ha+hb)/2;
    if(st==='zed'||st==='zivy'){const t=st==='zed'?.3:.8,nx=uz*t/2,nz=-ux*t/2,c=col;
      const A=[ax+nx,ha-.3,az+nz],Bv=[bx+nx,hb-.3,bz+nz],C=[bx+nx,hb+h,bz+nz],D=[ax+nx,ha+h,az+nz],A2=[ax-nx,ha-.3,az-nz],B2=[bx-nx,hb-.3,bz-nz],C2=[bx-nx,hb+h,bz-nz],D2=[ax-nx,ha+h,az-nz];
      gbQuad(gb,A,Bv,C,D,c);gbQuad(gb,B2,A2,D2,C2,c);gbQuad(gb,D,C,C2,D2,c);gbQuad(gb,A2,A,D,D2,c);gbQuad(gb,Bv,B2,C2,C,c);
      const s=[ax,ha+h+.04,az],e=[bx,hb+h+.04,bz],sx=nx*1.15,sz=nz*1.15;gbQuad(gb,[s[0]+sx,s[1],s[2]+sz],[e[0]+sx,e[1],e[2]+sz],[e[0]-sx,e[1],e[2]-sz],[s[0]-sx,s[1],s[2]-sz],snow);continue}
    const posts=Math.max(1,Math.ceil(l/2.2));
    for(let k=0;k<=posts;k++){if(k===0&&i>1)continue;const f=k/posts,x=ax+(bx-ax)*f,z=az+(bz-az)*f,y=H(x,z);gbPrim(gb,'box',x,y+(h+.1)/2-.05,z,.11,h+.1,.11,ry,0,st==='pletivo'?0x50555c:col);
      gbPrim(gb,'box',x,y+h+.08,z,.14,.05,.14,ry,0,snow)}
    if(st==='pletivo'){const nx=uz*.01,nz=-ux*.01;glass.p.push([ax+nx,ha+.05,az+nz],[bx+nx,hb+.05,bz+nz],[bx+nx,hb+h-.05,bz+nz],[ax+nx,ha+h-.05,az+nz],l,h);
      gbPrim(gb,'box',mx,hm+h-.03,mz,.04,.04,l,ry,pitch,0x50555c);continue}
    if(st==='prkna'){for(let k=0;k<4;k++){const y=.15+k*(h-.2)/4+(h-.2)/8;gbPrim(gb,'box',mx+uz*.06,hm+y,mz-ux*.06,.03,(h-.2)/4-.04,l,ry,pitch,col)}
      gbPrim(gb,'box',mx+uz*.06,hm+h-.02,mz-ux*.06,.05,.04,l,ry,pitch,snow);continue}
    /* laťky */
    for(const y of[.25*h,.78*h])gbPrim(gb,'box',mx+uz*.07,hm+y,mz-ux*.07,.04,.08,l,ry,pitch,col.clone().multiplyScalar(.8));
    const n=Math.floor(l/.17);for(let k=0;k<n;k++){const f=(k+.5)/n,x=ax+(bx-ax)*f+uz*.1,z=az+(bz-az)*f-ux*.1,y=H(x,z);
      gbPrim(gb,'box',x,y+h*.5,z,.08,h*.92,.025,ry,0,col);gbPrim(gb,'box',x,y+h*.95,z,.09,.04,.04,ry,0,snow)}}}
function objMesh(o){const g=new THREE.Group(),gb=GB(),glass={p:[]},k=o.k,c=o.c||OBJ_KINDS[k].c||'#cccccc',x=o.x,z=o.z;g.userData.oid=o.id;
  if(OBJ_KINDS[k].line){fenceMesh(o,gb,glass);
    if(glass.p.length){const P=[],U=[];for(let i=0;i<glass.p.length;i+=6){const[a,b,cc,d,l,h]=glass.p.slice(i,i+6);P.push(...a,...b,...cc,...a,...cc,...d);U.push(0,0,l*3,0,l*3,h*3,0,0,l*3,h*3,0,h*3)}
      const mg=new THREE.BufferGeometry();mg.setAttribute('position',new THREE.Float32BufferAttribute(P,3));mg.setAttribute('uv',new THREE.Float32BufferAttribute(U,2));mg.computeVertexNormals();g.add(new THREE.Mesh(mg,MAT.mesh))}
    if(gb.p.length)g.add(gbMesh(gb,MAT.vc));return g}
  const s=+objOpt(o,'s')||1,h=+objOpt(o,'h')||1,w=+objOpt(o,'w')||1,d=+objOpt(o,'d')||w;
  const L=GB();   /* místní souřadnice, celé se pak posune a otočí */
  if(k==='kvadr'){gbPrim(L,'box',0,h/2,0,w,h,d,0,0,c);gbPrim(L,'box',0,h+.04,0,w+.04,.08,d+.04,0,0,0xf2f6fb)}
  else if(k==='valec'){gbPrim(L,'cyl',0,h/2,0,w,h,w,0,0,c);gbPrim(L,'cyl',0,h+.04,0,w+.03,.08,w+.03,0,0,0xf2f6fb)}
  else if(k==='strom_j'){const q=h/7.6;gbPrim(L,'cyl6',0,.8*q,0,.5*q,1.6*q,.5*q,0,0,0x4b3527);gbPrim(L,'cone',0,3.8*q,0,4.4*q,6*q,4.4*q,0,0,0x29523a);gbPrim(L,'cone',0,6.1*q,0,2.5*q,2.4*q,2.5*q,0,0,0xf2f6fb)}
  else if(k==='strom_l'){const m=new THREE.Mesh(DECGEO,new THREE.MeshLambertMaterial({color:0x4a3f38}));const q=h/4.6;m.scale.set(q,q,q);g.add(m)}
  else if(k==='ker'){gbPrim(L,'sph',0,.45*s,0,1.3*s,.9*s,1.3*s,0,0,0x2f4a2f);gbPrim(L,'sph',0,.7*s,0,1.1*s,.5*s,1.1*s,0,0,0xf2f6fb)}
  else if(k==='lavicka'){for(const zz of[-.12,.12])gbPrim(L,'box',0,.45,zz,1.6,.04,.12,0,0,c);gbPrim(L,'box',0,.75,-.2,1.6,.25,.04,0,-.15,c);
    for(const xx of[-.7,.7]){gbPrim(L,'box',xx,.22,0,.06,.45,.4,0,0,0x2e333b);gbPrim(L,'box',xx,.6,-.2,.06,.4,.05,0,0,0x2e333b)}gbPrim(L,'box',0,.49,0,1.55,.04,.3,0,0,0xf2f6fb)}
  else if(k==='snehulak'){gbPrim(L,'sph',0,.4*s,0,.8*s,.8*s,.8*s,0,0,0xf6f8fb);gbPrim(L,'sph',0,.98*s,0,.58*s,.58*s,.58*s,0,0,0xf6f8fb);gbPrim(L,'sph',0,1.42*s,0,.4*s,.4*s,.4*s,0,0,0xf6f8fb);
    gbPrim(L,'cone',0,1.43*s,.24*s,.07*s,.25*s,.07*s,0,Math.PI/2,0xe07a1f);gbPrim(L,'cyl',0,1.72*s,0,.3*s,.3*s,.3*s,0,0,0x7a4a2a);
    for(const xx of[-.07,.07])gbPrim(L,'sph',xx*s,1.5*s,.18*s,.05*s,.05*s,.05*s,0,0,0x111111)}
  else if(k==='auto'){const car=makeCar(new THREE.Color(c).getHex(),true);g.add(car)}
  else if(k==='popelnice'){gbPrim(L,'box',0,.5,0,.6,1,.7,0,0,c);gbPrim(L,'box',0,1.04,-.02,.64,.08,.76,0,0,0xf2f6fb);for(const xx of[-.25,.25])gbPrim(L,'cyl',xx,.1,-.35,.2,.1,.2,0,0,0x111111,Math.PI/2)}
  else if(k==='lampa'){gbPrim(L,'cyl6',0,2.5,0,.14,5,.14,0,0,0x2b2f38);const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:GLOW,color:0xffd08a,transparent:true,opacity:.8,blending:THREE.AdditiveBlending,depthWrite:false}));sp.scale.set(3,3,1);sp.position.y=5.05;g.add(sp);
    const hm=new THREE.Mesh(new THREE.SphereGeometry(.28,8,6),new THREE.MeshBasicMaterial({color:0xffe2a8}));hm.position.y=5.05;g.add(hm)}
  else if(k==='kriz'){gbPrim(L,'box',0,.3,0,.7,.6,.7,0,0,0x9a958c);gbPrim(L,'box',0,.6+h/2,0,.14,h,.14,0,0,c);gbPrim(L,'box',0,.6+h*.72,0,1,.13,.14,0,0,c)}
  else if(k==='drevo'){gbPrim(L,'box',0,h/2,0,w,h,.9,0,0,0x7b5a3c);for(let i=0;i<Math.floor(w/.25);i++)for(let j=0;j<Math.floor(h/.25);j++)gbPrim(L,'cyl6',-w/2+.12+i*.25,.12+j*.25,.46,.2,.02,.2,0,Math.PI/2,0xc9a273);
    gbPrim(L,'box',0,h+.2,0,w+.3,.06,1.2,0,.15,0x4a4a4a);gbPrim(L,'box',0,h+.25,0,w+.3,.05,1.2,0,.15,0xf2f6fb)}
  else if(k==='branka'){for(const xx of[-w/2-.07,w/2+.07])gbPrim(L,'box',xx,(h+.2)/2,0,.14,h+.2,.14,0,0,c);
    const n=Math.max(3,Math.floor(w/.16));for(let i=0;i<n;i++)gbPrim(L,'box',-w/2+(i+.5)*w/n,h*.52,0,.08,h*.88,.03,0,0,c);for(const y of[.25*h,.8*h])gbPrim(L,'box',0,y,-.03,w,.08,.04,0,0,c)}
  else if(k==='kaplicka'){gbPrim(L,'box',0,1.4,0,2,2.8,2,0,0,c);gbPrim(L,'box',0,3.2,0,2.4,.1,2.4,0,0,0x6b4a3a);gbPrim(L,'cone',0,3.9,0,2.9,1.4,2.9,Math.PI/4,0,0xf2f6fb);
    gbPrim(L,'box',0,1.1,1.01,.9,1.6,.05,0,0,0x3a2a1e);gbPrim(L,'box',0,4.85,0,.06,.6,.06,0,0,0x2b2b2b);gbPrim(L,'box',0,4.95,0,.3,.06,.06,0,0,0x2b2b2b)}
  else if(k==='model'){const md=UPR.mod[o.m];if(md){let geo=objCache.get(o.m);if(!geo){geo=parseOBJ(md.d);objCache.set(o.m,geo)}const m=new THREE.Mesh(geo,new THREE.MeshLambertMaterial({color:c,side:THREE.DoubleSide}));m.scale.setScalar(s);g.add(m)}}
  if(L.p.length)g.add(gbMesh(L,MAT.vc));
  g.position.set(x,groundH(x,z),z);g.rotation.y=(+o.rot||0)*Math.PI/180;return g}
/* kolizní tvar objektu */
function objCollide(o){const k=o.k;
  if(OBJ_KINDS[k].line){for(let i=1;i<o.p.length;i++)addWallSeg(o.p[i-1][0],o.p[i-1][1],o.p[i][0],o.p[i][1],o.st==='zivy'?.4:.15);return}
  const a=(+o.rot||0)*Math.PI/180,ca=Math.cos(a),sa=Math.sin(a),R=(lx,lz)=>[o.x+lx*ca+lz*sa,o.z-lx*sa+lz*ca];
  const rect=(w,d)=>{const P=[R(-w/2,-d/2),R(w/2,-d/2),R(w/2,d/2),R(-w/2,d/2)];for(let i=0;i<4;i++)addWallSeg(P[i][0],P[i][1],P[(i+1)%4][0],P[(i+1)%4][1],.05)};
  const w=+objOpt(o,'w')||1,s=+objOpt(o,'s')||1;
  if(k==='kvadr')rect(w,+objOpt(o,'d')||w);else if(k==='auto')rect(1.9,4.9);else if(k==='drevo')rect(w,.9);else if(k==='kaplicka')rect(2,2);
  else if(k==='branka'){const P=[R(-w/2,0),R(w/2,0)];addWallSeg(P[0][0],P[0][1],P[1][0],P[1][1],.1)}
  else addCirc(o.x,o.z,{valec:w/2,strom_j:.4,strom_l:.35,ker:.6*s,lavicka:.6,snehulak:.45*s,popelnice:.45,lampa:.15,kriz:.4,model:.4*s}[k]||.4)}
let objGroup=new THREE.Group();scene.add(objGroup);const objMeshes=new Map();
const OSMFENCES=(M.f||[]).map((f,i)=>({id:'osm'+i,k:'plot',st:f.t==='fence'?'pletivo':'zed',h:f.t==='retaining_wall'?.8:1.5,p:f.p,osm:true}));
function buildObjects(){scene.remove(objGroup);disposeG(objGroup);objGroup=new THREE.Group();scene.add(objGroup);objMeshes.clear();
  for(const o of OSMFENCES.concat(UPR.o)){const m=objMesh(o);objGroup.add(m);objMeshes.set(o.id,m)}}
function updateObject(o){const old=objMeshes.get(o.id);if(old){objGroup.remove(old);disposeG(old)}if(UPR.o.includes(o)){const m=objMesh(o);objGroup.add(m);objMeshes.set(o.id,m)}else objMeshes.delete(o.id)}
function buildCollision(){WALLG.clear();CIRC=new Map();for(const s of BRIDGEWALLS)addWallSeg(s[0],s[1],s[2],s[3],.15);for(const o of OSMFENCES.concat(UPR.o))objCollide(o)}

/* ===================== SESTAVENÍ SVĚTA ===================== */
function buildWorld(){buildRoads();makeB();buildHouses(SELB&&B.find(b=>b.id===SELB.id));buildPaths();buildTrees();buildObjects();buildCollision()}
buildWorld();
