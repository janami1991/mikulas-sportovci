/* Editor mapy Lidečka: domy (barvy, střechy, okna, dveře, přístupová cesta), silnice a cesty, ploty a vlastní objekty.
   Úpravy se ukládají do prohlížeče a dají se stáhnout jako upravy.js (do složky hry). */
'use strict';
let day=true;setDay(true,0.0035);camera.far=1200;camera.updateProjectionMatrix();
const r1=v=>Math.round(v*10)/10;
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const ED={tab:'dum',b:null,wall:null,road:null,obj:null,tree:null,line:null,draw:null,place:null,vi:-1};

/* ===================== KAMERA (otáčení kolem bodu) ===================== */
const orbit={x:M.start[0],z:M.start[1]+60,yaw:.6,pitch:.75,dist:90};
function camUpd(){const y=groundH(orbit.x,orbit.z),cp=Math.cos(orbit.pitch);
  camera.position.set(orbit.x+Math.sin(orbit.yaw)*cp*orbit.dist,y+Math.sin(orbit.pitch)*orbit.dist,orbit.z+Math.cos(orbit.yaw)*cp*orbit.dist);camera.lookAt(orbit.x,y,orbit.z)}
function flyTo(x,z,dist){orbit.x=x;orbit.z=z;if(dist)orbit.dist=dist}

/* ===================== UNDO + UKLÁDÁNÍ ===================== */
const undo=[];
function snap(){undo.push(JSON.stringify(UPR));if(undo.length>60)undo.shift()}
let saveT=0;
function changed(){clearTimeout(saveT);saveT=setTimeout(()=>{const ok=saveUpr();$('status').textContent=ok?'Uloženo v tomto prohlížeči · '+new Date().toLocaleTimeString('cs-CZ'):'Nepodařilo se uložit do prohlížeče (moc velké?) – stáhni soubor v záložce Soubor.'},250)}
function doUndo(){if(!undo.length){toast('Není co vrátit');return}const u=JSON.parse(undo.pop());for(const k of Object.keys(UPR))delete UPR[k];Object.assign(UPR,normUpr(u));
  const id=ED.b&&ED.b.id;ED.line=null;ED.obj=null;ED.tree=null;ED.road=null;buildWorld();ED.b=id?B.find(b=>b.id===id)||null:null;buildHouses(ED.b);changed();render();toast('Vráceno')}

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
      const m=new THREE.Mesh(g,new THREE.MeshBasicMaterial({color:0xffc400,transparent:true,opacity:.35,side:THREE.DoubleSide,depthTest:false}));m.renderOrder=19;over.add(m)}}
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
  if(ED.tab==='dum'){const hit=pickList(e,houseMeshes());if(hit){const b=houseAt(hit.point.x,hit.point.z);if(b){selectHouse(b,distToBuilding(b,hit.point.x,hit.point.z).e);return}}
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
    if(ED.tab==='obj'&&ED.obj&&!ED.obj.osm&&!OBJ_KINDS[ED.obj.k].line){const m=objMeshes.get(ED.obj.id),h=m&&pickList(e,[m]);if(h){const g=pickGround(e);snap();drag={type:'o',dx:ED.obj.x-(g?g[0]:ED.obj.x),dz:ED.obj.z-(g?g[1]:ED.obj.z)};return}}}
  drag={type:e.button===2||e.shiftKey?'pan':'rot',x:e.clientX,y:e.clientY}});
canvas.addEventListener('pointermove',e=>{const p=ptrs.get(e.pointerId);
  if(ED.draw){const g=pickGround(e);ED.draw.hover=g;overlay()}
  if(!p)return;
  if(pinch&&ptrs.size===2){p.x=e.clientX;p.y=e.clientY;const[a,b]=[...ptrs.values()];const d=Math.hypot(a.x-b.x,a.y-b.y);orbit.dist=clamp(pinch.dist*pinch.d/Math.max(20,d),8,600);
    const mx=(a.x+b.x)/2,my=(a.y+b.y)/2;pan(mx-pinch.mx,my-pinch.my);pinch.mx=mx;pinch.my=my;return}
  p.x=e.clientX;p.y=e.clientY;if(!drag)return;
  if(drag.type==='v'){const g=pickGround(e);if(g){ED.line.pts[ED.vi]=g;ED.line.live();overlay()}return}
  if(drag.type==='o'){const g=pickGround(e);if(g){ED.obj.x=r1(g[0]+drag.dx);ED.obj.z=r1(g[1]+drag.dz);const m=objMeshes.get(ED.obj.id);m.position.set(ED.obj.x,groundH(ED.obj.x,ED.obj.z),ED.obj.z);overlay()}return}
  const dx=e.clientX-drag.x,dy=e.clientY-drag.y;drag.x=e.clientX;drag.y=e.clientY;
  if(drag.type==='rot'){orbit.yaw-=dx*.006;orbit.pitch=clamp(orbit.pitch+dy*.005,.08,1.5)}else pan(dx,dy)});
function pan(dx,dy){const k=orbit.dist*.0016,s=Math.sin(orbit.yaw),c=Math.cos(orbit.yaw);orbit.x+=(-dx*c-dy*s)*k;orbit.z+=(dx*s-dy*c)*k;
  const bx=M.box;orbit.x=clamp(orbit.x,bx[0]-150,bx[2]+150);orbit.z=clamp(orbit.z,bx[1]-150,bx[3]+150)}
function endPtr(e){const wasPinch=!!pinch;ptrs.delete(e.pointerId);if(ptrs.size<2)pinch=null;
  if(drag&&drag.type==='v'){ED.line.done();changed();render()}
  else if(drag&&drag.type==='o'){updateObject(ED.obj);buildCollision();changed();render()}
  else if(downAt&&!wasPinch&&e.type==='pointerup'&&Math.hypot(e.clientX-downAt.x,e.clientY-downAt.y)<6&&performance.now()-downAt.t<600&&e.button===0)click(e);
  drag=null;downAt=null}
canvas.addEventListener('pointerup',endPtr);canvas.addEventListener('pointercancel',endPtr);
canvas.addEventListener('wheel',e=>{e.preventDefault();orbit.dist=clamp(orbit.dist*Math.exp(e.deltaY*.0012),8,600)},{passive:false});
canvas.addEventListener('dblclick',()=>{if(ED.draw)finishDraw()});
const keys=new Set();
addEventListener('keydown',e=>{if(/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName))return;const k=e.key.toLowerCase();
  if((e.ctrlKey||e.metaKey)&&k==='z'){e.preventDefault();doUndo();return}
  if(k==='escape'){ED.draw=null;ED.place=null;render();return}
  if(k==='enter'&&ED.draw){finishDraw();return}
  if(k==='delete'||k==='backspace'){if(ED.line&&ED.vi>=0)delVertex();else if(ED.obj&&!ED.obj.osm)delObj();return}
  keys.add(k)});
addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));

/* ===================== DŮM ===================== */
function ov(b){return UPR.b[b.id]||(UPR.b[b.id]={})}
function cleanOv(id){const o=UPR.b[id];if(o){for(const k of Object.keys(o))if(o[k]===undefined||o[k]==='')delete o[k];if(o.ok&&!Object.keys(o.ok).length)delete o.ok;if(!Object.keys(o).length)delete UPR.b[id]}}
function selectHouse(b,wall){if(ED.b!==b){ED.b=b;buildHouses(b)}ED.wall=wall===undefined?null:wall;ED.line=null;ED.vi=-1;render()}
/* po změně vlastností vybraného domu */
function refreshHouse(){const b=ED.b,b0=M.b.find(q=>q.id===b.id),o=UPR.b[b.id]||{};cleanOv(b.id);b.ov=UPR.b[b.id]||{};
  b.h=o.h?+o.h:b0.h;b.r=o.r!==undefined&&o.r!==''?+o.r:b0.r;b.top=b.y0+b.h;buildSel();buildPaths();changed();overlay()}
function setHouse(k,v){snap();const o=ov(ED.b);if(v===null||v===undefined||v==='')delete o[k];else o[k]=v;refreshHouse();renderPanel()}
function findHouses(q){q=q.trim().toLowerCase().replace(/^č\.?\s*(p|ev)\.?\s*/,'');if(!q)return[];
  return B.filter(b=>b.adr&&b.adr.toLowerCase().split(',').some(a=>{const t=a.trim();return t.endsWith(' '+q)||t===q})).slice(0,20)}
function panelDum(){const b=ED.b;let h=`<div class="sec"><h2>Najít dům</h2><div class="row"><input type="text" id="fNum" placeholder="číslo popisné, např. 123" value="${esc(ED.q||'')}"><button class="btn pri" id="fGo" type="button">Najít</button></div>
  <div class="list" id="fRes"></div><div class="note">Nebo klikni na dům ve 3D. Kliknutím na stěnu ji vybereš (okna, dveře).</div></div>`;
  if(!b){const del=Object.keys(UPR.b).filter(id=>UPR.b[id].del);if(del.length)h+=`<div class="sec"><h2>Smazané domy</h2>${del.map(id=>{const b0=M.b.find(q=>q.id==id);return `<div class="row"><label>${esc(b0&&b0.adr||'dům '+id)}</label><button class="btn sm" data-undel="${id}" type="button">Obnovit</button></div>`}).join('')}</div>`;return h}
  const o=b.ov,dv=o.dv,E=ED.wall!==null?edgeOf(b,ED.wall):null,door=b.door;
  const col=(id,lab,val,def)=>`<div class="row"><label>${lab}</label><input type="color" id="${id}" value="${val}"><button class="btn sm" data-def="${id}" type="button" ${def?'':'disabled'}>výchozí</button></div>`;
  h+=`<div class="sec"><h2>${esc(b.adr||'Dům bez čísla')}</h2><div class="info">Typ: ${esc(b.t)}${b.pod?' · podlaží: '+b.pod:''} · plocha ${Math.round(b.a)} m²</div>
  ${col('cWall','Barva stěn','#'+wallColor(b).getHexString(),o.cs)}${col('cRoof','Barva střechy','#'+roofColor(b).getHexString(),o.cr)}
  <div class="row"><label>Střecha</label><select id="sRoof">${[['a','Automaticky'],['s','Sedlová'],['v','Valbová'],['p','Plochá']].map(([v,n])=>`<option value="${v}" ${(o.st||'a')===v?'selected':''}>${n}</option>`).join('')}</select></div>
  <div class="row"><label>Otočit hřeben o 90°</label><input type="checkbox" id="kRidge" ${o.ot?'checked':''}></div>
  <div class="row"><label>Výška stěn (m)</label><input type="number" id="nH" step="0.1" min="2" max="40" value="${b.h}"></div>
  <div class="row"><label>Výška střechy (m)</label><input type="number" id="nR" step="0.1" min="0" max="12" value="${b.r!==undefined?b.r:''}" placeholder="auto"></div></div>
  <div class="sec"><h2>Okna</h2>
  <div class="row"><label>Velikost</label><input type="range" id="rWin" min="0.6" max="1.6" step="0.05" value="${o.ov||1}"></div>
  <div class="row"><label>Svítí</label><input type="range" id="rLit" min="0" max="1" step="0.05" value="${o.sv!==undefined?o.sv:.58}"></div>
  ${col('cFrame','Barva rámů',o.rm||'#dedbd2',o.rm)}</div>
  <div class="sec"><h2>Vybraná stěna</h2>${E?`<div class="info">Stěna ${ED.wall+1} z ${b.p.length} · délka ${E.l.toFixed(1)} m</div>
   <div class="row"><label>Oken na této stěně</label><select id="sWin"><option value="">automaticky</option>${[0,1,2,3,4,5,6,7,8].map(n=>`<option value="${n}" ${o.ok&&o.ok[ED.wall]==n?'selected':''}>${n}</option>`).join('')}</select></div>
   <div class="btns"><button class="btn" id="bDoorHere" type="button">${door&&door.e===ED.wall?'Dveře jsou na této stěně':'Dát dveře na tuto stěnu'}</button></div>
   ${door&&door.e===ED.wall?`<div class="row"><label>Poloha dveří</label><input type="range" id="rDoor" min="0" max="1" step="0.01" value="${door.t.toFixed(2)}"></div>`:''}`:'<div class="note">Klikni na stěnu domu ve 3D.</div>'}</div>
  <div class="sec"><h2>Dveře</h2>${door?`${col('cDoor','Barva dveří',dv&&dv.c||'#5a3a24',dv&&dv.c)}
   <div class="row"><label>Šířka</label><select id="sDoorW">${[[1,'Jednokřídlé'],[1.5,'Dvoukřídlé'],[2.6,'Vrata']].map(([v,n])=>`<option value="${v}" ${((dv&&dv.w)||1)==v?'selected':''}>${n}</option>`).join('')}</select></div>
   ${dv?'<div class="btns"><button class="btn sm" id="bDoorAuto" type="button">Dveře automaticky</button></div>':''}`:'<div class="note">Dům nemá dveře – vyber stěnu a dej je tam.</div>'}</div>
  <div class="sec"><h2>Přístupová cesta</h2><div class="note">${UPR.cesty[b.id]?(UPR.cesty[b.id].del?'Bez cesty.':'Vlastní cesta.'):'Automatická (od silnice ke dveřím).'}</div>
   <div class="btns"><button class="btn" id="pEdit" type="button">Upravit body</button><button class="btn" id="pDraw" type="button">Nakreslit novou</button>
   <button class="btn" id="pNone" type="button">Bez cesty</button><button class="btn" id="pAuto" type="button">Automatická</button></div>
   ${UPR.cesty[b.id]&&!UPR.cesty[b.id].del?`<div class="row"><label>Šířka (m)</label><input type="number" id="pW" step="0.1" min="0.6" max="6" value="${UPR.cesty[b.id].w||1.5}"></div>`:''}</div>
  <div class="sec"><div class="btns"><button class="btn" id="bReset" type="button">Zrušit úpravy domu</button><button class="btn warn" id="bDel" type="button">Smazat dům</button><button class="btn" id="bClose" type="button">Zavřít</button></div></div>`;
  return h}
function bindDum(){const b=ED.b,on=(id,ev,f)=>{const el=$(id);if(el)el.addEventListener(ev,f)};
  const go=()=>{ED.q=$('fNum').value;const res=findHouses(ED.q);$('fRes').innerHTML=res.length?res.map(b=>`<button type="button" data-hid="${b.id}">${esc(b.adr)}</button>`).join(''):'<div class="note">Nenalezeno.</div>';
    if(res.length===1)pickHouse(res[0])};
  on('fGo','click',go);on('fNum','keydown',e=>{if(e.key==='Enter')go()});
  $('fRes').addEventListener('click',e=>{const id=e.target.dataset.hid;if(id)pickHouse(B.find(b=>b.id==id))});
  document.querySelectorAll('[data-undel]').forEach(el=>el.onclick=()=>{snap();delete UPR.b[el.dataset.undel].del;cleanOv(el.dataset.undel);makeB();buildHouses(null);buildPaths();changed();render()});
  if(!b)return;
  on('cWall','change',e=>setHouse('cs',e.target.value));on('cRoof','change',e=>setHouse('cr',e.target.value));on('cFrame','change',e=>setHouse('rm',e.target.value));
  document.querySelectorAll('[data-def]').forEach(el=>el.onclick=()=>{const m={cWall:'cs',cRoof:'cr',cFrame:'rm'}[el.dataset.def];if(m)setHouse(m,null);else if(el.dataset.def==='cDoor')setDoor({c:undefined})});
  on('sRoof','change',e=>setHouse('st',e.target.value==='a'?null:e.target.value));on('kRidge','change',e=>setHouse('ot',e.target.checked?1:null));
  on('nH','change',e=>setHouse('h',+e.target.value>=2?+e.target.value:null));on('nR','change',e=>setHouse('r',e.target.value===''?null:+e.target.value));
  on('rWin','change',e=>setHouse('ov',+e.target.value===1?null:+e.target.value));on('rLit','change',e=>setHouse('sv',+e.target.value));
  on('sWin','change',e=>{snap();const o=ov(b);o.ok=o.ok||{};if(e.target.value==='')delete o.ok[ED.wall];else o.ok[ED.wall]=+e.target.value;refreshHouse();renderPanel()});
  on('bDoorHere','click',()=>setDoor({e:ED.wall,t:.5}));on('rDoor','change',e=>setDoor({e:ED.wall,t:+e.target.value}));
  on('cDoor','change',e=>setDoor({c:e.target.value}));on('sDoorW','change',e=>setDoor({w:+e.target.value===1?undefined:+e.target.value}));
  on('bDoorAuto','click',()=>{snap();delete ov(b).dv;refreshHouse();renderPanel()});
  on('pEdit','click',()=>{const p=housePath(b);if(!p&&!UPR.cesty[b.id]){toast('Dům nemá cestu – nakresli novou');return}snap();
    if(!UPR.cesty[b.id]||UPR.cesty[b.id].del)UPR.cesty[b.id]={p:(p?p.p:[[b.door.x,b.door.z],[b.door.x+3,b.door.z]]).map(q=>[r1(q[0]),r1(q[1])]),w:p?p.w:1.5};
    editLine(UPR.cesty[b.id].p,()=>buildPaths(),()=>{buildPaths();changed()});changed();render()});
  on('pDraw','click',()=>startDraw('cesta k domu',pts=>{snap();UPR.cesty[b.id]={p:pts,w:1.5};buildPaths();changed()}));
  on('pNone','click',()=>{snap();UPR.cesty[b.id]={del:true};ED.line=null;buildPaths();changed();render()});
  on('pAuto','click',()=>{snap();delete UPR.cesty[b.id];ED.line=null;buildPaths();changed();render()});
  on('pW','change',e=>{snap();UPR.cesty[b.id].w=clamp(+e.target.value||1.5,.6,6);buildPaths();changed()});
  on('bReset','click',()=>{snap();delete UPR.b[b.id];refreshHouse();renderPanel()});
  on('bDel','click',()=>{snap();ov(b).del=true;ED.b=null;ED.wall=null;makeB();buildHouses(null);buildPaths();changed();render();toast('Dům smazán (obnovíš ho v záložce Dům)')});
  on('bClose','click',()=>{ED.b=null;ED.wall=null;ED.line=null;buildHouses(null);render()})}
function pickHouse(b){if(!b)return;selectHouse(b,null);flyTo(b.cx,b.cz,Math.max(28,Math.hypot(b.x1-b.x0,b.z1-b.z0)*2.2))}
function setDoor(ch){snap();const b=ED.b,o=ov(b),d=b.door;const cur=o.dv||{e:d?d.e:(ED.wall||0),t:d?d.t:.5};Object.assign(cur,ch);for(const k in cur)if(cur[k]===undefined)delete cur[k];o.dv=cur;refreshHouse();renderPanel()}

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
    else{if(K.line)h+=`<div class="row"><label>Druh</label><select id="oSt">${Object.entries(FENCE_ST).map(([k,n])=>`<option value="${k}" ${(o.st||'latky')===k?'selected':''}>${n}</option>`).join('')}</select></div>`+num('h','Výška (m)',.1,.3,4)+'<div class="note">Body táhni, šedým bodem přidáš nový, Delete smaže vybraný.</div>';
      else{h+=`<div class="row"><label>Otočení</label><input type="range" id="oRot" min="0" max="359" step="1" value="${o.rot||0}"></div>`;
        if('w' in K)h+=num('w','Šířka (m)',.1,.2,30);if('d' in K)h+=num('d','Hloubka (m)',.1,.2,30);if('h' in K)h+=num('h','Výška (m)',.1,.2,30);if('s' in K)h+=num('s','Velikost',.1,.2,20);
        h+='<div class="note">Objekt posuneš tažením myší.</div>'}
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
    on('oDup','click',()=>{snap();const c=JSON.parse(JSON.stringify(o));c.id='o'+Date.now().toString(36);c.x=r1(c.x+2);c.z=r1(c.z+2);UPR.o.push(c);updateObject(c);buildCollision();changed();selectObj(c)})}
  on('tDel','click',()=>{snap();UPR.st.push(treeKey(ED.tree));ED.tree=null;buildTrees();changed();render()});
  on('tRes','click',()=>{snap();UPR.st=[];buildTrees();changed();render()})}

/* ===================== SOUBOR ===================== */
function panelSoubor(){const nb=Object.keys(UPR.b).length,no=UPR.o.length,nr=Object.keys(UPR.r).length+UPR.nr.length,nc=Object.keys(UPR.cesty).length;
  return `<div class="sec"><h2>Přehled úprav</h2><div class="info">Domy: ${nb} · silnice: ${nr} · cesty k domům: ${nc} · objekty: ${no} · smazané stromy: ${UPR.st.length}</div>
  <div class="note">Úpravy se automaticky ukládají v tomto prohlížeči a hra je v něm hned použije.</div></div>
  <div class="sec"><h2>Přenos na jiné zařízení / web</h2><div class="btns"><button class="btn pri" id="sDown" type="button">Stáhnout upravy.js</button></div>
  <div class="note">Stažený soubor <b>upravy.js</b> dej do složky <b>hra</b> (vedle index.html). Pak se úpravy načtou na každém počítači i mobilu, který hru otevře. Když jsou úpravy v prohlížeči i v souboru, použijí se ty novější.</div>
  <div class="row"><label>Načíst ze souboru</label><input type="file" id="sUp" accept=".js,.json" style="width:150px"></div></div>
  <div class="sec"><h2>Vše zrušit</h2><div class="btns"><button class="btn warn" id="sClear" type="button">Smazat všechny úpravy</button></div><div class="note">Jde vrátit tlačítkem ↶ Zpět, dokud editor nezavřeš.</div></div>
  <div class="sec"><h2>Ovládání</h2><div class="note">Levé tlačítko + tažení: otáčení · pravé tlačítko nebo Shift + tažení: posun · kolečko: přiblížení · Ctrl+Z: zpět · Esc: zrušit kreslení. Na dotykovém displeji: jeden prst otáčí, dva prsty posun a přiblížení.</div></div>`}
function bindSoubor(){$('sDown').onclick=()=>{saveUpr();const blob=new Blob(['/* Úpravy mapy z editoru (Mikulášská obchůzka Lidečko) */\nwindow.UPRAVY='+JSON.stringify(UPR)+';\n'],{type:'text/javascript'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='upravy.js';document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1000)};
  $('sUp').onchange=e=>{const f=e.target.files[0];if(!f)return;const rd=new FileReader();rd.onload=()=>{let t=rd.result.trim();const i=t.indexOf('{');t=t.slice(i).replace(/;\s*$/,'');
    let u;try{u=JSON.parse(t)}catch(err){toast('Soubor se nepodařilo přečíst');return}snap();for(const k of Object.keys(UPR))delete UPR[k];Object.assign(UPR,normUpr(u));
    ED.b=null;ED.line=null;ED.obj=null;buildWorld();changed();render();toast('Úpravy načteny')};rd.readAsText(f)};
  $('sClear').onclick=()=>{if(!confirm('Opravdu smazat všechny úpravy mapy?'))return;snap();for(const k of Object.keys(UPR))delete UPR[k];Object.assign(UPR,normUpr({}));ED.b=null;ED.line=null;ED.obj=null;buildWorld();changed();render()}}

/* ===================== PANEL ===================== */
function hint(){const h=$('hint');let t='';
  if(ED.draw)t=`Kreslíš: ${ED.draw.what} – klikej body (${ED.draw.pts.length}). Hotovo: dvojklik / Enter · Zrušit: Esc <button class="btn sm" id="hOk" type="button">Hotovo</button> <button class="btn sm" id="hNo" type="button">Zrušit</button>`;
  else if(ED.place)t=`Klikni do mapy, kam dát: ${esc(OBJ_KINDS[ED.place].n)} · Esc zruší`;
  h.innerHTML=t;h.classList.toggle('hide',!t);const ok=$('hOk'),no=$('hNo');if(ok)ok.onclick=finishDraw;if(no)no.onclick=()=>{ED.draw=null;render()}}
function renderPanel(){const t=ED.tab;$('body').innerHTML=t==='dum'?panelDum():t==='cesty'?panelCesty():t==='obj'?panelObj():panelSoubor();
  (t==='dum'?bindDum:t==='cesty'?bindCesty:t==='obj'?bindObj:bindSoubor)()}
function render(){renderPanel();overlay();hint()}
$('tabs').addEventListener('click',e=>{const t=e.target.dataset.t;if(!t)return;ED.tab=t;ED.line=null;ED.draw=null;ED.place=null;ED.vi=-1;
  if(t!=='obj'){ED.obj=null;ED.tree=null}if(t!=='cesty')ED.road=null;
  if(t==='dum'&&ED.b){}else if(t!=='dum'&&ED.b){ED.b=null;ED.wall=null;buildHouses(null)}
  document.querySelectorAll('#tabs button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.t===t));render()});
$('toggle').onclick=()=>$('panel').classList.toggle('min');
$('bUndo').onclick=doUndo;
$('bDay').onclick=()=>{day=!day;setDay(day,day?0.0035:0.006);$('bDay').textContent=day?'Noc':'Den'};
if(isTouch&&innerWidth<700)$('panel').classList.add('min');

/* ===================== SMYČKA ===================== */
let last=performance.now();
function loop(now){requestAnimationFrame(loop);const dt=Math.min(.05,(now-last)/1000);last=now;
  const sp=orbit.dist*.9*dt;if(keys.has('w'))pan(0,sp/(orbit.dist*.0016));if(keys.has('s'))pan(0,-sp/(orbit.dist*.0016));if(keys.has('a'))pan(sp/(orbit.dist*.0016),0);if(keys.has('d'))pan(-sp/(orbit.dist*.0016),0);
  camUpd();scaleHandles();renderer.render(scene,camera)}
$('loading').remove();render();requestAnimationFrame(loop);
window.__ed={ED,orbit,UPR,pickHouse,findHouses,selectRoad,click};
