/* Editor mapy Lidečka (jen pro správce): budovy (barvy, střechy, střešní okna a vikýře, okna, dveře, poloha), silnice a cesty, ploty a objekty.
   Rozdělané změny drží v prohlížeči, tlačítko Uložit změny je zapíše do databáze (kolekce mapa) a hra je načte všude. */
'use strict';
let day=true;setDay(true,0.0035);camera.far=1200;camera.updateProjectionMatrix();
const r1=v=>Math.round(v*10)/10;
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const ED={tab:'dum',part:null,placeRo:null,moveH:false,b:null,wall:null,road:null,obj:null,tree:null,line:null,draw:null,place:null,vi:-1};

/* ===================== KAMERA (otáčení kolem bodu) ===================== */
const orbit={x:M.start[0],z:M.start[1]+60,yaw:.6,pitch:.75,dist:90};
function camUpd(){const y=groundH(orbit.x,orbit.z),cp=Math.cos(orbit.pitch);
  camera.position.set(orbit.x+Math.sin(orbit.yaw)*cp*orbit.dist,y+Math.sin(orbit.pitch)*orbit.dist,orbit.z+Math.cos(orbit.yaw)*cp*orbit.dist);camera.lookAt(orbit.x,y,orbit.z)}
function flyTo(x,z,dist){orbit.x=x;orbit.z=z;if(dist)orbit.dist=dist}

/* ===================== UNDO + UKLÁDÁNÍ ===================== */
const undo=[];
function snap(){undo.push(JSON.stringify(UPR));if(undo.length>60)undo.shift()}
/* koncept (neuložené změny) se průběžně drží v prohlížeči; „Uložit změny“ ho zapíše do databáze a hra ho pak načte všude */
const EDDB=window.EDDB||{pub:null,save:null};
const canon=u=>JSON.stringify(Object.assign({},u,{t:0}));
let savedC=canon(normUpr(EDDB.pub?JSON.parse(JSON.stringify(EDDB.pub)):null)),saving=false;
const isDirty=()=>canon(UPR)!==savedC;
function status(){const d=isDirty(),st=$('status'),bs=$('bSave');
  st.classList.toggle('dirty',d);st.textContent=saving?'Ukládám…':d?'Neuložené změny – zatím jen v tomto prohlížeči. Ulož je tlačítkem Uložit změny.':'Vše uloženo'+(EDDB.info&&EDDB.info.t?' · '+new Date(EDDB.info.t).toLocaleString('cs-CZ')+(EDDB.info.by?' ('+EDDB.info.by+')':''):'')+'.';
  bs.disabled=!d||saving;bs.textContent=saving?'Ukládám…':d?'Uložit změny':'Uloženo'}
let saveT=0;
function changed(){status();clearTimeout(saveT);saveT=setTimeout(()=>{if(!saveUpr())toast('Koncept se nevešel do prohlížeče – ulož změny do databáze.',3500);status()},250)}
async function saveAll(){if(saving||!isDirty())return;if(!EDDB.save){toast('Databáze není dostupná');return}
  saving=true;status();UPR.t=Date.now();const json=JSON.stringify(UPR);
  try{await EDDB.save(json,UPR.t);savedC=canon(UPR);EDDB.info={t:UPR.t,by:EDDB.me&&EDDB.me.jmeno};try{localStorage.setItem(UPR_KEY,json)}catch(e){}toast('Uloženo – hra teď všude načte tyto úpravy',2600)}
  catch(e){console.error(e);toast(/permission|insufficient/i.test(String(e&&(e.code||e.message)))?'Databáze uložení odmítla (chybí pravidlo pro mapu, nebo nejsi správce).':'Uložení se nepovedlo – zkus to znovu.',4000)}
  saving=false;status()}
function onLeave(e){if(isDirty()){saveUpr();e.preventDefault();e.returnValue=''}}addEventListener('beforeunload',onLeave);
function doUndo(){if(!undo.length){toast('Není co vrátit');return}const u=JSON.parse(undo.pop());for(const k of Object.keys(UPR))delete UPR[k];Object.assign(UPR,normUpr(u));
  const id=ED.b&&ED.b.id;ED.line=null;ED.part=null;ED.obj=null;ED.tree=null;ED.road=null;buildWorld();ED.b=id?B.find(b=>b.id===id)||null:null;buildHouses(ED.b);changed();render();toast('Vráceno')}

/* ===================== POMOCNÉ 3D: zvýraznění, body ===================== */
const over=new THREE.Group();scene.add(over);
const lineMat=c=>new THREE.LineBasicMaterial({color:c,depthTest:false,transparent:true});
function poly3(pts,y0,close,col){const P=[];for(const[x,z]of pts)P.push(x,(typeof y0==='function'?y0(x,z):y0)+.15,z);if(close&&pts.length)P.push(P[0],P[1],P[2]);
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(P,3));const l=new THREE.Line(g,lineMat(col));l.renderOrder=20;return l}
const hGeo=new THREE.SphereGeometry(1,10,8),hMat=new THREE.MeshBasicMaterial({color:0xffffff,depthTest:false}),hSel=new THREE.MeshBasicMaterial({color:0xffc400,depthTest:false}),hMid=new THREE.MeshBasicMaterial({color:0x8a8f99,depthTest:false,transparent:true,opacity:.85});
let handles=[];
function overlay(){over.clear();handles=[];
  if(ED.b){const b=ED.b;over.add(poly3(b.p,b.top,true,0xffc400),poly3(b.p,(x,z)=>gyC(x,z)-.1,true,0xffc400));
    if(ED.wall!==null&&ED.wall<b.p.length){const E=edgeOf(b,ED.wall);const g=new THREE.BufferGeometry();
      g.setAttribute('position',new THREE.Float32BufferAttribute([E.ax,b.gmin,E.az,E.bx,b.gmin,E.bz,E.bx,b.top,E.bz,E.ax,b.top,E.az],3));g.setIndex([0,1,2,0,2,3]);
      const m=new THREE.Mesh(g,new THREE.MeshBasicMaterial({color:0xffc400,transparent:true,opacity:.22,side:THREE.DoubleSide,depthTest:false}));m.renderOrder=19;over.add(m)}
    const pr=partRect();if(pr){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pr.flat().concat(pr[0]),3));const l=new THREE.Line(g,lineMat(0x4fc3f7));l.renderOrder=22;over.add(l)}}
  if(ED.obj&&!OBJ_KINDS[ED.obj.k].line){const m=objMeshes.get(ED.obj.id);if(m){const bh=new THREE.BoxHelper(m,0xffc400);bh.material.depthTest=false;bh.renderOrder=20;over.add(bh)}}
  if(ED.tree){const[x,z,h]=ED.tree;over.add(poly3([[x-1.5,z-1.5],[x+1.5,z-1.5],[x+1.5,z+1.5],[x-1.5,z+1.5]],groundH(x,z),true,0xffc400))}
  if(ED.line){const P=ED.line.pts;over.add(poly3(P,roadH,false,0xffc400));
    P.forEach(([x,z],i)=>{const m=new THREE.Mesh(hGeo,i===ED.vi?hSel:hMat);m.position.set(x,roadH(x,z)+.3,z);m.userData.h={i};m.renderOrder=21;over.add(m);handles.push(m)});
    for(let i=1;i<P.length;i++){const x=(P[i-1][0]+P[i][0])/2,z=(P[i-1][1]+P[i][1])/2,m=new THREE.Mesh(hGeo,hMid);m.position.set(x,roadH(x,z)+.3,z);m.userData.h={mid:i};m.renderOrder=21;over.add(m);handles.push(m)}}
  if(ED.draw&&ED.draw.pts.length)over.add(poly3(ED.draw.pts.concat(ED.draw.hover?[ED.draw.hover]:[]),roadH,false,0x4fc3f7))}
function scaleHandles(){const s=Math.max(.25,camera.position.distanceTo(new THREE.Vector3(orbit.x,groundH(orbit.x,orbit.z),orbit.z))*.009);for(const h of handles)h.scale.setScalar(h.userData.h.mid?s*.7:s)}

/* ===================== VÝBĚR MYŠÍ ===================== */
const ray=new THREE.Raycaster(),mv=new THREE.Vector2();
function setRay(e){const r=canvas.getBoundingClientRect();mv.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(mv,camera)}
function pickGround(e){setRay(e);const h=ray.intersectObject(groundMesh,false)[0];return h?[r1(h.point.x),r1(h.point.z)]:null}
function pickList(e,list){setRay(e);return ray.intersectObjects(list,true)[0]||null}
function houseAt(x,z){let best=null,bd=1.2;for(const b of near(x,z)){const q=distToBuilding(b,x,z);if(q.inside)return b;if(q.d<bd){bd=q.d;best=b}}return best}
function houseMeshes(){const l=[];for(const g of[houseGroup,selGroup])g.traverse(o=>{if(o.userData.houses)l.push(o)});return l}
function nearestRoad(x,z){let best=null,bd=1e9;for(const r of M.r){for(let i=1;i<r.p.length;i++){const q=closestOnSeg(x,z,r.p[i-1][0],r.p[i-1][1],r.p[i][0],r.p[i][1]),d=Math.hypot(x-q[0],z-q[1])-Math.max(1.6,r.w)/2;if(d<bd){bd=d;best=r}}}return bd<2.5?best:null}

function click(e){
  if(ED.draw){const p=pickGround(e);if(p){ED.draw.pts.push(p);overlay();hint()}return}
  if(ED.place){const p=pickGround(e);if(!p)return;snap();const k=ED.place,o={id:'o'+Date.now().toString(36)+Math.floor(Math.random()*99),k,x:p[0],z:p[1],rot:0};
    if(k==='model')o.m=ED.placeModel;UPR.o.push(o);updateObject(o);buildCollision();changed();ED.obj=o;ED.place=null;render();return}
  if(ED.tab==='dum'){
    if(ED.placeRo&&ED.b){const hit=pickList(e,houseMeshes().filter(m=>selGroup.children.includes(m)));if(!hit){toast('Klikni na střechu vybraného domu');return}
      const b=ED.b,o=ov(b),l=b.itf(hit.point.x,hit.point.z);snap();o.ro=o.ro||[];const el={k:ED.placeRo,x:r2(l[0]-b.c0[0]),z:r2(l[1]-b.c0[1])};
      if(el.k!=='o'){/* vikýř: kliknutý bod = střed, předek je níž po svahu */const F=roofElFrame(b,el),d=elOpt(el,'d')/2,q=b.itf(F.x+F.f[0]*d,F.z+F.f[1]*d);el.x=r2(q[0]-b.c0[0]);el.z=r2(q[1]-b.c0[1])}
      o.ro.push(el);ED.part={t:'ro',i:o.ro.length-1};ED.placeRo=null;refreshHouse();render();return}
    const hit=pickList(e,houseMeshes());if(hit){const b=houseAt(hit.point.x,hit.point.z);if(b){const w=distToBuilding(b,hit.point.x,hit.point.z).e;
      if(b===ED.b){ED.wall=w;pickPart(e,w);ED.line=null;render();return}selectHouse(b,w);return}}
    return}
  if(ED.tab==='cesty'){const p=pickGround(e);if(!p)return;const r=nearestRoad(p[0],p[1]);if(r)selectRoad(r);else{ED.road=null;ED.line=null;render()}return}
  if(ED.tab==='obj'){const hit=pickList(e,[objGroup,treeGroup,groundMesh]);ED.obj=null;ED.tree=null;ED.line=null;
    if(hit&&hit.object!==groundMesh){let o=hit.object;while(o&&!o.userData.oid&&o.parent)o=o.parent;
      if(o&&o.userData.oid){const ob=UPR.o.find(q=>q.id===o.userData.oid)||OSMFENCES.find(q=>q.id===o.userData.oid);selectObj(ob);return}
      if(hit.object.userData.trees&&hit.instanceId!==undefined){ED.tree=hit.object.userData.trees[hit.instanceId];render();return}}
    render()}}

/* ===================== OVLÁDÁNÍ KAMERY A TAŽENÍ ===================== */
const ptrs=new Map();let drag=null,downAt=null,pinch=null;
canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('pointerdown',e=>{canvas.setPointerCapture&&(()=>{try{canvas.setPointerCapture(e.pointerId)}catch(_){}})();ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(ptrs.size===2){const[a,b]=[...ptrs.values()];pinch={d:Math.hypot(a.x-b.x,a.y-b.y),dist:orbit.dist,mx:(a.x+b.x)/2,my:(a.y+b.y)/2};drag=null;return}
  downAt={x:e.clientX,y:e.clientY,t:performance.now()};
  if(e.button===0&&!e.shiftKey){
    if(ED.line&&handles.length){const h=pickList(e,handles);if(h){const d=h.object.userData.h;snap();ED.line.ensure&&ED.line.ensure();
      if(d.mid){const P=ED.line.pts,x=r1((P[d.mid-1][0]+P[d.mid][0])/2),z=r1((P[d.mid-1][1]+P[d.mid][1])/2);P.splice(d.mid,0,[x,z]);ED.vi=d.mid}else ED.vi=d.i;
      drag={type:'v'};overlay();return}}
    if(ED.tab==='dum'&&ED.b&&!ED.placeRo){
      if(ED.part&&partDistance(e)<.35){snap();const q=partInfo();if(q&&q.F){const p=rayFlat(e,q.F.y);ED.dragOff=p?[q.F.x-p[0],q.F.z-p[1]]:[0,0]}drag={type:'part'};return}
      if(ED.moveH){const h=pickList(e,houseMeshes().filter(m=>selGroup.children.includes(m)));if(h){const g=pickGround(e);if(g){snap();const o=ov(ED.b);drag={type:'h',g0:g,mx:+o.mx||0,mz:+o.mz||0};return}}}}
    if(ED.tab==='obj'&&!ED.draw&&!ED.place){
      /* stisk na objektu ho vybere a hned jde táhnout (plot se posune celý) */
      const hit=pickList(e,[objGroup]);let o=hit&&hit.object;while(o&&!o.userData.oid&&o.parent)o=o.parent;
      const ob=o&&o.userData.oid&&UPR.o.find(q=>q.id===o.userData.oid);
      if(ob){const g=pickGround(e);if(ED.obj!==ob)selectObj(ob);snap();
        drag=OBJ_KINDS[ob.k].line?{type:'f',g0:g,p0:ob.p.map(q=>q.slice())}:{type:'o',dx:ob.x-(g?g[0]:ob.x),dz:ob.z-(g?g[1]:ob.z)};drag.moved=false;return}}}
  drag={type:e.button===2||e.shiftKey?'pan':'rot',x:e.clientX,y:e.clientY}});
canvas.addEventListener('pointermove',e=>{const p=ptrs.get(e.pointerId);
  if(ED.draw){const g=pickGround(e);ED.draw.hover=g;overlay()}
  if(!p)return;
  if(pinch&&ptrs.size===2){p.x=e.clientX;p.y=e.clientY;const[a,b]=[...ptrs.values()];const d=Math.hypot(a.x-b.x,a.y-b.y);orbit.dist=clamp(pinch.dist*pinch.d/Math.max(20,d),8,600);
    const mx=(a.x+b.x)/2,my=(a.y+b.y)/2;pan(mx-pinch.mx,my-pinch.my);pinch.mx=mx;pinch.my=my;return}
  p.x=e.clientX;p.y=e.clientY;if(!drag)return;
  if(drag.type==='v'){const g=pickGround(e);if(g){ED.line.pts[ED.vi]=g;ED.line.live();overlay()}return}
  if(drag.type==='o'){const g=pickGround(e);if(g){drag.moved=true;ED.obj.x=r1(g[0]+drag.dx);ED.obj.z=r1(g[1]+drag.dz);const m=objMeshes.get(ED.obj.id);m.position.set(ED.obj.x,groundH(ED.obj.x,ED.obj.z),ED.obj.z);overlay()}return}
  if(drag.type==='f'){const g=pickGround(e);if(g&&drag.g0){drag.moved=true;const dx=g[0]-drag.g0[0],dz=g[1]-drag.g0[1];ED.obj.p.forEach((q,i)=>{q[0]=r1(drag.p0[i][0]+dx);q[1]=r1(drag.p0[i][1]+dz)});
    if(!drag.q){drag.q=1;requestAnimationFrame(()=>{drag&&(drag.q=0);updateObject(ED.obj);overlay()})}}return}
  if(drag.type==='part'){drag.moved=true;if(!drag.q){drag.q=1;const ev={clientX:e.clientX,clientY:e.clientY};requestAnimationFrame(()=>{if(drag){drag.q=0;dragPart(ev)}})}return}
  if(drag.type==='h'){const g=pickGround(e);if(g){drag.moved=true;const o=ov(ED.b);o.mx=r1(drag.mx+g[0]-drag.g0[0]);o.mz=r1(drag.mz+g[1]-drag.g0[1]);
    if(!drag.q){drag.q=1;requestAnimationFrame(()=>{if(drag)drag.q=0;ED.b.ov=o;applyB(ED.b);buildSel();overlay()})}}return}
  const dx=e.clientX-drag.x,dy=e.clientY-drag.y;drag.x=e.clientX;drag.y=e.clientY;
  if(drag.type==='rot'){orbit.yaw-=dx*.006;orbit.pitch=clamp(orbit.pitch+dy*.005,.08,1.5)}else pan(dx,dy)});
function pan(dx,dy){const k=orbit.dist*.0016,s=Math.sin(orbit.yaw),c=Math.cos(orbit.yaw);orbit.x+=(-dx*c-dy*s)*k;orbit.z+=(dx*s-dy*c)*k;
  const bx=M.box;orbit.x=clamp(orbit.x,bx[0]-150,bx[2]+150);orbit.z=clamp(orbit.z,bx[1]-150,bx[3]+150)}
function endPtr(e){const wasPinch=!!pinch;ptrs.delete(e.pointerId);if(ptrs.size<2)pinch=null;
  if(drag&&drag.type==='v'){ED.line.done();changed();render()}
  else if(drag&&(drag.type==='o'||drag.type==='f')){if(drag.moved){updateObject(ED.obj);buildCollision();changed()}else undo.pop();render()}
  else if(drag&&drag.type==='part'){if(drag.moved){dragPart(e);refreshHouse();renderPanel()}else{undo.pop();if(e.type==='pointerup')click(e)}}
  else if(drag&&drag.type==='h'){if(drag.moved){refreshHouse(true);renderPanel()}else{undo.pop();if(e.type==='pointerup')click(e)}}
  else if(downAt&&!wasPinch&&e.type==='pointerup'&&Math.hypot(e.clientX-downAt.x,e.clientY-downAt.y)<6&&performance.now()-downAt.t<600&&e.button===0)click(e);
  drag=null;downAt=null}
canvas.addEventListener('pointerup',endPtr);canvas.addEventListener('pointercancel',endPtr);
canvas.addEventListener('wheel',e=>{e.preventDefault();orbit.dist=clamp(orbit.dist*Math.exp(e.deltaY*.0012),8,600)},{passive:false});
canvas.addEventListener('dblclick',()=>{if(ED.draw)finishDraw()});
const keys=new Set();
addEventListener('keydown',e=>{if(/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName))return;const k=e.key.toLowerCase();
  if((e.ctrlKey||e.metaKey)&&k==='z'){e.preventDefault();doUndo();return}
  if(k==='escape'){ED.draw=null;ED.place=null;ED.placeRo=null;ED.moveH=false;render();return}
  if(k==='enter'&&ED.draw){finishDraw();return}
  if(k==='delete'||k==='backspace'){if(ED.line&&ED.vi>=0)delVertex();else if(ED.tab==='dum'&&ED.part)delPart();else if(ED.obj&&!ED.obj.osm)delObj();return}
  keys.add(k)});
addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));

/* ===================== DŮM ===================== */
function ov(b){return UPR.b[b.id]||(UPR.b[b.id]={})}
function cleanOv(id){const o=UPR.b[id];if(o){for(const k of Object.keys(o))if(o[k]===undefined||o[k]==='')delete o[k];if(o.ok&&!Object.keys(o.ok).length)delete o.ok;
  if(o.wo&&!Object.keys(o.wo).length)delete o.wo;if(o.ro&&!o.ro.length)delete o.ro;if(!Object.keys(o).length)delete UPR.b[id]}}
function selectHouse(b,wall){if(ED.b!==b){ED.b=b;ED.part=null;ED.moveH=false;buildHouses(b)}ED.wall=wall===undefined?null:wall;ED.line=null;ED.vi=-1;render()}
/* po změně vlastností vybraného domu; full = přestavět i ostatní (poloha domu ovlivní kolize a cestičky) */
function refreshHouse(full){const b=ED.b;cleanOv(b.id);b.ov=UPR.b[b.id]||{};applyB(b);
  if(full){const id=b.id;makeB();ED.b=B.find(q=>q.id===id);buildHouses(ED.b)}else buildSel();buildPaths();changed();overlay()}
function setHouse(k,v){snap();const o=ov(ED.b);if(v===null||v===undefined||v==='')delete o[k];else o[k]=v;refreshHouse(['mx','mz','mr'].includes(k));renderPanel()}
const r2=v=>Math.round(v*100)/100;
/* vybraná část domu: okno {t:'win',w:stěna,i}, dveře {t:'door'}, prvek střechy {t:'ro',i} */
function partInfo(){const b=ED.b,p=ED.part;if(!b||!p)return null;
  if(p.t==='win'){const l=b.ov.wo&&b.ov.wo[p.w];const w=l&&l[p.i];if(!w)return null;return {w,E:edgeOf(b,p.w)}}
  if(p.t==='door'){if(!b.door||!b.door.drawn)return null;return {d:b.door}}
  if(p.t==='ro'){const el=(b.ov.ro||[])[p.i];if(!el)return null;return {el,F:roofElFrame(b,el)}}return null}
function partRect(){const q=partInfo();if(!q)return null;const b=ED.b;
  if(q.w){const{w,E}=q,cx=E.ax+E.dx*w.x+E.nx*.12,cz=E.az+E.dz*w.x+E.nz*.12,Y=b.y0+(+w.y),hw=(+w.w)/2+.12,hh=(+w.h)/2+.12;
    return [[cx-E.dx*hw,Y-hh,cz-E.dz*hw],[cx+E.dx*hw,Y-hh,cz+E.dz*hw],[cx+E.dx*hw,Y+hh,cz+E.dz*hw],[cx-E.dx*hw,Y+hh,cz-E.dz*hw]]}
  if(q.d){const d=q.d,E=d.E,dv=b.ov.dv||{},hw=(+dv.w||1)/2+.12,dh=(+dv.h||2.12)+.15,gh=gyC(d.cp[0],d.cp[1]),cx=d.cp[0]+E.nx*.12,cz=d.cp[1]+E.nz*.12;
    return [[cx-E.dx*hw,gh,cz-E.dz*hw],[cx+E.dx*hw,gh,cz+E.dz*hw],[cx+E.dx*hw,gh+dh,cz+E.dz*hw],[cx-E.dx*hw,gh+dh,cz-E.dz*hw]]}
  const{el,F}=q,w=elOpt(el,'w')/2+.2,d=elOpt(el,'d'),y=F.y+(el.k==='o'?.25:elOpt(el,'h')+.4),fa0=el.k==='o'?-d/2-.2:-d,fa1=el.k==='o'?d/2+.2:.4,P=(sa,fa)=>[F.x+F.s[0]*sa+F.f[0]*fa,y,F.z+F.s[1]*sa+F.f[1]*fa];
  return [P(-w,fa0),P(w,fa0),P(w,fa1),P(-w,fa1)]}
/* bod na stěně / střeše pod myší (pro tažení oken, dveří a prvků střechy) */
const _pl=new THREE.Plane(),_pv=new THREE.Vector3();
function rayWall(e,E){setRay(e);_pl.setFromNormalAndCoplanarPoint(_pv.set(E.nx,0,E.nz),new THREE.Vector3(E.ax,0,E.az));const v=ray.ray.intersectPlane(_pl,new THREE.Vector3());
  return v?{along:(v.x-E.ax)*E.dx+(v.z-E.az)*E.dz,y:v.y}:null}
function rayFlat(e,y){setRay(e);_pl.set(_pv.set(0,1,0),-y);const v=ray.ray.intersectPlane(_pl,new THREE.Vector3());return v?[v.x,v.z]:null}
function partDistance(e){const q=partInfo();if(!q)return 1e9;const b=ED.b;
  if(q.w){const r=rayWall(e,q.E);return r?Math.max(Math.abs(r.along-q.w.x)-q.w.w/2,Math.abs(r.y-b.y0-q.w.y)-q.w.h/2,0):1e9}
  if(q.d){const r=rayWall(e,q.d.E);const dv=b.ov.dv||{};return r?Math.max(Math.abs(r.along-q.d.t*q.d.E.l)-(+dv.w||1)/2,0):1e9}
  const p=rayFlat(e,q.F.y),c=roCenter(q);return p?Math.max(0,Math.hypot(p[0]-c[0],p[1]-c[1])-Math.max(elOpt(q.el,'w'),elOpt(q.el,'d'))/2):1e9}
function roCenter(q){const k=q.el.k==='o'?0:elOpt(q.el,'d')/2;return [q.F.x-q.F.f[0]*k,q.F.z-q.F.f[1]*k]}
function dragPart(e){const q=partInfo();if(!q)return;const b=ED.b,o=ov(b);
  if(q.w){const r=rayWall(e,q.E);if(!r)return;q.w.x=r2(clamp(r.along,q.w.w/2,q.E.l-q.w.w/2));q.w.y=r2(clamp(r.y-b.y0,q.w.h/2,Math.max(q.w.h/2,b.h-q.w.h/2)))}
  else if(q.d){const r=rayWall(e,q.d.E);if(!r)return;o.dv=o.dv||{e:q.d.e,t:q.d.t};o.dv.e=q.d.e;o.dv.t=r2(clamp(r.along/q.d.E.l,0,1))}
  else{const p=rayFlat(e,q.F.y);if(!p)return;const ox=q.el.x,oz=q.el.z,l=b.itf(p[0]+ED.dragOff[0],p[1]+ED.dragOff[1]);q.el.x=r2(l[0]-b.c0[0]);q.el.z=r2(l[1]-b.c0[1]);
    /* prvek musí zůstat na střeše (střed i předek uvnitř obrysu domu) */
    const F=roofElFrame(b,q.el),c=roCenter({el:q.el,F});if(!inPoly(c[0],c[1],b.p)||!inPoly(F.x-F.f[0]*.05,F.z-F.f[1]*.05,b.p)){q.el.x=ox;q.el.z=oz}}
  b.ov=o;applyB(b);buildSel();overlay()}
/* klik na vybraný dům: najde okno, dveře nebo prvek střechy pod myší */
function pickPart(e,wall){const b=ED.b,save=ED.part;let best=null,bd=.35;
  const tryP=p=>{ED.part=p;const d=partDistance(e);if(d<bd){bd=d;best=p}};
  (b.ov.ro||[]).forEach((el,i)=>tryP({t:'ro',i}));
  if(wall!==null&&b.ov.wo&&b.ov.wo[wall])b.ov.wo[wall].forEach((w,i)=>tryP({t:'win',w:wall,i}));
  if(b.door&&b.door.drawn&&b.door.e===wall)tryP({t:'door'});
  ED.part=best;return best}
function findHouses(q){q=q.trim().toLowerCase().replace(/^č\.?\s*(p|ev)\.?\s*/,'');if(!q)return[];
  return B.filter(b=>b.adr&&b.adr.toLowerCase().split(',').some(a=>{const t=a.trim();return t.endsWith(' '+q)||t===q})).slice(0,20)}
function panelDum(){const b=ED.b;let h=`<div class="sec"><h2>Najít dům</h2><div class="row"><input type="text" id="fNum" placeholder="číslo popisné, např. 123" value="${esc(ED.q||'')}"><button class="btn pri" id="fGo" type="button">Najít</button></div>
  <div class="list" id="fRes"></div><div class="note">Nebo klikni na dům ve 3D. Kliknutím na stěnu ji vybereš (okna, dveře).</div></div>`;
  if(!b){const del=Object.keys(UPR.b).filter(id=>UPR.b[id].del);if(del.length)h+=`<div class="sec"><h2>Smazané domy</h2>${del.map(id=>{const b0=M.b.find(q=>q.id==id);return `<div class="row"><label>${esc(b0&&b0.adr||'dům '+id)}</label><button class="btn sm" data-undel="${id}" type="button">Obnovit</button></div>`}).join('')}</div>`;return h}
  const o=b.ov,dv=o.dv||{},E=ED.wall!==null?edgeOf(b,ED.wall):null,door=b.door,drawn=door&&door.drawn,R=b._R;
  const col=(id,lab,val,def)=>`<div class="row"><label>${lab}</label><input type="color" id="${id}" value="${val}"><button class="btn sm" data-def="${id}" type="button" ${def?'':'disabled'}>výchozí</button></div>`;
  const num=(id,lab,val,step,min,max,ph)=>`<div class="row"><label>${lab}</label><input type="number" id="${id}" step="${step}" min="${min}" max="${max}" value="${val===undefined||val===null?'':val}" ${ph?`placeholder="${ph}"`:''}></div>`;
  const sel=(id,lab,opts,val)=>`<div class="row"><label>${lab}</label><select id="${id}">${opts.map(([v,n])=>`<option value="${v}" ${String(val)===String(v)?'selected':''}>${n}</option>`).join('')}</select></div>`;
  const litSel=(id,v)=>sel(id,'Svítí',[['','podle domu'],['1','ano'],['0','ne']],v===undefined?'':v);
  const P=ED.part;
  h+=`<div class="sec"><h2>${esc(b.adr||'Budova bez čísla')}</h2><div class="info">Typ: ${esc(b.t)}${b.pod?' · podlaží: '+b.pod:''} · plocha ${Math.round(b.a)} m²</div>
  ${col('cWall','Barva stěn','#'+wallColor(b).getHexString(),o.cs)}${col('cRoof','Barva střechy','#'+roofColor(b).getHexString(),o.cr)}
  ${sel('sRoof','Střecha',[['a','Automaticky'],['s','Sedlová'],['v','Valbová'],['u','Pultová'],['p','Plochá']],o.st||'a')}
  ${sel('sRidge',o.st==='u'?'Směr spádu':'Natočení hřebene',[[0,'0°'],[1,'90°'],[2,'180°'],[3,'270°']],+o.ot||0)}
  ${num('nH','Výška stěn (m)',b.h,.1,2,40)}${num('nR','Výška střechy (m)',b.r!==undefined?b.r:'',.1,0,12,'auto')}</div>
  <div class="sec"><h2>Poloha budovy</h2>
  ${num('nMx','Posun východ–západ (m)',o.mx||0,.1,-200,200)}${num('nMz','Posun sever–jih (m)',o.mz||0,.1,-200,200)}
  <div class="row"><label>Otočení</label><input type="range" id="rMr" min="-180" max="180" step="1" value="${+o.mr||0}"><span>${+o.mr||0}°</span></div>
  <div class="btns"><button class="btn ${ED.moveH?'pri':''}" id="bMoveH" type="button">${ED.moveH?'Přesouvání zapnuto – táhni budovu':'Přesunout tažením'}</button>${o.mx||o.mz||o.mr?'<button class="btn" id="bMoveRes" type="button">Původní poloha</button>':''}</div></div>
  <div class="sec"><h2>Střešní okna a vikýře</h2>
  <div class="btns">${Object.entries(ROOF_EL).map(([k,d])=>`<button class="btn ${ED.placeRo===k?'pri':''}" data-addro="${k}" type="button">+ ${d.n}</button>`).join('')}</div>
  ${(o.ro||[]).length?`<div class="list">${o.ro.map((el,i)=>`<button type="button" data-selro="${i}" aria-pressed="${P&&P.t==='ro'&&P.i===i}">${ROOF_EL[el.k].n} ${i+1}</button>`).join('')}</div>`:'<div class="note">Vyber druh a klikni na střechu domu.</div>'}`;
  if(P&&P.t==='ro'&&o.ro&&o.ro[P.i]){const el=o.ro[P.i],dorm=el.k!=='o';
    h+=`<div class="info">${ROOF_EL[el.k].n} ${P.i+1} – táhni ho po střeše myší.</div>
    ${num('eW','Šířka (m)',elOpt(el,'w'),.1,.3,12)}${num('eD',dorm?'Hloubka (m)':'Délka (m)',elOpt(el,'d'),.1,.3,12)}${dorm?num('eH','Výška čela (m)',elOpt(el,'h'),.1,.4,6):''}
    <div class="row"><label>Otočení</label><input type="range" id="eRot" min="-180" max="180" step="1" value="${+el.rot||0}"><span>${+el.rot||0}°</span></div>
    ${dorm?col('eC','Barva stěn',el.c||'#'+wallColor(b).getHexString(),el.c)+col('eCr','Barva střechy',el.cr||'#'+roofColor(b).getHexString(),el.cr):''}
    ${col('eRm','Barva rámu',el.rm||(dorm?o.rm||'#dedbd2':'#3b3f46'),el.rm)}${litSel('eSv',el.sv)}
    <div class="btns"><button class="btn" id="eDup" type="button">Duplikovat</button><button class="btn warn" id="eDel" type="button">Smazat</button></div>`}
  h+=`</div><div class="sec"><h2>Okna (celý dům)</h2>
  <div class="row"><label>Velikost (automatická okna)</label><input type="range" id="rWin" min="0.6" max="1.6" step="0.05" value="${o.ov||1}"></div>
  <div class="row"><label>Svítí</label><input type="range" id="rLit" min="0" max="1" step="0.05" value="${o.sv!==undefined?o.sv:.58}"></div>
  ${col('cFrame','Barva rámů',o.rm||'#dedbd2',o.rm)}</div>
  <div class="sec"><h2>Vybraná stěna</h2>`;
  if(E){const cust=o.wo&&o.wo[ED.wall];
    h+=`<div class="info">Stěna ${ED.wall+1} z ${b.p.length} · délka ${E.l.toFixed(1)} m</div>
    ${sel('sWinMode','Okna na stěně',[['a','automaticky'],['c','vlastní rozmístění']],cust?'c':'a')}`;
    if(!cust)h+=sel('sWin','Počet oken',[['','automaticky'],...[0,1,2,3,4,5,6,7,8].map(n=>[n,n])],o.ok&&o.ok[ED.wall]!==undefined?o.ok[ED.wall]:'');
    else{h+=`<div class="list">${cust.map((w,i)=>`<button type="button" data-selwin="${i}" aria-pressed="${P&&P.t==='win'&&P.w===ED.wall&&P.i===i}">Okno ${i+1} · ${(+w.w).toFixed(1)}×${(+w.h).toFixed(1)} m</button>`).join('')}</div>
      <div class="btns"><button class="btn" id="wAdd" type="button">+ Přidat okno</button></div>`;
      if(P&&P.t==='win'&&P.w===ED.wall&&cust[P.i]){const w=cust[P.i];
        h+=`<div class="info">Okno ${P.i+1} – táhni ho po stěně myší.</div>
        <div class="row"><label>Od kraje stěny (m)</label><input type="range" id="wX" min="0" max="${E.l.toFixed(2)}" step="0.05" value="${w.x}"><input type="number" id="wXn" step="0.05" value="${w.x}"></div>
        ${num('wY','Výška středu (m)',w.y,.05,.3,40)}${num('wW','Šířka (m)',w.w,.05,.3,6)}${num('wH','Výška (m)',w.h,.05,.3,6)}
        ${col('wC','Barva rámu',w.c||o.rm||'#dedbd2',w.c)}${litSel('wS',w.s)}
        <div class="btns"><button class="btn" id="wDup" type="button">Duplikovat</button><button class="btn warn" id="wDel" type="button">Smazat okno</button></div>`}}
    h+=`<div class="btns"><button class="btn" id="bDoorHere" type="button" ${drawn&&door.e===ED.wall?'disabled':''}>${drawn&&door.e===ED.wall?'Dveře jsou na této stěně':'Dát dveře na tuto stěnu'}</button></div>`}
  else h+='<div class="note">Klikni na stěnu domu ve 3D. Kliknutím na okno, dveře nebo vikýř je vybereš.</div>';
  h+=`</div><div class="sec"><h2>Dveře</h2>`;
  if(drawn){h+=`<div class="row"><label>Poloha na stěně ${door.e+1}</label><input type="range" id="rDoor" min="0" max="1" step="0.01" value="${door.t.toFixed(2)}"></div>
    ${num('dW','Šířka (m)',+dv.w||1,.05,.6,5)}${num('dH','Výška (m)',+dv.h||2.12,.05,1.5,4.5)}
    ${col('cDoor','Barva dveří',dv.c||'#5a3a24',dv.c)}${col('cDoorF','Barva zárubně',dv.f||'#d9d4c8',dv.f)}
    <div class="btns"><button class="btn ${P&&P.t==='door'?'pri':''}" id="bDoorSel" type="button">Táhnout myší</button><button class="btn" id="bDoorNone" type="button">Bez dveří</button>${o.dv?'<button class="btn" id="bDoorAuto" type="button">Dveře automaticky</button>':''}</div>`}
  else h+=`<div class="note">${o.dv&&o.dv.none?'Budova je bez dveří.':'Budova nemá dveře.'} Vyber stěnu a dej je tam.</div>${o.dv?'<div class="btns"><button class="btn" id="bDoorAuto" type="button">Dveře automaticky</button></div>':''}`;
  if(b.adr){const ob=obyv(b),cust=!!o.ob,on2=(id,lab,v)=>`<div class="row"><label>${lab}</label><input type="number" id="${id}" min="0" max="9" step="1" value="${v}"></div>`;
    h+=`</div><div class="sec"><h2>Obyvatelé</h2><div class="note">Vyjdou před dům, když je u něj družina. ${cust?'Nastaveno ručně.':'Zatím náhodně (výchozí).'}</div>
    ${on2('obM','Muži',ob.m)}${on2('obZ','Ženy',ob.z)}${on2('obK','Kluci',ob.k)}${on2('obH','Holky',ob.h)}
    <div class="btns"><button class="btn" id="obRnd" type="button">Náhodně</button><button class="btn" id="obNone" type="button">Nikdo</button>${cust?'<button class="btn" id="obDef" type="button">Výchozí</button>':''}</div>`}
  h+=`</div><div class="sec"><h2>Přístupová cesta</h2><div class="note">${UPR.cesty[b.id]?(UPR.cesty[b.id].del?'Bez cesty.':'Vlastní cesta.'):'Automatická (od silnice ke dveřím).'}</div>
   <div class="btns"><button class="btn" id="pEdit" type="button">Upravit body</button><button class="btn" id="pDraw" type="button">Nakreslit novou</button>
   <button class="btn" id="pNone" type="button">Bez cesty</button><button class="btn" id="pAuto" type="button">Automatická</button></div>
   ${UPR.cesty[b.id]&&!UPR.cesty[b.id].del?`<div class="row"><label>Šířka (m)</label><input type="number" id="pW" step="0.1" min="0.6" max="6" value="${UPR.cesty[b.id].w||1.5}"></div>`:''}</div>
  <div class="sec"><div class="btns"><button class="btn" id="bReset" type="button">Zrušit úpravy budovy</button><button class="btn warn" id="bDel" type="button">Smazat budovu</button><button class="btn" id="bClose" type="button">Zavřít</button></div></div>`;
  return h}
function bindDum(){const b=ED.b,on=(id,ev,f)=>{const el=$(id);if(el)el.addEventListener(ev,f)};
  const go=()=>{ED.q=$('fNum').value;const res=findHouses(ED.q);$('fRes').innerHTML=res.length?res.map(b=>`<button type="button" data-hid="${b.id}">${esc(b.adr)}</button>`).join(''):'<div class="note">Nenalezeno.</div>';
    if(res.length===1)pickHouse(res[0])};
  on('fGo','click',go);on('fNum','keydown',e=>{if(e.key==='Enter')go()});
  $('fRes').addEventListener('click',e=>{const id=e.target.dataset.hid;if(id)pickHouse(B.find(b=>b.id==id))});
  document.querySelectorAll('[data-undel]').forEach(el=>el.onclick=()=>{snap();delete UPR.b[el.dataset.undel].del;cleanOv(el.dataset.undel);makeB();buildHouses(null);buildPaths();changed();render()});
  if(!b)return;const o=()=>ov(b);
  /* úprava a překreslení domu; hold = panel se nepřekresluje (posuvníky) */
  const edit=(f,full)=>{snap();f(o());refreshHouse(full);renderPanel()};
  const setK=(obj,k,v)=>{if(v===null||v===undefined||v===''||(typeof v==='number'&&isNaN(v)))delete obj[k];else obj[k]=v};
  on('cWall','change',e=>setHouse('cs',e.target.value));on('cRoof','change',e=>setHouse('cr',e.target.value));on('cFrame','change',e=>setHouse('rm',e.target.value));
  document.querySelectorAll('[data-def]').forEach(el=>el.onclick=()=>{const id=el.dataset.def,m={cWall:'cs',cRoof:'cr',cFrame:'rm'}[id];
    if(m)return setHouse(m,null);
    if(id==='cDoor')return setDoor({c:undefined});if(id==='cDoorF')return setDoor({f:undefined});
    if(id==='wC')return edit(q=>delete q.wo[ED.part.w][ED.part.i].c);
    const ek={eC:'c',eCr:'cr',eRm:'rm'}[id];if(ek)edit(q=>delete q.ro[ED.part.i][ek])});
  on('sRoof','change',e=>setHouse('st',e.target.value==='a'?null:e.target.value));on('sRidge','change',e=>setHouse('ot',+e.target.value||null));
  on('nH','change',e=>setHouse('h',+e.target.value>=2?+e.target.value:null));on('nR','change',e=>setHouse('r',e.target.value===''?null:+e.target.value));
  on('rWin','change',e=>setHouse('ov',+e.target.value===1?null:+e.target.value));on('rLit','change',e=>setHouse('sv',+e.target.value));
  /* poloha budovy */
  on('nMx','change',e=>setHouse('mx',+e.target.value||null));on('nMz','change',e=>setHouse('mz',+e.target.value||null));
  on('rMr','input',e=>{const q=o();q.mr=+e.target.value;b.ov=q;applyB(b);buildSel();overlay();e.target.nextElementSibling.textContent=q.mr+'°'});
  on('rMr','change',e=>setHouse('mr',+e.target.value||null));
  on('bMoveH','click',()=>{ED.moveH=!ED.moveH;ED.part=null;renderPanel();toast(ED.moveH?'Táhni budovu myší':'Přesouvání vypnuto')});
  on('bMoveRes','click',()=>edit(q=>{delete q.mx;delete q.mz;delete q.mr},true));
  /* střešní okna a vikýře */
  document.querySelectorAll('[data-addro]').forEach(el=>el.onclick=()=>{const k=el.dataset.addro;ED.placeRo=ED.placeRo===k?null:k;ED.moveH=false;render()});
  document.querySelectorAll('[data-selro]').forEach(el=>el.onclick=()=>{ED.part={t:'ro',i:+el.dataset.selro};render()});
  const curEl=()=>o().ro[ED.part.i];
  const eNum=(id,k,min)=>on(id,'change',e=>edit(()=>setK(curEl(),k,+e.target.value>=min?+e.target.value:null)));
  eNum('eW','w',.3);eNum('eD','d',.3);eNum('eH','h',.4);
  on('eRot','input',e=>{curEl().rot=+e.target.value;applyB(b);buildSel();overlay();e.target.nextElementSibling.textContent=e.target.value+'°'});
  on('eRot','change',e=>edit(()=>setK(curEl(),'rot',+e.target.value||null)));
  on('eC','change',e=>edit(()=>curEl().c=e.target.value));on('eCr','change',e=>edit(()=>curEl().cr=e.target.value));on('eRm','change',e=>edit(()=>curEl().rm=e.target.value));
  on('eSv','change',e=>edit(()=>setK(curEl(),'sv',e.target.value===''?null:+e.target.value)));
  on('eDup','click',()=>edit(q=>{const c=JSON.parse(JSON.stringify(curEl()));c.x=r2(c.x+1.5);q.ro.push(c);ED.part={t:'ro',i:q.ro.length-1}}));
  on('eDel','click',delPart);
  /* okna na vybrané stěně */
  on('sWinMode','change',e=>edit(q=>{q.wo=q.wo||{};if(e.target.value==='c'){const E=edgeOf(b,ED.wall);
      q.wo[ED.wall]=wallWins(b,ED.wall,E,b.door&&b.door.drawn?b.door:null).map(w=>({x:r2(w.x),y:r2(w.y),w:r2(w.w),h:r2(w.h)}));if(q.ok)delete q.ok[ED.wall];
      ED.part=q.wo[ED.wall].length?{t:'win',w:ED.wall,i:0}:null}else{delete q.wo[ED.wall];ED.part=null}}));
  on('sWin','change',e=>edit(q=>{q.ok=q.ok||{};if(e.target.value==='')delete q.ok[ED.wall];else q.ok[ED.wall]=+e.target.value}));
  document.querySelectorAll('[data-selwin]').forEach(el=>el.onclick=()=>{ED.part={t:'win',w:ED.wall,i:+el.dataset.selwin};render()});
  on('wAdd','click',()=>edit(q=>{const E=edgeOf(b,ED.wall),l=q.wo[ED.wall];l.push({x:r2(E.l/2),y:r2(Math.min(1.9,b.h/2)),w:1.1,h:1.2});ED.part={t:'win',w:ED.wall,i:l.length-1}}));
  const curW=()=>o().wo[ED.part.w][ED.part.i];
  on('wX','input',e=>{curW().x=+e.target.value;$('wXn').value=e.target.value;applyB(b);buildSel();overlay()});
  on('wX','change',e=>{const v=+e.target.value;edit(()=>curW().x=v)});on('wXn','change',e=>edit(()=>curW().x=r2(+e.target.value||0)));
  const wNum=(id,k,min)=>on(id,'change',e=>edit(()=>{if(+e.target.value>=min)curW()[k]=+e.target.value}));
  wNum('wY','y',.3);wNum('wW','w',.3);wNum('wH','h',.3);
  on('wC','change',e=>edit(()=>curW().c=e.target.value));on('wS','change',e=>edit(()=>setK(curW(),'s',e.target.value===''?null:+e.target.value)));
  on('wDup','click',()=>edit(q=>{const l=q.wo[ED.part.w],c=Object.assign({},curW());c.x=r2(c.x+c.w+.4);l.push(c);ED.part={t:'win',w:ED.part.w,i:l.length-1}}));
  on('wDel','click',delPart);
  /* dveře */
  on('bDoorHere','click',()=>setDoor({e:ED.wall,t:.5,none:undefined}));on('rDoor','change',e=>setDoor({t:+e.target.value}));
  on('dW','change',e=>setDoor({w:+e.target.value>0&&+e.target.value!==1?+e.target.value:undefined}));on('dH','change',e=>setDoor({h:+e.target.value>0&&+e.target.value!==2.12?+e.target.value:undefined}));
  on('cDoor','change',e=>setDoor({c:e.target.value}));on('cDoorF','change',e=>setDoor({f:e.target.value}));
  on('bDoorSel','click',()=>{ED.part=ED.part&&ED.part.t==='door'?null:{t:'door'};if(ED.part)ED.wall=b.door.e;render()});
  on('bDoorNone','click',()=>{snap();o().dv={none:1};ED.part=null;refreshHouse();renderPanel()});
  on('bDoorAuto','click',()=>{snap();delete o().dv;ED.part=null;refreshHouse();renderPanel()});
  /* obyvatelé (jen data, dům se nepřekresluje) */
  const setOb=v=>{snap();const q=o();if(v)q.ob=v;else delete q.ob;cleanOv(b.id);b.ov=UPR.b[b.id]||{};changed();renderPanel()};
  const curOb=()=>({m:+$('obM').value||0,z:+$('obZ').value||0,k:+$('obK').value||0,h:+$('obH').value||0});
  ['obM','obZ','obK','obH'].forEach(id=>on(id,'change',()=>{const v=curOb();for(const k in v)v[k]=clamp(Math.round(v[k]),0,9);setOb(v)}));
  on('obRnd','click',()=>{const r=n=>Math.floor(Math.random()*n),ad=1+r(3),dt=r(4),v={m:0,z:0,h:0,k:0};
    if(ad===1)Math.random()<.45?v.m=1:v.z=1;else{v.m=1;v.z=1;if(ad>2)Math.random()<.5?v.m++:v.z++}for(let i=0;i<dt;i++)Math.random()<.5?v.h++:v.k++;setOb(v)});
  on('obNone','click',()=>setOb({m:0,z:0,h:0,k:0}));on('obDef','click',()=>setOb(null));
  /* přístupová cesta */
  on('pEdit','click',()=>{const p=housePath(b);if(!p&&!UPR.cesty[b.id]){toast('Dům nemá cestu – nakresli novou');return}snap();
    if(!UPR.cesty[b.id]||UPR.cesty[b.id].del)UPR.cesty[b.id]={p:(p?p.p:[[b.door.x,b.door.z],[b.door.x+3,b.door.z]]).map(q=>[r1(q[0]),r1(q[1])]),w:p?p.w:1.5};
    editLine(UPR.cesty[b.id].p,()=>buildPaths(),()=>{buildPaths();changed()});changed();render()});
  on('pDraw','click',()=>startDraw('cesta k domu',pts=>{snap();UPR.cesty[b.id]={p:pts,w:1.5};buildPaths();changed()}));
  on('pNone','click',()=>{snap();UPR.cesty[b.id]={del:true};ED.line=null;buildPaths();changed();render()});
  on('pAuto','click',()=>{snap();delete UPR.cesty[b.id];ED.line=null;buildPaths();changed();render()});
  on('pW','change',e=>{snap();UPR.cesty[b.id].w=clamp(+e.target.value||1.5,.6,6);buildPaths();changed()});
  on('bReset','click',()=>{snap();const moved=o().mx||o().mz||o().mr;delete UPR.b[b.id];ED.part=null;refreshHouse(!!moved);renderPanel()});
  on('bDel','click',()=>{snap();ov(b).del=true;ED.b=null;ED.wall=null;ED.part=null;makeB();buildHouses(null);buildPaths();changed();render();toast('Budova smazána (obnovíš ji v záložce Budova)')});
  on('bClose','click',()=>{ED.b=null;ED.wall=null;ED.line=null;ED.part=null;ED.moveH=false;ED.placeRo=null;buildHouses(null);render()})}
function delPart(){const p=ED.part,b=ED.b;if(!p||!b)return;snap();const q=ov(b);
  if(p.t==='ro')q.ro.splice(p.i,1);else if(p.t==='win')q.wo[p.w].splice(p.i,1);else if(p.t==='door')q.dv={none:1};
  ED.part=null;refreshHouse();renderPanel();overlay()}
function pickHouse(b){if(!b)return;selectHouse(b,null);flyTo(b.cx,b.cz,Math.max(28,Math.hypot(b.x1-b.x0,b.z1-b.z0)*2.2))}
function setDoor(ch){snap();if(ch.t!==undefined)ch.t=r2(ch.t);const b=ED.b,o=ov(b),d=b.door;const cur=o.dv||{e:d?d.e:(ED.wall||0),t:d?d.t:.5};Object.assign(cur,ch);for(const k in cur)if(cur[k]===undefined)delete cur[k];o.dv=cur;refreshHouse();renderPanel()}

/* ===================== CESTY ===================== */
/* úprava lomené čáry (silnice, cesta k domu, plot): live = během tažení, done = po puštění */
function editLine(pts,live,done){ED.line={pts,live:()=>{if(!ED.line._q){ED.line._q=1;requestAnimationFrame(()=>{if(ED.line){ED.line._q=0;live()}})}},done};ED.vi=-1;overlay()}
function delVertex(){const P=ED.line.pts;if(P.length<=2){toast('Čára musí mít aspoň 2 body');return}snap();ED.line.ensure&&ED.line.ensure();P.splice(ED.vi,1);ED.vi=-1;ED.line.done();changed();render()}
function afterRoads(full){buildRoads();if(full){makeB();buildHouses(ED.b?B.find(b=>b.id===ED.b.id):null);if(ED.b)ED.b=SELB;buildPaths();buildTrees();buildCollision()}}
function selectRoad(r){ED.road=r.id;const isNew=String(r.id)[0]==='n';
  const pts=isNew?UPR.nr.find(q=>q.id===r.id).p:(UPR.r[r.id]&&UPR.r[r.id].p)||r.p.map(q=>[q[0],q[1]]);
  editLine(pts,()=>buildRoads(),()=>{afterRoads(true);changed()});
  /* první úprava založí záznam v úpravách */
  ED.line.ensure=()=>{if(!isNew){const o=UPR.r[r.id]||(UPR.r[r.id]={});if(!o.p)o.p=pts}};render()}
function curRoad(){return M.r.find(r=>r.id===ED.road)}
function panelCesty(){const r=curRoad();let h=`<div class="sec"><h2>Silnice a cesty</h2><div class="note">Klikni na silnici nebo cestu. Bílé body táhni myší, šedým bodem uprostřed přidáš nový bod. Vybraný bod smažeš klávesou Delete.</div>
  <div class="row"><label>Nová</label><select id="nrT">${Object.entries(ROAD_TYPES).map(([k,n])=>`<option value="${k}" ${k==='service'?'selected':''}>${n}</option>`).join('')}</select><button class="btn pri" id="nrGo" type="button">Kreslit</button></div></div>`;
  if(r){const orig=String(r.id)[0]!=='n',mod=orig&&UPR.r[r.id];
    h+=`<div class="sec"><h2>${esc(r.n||ROAD_TYPES[r.t]||r.t)}</h2>${orig?'':'<div class="info">Vlastní (nakreslená) cesta</div>'}
    <div class="row"><label>Typ</label><select id="rT">${Object.entries(ROAD_TYPES).map(([k,n])=>`<option value="${k}" ${k===r.t?'selected':''}>${n}</option>`).join('')}</select></div>
    <div class="row"><label>Šířka (m)</label><input type="number" id="rW" step="0.1" min="0.8" max="14" value="${r.w}"></div>
    <div class="btns">${ED.vi>=0?'<button class="btn" id="rDv" type="button">Smazat vybraný bod</button>':''}<button class="btn warn" id="rDel" type="button">Smazat cestu</button>${mod?'<button class="btn" id="rRes" type="button">Obnovit původní</button>':''}</div>
    <div class="note">Změny silnic se ve hře projeví i v chůzi družiny a v jízdě aut.</div></div>`}
  const del=Object.keys(UPR.r).filter(id=>UPR.r[id].del);if(del.length)h+=`<div class="sec"><h2>Smazané silnice</h2>${del.map(id=>{const r0=M.r0.find(q=>q.id==id);return `<div class="row"><label>${esc(r0&&(r0.n||ROAD_TYPES[r0.t])||id)}</label><button class="btn sm" data-unr="${id}" type="button">Obnovit</button></div>`}).join('')}</div>`;
  return h}
function bindCesty(){const r=curRoad(),on=(id,ev,f)=>{const el=$(id);if(el)el.addEventListener(ev,f)};
  on('nrGo','click',()=>{const t=$('nrT').value;startDraw(ROAD_TYPES[t],pts=>{snap();const n={id:'n'+Date.now().toString(36),p:pts,t,w:{primary:9,secondary:8,tertiary:7,residential:6,unclassified:5,service:4,living_street:5,track:3,footway:2,path:1.5,steps:2}[t]||4,n:''};
    UPR.nr.push(n);afterRoads(true);changed();selectRoad(M.r.find(q=>q.id===n.id))})});
  document.querySelectorAll('[data-unr]').forEach(el=>el.onclick=()=>{snap();delete UPR.r[el.dataset.unr];afterRoads(true);changed();render()});
  if(!r)return;
  const setR=(k,v)=>{snap();ED.line&&ED.line.ensure&&ED.line.ensure();const rec=String(r.id)[0]==='n'?UPR.nr.find(q=>q.id===r.id):(UPR.r[r.id]||(UPR.r[r.id]={}));rec[k]=v;afterRoads(true);changed();render()};
  on('rT','change',e=>setR('t',e.target.value));on('rW','change',e=>setR('w',clamp(+e.target.value||3,.8,14)));
  on('rDv','click',delVertex);
  on('rDel','click',()=>{snap();if(String(r.id)[0]==='n')UPR.nr=UPR.nr.filter(q=>q.id!==r.id);else UPR.r[r.id]={del:true};ED.road=null;ED.line=null;afterRoads(true);changed();render()});
  on('rRes','click',()=>{snap();delete UPR.r[r.id];afterRoads(true);changed();selectRoad(M.r.find(q=>q.id===r.id))})}

/* ===================== KRESLENÍ NOVÉ ČÁRY ===================== */
function startDraw(what,done){ED.draw={what,pts:[],done};ED.line=null;ED.place=null;render()}
function finishDraw(){const d=ED.draw;if(!d)return;ED.draw=null;if(d.pts.length>=2)d.done(d.pts.slice());else toast('Potřeba aspoň 2 body');render()}

/* ===================== OBJEKTY ===================== */
function selectObj(o){ED.obj=o;ED.tree=null;ED.line=null;if(o&&OBJ_KINDS[o.k].line&&!o.osm)editLine(o.p,()=>updateObject(o),()=>{updateObject(o);buildCollision();changed()});render()}
function setObj(k,v){snap();const o=ED.obj;if(v===null||v===''||v===undefined)delete o[k];else o[k]=v;updateObject(o);buildCollision();changed();overlay();renderPanel()}
function delObj(){snap();UPR.o=UPR.o.filter(q=>q!==ED.obj);updateObject(ED.obj);buildCollision();ED.obj=null;ED.line=null;changed();render()}
function panelObj(){let h=`<div class="sec"><h2>Vložit</h2><div class="pal">${Object.entries(OBJ_KINDS).filter(([k])=>k!=='model').map(([k,d])=>`<button type="button" data-k="${k}" aria-pressed="${ED.place===k}">${d.n}</button>`).join('')}</div>
  <div class="note">Vyber objekt a klikni do mapy. Plot kreslíš body (dvojklik nebo Enter = hotovo).</div>
  <div class="row"><label>Vlastní 3D model (.obj)</label><input type="file" id="fObj" accept=".obj" style="width:150px"></div>
  ${Object.keys(UPR.mod).length?`<div class="list">${Object.entries(UPR.mod).map(([id,m])=>`<button type="button" data-mod="${id}">Vložit: ${esc(m.n)}</button>`).join('')}</div>`:''}</div>`;
  const o=ED.obj;
  if(o){const K=OBJ_KINDS[o.k],num=(k,lab,step,min,max)=>`<div class="row"><label>${lab}</label><input type="number" data-ok="${k}" step="${step}" min="${min}" max="${max}" value="${objOpt(o,k)}"></div>`;
    h+=`<div class="sec"><h2>${esc(K.n)}${o.osm?' (z OpenStreetMap)':''}</h2>`;
    if(o.osm)h+='<div class="note">Plot nebo zeď převzatá z mapy – nejde upravit. Můžeš nakreslit vlastní.</div>';
    else{if(K.line)h+=`<div class="row"><label>Druh</label><select id="oSt">${Object.entries(FENCE_ST).map(([k,n])=>`<option value="${k}" ${(o.st||'latky')===k?'selected':''}>${n}</option>`).join('')}</select></div>`+num('h','Výška (m)',.1,.3,4)+'<div class="note">Body táhni, šedým bodem přidáš nový, Delete smaže vybraný. Tažením za plot posuneš celý plot.</div>';
      else{h+=`<div class="row"><label>Otočení</label><input type="range" id="oRot" min="0" max="359" step="1" value="${o.rot||0}"></div>`;
        if('w' in K)h+=num('w','Šířka (m)',.1,.2,30);if('d' in K)h+=num('d','Hloubka (m)',.1,.2,30);if('h' in K)h+=num('h','Výška (m)',.1,.2,30);if('s' in K)h+=num('s','Velikost',.1,.2,20);
        h+=`<div class="row"><label>Poloha X / Z (m)</label><input type="number" id="oX" step="0.1" value="${o.x}" style="width:70px"><input type="number" id="oZ" step="0.1" value="${o.z}" style="width:70px"></div>
        <div class="note">Objekt posuneš tažením myší (chyť ho a táhni).</div>`}
      if('c' in K)h+=`<div class="row"><label>Barva</label><input type="color" id="oC" value="${o.c||K.c||'#cccccc'}"></div>`;
      if(!K.line&&o.k==='plot'){}
      h+=`<div class="btns">${ED.line&&ED.vi>=0?'<button class="btn" id="oDv" type="button">Smazat vybraný bod</button>':''}${K.line?'':'<button class="btn" id="oDup" type="button">Duplikovat</button>'}<button class="btn warn" id="oDel" type="button">Smazat</button></div>`}
    h+='</div>'}
  if(ED.tree)h+=`<div class="sec"><h2>Strom z mapy</h2><div class="info">Výška podle výškového modelu: ${ED.tree[2]} m</div><div class="btns"><button class="btn warn" id="tDel" type="button">Smazat strom</button></div></div>`;
  if(UPR.st.length)h+=`<div class="sec"><div class="row"><label>Smazané stromy: ${UPR.st.length}</label><button class="btn sm" id="tRes" type="button">Obnovit všechny</button></div></div>`;
  return h}
function bindObj(){const on=(id,ev,f)=>{const el=$(id);if(el)el.addEventListener(ev,f)};
  document.querySelectorAll('.pal [data-k]').forEach(el=>el.onclick=()=>{const k=el.dataset.k;ED.obj=null;ED.tree=null;ED.line=null;
    if(OBJ_KINDS[k].line)startDraw('plot',pts=>{snap();const o={id:'o'+Date.now().toString(36),k,p:pts,st:'latky'};UPR.o.push(o);updateObject(o);buildCollision();changed();selectObj(o)});
    else{ED.place=ED.place===k?null:k;ED.draw=null;render()}});
  document.querySelectorAll('[data-mod]').forEach(el=>el.onclick=()=>{ED.place='model';ED.placeModel=el.dataset.mod;render()});
  on('fObj','change',e=>{const f=e.target.files[0];if(!f)return;if(f.size>2e6){toast('Model je moc velký (max. 2 MB)');return}
    const rd=new FileReader();rd.onload=()=>{const txt=rd.result.split('\n').filter(l=>/^(v|f)\s/.test(l)).join('\n');try{parseOBJ(txt)}catch(err){toast('Soubor se nepodařilo přečíst');return}
      snap();const id='m'+Date.now().toString(36);UPR.mod[id]={n:f.name.replace(/\.obj$/i,''),d:txt};changed();ED.place='model';ED.placeModel=id;render();toast('Model načten – klikni do mapy')};rd.readAsText(f)});
  const o=ED.obj;
  if(o&&!o.osm){document.querySelectorAll('[data-ok]').forEach(el=>el.onchange=()=>setObj(el.dataset.ok,+el.value>0?+el.value:null));
    on('oSt','change',e=>setObj('st',e.target.value));on('oC','change',e=>setObj('c',e.target.value));
    on('oRot','input',e=>{o.rot=+e.target.value;const m=objMeshes.get(o.id);if(m)m.rotation.y=o.rot*Math.PI/180;overlay()});
    on('oRot','change',e=>{snap();o.rot=+e.target.value;buildCollision();changed()});
    on('oDv','click',delVertex);on('oDel','click',delObj);
    on('oX','change',e=>setObj('x',r1(+e.target.value)));on('oZ','change',e=>setObj('z',r1(+e.target.value)));
    on('oDup','click',()=>{snap();const c=JSON.parse(JSON.stringify(o));c.id='o'+Date.now().toString(36);c.x=r1(c.x+2);c.z=r1(c.z+2);UPR.o.push(c);updateObject(c);buildCollision();changed();selectObj(c)})}
  on('tDel','click',()=>{snap();UPR.st.push(treeKey(ED.tree));ED.tree=null;buildTrees();changed();render()});
  on('tRes','click',()=>{snap();UPR.st=[];buildTrees();changed();render()})}

/* ===================== SOUBOR ===================== */
function panelSoubor(){const nb=Object.keys(UPR.b).length,no=UPR.o.length,nr=Object.keys(UPR.r).length+UPR.nr.length,nc=Object.keys(UPR.cesty).length;
  return `<div class="sec"><h2>Přehled úprav</h2><div class="info">Domy: ${nb} · silnice: ${nr} · cesty k domům: ${nc} · objekty: ${no} · smazané stromy: ${UPR.st.length}</div>
  <div class="note">Rozdělané změny se průběžně drží v tomto prohlížeči. Hra je uvidí až po <b>Uložit změny</b> (vpravo nahoře) – pak se načtou na každém počítači i mobilu.</div>
  <div class="btns"><button class="btn pri" id="sSave" type="button">Uložit změny</button><button class="btn" id="sDiscard" type="button">Zahodit neuložené změny</button></div></div>
  <div class="sec"><h2>Záloha do souboru</h2><div class="btns"><button class="btn" id="sDown" type="button">Stáhnout upravy.js</button></div>
  <div class="note">Záložní kopie úprav. Načtením ze souboru se úpravy jen otevřou v editoru – do hry je dostaneš tlačítkem Uložit změny.</div>
  <div class="row"><label>Načíst ze souboru</label><input type="file" id="sUp" accept=".js,.json" style="width:150px"></div></div>
  <div class="sec"><h2>Vše zrušit</h2><div class="btns"><button class="btn warn" id="sClear" type="button">Smazat všechny úpravy</button></div><div class="note">Jde vrátit tlačítkem ↶ Zpět, dokud editor nezavřeš.</div></div>
  <div class="sec"><h2>Ovládání</h2><div class="note">Levé tlačítko + tažení: otáčení · pravé tlačítko nebo Shift + tažení: posun · kolečko: přiblížení · Ctrl+Z: zpět · Esc: zrušit kreslení. Na dotykovém displeji: jeden prst otáčí, dva prsty posun a přiblížení.</div></div>`}
function bindSoubor(){$('sSave').onclick=saveAll;$('sDiscard').onclick=()=>{if(!isDirty()){toast('Nic neuloženého není');return}if(!confirm('Zahodit všechny neuložené změny a vrátit uložený stav?'))return;
    try{localStorage.removeItem(UPR_KEY)}catch(e){}removeEventListener('beforeunload',onLeave);location.reload()};
  $('sDown').onclick=()=>{saveUpr();const blob=new Blob(['/* Úpravy mapy z editoru (Mikulášská obchůzka Lidečko) */\nwindow.UPRAVY='+JSON.stringify(UPR)+';\n'],{type:'text/javascript'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='upravy.js';document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1000)};
  $('sUp').onchange=e=>{const f=e.target.files[0];if(!f)return;const rd=new FileReader();rd.onload=()=>{let t=rd.result.trim();const i=t.indexOf('{');t=t.slice(i).replace(/;\s*$/,'');
    let u;try{u=JSON.parse(t)}catch(err){toast('Soubor se nepodařilo přečíst');return}snap();for(const k of Object.keys(UPR))delete UPR[k];Object.assign(UPR,normUpr(u));
    ED.b=null;ED.line=null;ED.obj=null;buildWorld();changed();render();toast('Úpravy načteny')};rd.readAsText(f)};
  $('sClear').onclick=()=>{if(!confirm('Opravdu smazat všechny úpravy mapy?'))return;snap();for(const k of Object.keys(UPR))delete UPR[k];Object.assign(UPR,normUpr({}));ED.b=null;ED.line=null;ED.obj=null;buildWorld();changed();render()}}

/* ===================== PANEL ===================== */
function hint(){const h=$('hint');let t='';
  if(ED.draw)t=`Kreslíš: ${ED.draw.what} – klikej body (${ED.draw.pts.length}). Hotovo: dvojklik / Enter · Zrušit: Esc <button class="btn sm" id="hOk" type="button">Hotovo</button> <button class="btn sm" id="hNo" type="button">Zrušit</button>`;
  else if(ED.placeRo)t=`Klikni na střechu vybraného domu, kam dát: ${esc(ROOF_EL[ED.placeRo].n)} · Esc zruší`;
  else if(ED.moveH&&ED.b)t='Táhni budovu myší na nové místo · Esc ukončí';
  else if(ED.place)t=`Klikni do mapy, kam dát: ${esc(OBJ_KINDS[ED.place].n)} · Esc zruší`;
  h.innerHTML=t;h.classList.toggle('hide',!t);const ok=$('hOk'),no=$('hNo');if(ok)ok.onclick=finishDraw;if(no)no.onclick=()=>{ED.draw=null;render()}}
function renderPanel(){const t=ED.tab;$('body').innerHTML=t==='dum'?panelDum():t==='cesty'?panelCesty():t==='obj'?panelObj():panelSoubor();
  (t==='dum'?bindDum:t==='cesty'?bindCesty:t==='obj'?bindObj:bindSoubor)()}
function render(){renderPanel();overlay();hint()}
$('tabs').addEventListener('click',e=>{const t=e.target.dataset.t;if(!t)return;ED.tab=t;ED.placeRo=null;ED.moveH=false;ED.part=null;ED.line=null;ED.draw=null;ED.place=null;ED.vi=-1;
  if(t!=='obj'){ED.obj=null;ED.tree=null}if(t!=='cesty')ED.road=null;
  if(t==='dum'&&ED.b){}else if(t!=='dum'&&ED.b){ED.b=null;ED.wall=null;buildHouses(null)}
  document.querySelectorAll('#tabs button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.t===t));render()});
$('toggle').onclick=()=>$('panel').classList.toggle('min');
$('bUndo').onclick=doUndo;$('bSave').onclick=saveAll;
$('bDay').onclick=()=>{day=!day;setDay(day,day?0.0035:0.006);$('bDay').textContent=day?'Noc':'Den'};
if(isTouch&&innerWidth<700)$('panel').classList.add('min');

/* ===================== SMYČKA ===================== */
let last=performance.now();
function loop(now){requestAnimationFrame(loop);const dt=Math.min(.05,(now-last)/1000);last=now;
  const sp=orbit.dist*.9*dt;if(keys.has('w'))pan(0,sp/(orbit.dist*.0016));if(keys.has('s'))pan(0,-sp/(orbit.dist*.0016));if(keys.has('a'))pan(sp/(orbit.dist*.0016),0);if(keys.has('d'))pan(-sp/(orbit.dist*.0016),0);
  camUpd();scaleHandles();renderer.render(scene,camera)}
$('loading').remove();render();status();if(EDDB.draft)toast('Načten neuložený koncept z tohoto prohlížeče',3500);requestAnimationFrame(loop);
window.__ed={ED,orbit,UPR,saveAll,isDirty,pickHouse,findHouses,selectRoad,click};
