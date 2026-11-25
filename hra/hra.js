/* Mikulášská obchůzka – Lidečko: hra (svět – terén, domy, cesty, objekty – je ve svet.js)
   Data mapy: © přispěvatelé OpenStreetMap (ODbL), ČÚZK (CC BY 4.0), viz polnak.js
   Grafická knihovna: three.js r128 (MIT) */
'use strict';
const CFG = {
  aut: 3,                // kolik aut může jezdit najednou
  limit: 25*60,          // délka obchůzky v sekundách
  napalovacu: 7,         // kolik jich je najednou ve hře
  chuze: 3.4, beh: 6.6,  // rychlost čerta (m/s)
  kidBeh: 5.5, kidUnaveny: 3.0,
  bodyDum: 10, bodyChycen: 25,
};
const POSTAVY = [
  {id:'cert', n:'Čert', d:'síla, rozsocha'},
  {id:'prda', n:'Prďa', d:'tichý, rychlý'},
  {id:'konik', n:'Koník', d:'nejrychlejší, šavle'},
  {id:'smrtka', n:'Smrtka', d:'dlouhý dosah kosy'},
  {id:'mikulas', n:'Mikuláš', d:'vede družinu'},
  {id:'napalovac', n:'Napalovač', d:'brzy', off:1},
];
const STRANY = [
  {id:'polnak', n:'Polňák', d:M.b.filter(b=>b.v).length+' domů'},
  {id:'s2', n:'Strana 2', d:'brzy', off:1},{id:'s3', n:'Strana 3', d:'brzy', off:1},
  {id:'s4', n:'Strana 4', d:'brzy', off:1},{id:'s5', n:'Strana 5', d:'brzy', off:1},
];
const POKRIK = ['Čerte, čerte, nechytíš mě!','Ty máš ale smradlavý kožich!','Bééé!','Pojď si pro mě!','Mikuláš už spí!','Kde máš ocas?','Haha, ty mě nedoženeš!','Čertí babička volá!'];
const AU = ['Au! Au!','Už budu hodný!','Jauvajs!','To bolí!','Pustííí!'];
const DUM = ['Děti řekly básničku.','Malá Anička zazpívala písničku.','Honzík se schoval pod stůl.','Nadílka předána.','Babička nabídla koláč.','Děti slíbily, že budou hodné.'];


/* sněžení */
const snow=(()=>{const n=1400,g=new THREE.BufferGeometry(),p=new Float32Array(n*3);for(let i=0;i<n;i++){p[i*3]=rnd(-40,40);p[i*3+1]=rnd(0,25);p[i*3+2]=rnd(-40,40)}
 g.setAttribute('position',new THREE.BufferAttribute(p,3));const m=new THREE.Points(g,new THREE.PointsMaterial({color:0xffffff,size:0.13,transparent:true,opacity:.85,depthWrite:false}));
 m.frustumCulled=false;scene.add(m);return m})();


/* ===================== POSTAVY ===================== */
const lam=c=>new THREE.MeshLambertMaterial({color:c});
function box(w,h,d,m,x,y,z){const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);o.position.set(x,y,z);return o}
function limb(w,h,d,m,x,y,z){const piv=new THREE.Group();piv.position.set(x,y,z);const o=box(w,h,d,m,0,-h/2,0);piv.add(o);return piv}
/* huňatý kožich: koule/válec s náhodně vystouplými body a skvrnitou barvou */
/* ===== ČERT Z LIDEČKA (podle předlohy): světlá kožešinová bunda, tmavá dlouhá kožešina, kapuce s rohy, maska, zvonce vpředu i vzadu ===== */
function woolTex(base,light,dark,seed,long){const S=256,c=document.createElement('canvas');c.width=c.height=S;const x=c.getContext('2d');let r=seed||7;const R=()=>{r=(r*16807)%2147483647;return r/2147483647};
  x.fillStyle=base;x.fillRect(0,0,S,S);x.lineCap='round';
  for(let i=0;i<1900;i++){const px=R()*S,py=R()*S;x.lineWidth=1+R()*2.2;x.strokeStyle=R()<.5?light:dark;x.globalAlpha=.45+R()*.5;
    for(const ox of[-S,0,S])for(const oy of[-S,0,S]){x.beginPath();
      if(long){const l=6+R()*12,a=Math.PI/2+(R()-.5)*.7;x.moveTo(px+ox,py+oy);x.quadraticCurveTo(px+ox+(R()-.5)*6,py+oy+l/2,px+ox+Math.cos(a)*l*.3,py+oy+l)}
      else{const rad=2.5+R()*5,a0=R()*6.3;x.arc(px+ox,py+oy,rad,a0,a0+2.4+R()*2.4)}x.stroke()}}
  x.globalAlpha=1;const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;return t}
const TEX={tan:woolTex('#cfac74','#ecd3a2','#9c7a48',11),dark:woolTex('#3b2719','#6a4a33','#1e130b',5,true),cream:woolTex('#e6d6b2','#fbf2de','#bba57c',9),black:woolTex('#161616','#3c3c3c','#040404',13,true),hair:woolTex('#b08a5e','#d6b68c','#86663f',17,true)};
function furM(kind,rx,ry,col,em){const t=TEX[kind].clone();t.needsUpdate=true;t.repeat.set(rx,ry);
  return new THREE.MeshStandardMaterial({map:t,bumpMap:t,bumpScale:.04,roughness:1,metalness:0,color:col||0xffffff,emissive:em||0x2a1e10})}
function lumpy(geo,amp,seed){const p=geo.attributes.position,m=new Map();let r=seed||3;const R=()=>{r=(r*16807)%2147483647;return r/2147483647};
  for(let i=0;i<p.count;i++){const k=Math.round(p.getX(i)*200)+','+Math.round(p.getY(i)*200)+','+Math.round(p.getZ(i)*200);if(!m.has(k))m.set(k,[(R()-.5)*amp,(R()-.5)*amp*.5,(R()-.5)*amp]);
    const d=m.get(k);p.setXYZ(i,p.getX(i)+d[0],p.getY(i)+d[1],p.getZ(i)+d[2])}geo.computeVertexNormals();return geo}
function lathe(profile,segs){return new THREE.LatheGeometry(profile.map(([r,y])=>new THREE.Vector2(r,y)),segs||24)}
/* roh: silný u kořene, zahnutý dozadu, s proužky */
function horn(side){const s=side;const path=new THREE.CatmullRomCurve3([new THREE.Vector3(.07*s,0,.02),new THREE.Vector3(.1*s,.25,-.02),new THREE.Vector3(.15*s,.48,-.12),new THREE.Vector3(.2*s,.62,-.28),new THREE.Vector3(.24*s,.66,-.42)]);
  const segs=26,rad=8,g=new THREE.TubeGeometry(path,segs,.065,rad,false),p=g.attributes.position,col=new Float32Array(p.count*3);
  const A=new THREE.Color(0xb89a72),B=new THREE.Color(0x7d6446);
  for(let i=0;i<p.count;i++){const seg=Math.floor(i/(rad+1)),t=seg/segs,c=path.getPointAt(t),f=1-t*.8;p.setXYZ(i,c.x+(p.getX(i)-c.x)*f,c.y+(p.getY(i)-c.y)*f,c.z+(p.getZ(i)-c.z)*f);
    const cc=(seg%2===0&&t<.8)?B:A;col[i*3]=cc.r;col[i*3+1]=cc.g;col[i*3+2]=cc.b}
  g.setAttribute('color',new THREE.BufferAttribute(col,3));g.computeVertexNormals();return new THREE.Mesh(g,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.55}))}
/* zvonec */
const bellGeo=lathe([[0,.0],[.035,.0],[.045,-.035],[.055,-.1],[.07,-.17],[.1,-.23],[.11,-.24]],14);
const bellMat=stdM(0x6a5a48,{metalness:.3,roughness:.55,side:THREE.DoubleSide,emissive:0x0d0906});
const clapGeo=new THREE.SphereGeometry(.028,6,5),clapMat=stdM(0x1d1712);
function bellCluster(pts,dir){const g=new THREE.Group(),list=[];
  for(const[x,y,z,tilt]of pts){const b=new THREE.Group();b.position.set(x,y,z*dir);const m=new THREE.Mesh(bellGeo,bellMat);m.scale.setScalar(1.45);
    m.rotation.x=-tilt*dir;m.rotation.z=-x*1.2*dir;const cl=new THREE.Mesh(clapGeo,clapMat);cl.position.y=-.2;m.add(cl);b.add(m);g.add(b);list.push(b)}return {g,list}}
const BELLS_F=[[-.22,1.5,.4,.9],[-.08,1.47,.44,.8],[.07,1.48,.44,.85],[.22,1.5,.4,.9],[-.15,1.3,.44,.55],[0,1.28,.46,.5],[.15,1.3,.44,.55],[-.05,1.12,.45,.35],[.1,1.13,.44,.35]];
const BELLS_B=[[-.24,1.5,.4,.85],[-.08,1.46,.43,.75],[.08,1.46,.43,.75],[.24,1.5,.4,.85],[-.14,1.29,.43,.5],[.03,1.27,.44,.45],[.17,1.3,.42,.5]];
/* přírodní rozsocha: zvlněná hůl, nahoře se dělí na dva hroty */
function forkStick(){const g=new THREE.Group(),m=stdM(0xc2a57a,{roughness:.9});
  const tube=(pts,r0,r1)=>{const path=new THREE.CatmullRomCurve3(pts.map(p=>new THREE.Vector3(...p)));const segs=18,rad=6,geo=new THREE.TubeGeometry(path,segs,r0,rad,false),p=geo.attributes.position;
    for(let i=0;i<p.count;i++){const t=Math.floor(i/(rad+1))/segs,c=path.getPointAt(t),f=1-(1-r1/r0)*t;p.setXYZ(i,c.x+(p.getX(i)-c.x)*f,c.y+(p.getY(i)-c.y)*f,c.z+(p.getZ(i)-c.z)*f)}geo.computeVertexNormals();return new THREE.Mesh(geo,m)};
  /* osa -y = od ruky ven (hroty), +y = konec násady */
  g.add(tube([[0,.95,0],[.015,.4,0],[-.01,-.2,0],[.01,-.7,0],[0,-1.05,0]],.032,.03));
  g.add(tube([[0,-1.05,0],[-.04,-1.3,0],[-.08,-1.55,0],[-.09,-1.72,0]],.028,.014));
  g.add(tube([[0,-1.05,0],[.03,-1.32,0],[.06,-1.6,0],[.07,-1.78,0]],.028,.014));
  return g}
function cagan(){const g=new THREE.Group(),m=stdM(0x9c7a52,{roughness:.95});const path=new THREE.CatmullRomCurve3([[0,.9,0],[.01,.3,0],[-.012,-.3,0],[.01,-.9,0],[0,-1.35,0]].map(p=>new THREE.Vector3(...p)));
  g.add(new THREE.Mesh(new THREE.TubeGeometry(path,16,.03,6,false),m));const k=new THREE.Mesh(new THREE.SphereGeometry(.05,8,6),m);k.position.y=-1.37;g.add(k);return g}
function makeCert(opt){opt=opt||{};
  const g=new THREE.Group(),rig=new THREE.Group();g.add(rig);
  const jeans=stdM(0x3f58c8,{roughness:.85}),bootM=stdM(0x7a776e,{roughness:.9}),soleM=stdM(0x2b2a28);
  const legMat=opt.prda?furM('dark',1.2,1,0x9c8270,0x0e0804):jeans;
  const leg=x=>{const piv=new THREE.Group();piv.position.set(x,.72,0);const l=new THREE.Mesh(opt.prda?lumpy(new THREE.CylinderGeometry(.14,.16,.6,10,3),.04,x>0?61:62):new THREE.CylinderGeometry(.115,.125,.6,10),legMat);l.position.y=-.3;
    const b=new THREE.Mesh(new THREE.BoxGeometry(.19,.15,.32),bootM);b.position.set(0,-.64,.05);const so=new THREE.Mesh(new THREE.BoxGeometry(.2,.04,.33),soleM);so.position.set(0,-.71,.05);
    const an=new THREE.Mesh(new THREE.CylinderGeometry(.11,.12,.14,10),bootM);an.position.y=-.55;piv.add(l,an,b,so);return piv};
  const legL=leg(-.15),legR=leg(.15);
  /* tmavá dlouhá kožešina (od pasu po kolena) */
  const V=opt.prda?1:(+opt.v||1),blk=V===5;
  /* každý vzhled má trochu jiný odstín kožichu: bunda a rukávy (JT), dlouhá kožešina (ST); 5 = černý kožich se světlými rukávy */
  const JT=[0,0xf2c58a,0xb8773f,0xfff2d2,0xa49884,0xf2c58a][V],ST=[0,0x8c7464,0x5e3a26,0xb09a86,0x58534e,0][V];
  const skirt=new THREE.Mesh(lumpy(lathe([[.47,.5],[.46,.56],[.44,.75],[.42,.95],[.41,1.02]],26),.05,4),(blk?furM('black',4,1.5,0xffffff,0x050505):furM('dark',4,1.5,ST,0x0e0804)));skirt.scale.z=.85;
  /* světlá kožešinová bunda */
  const jacket=new THREE.Mesh(lumpy(lathe([[.47,.94],[.48,.98],[.46,1.1],[.44,1.25],[.46,1.42],[.45,1.55],[.38,1.66],[.22,1.73]],26),.05,6),(blk?furM('black',4,2.4,0xffffff,0x060606):furM('tan',4,2.4,JT)));jacket.scale.z=.82;
  /* opasek, přezka, visící řemeny, řetěz */
  const leather=stdM(0x4a2f1d,{roughness:.6}),iron=stdM(0x8c8c88,{metalness:.7,roughness:.4});
  const belt=new THREE.Mesh(new THREE.TorusGeometry(.47,.035,4,30),leather);belt.rotation.x=Math.PI/2;belt.scale.set(1,.83,1);belt.position.y=1.06;
  const buckle=new THREE.Mesh(new THREE.BoxGeometry(.1,.08,.02),iron);buckle.position.set(0,1.06,.405);
  const hang=new THREE.Group();for(const[x,l]of[[-.04,.42],[.05,.5],[-.2,.36]]){const s=new THREE.Mesh(new THREE.BoxGeometry(.045,l,.015),leather);s.position.set(x,1.04-l/2,.41);hang.add(s)}
  const chain=new THREE.Group();for(let i=0;i<9;i++){const ln=new THREE.Mesh(new THREE.TorusGeometry(.022,.006,4,8),iron);ln.position.set(.22+Math.sin(i*.5)*.02,1.4-i*.05,.37+i*.004);ln.rotation.y=i%2?Math.PI/2:0;chain.add(ln)}
  /* kapuce: vysoká, s klapkami přes uši a pelerínou na ramena */
  const cape=new THREE.Mesh(lumpy(lathe([[.44,1.5],[.42,1.58],[.34,1.7],[.24,1.8]],22),.05,8),furM('cream',3,1));cape.scale.z=.85;
  const hood=new THREE.Mesh(lumpy(lathe([[.22,1.76],[.25,1.9],[.255,2.1],[.245,2.28],[.2,2.4],[.11,2.46],[0,2.48]],22),.03,9),furM('cream',2,1.4));
  const flaps=new THREE.Group();for(const s of[-1,1]){const f=new THREE.Mesh(lumpy(new THREE.SphereGeometry(.13,10,8),.03,s+20),furM('cream',1,1));f.scale.set(.75,1.15,.9);f.position.set(s*.23,1.83,.06);flaps.add(f)}
  /* maska: černá, v otvorech je vidět obličej */
  const maskM=stdM(0x0f0f0f,{roughness:.6,side:THREE.DoubleSide}),skin=stdM(0xd9a688,{roughness:.7});
  const mask=new THREE.Mesh(new THREE.CylinderGeometry(.25,.235,.36,18,1,true,-0.8,1.6),maskM);mask.position.y=1.96;
  const face=new THREE.Group();
  for(const sx of[-1,1]){const e=new THREE.Mesh(new THREE.CircleGeometry(.038,14),skin);e.position.set(sx*.08,2.04,.247);const w=new THREE.Mesh(new THREE.CircleGeometry(.02,10),stdM(0xf2efe8));w.position.set(sx*.08,2.04,.249);
    const pu=new THREE.Mesh(new THREE.CircleGeometry(.01,8),stdM(0x2b4a7a));pu.position.set(sx*.08,2.04,.251);face.add(e,w,pu)}
  const nose=new THREE.Mesh(new THREE.SphereGeometry(.03,8,6),skin);nose.position.set(0,1.97,.255);nose.scale.set(1,1.2,.8);
  const mouth=new THREE.Mesh(new THREE.CircleGeometry(.045,14),skin);mouth.position.set(0,1.885,.247);mouth.scale.y=.55;
  const teeth=new THREE.Mesh(new THREE.PlaneGeometry(.05,.012),stdM(0xffffff));teeth.position.set(0,1.893,.25);
  const tongue=new THREE.Mesh(new THREE.BoxGeometry(.085,.46,.02),stdM(0xd3121c,{roughness:.5}));tongue.position.set(0,1.66,.29);tongue.rotation.x=-.15;
  face.add(nose,mouth,teeth);
  /* rohy a růže */
  const hL=horn(-1),hR=horn(1);hL.position.set(0,2.38,0);hR.position.set(0,2.38,0);hL.scale.setScalar(.75);hR.scale.setScalar(.75);
  const ros=new THREE.Group();
  for(const[x,y]of[[-.07,0],[0,.02],[.07,0]]){const r=new THREE.Group();const core=new THREE.Mesh(new THREE.SphereGeometry(.045,8,6),stdM(0xc1121f));r.add(core);
    for(let i=0;i<6;i++){const a=i/6*Math.PI*2,p=new THREE.Mesh(new THREE.SphereGeometry(.028,6,4),stdM(0xe01e2b));p.position.set(Math.cos(a)*.04,Math.sin(a)*.04,-.01);r.add(p)}r.position.set(x,y,0);ros.add(r)}
  for(const x of[-.03,.03]){const y=new THREE.Mesh(new THREE.SphereGeometry(.035,6,5),stdM(0xf4b400));y.position.set(x,.07,-.02);ros.add(y)}
  ros.position.set(0,2.36,.19);ros.rotation.x=-.4;
  /* postroj na zvonce: řemeny přes ramena vpředu i vzadu */
  const harness=new THREE.Group();for(const z of[.36,-.36])for(const s of[-1,1]){const st=new THREE.Mesh(new THREE.BoxGeometry(.045,.42,.015),leather);st.position.set(s*.17,1.42,z);st.rotation.z=s*.35;harness.add(st)}
  const fr=bellCluster(BELLS_F,1),bk=bellCluster(BELLS_B,-1);
  /* rukávy, tmavé manžety, ruce */
  const arm=(x,sd)=>{const piv=new THREE.Group();piv.position.set(x,1.6,0);
    const sl=new THREE.Mesh(lumpy(new THREE.CylinderGeometry(.14,.16,.58,12,4),.035,sd),furM('tan',1.5,1.4,JT));sl.position.y=-.29;
    const cuff=new THREE.Mesh(lumpy(new THREE.CylinderGeometry(.17,.18,.18,12,2),.04,sd+1),furM('dark',1.5,.6,0x8c7464,0x0e0804));cuff.position.y=-.64;
    const hand=new THREE.Mesh(new THREE.SphereGeometry(.075,10,8),skin);hand.scale.set(.9,1.2,.8);hand.position.y=-.79;piv.add(sl,cuff,hand);return piv};
  const armL=arm(-.52,13),armR=arm(.52,17);
  const fork=opt.prda?cagan():forkStick();fork.position.set(0,-.79,0);fork.rotation.x=Math.PI;armR.add(fork);
  /* varianty masky: 2 a 5 = celá přední část hlavy černá, 3 = okolo očí, nosu a úst, 4 = nad očima */
  if(V>1){const HP=[[1.76,.22],[1.9,.25],[2.1,.255],[2.28,.245],[2.4,.2]],hr=y=>{for(let i=1;i<HP.length;i++)if(y<=HP[i][0]){const[a,ra]=HP[i-1],[b,rb]=HP[i];return ra+(rb-ra)*(y-a)/(b-a)}return .2};
    const[y0,y1,ph]={2:[1.78,2.36,1.05],5:[1.78,2.36,1.05],3:[1.84,2.12,.78],4:[2.09,2.36,.95]}[V],pr=[];for(let k=0;k<=10;k++){const y=y0+(y1-y0)*k/10;pr.push(new THREE.Vector2(hr(y)+.035,y))}
    rig.add(new THREE.Mesh(new THREE.LatheGeometry(pr,18,-ph,ph*2),maskM));face.position.z+=.045;tongue.position.z+=.04}
  rig.add(legL,legR,skirt,jacket,belt,buckle,hang,chain,cape,hood,mask,face,tongue,armL,armR);
  if(!opt.prda)rig.add(hL,hR,harness,fr.g,bk.g,flaps,ros);
  g.userData={legL,legR,armL,armR,fork,rig,bells:opt.prda?[]:fr.list.concat(bk.list)};return g}
/* ===== PROVIZORNÍ POSTAVY (doladíme podle fotek) ===== */
function legPair(mat,shoe){const mk=x=>{const piv=new THREE.Group();piv.position.set(x,.72,0);const l=new THREE.Mesh(new THREE.CylinderGeometry(.11,.12,.6,8),mat);l.position.y=-.3;
  const b=new THREE.Mesh(new THREE.BoxGeometry(.18,.14,.3),shoe);b.position.set(0,-.65,.05);piv.add(l,b);return piv};return [mk(-.14),mk(.14)]}
function sleeveArm(x,mat,handMat,len){const piv=new THREE.Group();piv.position.set(x,1.6,0);const s=new THREE.Mesh(new THREE.CylinderGeometry(.11,.14,len||.66,10),mat);s.position.y=-(len||.66)/2;
  const h=new THREE.Mesh(new THREE.SphereGeometry(.075,8,6),handMat);h.position.y=-(len||.66)-.08;piv.add(s,h);return piv}
function finish3(g,rig,legL,legR,armL,armR,tool,bells){tool.position.set(0,-.79,0);tool.rotation.x=Math.PI;armR.add(tool);g.userData={legL,legR,armL,armR,fork:tool,rig,bells:bells||[]};return g}
/* textura pleteného svetru */
function knitTex(base,light){const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d');x.fillStyle=base;x.fillRect(0,0,128,128);x.strokeStyle=light;x.lineWidth=3;x.globalAlpha=.5;
  for(let col=0;col<8;col++)for(let row=0;row<16;row++){const cx=col*16+8,cy=row*8;x.beginPath();x.moveTo(cx-5,cy);x.lineTo(cx,cy+6);x.lineTo(cx+5,cy);x.stroke()}
  const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;return t}
/* Koník: zelený pletený svetr, černý obličej a vousy, brýle, červená čepice, červená sukně s koníkem a zvonky, dřevěná šavle */
function makeKonik(){const g=new THREE.Group(),rig=new THREE.Group();g.add(rig);
  const kt=knitTex('#1f4a3a','#2f6a52');kt.repeat.set(4,4);const sweater=new THREE.MeshStandardMaterial({map:kt,bumpMap:kt,bumpScale:.03,roughness:1});
  const black=stdM(0x161616),red=stdM(0xc8202a,{roughness:.7}),white=stdM(0xf3f1ec,{roughness:.4}),gold=stdM(0xd4af37,{metalness:.7,roughness:.35}),brown=stdM(0x7a4a2a);
  const [legL,legR]=legPair(stdM(0x1e1e22),black);
  const body=new THREE.Mesh(lathe([[.32,1.0],[.36,1.2],[.36,1.45],[.28,1.62],[.14,1.72]],18),sweater);
  const skirt=new THREE.Mesh(lathe([[.52,.5],[.5,.7],[.47,.95],[.44,1.05]],22),red);skirt.scale.z=.9;
  const stripes=new THREE.Group();for(const y of[.6,.68]){const s=new THREE.Mesh(new THREE.TorusGeometry(.515,.012,4,30),white);s.rotation.x=Math.PI/2;s.position.y=y;s.scale.set(1,.9,1);stripes.add(s)}
  /* bílá zástěra vpředu na sukni + pásek v pase */
  const SK=[[.52,.5],[.5,.7],[.47,.95],[.44,1.05]],skR=y=>{for(let i=1;i<SK.length;i++)if(y<=SK[i][1]){const[ra,a]=SK[i-1],[rb,b]=SK[i];return ra+(rb-ra)*(y-a)/(b-a)}return .44};
  const apP=[];for(let k=0;k<=8;k++){const y=.74+(1.05-.74)*k/8;apP.push(new THREE.Vector2(skR(y)+.018,y))}
  const frill=new THREE.Mesh(new THREE.LatheGeometry(apP,16,-.85,1.7),stdM(0xf3f1ec,{roughness:.6,side:THREE.DoubleSide}));frill.scale.z=.9;
  const ftrim=new THREE.Mesh(new THREE.TorusGeometry(.445,.02,5,30),white);ftrim.rotation.x=Math.PI/2;ftrim.position.y=1.05;ftrim.scale.set(1,.9,1);
  /* koník vpředu */
  const horse=new THREE.Group();const hh=new THREE.Mesh(new THREE.BoxGeometry(.16,.3,.14),brown);const sn=new THREE.Mesh(new THREE.BoxGeometry(.13,.12,.12),brown);sn.position.set(0,-.16,.04);
  const ears=[-.05,.05].map(x=>{const e=new THREE.Mesh(new THREE.ConeGeometry(.025,.08,4),brown);e.position.set(x,.18,0);return e});
  const eyes=[-.08,.08].map(x=>{const e=new THREE.Mesh(new THREE.SphereGeometry(.018,6,4),black);e.position.set(x,.04,.05);return e});
  const mane=new THREE.Mesh(new THREE.BoxGeometry(.03,.26,.04),black);mane.position.set(0,.04,-.07);
  horse.add(hh,sn,...ears,...eyes,mane);horse.position.set(0,1.0,.52);horse.rotation.x=-.15;
  const bells=[];for(const x of[-.06,.06]){const b=new THREE.Group();const m=new THREE.Mesh(bellGeo,gold);m.scale.setScalar(.8);b.add(m);b.position.set(x,.82,.56);bells.push(b)}
  /* hlava */
  const face=new THREE.Mesh(new THREE.SphereGeometry(.17,12,10),black);face.position.y=1.88;
  const beard=new THREE.Mesh(lumpy(new THREE.SphereGeometry(.17,10,8),.05,31),stdM(0x221811,{roughness:1}));beard.scale.set(1.1,1.5,.75);beard.position.set(0,1.7,.08);
  const cap=new THREE.Mesh(new THREE.SphereGeometry(.18,12,8,0,Math.PI*2,0,Math.PI/2),red);cap.position.y=1.94;cap.scale.y=1.1;
  const capRim=new THREE.Mesh(new THREE.TorusGeometry(.175,.03,6,18),red);capRim.rotation.x=Math.PI/2;capRim.position.y=1.95;
  const goggles=new THREE.Group();for(const x of[-.07,.07]){const r=new THREE.Mesh(new THREE.TorusGeometry(.045,.014,6,14),white);r.position.set(x,1.9,.16);const l=new THREE.Mesh(new THREE.CircleGeometry(.04,12),stdM(0x9aa3ad,{metalness:.5,roughness:.2}));l.position.set(x,1.9,.165);goggles.add(r,l)}
  const mouth=new THREE.Mesh(new THREE.SphereGeometry(.025,8,6),stdM(0xb0303a));mouth.position.set(0,1.79,.16);mouth.scale.set(1.2,.7,.5);
  const glove=black;const armL=sleeveArm(-.42,sweater,glove,.62),armR=sleeveArm(.42,sweater,glove,.62);
  /* zahnutá dřevěná šavle */
  const sab=new THREE.Group(),wood=stdM(0x8a4a22,{roughness:.6});const grip=new THREE.Mesh(new THREE.CylinderGeometry(.025,.025,.16,6),stdM(0x3b2414));grip.position.y=.04;sab.add(grip);
  const tas=new THREE.Mesh(new THREE.SphereGeometry(.04,6,5),stdM(0xddd3b8));tas.position.y=.14;sab.add(tas);
  for(let i=0;i<9;i++){const s=new THREE.Mesh(new THREE.BoxGeometry(.03,.12,.075),wood);s.position.set(0,-.08-i*.1,-(i*i)*.005);s.rotation.x=i*.03;sab.add(s)}
  rig.add(legL,legR,skirt,stripes,frill,ftrim,body,horse,...bells,face,beard,cap,capRim,goggles,mouth,armL,armR);return finish3(g,rig,legL,legR,armL,armR,sab,bells)}
/* Smrtka: chudák v bílém, bílá plachta přes hlavu, maska s dlouhým špičatým nosem, červený věneček a šerpa, gumáky, bílá dřevěná kosa s nápisem */
function scytheTex(){const c=document.createElement('canvas');c.width=512;c.height=64;const x=c.getContext('2d');x.fillStyle='#f4f2ea';x.fillRect(0,0,512,64);
  x.fillStyle='#222';x.font='bold 34px Arial';x.textBaseline='middle';x.fillText('BERU STARÉ KLEBETNICE',14,34);return new THREE.CanvasTexture(c)}
function makeSmrtka(){const g=new THREE.Group(),rig=new THREE.Group();g.add(rig);
  const white=stdM(0xf1f0ea,{roughness:.95}),sheet=stdM(0xf6f5f0,{roughness:1,side:THREE.DoubleSide}),rubber=stdM(0x121212,{roughness:.5}),mud=stdM(0x8d8a80),red=stdM(0xd21f2a);
  const mk=x=>{const piv=new THREE.Group();piv.position.set(x,.72,0);const l=new THREE.Mesh(new THREE.CylinderGeometry(.12,.13,.4,8),white);l.position.y=-.2;
    const bt=new THREE.Mesh(new THREE.CylinderGeometry(.12,.12,.36,10),rubber);bt.position.y=-.5;const ft=new THREE.Mesh(new THREE.BoxGeometry(.2,.13,.3),mud);ft.position.set(0,-.66,.05);piv.add(l,bt,ft);return piv};
  const legL=mk(-.14),legR=mk(.14);
  const body=new THREE.Mesh(lathe([[.3,.7],[.3,1.0],[.31,1.3],[.3,1.5],[.22,1.64],[.1,1.7]],16),white);
  /* plachta: přes hlavu a ramena, vpředu otevřená */
  const cloak=new THREE.Mesh(lathe([[.5,.75],[.48,1.0],[.45,1.3],[.42,1.55],[.33,1.7],[.25,1.85],[.22,2.02],[.15,2.12],[.02,2.16]],24,).clone(),sheet);
  cloak.geometry=new THREE.LatheGeometry([[.5,.75],[.48,1.0],[.45,1.3],[.42,1.55],[.33,1.7],[.25,1.85],[.22,2.02],[.15,2.12],[.02,2.16]].map(([r,y])=>new THREE.Vector2(r,y)),24,.75,Math.PI*2-1.5);
  lumpy(cloak.geometry,.04,44);
  const head=new THREE.Mesh(new THREE.SphereGeometry(.17,14,10),white);head.position.set(0,1.88,.03);
  const eyeR=stdM(0xffffff),eyeB=stdM(0x080808);const eyes=new THREE.Group();
  for(const x of[-.065,.065]){const r=new THREE.Mesh(new THREE.CircleGeometry(.05,14),eyeB);r.position.set(x,1.92,.18);const pu=new THREE.Mesh(new THREE.CircleGeometry(.02,10),eyeR);pu.position.set(x+.01,1.92,.182);eyes.add(r,pu)}
  const nose=new THREE.Mesh(new THREE.ConeGeometry(.04,.36,10),white);nose.rotation.x=Math.PI/2+.35;nose.position.set(0,1.8,.33);
  const wreath=new THREE.Group();for(let i=0;i<10;i++){const a=i/10*Math.PI*2,f=new THREE.Mesh(new THREE.SphereGeometry(.035,6,4),red);f.position.set(Math.cos(a)*.15,0,Math.sin(a)*.15);wreath.add(f)}wreath.position.set(0,2.02,.04);
  /* červená kravata: uzel a list rovně dolů */
  const sash=new THREE.Group(),tieS=new THREE.Shape([[-.03,0],[.03,0],[.055,-.27],[0,-.33],[-.055,-.27]].map(([x,y])=>new THREE.Vector2(x,y)));
  const tie=new THREE.Mesh(new THREE.ExtrudeGeometry(tieS,{depth:.015,bevelEnabled:false}),red);tie.position.set(0,1.555,.3);tie.rotation.x=-.06;
  const knot=new THREE.Mesh(new THREE.BoxGeometry(.075,.06,.04),red);knot.position.set(0,1.585,.3);sash.add(tie,knot);
  const glove=stdM(0xf7f6f2);const armL=sleeveArm(-.36,white,glove,.64),armR=sleeveArm(.36,white,glove,.64);
  const brush=new THREE.Group();brush.add(new THREE.Mesh(new THREE.BoxGeometry(.07,.05,.22),stdM(0x8a5a32)));const br2=new THREE.Mesh(new THREE.BoxGeometry(.06,.05,.2),stdM(0x2a2018));br2.position.y=-.045;brush.add(br2);brush.position.set(0,-.78,.08);armL.add(brush);
  /* bílá dřevěná kosa s nápisem na kose */
  const k=new THREE.Group(),wood=stdM(0xeeece4,{roughness:.9});const sh=new THREE.Mesh(new THREE.BoxGeometry(.05,2.3,.05),wood);sh.position.y=-.45;k.add(sh);
  const grip2=new THREE.Mesh(new THREE.BoxGeometry(.04,.04,.16),wood);grip2.position.set(0,-.2,.08);k.add(grip2);
  const tex=scytheTex();const bladeMats=[wood,wood,wood,wood,new THREE.MeshStandardMaterial({map:tex,roughness:.9}),new THREE.MeshStandardMaterial({map:tex,roughness:.9})];
  const blade=new THREE.Mesh(new THREE.BoxGeometry(.02,.12,.95),[wood,wood,wood,wood,wood,wood]);
  const bl=new THREE.Mesh(new THREE.BoxGeometry(.95,.13,.02),bladeMats);bl.rotation.y=Math.PI/2;bl.position.set(0,-1.56,.46);bl.rotation.z=.12;k.add(bl);
  rig.add(legL,legR,body,head,eyes,nose,wreath,sash,cloak,armL,armR);return finish3(g,rig,legL,legR,armL,armR,k)}
/* Mikuláš: bílá alba, zlatý ornát s červeným lemem a křížem, zlatá mitra, dlouhé bílé vousy, bílé rukavice, košík, berla se spirálou */
function at(o,x,y,z){o.position.set(x,y,z);return o}
function makeMikulas(){const g=new THREE.Group(),rig=new THREE.Group();g.add(rig);
  const white=stdM(0xf6f5f0,{roughness:.7}),gold=stdM(0xd8b445,{metalness:.65,roughness:.35,emissive:0x2a1e05}),red=stdM(0xc1121f,{roughness:.6}),skin=stdM(0xe8bfa2),shoe=stdM(0x141414);
  const [legL,legR]=legPair(white,shoe);
  const alba=new THREE.Mesh(lathe([[.42,.08],[.41,.4],[.37,.9],[.34,1.3],[.33,1.55],[.2,1.7],[.1,1.74]],20),white);
  const prof=[[.46,.55],[.44,.8],[.4,1.1],[.37,1.4],[.34,1.58],[.24,1.7],[.14,1.75]].map(([r,y])=>new THREE.Vector2(r,y));
  const front=new THREE.Mesh(new THREE.LatheGeometry(prof,14,-1.05,2.1),stdM(0xd8b445,{metalness:.65,roughness:.35,emissive:0x2a1e05,side:THREE.DoubleSide}));
  const back=new THREE.Mesh(new THREE.LatheGeometry(prof,14,Math.PI-1.05,2.1),front.material);
  const trimF=new THREE.Mesh(new THREE.TorusGeometry(.46,.018,4,16,2.1),red);trimF.rotation.x=Math.PI/2;trimF.rotation.z=Math.PI/2-1.05-2.1;trimF.position.y=.55;
  const trimB=trimF.clone();trimB.rotation.z+=Math.PI;
  const cross=new THREE.Group();cross.add(new THREE.Mesh(new THREE.BoxGeometry(.08,.5,.015),red),at(new THREE.Mesh(new THREE.BoxGeometry(.32,.08,.015),red),0,.1,0));cross.position.set(0,1.12,.405);cross.rotation.x=-.08;
  const head=new THREE.Mesh(new THREE.SphereGeometry(.16,12,10),skin);head.position.y=1.9;
  const beard=new THREE.Mesh(lumpy(new THREE.SphereGeometry(.18,12,10),.05,51),furM('cream',1,1,0xffffff,0x3a3a36));beard.scale.set(1.15,1.5,.7);beard.position.set(0,1.56,.11);
  /* dlouhá část vousů přes ornát až k horní části kříže */
  const beard2=new THREE.Mesh(lumpy(new THREE.SphereGeometry(.18,12,10),.05,55),beard.material);beard2.scale.set(1.1,1.3,.42);beard2.position.set(0,1.6,.27);beard2.rotation.x=-.38;
  const must=new THREE.Mesh(lumpy(new THREE.SphereGeometry(.07,8,6),.02,52),beard.material);must.scale.set(2,.7,.8);must.position.set(0,1.815,.16);
  /* oči, obočí a nos (vousy začínají až pod nosem) */
  const mface=new THREE.Group();for(const x of[-.058,.058]){const w=new THREE.Mesh(new THREE.SphereGeometry(.026,10,8),stdM(0xffffff,{roughness:.3}));w.position.set(x,1.935,.138);w.scale.z=.6;
    const pu=new THREE.Mesh(new THREE.SphereGeometry(.013,8,6),stdM(0x2a3f66));pu.position.set(x,1.935,.153);
    const br=new THREE.Mesh(lumpy(new THREE.SphereGeometry(.03,6,4),.01,54+x*10),beard.material);br.scale.set(1.6,.55,.6);br.position.set(x,1.978,.14);mface.add(w,pu,br)}
  const mnose=new THREE.Mesh(new THREE.SphereGeometry(.034,10,8),stdM(0xe3a98c));mnose.scale.set(.9,1.1,1);mnose.position.set(0,1.875,.16);mface.add(mnose);
  /* světle hnědé vlasy pod mitrou: vzadu a po stranách až po ramena, obličej volný */
  const hairP=[[.172,2.04],[.19,1.96],[.2,1.86],[.195,1.76],[.18,1.68],[.15,1.62]].map(([r,y])=>new THREE.Vector2(r,y));
  const hair=new THREE.Mesh(lumpy(new THREE.LatheGeometry(hairP,18,.85,Math.PI*2-1.7),.025,53),furM('hair',2,1.2,0xffffff,0x1e140a));hair.material.side=THREE.DoubleSide;hair.position.z=-.01;
  /* mitra */
  const ms=new THREE.Shape();ms.moveTo(-.16,0);ms.lineTo(.16,0);ms.lineTo(.17,.24);ms.quadraticCurveTo(.12,.4,0,.5);ms.quadraticCurveTo(-.12,.4,-.17,.24);ms.lineTo(-.16,0);
  const mg=new THREE.ExtrudeGeometry(ms,{depth:.2,bevelEnabled:true,bevelSize:.02,bevelThickness:.02,bevelSegments:2});mg.translate(0,0,-.1);
  const mitre=new THREE.Mesh(mg,gold);mitre.position.y=2.02;
  const mcross=new THREE.Group();mcross.add(new THREE.Mesh(new THREE.BoxGeometry(.04,.2,.01),red),at(new THREE.Mesh(new THREE.BoxGeometry(.14,.04,.01),red),0,.03,0));mcross.position.set(0,2.27,.125);
  const band=new THREE.Mesh(new THREE.CylinderGeometry(.175,.175,.05,18),red);band.position.y=2.03;
  const fur=new THREE.Mesh(new THREE.TorusGeometry(.17,.035,6,18),white);fur.rotation.x=Math.PI/2;fur.position.y=2.0;
  const glove=stdM(0xfafafa);const armL=sleeveArm(-.4,white,glove,.62),armR=sleeveArm(.4,white,glove,.62);
  /* košík v levé ruce */
  const bas=new THREE.Group();const bw=stdM(0x9a6a3a,{roughness:1});const bowl=new THREE.Mesh(lathe([[.0,0],[.14,0],[.17,.14]],12),bw);bowl.material.side=THREE.DoubleSide;
  const handle=new THREE.Mesh(new THREE.TorusGeometry(.14,.012,4,14,Math.PI),bw);handle.position.y=.14;bas.add(bowl,handle);bas.position.set(0,-.95,.05);armL.add(bas);
  /* berla se spirálou */
  const b=new THREE.Group();const sh=new THREE.Mesh(new THREE.CylinderGeometry(.022,.022,2.2,6),stdM(0xd8d0c0,{metalness:.5,roughness:.4}));sh.position.y=-.35;b.add(sh);
  const sp=[];for(let i=0;i<40;i++){const a=i/40*Math.PI*3.2,r=.14*(1-i/52);sp.push(new THREE.Vector3(0,-1.45-Math.sin(a)*r-r,Math.cos(a)*r-.0))}
  const spiral=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(sp),60,.018,6,false),gold);b.add(spiral);
  rig.add(legL,legR,alba,front,back,trimF,trimB,cross,head,hair,beard,beard2,must,mface,mitre,mcross,band,fur,armL,armR);return finish3(g,rig,legL,legR,armL,armR,b)}
function makeRole(r,v){return r==='konik'?makeKonik():r==='smrtka'?makeSmrtka():r==='mikulas'?makeMikulas():r==='napalovac'?makeKid(0):makeCert({prda:r==='prda',v})}



const JACKETS=[0xe63946,0x2a9d8f,0x457b9d,0xf4a261,0x8338ec,0x06d6a0,0xffbe0b,0xfb5607];
function makeKid(i){
  const g=new THREE.Group(),jacket=lam(JACKETS[i%JACKETS.length]),jeans=lam(0x2b4c7e),skin=lam(0xf1c9a0),hat=lam(JACKETS[(i+3)%JACKETS.length]);
  const legL=limb(.18,.7,.2,jeans,-.11,.7,0),legR=limb(.18,.7,.2,jeans,.11,.7,0);
  const body=box(.5,.62,.32,jacket,0,1.02,0);
  const head=new THREE.Mesh(new THREE.SphereGeometry(.2,10,8),skin);head.position.y=1.52;
  const cap=new THREE.Mesh(new THREE.SphereGeometry(.21,10,6,0,Math.PI*2,0,Math.PI/2),hat);cap.position.y=1.56;
  const pom=new THREE.Mesh(new THREE.SphereGeometry(.08,6,5),lam(0xffffff));pom.position.y=1.79;
  const armL=limb(.14,.58,.16,jacket,-.33,1.3,0),armR=limb(.14,.58,.16,jacket,.33,1.3,0);
  g.add(legL,legR,body,head,cap,pom,armL,armR);g.userData={legL,legR,armL,armR};return g}
function animWalk(m,phase,amt){const u=m.userData;const s=Math.sin(phase)*amt;u.legL.rotation.x=s;u.legR.rotation.x=-s;if(!u.attack){u.armL.rotation.x=-s*.8;u.armR.rotation.x=s*.5}
  if(u.bells)u.bells.forEach((b,i)=>{b.rotation.x=Math.sin(phase*2+i)*amt*.5;b.rotation.z=Math.cos(phase*2+i*1.3)*amt*.35})}

/* ===================== ROLE A JEJICH SCHOPNOSTI ===================== */
const ROLE={
  cert:   {n:'Čert',   chuze:3.4,beh:6.6,drain:17,dosah:3.0,sila:1/5,respekt:1,   akce:'Strašit'},
  prda:   {n:'Prďa',   chuze:3.7,beh:7.3,drain:11,dosah:2.8,sila:1/8,respekt:1.25,akce:'Strašit'},
  konik:  {n:'Koník',  chuze:3.8,beh:7.6,drain:11,dosah:2.9,sila:1/8,respekt:1.25,akce:'Točit šavlí'},
  smrtka: {n:'Smrtka', chuze:3.7,beh:7.1,drain:11,dosah:3.4,sila:1/8,respekt:1.25,akce:'Klepat na kosu'},
  mikulas:{n:'Mikuláš',chuze:3.2,beh:5.6,drain:18,dosah:2.6,sila:1/8,respekt:1,   akce:'Pochválit děti',pokuta:10},
};
const DRUZINA=['mikulas','cert','cert','cert','cert','cert','konik','smrtka','prda'];
const VISIT_S=25, ROUTE_N=18, GROUP_SPD=1.35;

/* ===================== STAV HRY ===================== */
const cam={yaw:Math.PI,pitch:0.42,dist:7};
let ents=[],player=null,kids=[],balls=[],state='menu',score=0,houses=0,caught=0,scareP=0,penalty=0,timeLeft=CFG.limit;
let route=[],ri=0,grp={phase:'walk',path:[],pi:0,t:0,house:null,door:null,stuck:0},scareCount=0;
const ballGeo=new THREE.SphereGeometry(.12,8,6),ballMat=new THREE.MeshLambertMaterial({color:0xffffff});
const starTex=(()=>{const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d');x.fillStyle='#ffd166';x.font='bold 40px sans-serif';x.textAlign='center';x.textBaseline='middle';x.fillText('★',32,34);return new THREE.CanvasTexture(c)})();
const leader=()=>ents.find(e=>e.role==='mikulas');
function grpCenter(){let x=0,z=0,n=0;for(const e of ents)if(!e.isPlayer||e.role==='mikulas'){x+=e.pos.x;z+=e.pos.z;n++}return [x/n,z/n]}

function newEnt(role,isPlayer,slot,v){const m=makeRole(role,v);scene.add(m);
  return {role,isPlayer,slot,mesh:m,pos:new THREE.Vector3(),face:Math.PI,phase:rnd(0,6),stamina:100,tired:false,attack:0,atkT:0,hitDone:true,cool:0,
    st:'follow',target:null,chaseT:0,chaseCd:rnd(2,6),jump:0,scareT:0,running:false}}
function spawnPoint(cx,cz,minD,maxD){for(let k=0;k<60;k++){const a=rnd(0,Math.PI*2),d=rnd(minD,maxD);const x=cx+Math.cos(a)*d,z=cz+Math.sin(a)*d;
  const bx=M.box;if(x<bx[0]+5||x>bx[2]-5||z<bx[1]+5||z>bx[3]-5)continue;if(insideAny(x,z,1.2))continue;return [x,z]}return [cx+20,cz]}
function newKid(i){const m=makeKid(i);scene.add(m);const[cx,cz]=grpCenter();const[x,z]=spawnPoint(cx,cz,22,42);
  const b=document.createElement('div');b.className='bub hide';$('bubbles').appendChild(b);
  const star=new THREE.Sprite(new THREE.SpriteMaterial({map:starTex,transparent:true,depthWrite:false}));star.scale.set(.6,.6,1);star.visible=false;scene.add(star);
  return {i,mesh:m,pos:new THREE.Vector3(x,0,z),face:0,phase:rnd(0,6),st:'roam',t:rnd(1,3),stamina:100,throwCd:rnd(2,5),bub:b,bubT:0,star,turn:0,turnT:0,gone:0,freeze:0}}
function say(k,t,ms){k.bub.textContent=t;k.bub.classList.remove('hide');k.bubT=ms||2200}

/* trasa: domy na Polňáku blízko cesty, postupně nejbližší další */
function makeRoute(sx,sz){const cand=B.filter(b=>b.v).map(b=>({b,d:doorOf(b)})).filter(o=>o.d.road<22);
  const out=[];let x=sx,z=sz;while(out.length<ROUTE_N&&cand.length){let bi=0,bd=1e9;cand.forEach((o,i)=>{const d=Math.hypot(o.d.x-x,o.d.z-z);if(d<bd){bd=d;bi=i}});
    const o=cand.splice(bi,1)[0];
    for(let i=cand.length-1;i>=0;i--)if(Math.hypot(cand[i].d.x-o.d.x,cand[i].d.z-o.d.z)<9)cand.splice(i,1);   /* sousední domy přeskočí, ať se jen nepřešlapuje */
    out.push(o);x=o.d.x;z=o.d.z}return out}
const routeMarks=[];
function setMarks(){routeMarks.forEach(s=>scene.remove(s));routeMarks.length=0;
  route.forEach((o,i)=>{const s=new THREE.Sprite(new THREE.SpriteMaterial({map:GLOW,transparent:true,depthWrite:false,fog:false}));s.position.set(o.b.cx,o.b.top+(o.b.r!==undefined?o.b.r:4)+1.8,o.b.cz);scene.add(s);routeMarks.push(s);o.mark=s});updMarks()}
function updMarks(){route.forEach((o,i)=>{const s=o.mark;if(i<ri){s.material.color.set(o.with?0x4ade80:0x8899aa);s.scale.set(1.2,1.2,1)}else if(i===ri){s.material.color.set(0xffd166);s.scale.set(3.2,3.2,1)}else{s.material.color.set(0xffffff);s.material.opacity=.45;s.scale.set(1.3,1.3,1)}})}
function planTo(i){const L=leader(),o=route[i];if(!o)return;const a=nearestNode(L.pos.x,L.pos.z);const p=findPath(a,o.d.node)||[];grp.path=p.concat([[o.d.x,o.d.z]]);grp.pi=0;grp.phase='walk';grp.house=o.b;grp.door=o.d}

function resetGame(){
  for(const e of ents)scene.remove(e.mesh);for(const k of kids){scene.remove(k.mesh);scene.remove(k.star);k.bub.remove()}for(const b of balls)scene.remove(b.m);
  for(const c of cars)scene.remove(c.mesh);cars=[];carT=rnd(6,12);
  ents=[];kids=[];balls=[];score=0;houses=0;caught=0;scareP=0;penalty=0;timeLeft=CFG.limit;ri=0;
  const s=M.start||[0,0];let pTaken=false;
  /* čerti v družině mají každý jiný vzhled; hráč-čert ten, který si vybral */
  const cv=[1,2,3,4,5].filter(v=>!(selChar==='cert'&&v===selVar));let ci=0;
  DRUZINA.forEach((r,i)=>{const isP=!pTaken&&r===selChar;if(isP)pTaken=true;const e=newEnt(r,isP,i,r==='cert'?(isP?selVar:cv[ci++%cv.length]):1);
    const a=i/DRUZINA.length*Math.PI*2;e.pos.set(s[0]+Math.cos(a)*2.5,0,s[1]+Math.sin(a)*2.5);pushOut(e.pos,.45);ents.push(e);if(isP)player=e});
  player.face=Math.PI;cam.yaw=Math.PI;cam.cur=undefined;
  route=makeRoute(s[0],s[1]);setMarks();planTo(0);
  for(let i=0;i<CFG.napalovacu;i++)kids.push(newKid(i));
  $('hHousesT').textContent=route.length;$('tScare').textContent=ROLE[player.role].akce;updHud();
}

/* ===================== OVLÁDÁNÍ ===================== */
const keys=new Set();
addEventListener('keydown',e=>{const k=e.key.toLowerCase();keys.add(k);if(state!=='play')return;
  if(k===' '||k==='j'){e.preventDefault();attack(player)}if(k==='q'||k==='e')scare();if(k==='escape'||k==='p')pause(true)});
addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
const joy={id:null,x:0,y:0,dx:0,dy:0},look={id:null,x:0,y:0};let runHeld=false;
canvas.addEventListener('pointerdown',e=>{if(state!=='play')return;
  if(e.pointerType!=='mouse'&&e.clientX<innerWidth*0.45&&joy.id===null){joy.id=e.pointerId;joy.x=e.clientX;joy.y=e.clientY;joy.dx=joy.dy=0;const j=$('joy');j.style.left=e.clientX+'px';j.style.top=e.clientY+'px';j.classList.remove('hide')}
  else if(look.id===null){look.id=e.pointerId;look.x=e.clientX;look.y=e.clientY}
  try{canvas.setPointerCapture(e.pointerId)}catch(err){}});
canvas.addEventListener('pointermove',e=>{
  if(e.pointerId===joy.id){let dx=e.clientX-joy.x,dy=e.clientY-joy.y;const l=Math.hypot(dx,dy),mx=55;if(l>mx){dx=dx/l*mx;dy=dy/l*mx}joy.dx=dx/mx;joy.dy=dy/mx;
    $('joy').firstElementChild.style.transform=`translate(${dx}px,${dy}px)`}
  else if(e.pointerId===look.id){cam.yaw-=(e.clientX-look.x)*0.006;cam.pitch=clamp(cam.pitch+(e.clientY-look.y)*0.004,0.12,1.1);look.x=e.clientX;look.y=e.clientY}});
function endPtr(e){if(e.pointerId===joy.id){joy.id=null;joy.dx=joy.dy=0;$('joy').classList.add('hide');$('joy').firstElementChild.style.transform=''}if(e.pointerId===look.id)look.id=null}
canvas.addEventListener('pointerup',endPtr);canvas.addEventListener('pointercancel',endPtr);
canvas.addEventListener('wheel',e=>{cam.dist=clamp(cam.dist+e.deltaY*0.01,4,14)},{passive:true});
const tb=(id,down,up)=>{const b=$(id);b.addEventListener('pointerdown',e=>{e.preventDefault();b.classList.add('on');down()});
  const u=e=>{b.classList.remove('on');up&&up()};b.addEventListener('pointerup',u);b.addEventListener('pointercancel',u);b.addEventListener('pointerleave',u)};
tb('tHit',()=>attack(player));tb('tRun',()=>runHeld=true,()=>runHeld=false);tb('tScare',()=>scare());
addEventListener('contextmenu',e=>e.preventDefault());

/* ===================== ÚDER (pro hráče i počítač) ===================== */
const ATK={wind:.15,strike:.09,rec:.3};
function attack(e){if(e.attack>0||e.cool>0)return;e.attack=ATK.wind+ATK.strike+ATK.rec;e.atkT=0;e.hitDone=false;
  for(const k of kids){if(Math.hypot(k.pos.x-e.pos.x,k.pos.z-e.pos.z)<3.6)k.freeze=.4}}
function strikeHit(e){const fx=Math.sin(e.face),fz=Math.cos(e.face),R=ROLE[e.role],spin=e.role==='konik';
  if(!spin)puff(e.pos.x+fx*1.5,e.pos.z+fz*1.5);if(e.isPlayer)cam.shake=spin?.08:.18;let any=false;
  for(const k of kids){if(k.st==='down'||k.gone>0)continue;const dx=k.pos.x-e.pos.x,dz=k.pos.z-e.pos.z,d=Math.hypot(dx,dz);
    if(d<R.dosah&&d>0.2&&(spin||(dx*fx+dz*fz)/d>0.4)){any=true;k.hp=(k.hp===undefined?1:k.hp)-R.sila;
      if(k.hp>0.001){k.freeze=1.0;say(k,['Au!','Jau!','Au au!','Nech mě!'][Math.floor(Math.random()*4)],900);if(e.isPlayer){const n=Math.round(1/R.sila),done=n-Math.round(k.hp/R.sila);toast(`Zásah ${done}/${n}`,700)}}
      else{k.st='down';k.t=rnd(5,7);k.hp=1;say(k,AU[Math.floor(Math.random()*AU.length)],2400);
        if(e.isPlayer){caught++;if(R.pokuta){penalty+=R.pokuta;score-=R.pokuta;toast(`Mikuláš se nemá prát! −${R.pokuta}`,1800)}else{score+=CFG.bodyChycen;toast(`Napalovač leží! +${CFG.bodyChycen}`,1200)}updHud()}}
      e.st='return';if(!spin)return true}}return any}
const puffs=[],puffGeo=new THREE.SphereGeometry(.07,5,4),puffMat=new THREE.MeshBasicMaterial({color:0xffffff});
function puff(x,z){for(let i=0;i<14;i++){const m=new THREE.Mesh(puffGeo,puffMat);m.position.set(x+rnd(-.2,.2),groundH(x,z)+.1,z+rnd(-.2,.2));scene.add(m);
  puffs.push({m,v:new THREE.Vector3(rnd(-1.6,1.6),rnd(1.5,3.5),rnd(-1.6,1.6)),t:.7,g:groundH(x,z)})}}
function animAttack(e,dt){const u=e.mesh.userData;e.cool-=dt;if(e.attack<=0){u.attack=false;u.fork.rotation.x=Math.PI;u.fork.rotation.z=0;u.rig.rotation.x=0;u.rig.rotation.y=0;return}
  u.attack=true;e.atkT+=dt;e.attack-=dt;const t=e.atkT,tot=ATK.wind+ATK.strike+ATK.rec;
  if(e.role==='konik'){/* šavlí seká do kříže: shora zprava dolů doleva, pak shora zleva dolů doprava */const f=Math.min(1,t/tot),h=f<.5?f*2:(f-.5)*2,sw=h*h*(3-2*h);
    const zA=f<.5?.95:-.55,zB=f<.5?-.55:.95;u.armR.rotation.x=-2.7+2.1*sw;u.armR.rotation.z=zA+(zB-zA)*sw;u.armR.rotation.y=0;u.fork.rotation.x=0;u.fork.rotation.z=0;
    u.armL.rotation.x=-.5;u.rig.rotation.x=.12*sw;u.rig.rotation.y=(f<.5?-.25:.25)*(1-2*sw);
    if(f>.3&&!e.hitDone){e.hitDone=true;strikeHit(e)}if(e.attack<=0){e.cool=.08;u.armR.rotation.set(0,0,0);u.rig.rotation.set(0,0,0)}return}
  let arm,fk,lean;const ease=x=>x*x*(3-2*x);
  if(t<ATK.wind){const f=ease(t/ATK.wind);arm=-3.25*f;fk=Math.PI+Math.PI*f;lean=-.12*f}
  else if(t<ATK.wind+ATK.strike){const f=(t-ATK.wind)/ATK.strike;arm=-3.25+2.6*f*f;fk=0;lean=-.12+.34*f*f;if(f>.8&&!e.hitDone){e.hitDone=true;strikeHit(e)}}
  else{const f=ease(Math.min(1,(t-ATK.wind-ATK.strike)/ATK.rec));arm=-.65*(1-f);fk=Math.PI*f;lean=.22*(1-f)}
  if(!e.hitDone&&t>=ATK.wind+ATK.strike){e.hitDone=true;strikeHit(e)}
  u.armR.rotation.x=arm;u.armL.rotation.x=arm*.92;u.armL.rotation.z=-.35*Math.min(1,-arm/1.5);u.armR.rotation.z=.25*Math.min(1,-arm/1.5);u.fork.rotation.x=fk;u.rig.rotation.x=lean;
  if(e.attack<=0){e.cool=.08;u.armL.rotation.z=u.armR.rotation.z=0}}

/* ===================== STRAŠENÍ U DOMU ===================== */
function scare(){const e=player;if(e.scareT>0)return;e.scareT=1.2;
  if(grp.phase==='visit'&&grp.house&&Math.hypot(e.pos.x-grp.house.cx,e.pos.z-grp.house.cz)<16){
    if(scareCount<4){scareCount++;scareP+=3;score+=3;toast(`${ROLE[e.role].akce}! +3`,900);updHud()}else toast('U tohoto domu už stačí 🙂',900)}
  else toast('Body za strašení jsou jen u domu s družinou',1500)}

/* ===================== POHYB A AI ===================== */
function steer(e,tx,tz,spd,dt){const dx=tx-e.pos.x,dz=tz-e.pos.z,d=Math.hypot(dx,dz);if(d<0.05)return 0;const s=Math.min(spd*dt,d);
  const ox=e.pos.x,oz=e.pos.z;e.pos.x+=dx/d*s;e.pos.z+=dz/d*s;pushOut(e.pos,.45);const moved=Math.hypot(e.pos.x-ox,e.pos.z-oz);
  const tf=Math.atan2(dx,dz);let a=tf-e.face;a=Math.atan2(Math.sin(a),Math.cos(a));e.face+=a*Math.min(1,dt*8);e.phase+=moved*2.4;return moved/dt}
function updGroup(dt){
  const L=leader();
  if(grp.phase==='walk'){
    if(!L.isPlayer){const wp=grp.path[grp.pi];if(wp){
      /* počká na opozdilce (kromě hráče) */
      const lag=ents.some(e=>!e.isPlayer&&e!==L&&e.st==='follow'&&Math.hypot(e.pos.x-L.pos.x,e.pos.z-L.pos.z)>14);
      const sp=steer(L,wp[0],wp[1],lag?.5:GROUP_SPD,dt);L.spd=sp;
      if(Math.hypot(wp[0]-L.pos.x,wp[1]-L.pos.z)<1.2)grp.pi++;
      if(sp<.3){grp.stuck+=dt;if(grp.stuck>3){grp.pi++;grp.stuck=0}}else grp.stuck=0}}
    if(Math.hypot(L.pos.x-grp.door.x,L.pos.z-grp.door.z)<(L.isPlayer?3:1.5)||(!L.isPlayer&&grp.pi>=grp.path.length)){grp.phase='visit';grp.t=VISIT_S;scareCount=0;
      if(!player.isPlayer||true)toast(`Zastávka: ${route[ri].b.adr||'dům '+(ri+1)}`,1400)}
  }else{
    grp.t-=dt;if(grp.t<=0){const o=route[ri];const near=Math.hypot(player.pos.x-o.b.cx,player.pos.z-o.b.cz)<18;o.with=near;
      if(near){houses++;score+=CFG.bodyDum;toast(`${o.b.adr?o.b.adr+': ':''}${DUM[Math.floor(Math.random()*DUM.length)]} +${CFG.bodyDum}`,1800)}else toast('Družina odešla od domu bez tebe – body za dům propadly',2200);
      ri++;updMarks();updHud();if(ri>=route.length){finish(false,true);return}planTo(ri)}}
}
const SLOTS=[[-1.3,1.8],[1.3,1.8],[-1.6,3.4],[0,3.6],[1.6,3.4],[-1.3,5.2],[1.3,5.2],[0,6.8]];
function updMember(e,k,dt){
  const L=leader(),R=ROLE[e.role];let spd=0;
  if(e.isPlayer)return;
  e.chaseCd-=dt;
  /* honička: napalovač blízko a družina není daleko (nejvýš 3 honí najednou) */
  const chasers=ents.filter(x=>x.st==='chase'||x.st==='hold').length;
  if(e.st!=='chase'&&e.st!=='hold'&&e.role!=='mikulas'&&e.chaseCd<=0&&chasers<3){
    let best=null,bd=grp.phase==='visit'?8:14;for(const kd of kids){if(kd.gone>0||kd.st==='down')continue;const d=Math.hypot(kd.pos.x-e.pos.x,kd.pos.z-e.pos.z);if(d<bd){bd=d;best=kd}}
    if(best&&Math.hypot(e.pos.x-L.pos.x,e.pos.z-L.pos.z)<26){e.st='chase';e.target=best;e.herd=false;e.chaseT=rnd(5,8)}}
  if(e.st==='chase'){const t=e.target;e.chaseT-=dt;
    if(!t||t.gone>0||t.st==='down'||e.chaseT<=0||Math.hypot(e.pos.x-L.pos.x,e.pos.z-L.pos.z)>34){e.st='return';e.chaseCd=rnd(3,6)}
    else{const d=Math.hypot(t.pos.x-e.pos.x,t.pos.z-e.pos.z);e.running=true;let tx=t.pos.x,tz=t.pos.z;
      /* nahánění k hráči: oběhne napalovače z druhé strany */
      if(e.herd&&d>3){const ax=t.pos.x-player.pos.x,az=t.pos.z-player.pos.z,al=Math.hypot(ax,az)||1;tx=t.pos.x+ax/al*3;tz=t.pos.z+az/al*3}
      spd=steer(e,tx,tz,R.beh*.95,dt);
      if(d<R.dosah*.75&&e.attack<=0){const pd=Math.hypot(player.pos.x-t.pos.x,player.pos.z-t.pos.z);
        if(pd<14&&player.role!=='mikulas'){t.freeze=1.9;e.st='hold';e.holdT=1.9;say(t,'Pusť mě!',1800);toast(`${ROLE[e.role].n} ho drží – rychle udeř!`,1500)}
        else attack(e)}}}
  if(e.st==='hold'){const t=e.target;e.holdT-=dt;e.running=false;
    if(!t||t.st==='down'||e.holdT<=0){e.st='return';e.chaseCd=rnd(2,4)}else{const a=Math.atan2(t.pos.x-e.pos.x,t.pos.z-e.pos.z);e.face=a;spd=0}}
  if(e.st!=='chase')e.running=false;
  if(e.st==='return'||e.st==='follow'){
    let tx,tz;
    if(e===L){/* Mikuláš vede (řeší updGroup), u domu stojí u dveří */if(grp.phase==='visit'){tx=grp.door.x;tz=grp.door.z;spd=steer(e,tx,tz,1.5,dt);const hf=Math.atan2(grp.house.cx-e.pos.x,grp.house.cz-e.pos.z);let a=hf-e.face;a=Math.atan2(Math.sin(a),Math.cos(a));e.face+=a*Math.min(1,dt*4)}else spd=L.spd||0}
    else if(grp.phase==='visit'){const h=grp.house,rad=Math.max(h.x1-h.x0,h.z1-h.z0)/2+2.6,a=k/9*Math.PI*2+(VISIT_S-grp.t)*.22;tx=h.cx+Math.cos(a)*rad;tz=h.cz+Math.sin(a)*rad;
      spd=steer(e,tx,tz,e.st==='return'?4.5:2.2,dt);e.jump+=dt*7}
    else{const fx=Math.sin(L.face),fz=Math.cos(L.face),sl=SLOTS[(k-1+SLOTS.length)%SLOTS.length];tx=L.pos.x-fx*sl[1]+fz*sl[0];tz=L.pos.z-fz*sl[1]-fx*sl[0];
      const d=Math.hypot(tx-e.pos.x,tz-e.pos.z);spd=steer(e,tx,tz,d>6?4.5:d>1.5?GROUP_SPD*1.5:GROUP_SPD*.8,dt)}
    if(e.st==='return'&&Math.hypot(e.pos.x-L.pos.x,e.pos.z-L.pos.z)<9)e.st='follow'}
  /* zaseknutý opozdilec: mimo dohled hráče se přenese k družině */
  if(e!==L&&e.st!=='chase'){const dl=Math.hypot(e.pos.x-L.pos.x,e.pos.z-L.pos.z);e.lagT=(dl>24&&spd<.6)?(e.lagT||0)+dt:0;
    if(e.lagT>2.5&&Math.hypot(e.pos.x-player.pos.x,e.pos.z-player.pos.z)>22){const[x,z]=spawnPoint(L.pos.x,L.pos.z,2,5);e.pos.set(x,0,z);e.lagT=0;e.st='follow'}}
  e.spd=spd}
/* strašení podle postavy: t = 0..1 průběh, on = probíhá */
function scareAnim(e,t,on){const m=e.mesh,u=m.userData;if(e.attack>0)return;
  if(!on){if(e.scaring){e.scaring=false;u.armL.rotation.set(0,0,0);u.armR.rotation.set(0,0,0);u.fork.rotation.set(Math.PI,0,0);u.rig.rotation.y=0}return}
  e.scaring=true;
  if(e.role==='cert'){m.position.y=e.pos.y+Math.abs(Math.sin(t*Math.PI*5))*.5;u.rig.rotation.y=t*Math.PI*2}
  else if(e.role==='konik'){m.position.y=e.pos.y+Math.abs(Math.sin(t*Math.PI*6))*.35;
    if((e.twirl||0)>0){u.armR.rotation.set(-3.0,0,0);u.fork.rotation.set(Math.PI/2,0,t*40)}else{u.armR.rotation.x=-.8+Math.sin(t*30)*.3}}
  else if(e.role==='smrtka'){/* kosa svisle, kartáčem klepe o násadu */u.armR.rotation.set(-.35,0,0);u.fork.rotation.set(Math.PI,0,0);u.armL.rotation.set(-1.05+Math.abs(Math.sin(t*Math.PI*8))*.35,0,.75)}
  else if(e.role==='prda'){u.armR.rotation.x=-.6+Math.sin(t*Math.PI*6)*.5;u.armL.rotation.x=-1.2+Math.sin(t*Math.PI*6+1)*.4}
  else if(e.role==='mikulas'){u.armR.rotation.set(-2.4,0,-.2);u.armL.rotation.x=-.4}}
function placeEnt(e,dt){const m=e.mesh;e.pos.y=groundH(e.pos.x,e.pos.z)+.08;m.position.copy(e.pos);m.rotation.y=e.face;const sp=e.spd||0;
  animWalk(m,e.phase,sp>.15?Math.min(.9,.35+sp/9):0);
  if(e.isPlayer){if(e.scareT>0){e.scareT-=dt;if(e.role==='konik'&&e.twirl===undefined)e.twirl=Math.random()<.5?1:0;scareAnim(e,1-e.scareT/1.2,true)}else{e.twirl=undefined;scareAnim(e,0,false)}}
  else{const atHouse=grp.phase==='visit'&&e.st==='follow'&&e.role!=='mikulas';e.jump+=0;
    if(atHouse){e.st2=(e.st2||0)+dt;const cyc=e.role==='konik'?4:2.4;const tt=(e.st2%cyc)/cyc;if(e.role==='konik')e.twirl=(Math.floor(e.st2/cyc)%3===0)?1:0;scareAnim(e,tt,true)}
    else scareAnim(e,0,false)}
  animAttack(e,dt)}

/* ===================== AUTA (občas projede kombík) ===================== */
const CG={n:[],adj:[],key:new Map()},DRIVE=new Set(['primary','secondary','tertiary','residential','unclassified','living_street']);
function cNode(x,z){const k=Math.round(x*2)+','+Math.round(z*2);let id=CG.key.get(k);if(id===undefined){id=CG.n.length;CG.key.set(k,id);CG.n.push([x,z]);CG.adj.push([])}return id}
for(const r of M.r){if(!DRIVE.has(r.t))continue;let prev=null;
  for(let i=0;i<r.p.length;i++){const[x,z]=r.p[i];
    if(i>0){const[px,pz]=r.p[i-1];const d=Math.hypot(x-px,z-pz),n=Math.ceil(d/6);
      for(let k=1;k<=n;k++){const id=cNode(px+(x-px)*k/n,pz+(z-pz)*k/n);if(prev!==null&&prev!==id){const l=Math.hypot(CG.n[id][0]-CG.n[prev][0],CG.n[id][1]-CG.n[prev][1]);CG.adj[prev].push([id,l]);CG.adj[id].push([prev,l])}prev=id}}
    else prev=cNode(x,z)}}
let cars=[],carT=rnd(3,8);
function spawnCar(){const P=player.pos;let a=-1,b=-1;
  for(let k=0;k<40;k++){const i=Math.floor(Math.random()*CG.n.length),[x,z]=CG.n[i],d=Math.hypot(x-P.x,z-P.z);if(d>45&&d<120){a=i;break}}
  if(a<0)return;
  for(let k=0;k<60;k++){const i=Math.floor(Math.random()*CG.n.length),[x,z]=CG.n[i],d=Math.hypot(x-CG.n[a][0],z-CG.n[a][1]);if(d>140&&Math.hypot(x-P.x,z-P.z)<200){b=i;break}}
  if(b<0)return;const path=findPath(a,b,CG);if(!path||path.length<10)return;
  const m=makeCar();scene.add(m);const c={mesh:m,path,i:1,pos:new THREE.Vector3(path[0][0],0,path[0][1]),face:0,spd:6,honk:0};
  c.face=Math.atan2(path[1][0]-path[0][0],path[1][1]-path[0][1]);cars.push(c)}
function updCars(dt){carT-=dt;if(carT<=0){if(cars.length<CFG.aut)spawnCar();carT=rnd(8,20)}
  for(let ci=cars.length-1;ci>=0;ci--){const c=cars[ci],p=c.path;
    if(c.i>=p.length){scene.remove(c.mesh);cars.splice(ci,1);continue}
    const[ax,az]=p[c.i-1],[bx,bz]=p[c.i];let dx=bx-ax,dz=bz-az;const l=Math.hypot(dx,dz)||1;dx/=l;dz/=l;
    const tx=bx-dz*1.6,tz=bz+dx*1.6;                     /* jede vpravo */
    const ddx=tx-c.pos.x,ddz=tz-c.pos.z,dist=Math.hypot(ddx,ddz);
    /* zatáčka a překážky před autem */
    let want=9.5;if(c.i+1<p.length){const[cx2,cz2]=p[c.i+1];const ex=cx2-bx,ez=cz2-bz,el=Math.hypot(ex,ez)||1;const dot=(dx*ex+dz*ez)/el;if(dot<.85)want=Math.min(want,4.5)}
    const fx=Math.sin(c.face),fz=Math.cos(c.face);let block=false;
    for(const o of ents.concat(kids)){if(o.gone>0)continue;const ox=o.pos.x-c.pos.x,oz=o.pos.z-c.pos.z,ahead=ox*fx+oz*fz,side=Math.abs(ox*fz-oz*fx);
      if(ahead>0&&ahead<10&&side<2.2){block=true;if(o===player&&c.honk<=0){c.honk=4;toast('Túúút! Pozor, auto!',1200)}}}
    /* auto před ním ve stejném pruhu */
    for(const o of cars){if(o===c)continue;const ox=o.pos.x-c.pos.x,oz=o.pos.z-c.pos.z,ahead=ox*fx+oz*fz,side=Math.abs(ox*fz-oz*fx);
      if(ahead>0&&ahead<11&&side<1.8&&Math.cos(o.face-c.face)>-.3){want=Math.min(want,ahead<7?0:o.spd)}}
    c.honk-=dt;c.wait=block?(c.wait||0)+dt:0;if(block)want=c.wait>5?2:0;   /* po chvíli čekání popojíždí krokem */
    c.spd+=Math.max(-14*dt,Math.min(4*dt,want-c.spd));
    if(dist<1.2){c.i++;continue}
    const tf=Math.atan2(ddx,ddz);let da=tf-c.face;da=Math.atan2(Math.sin(da),Math.cos(da));c.face+=da*Math.min(1,dt*3.5);
    c.pos.x+=Math.sin(c.face)*c.spd*dt;c.pos.z+=Math.cos(c.face)*c.spd*dt;
    c.pos.y=groundH(c.pos.x,c.pos.z)+.08;c.mesh.position.copy(c.pos);{const hf=groundH(c.pos.x+fx*1.4,c.pos.z+fz*1.4),hb=groundH(c.pos.x-fx*1.4,c.pos.z-fz*1.4);c.mesh.rotation.set(-Math.atan2(hf-hb,2.8),c.face,0,'YXZ')}c.mesh.userData.wheels.forEach(w=>w.rotation.x+=c.spd*dt/.34);
    /* nikoho nepřejede: kdo stojí v autě, toho odsune stranou */
    for(const o of ents.concat(kids)){const ox=o.pos.x-c.pos.x,oz=o.pos.z-c.pos.z,lz=ox*fx+oz*fz,lx=ox*fz-oz*fx;
      if(Math.abs(lz)<2.6&&Math.abs(lx)<1.3){const push=(1.4-Math.abs(lx))*(lx<0?-1:1);o.pos.x+=fz*push;o.pos.z-=fx*push}}}}

/* ===================== AKTUALIZACE ===================== */
function updHud(){$('hScore').textContent=score;$('hHouses').textContent=houses;$('hCaught').textContent=caught}
const tmpV=new THREE.Vector3();
function update(dt){
  timeLeft-=dt;if(timeLeft<=0){finish(true);return}
  const m=Math.floor(timeLeft/60),s=Math.floor(timeLeft%60);$('hTime').textContent=`${m}:${String(s).padStart(2,'0')}`;
  /* hráč */
  const P=player,R=ROLE[P.role];
  let ix=0,iz=0;
  if(keys.has('w')||keys.has('arrowup'))iz-=1;if(keys.has('s')||keys.has('arrowdown'))iz+=1;
  if(keys.has('a'))ix-=1;if(keys.has('d'))ix+=1;
  if(keys.has('arrowleft'))cam.yaw+=1.8*dt;if(keys.has('arrowright'))cam.yaw-=1.8*dt;
  if(joy.id!==null){ix+=joy.dx;iz+=joy.dy}
  let il=Math.hypot(ix,iz);if(il>1){ix/=il;iz/=il;il=1}
  const wantRun=(keys.has('shift')||runHeld)&&il>0.2;
  if(P.stamina<=0)P.tired=true;if(P.tired&&P.stamina>30)P.tired=false;
  const running=wantRun&&!P.tired;P.running=running;
  const spd=(running?R.beh:R.chuze)*il*(P.attack>0?.35:1);
  P.stamina=clamp(P.stamina+(running?-R.drain:il>0.1?9:15)*dt,0,100);
  if(il>0.05){const sy=Math.sin(cam.yaw),cy=Math.cos(cam.yaw);const fx=-sy*(-iz)+cy*ix,fz=-cy*(-iz)-sy*ix;
    const Lq=Math.hypot(fx,fz)||1;P.pos.x+=fx/Lq*spd*dt;P.pos.z+=fz/Lq*spd*dt;
    const tf=Math.atan2(fx,fz);let d=tf-P.face;d=Math.atan2(Math.sin(d),Math.cos(d));P.face+=d*Math.min(1,dt*12);P.phase+=dt*spd*2.4}
  pushOut(P.pos,.45);P.spd=spd;
  const st=$('stamina');st.style.width=P.stamina+'%';st.classList.toggle('low',P.tired);
  /* družina */
  updGroup(dt);if(state!=='play')return;
  /* spolupráce: když hráč honí napalovače, přiběhnou pomoct až dva nejbližší */
  if(P.running&&P.role!=='mikulas'){let kd=null,bd=16;for(const k of kids){if(k.gone>0||k.st==='down')continue;const d=Math.hypot(k.pos.x-P.pos.x,k.pos.z-P.pos.z);if(d<bd){bd=d;kd=k}}
    if(kd&&!ents.some(e=>e.target===kd&&(e.st==='chase'||e.st==='hold'))){
      const help=ents.filter(e=>!e.isPlayer&&e.role!=='mikulas'&&e.st!=='chase'&&e.st!=='hold'&&Math.hypot(e.pos.x-P.pos.x,e.pos.z-P.pos.z)<30)
        .sort((a,b)=>Math.hypot(a.pos.x-kd.pos.x,a.pos.z-kd.pos.z)-Math.hypot(b.pos.x-kd.pos.x,b.pos.z-kd.pos.z)).slice(0,2);
      help.forEach(e=>{e.st='chase';e.target=kd;e.herd=true;e.chaseT=8})}}
  ents.forEach((e,k)=>updMember(e,k,dt));ents.forEach(e=>placeEnt(e,dt));
  for(let i=puffs.length-1;i>=0;i--){const p=puffs[i];p.t-=dt;p.v.y-=9*dt;p.m.position.addScaledVector(p.v,dt);p.m.scale.setScalar(Math.max(.1,p.t/.7));if(p.t<=0||p.m.position.y<p.g){scene.remove(p.m);puffs.splice(i,1)}}
  /* ukazatele */
  const[gx,gz]=grpCenter(),far=Math.hypot(P.pos.x-gx,P.pos.z-gz)>28;
  $('warn').textContent=!inPoly(P.pos.x,P.pos.z,M.poly)?'Jsi mimo Polňák':'Družina je daleko – vrať se k ní';
  $('warn').classList.toggle('hide',!far&&inPoly(P.pos.x,P.pos.z,M.poly));
  if(grp.phase==='visit'){$('prompt').classList.remove('hide');$('promptT').textContent=`${route[ri].b.adr||'Dům'} (${ri+1}/${route.length}) – zbývá ${Math.ceil(grp.t)} s · ${isTouch?'tlačítko':'Q'}: ${ROLE[P.role].akce}`;
    $('promptBar').style.width=((VISIT_S-grp.t)/VISIT_S*100)+'%'}
  else if(P.role==='mikulas'){$('prompt').classList.remove('hide');$('promptT').textContent=`Veď družinu k domu ${ri+1}/${route.length} (žluté světlo)`;$('promptBar').style.width='0'}
  else $('prompt').classList.add('hide');
  /* napalovači */
  for(const k of kids)updKid(k,dt);
  updCars(dt);
  /* koule */
  for(let i=balls.length-1;i>=0;i--){const b=balls[i];b.v.y-=9.8*dt;b.m.position.addScaledVector(b.v,dt);
    const dx=b.m.position.x-P.pos.x,dz=b.m.position.z-P.pos.z;
    if(Math.hypot(dx,dz)<0.7&&b.m.position.y>P.pos.y+0.2&&b.m.position.y<P.pos.y+2.2){P.stamina=Math.max(0,P.stamina-12);const sp=$('splat');sp.style.transition='none';sp.style.opacity='1';
      requestAnimationFrame(()=>{sp.style.transition='opacity .9s';sp.style.opacity='0'});scene.remove(b.m);balls.splice(i,1);continue}
    if(b.m.position.y<groundH(b.m.position.x,b.m.position.z)||b.life--<0){scene.remove(b.m);balls.splice(i,1)}}
  /* kamera (nezajede do domu) */
  let dist=cam.dist;const cp=Math.cos(cam.pitch),sx=Math.sin(cam.yaw)*cp,sz=Math.cos(cam.yaw)*cp,sy=Math.sin(cam.pitch);
  for(let i=1;i<=14;i++){const f=i/14*cam.dist,x=P.pos.x+sx*f,z=P.pos.z+sz*f,y=P.pos.y+1.6+sy*f;let hit=false;
    for(const b of near(x,z)){if(x<b.x0-.4||x>b.x1+.4||z<b.z0-.4||z>b.z1+.4||y>b.top+4.5)continue;const q=distToBuilding(b,x,z);if(q.inside||q.d<.4){hit=true;break}}
    if(hit){dist=Math.max(1.6,f-0.8);break}}
  cam.cur=cam.cur===undefined?dist:(dist<cam.cur?dist:cam.cur+(dist-cam.cur)*Math.min(1,dt*3));
  const tx=P.pos.x+sx*cam.cur,tz=P.pos.z+sz*cam.cur,ty=Math.max(P.pos.y+1.6+sy*cam.cur,groundH(tx,tz)+0.8);
  if(cam.shake>0){cam.shake-=dt;tmpV.set(rnd(-1,1),rnd(-1,1),rnd(-1,1)).multiplyScalar(cam.shake*.6);camera.position.add(tmpV)}
  camera.position.lerp(tmpV.set(tx,ty,tz),Math.min(1,dt*(cam.cur<cam.dist?20:10)));camera.lookAt(P.pos.x,P.pos.y+1.5,P.pos.z);
  lantern.position.set(P.pos.x,P.pos.y+3.2,P.pos.z);
  const sp=snow.geometry.attributes.position;for(let i=0;i<sp.count;i++){let y=sp.getY(i)-dt*1.6;if(y<0)y+=25;sp.setY(i,y)}sp.needsUpdate=true;snow.position.set(P.pos.x,P.pos.y,P.pos.z);
  const o=route[ri];if(o){o.mark.position.y=o.b.top+(o.b.r!==undefined?o.b.r:4)+1.8+Math.sin(performance.now()/300)*.3}
  drawMap();
}
/* napalovači: škádlí družinu, utíkají před kýmkoli z ní */
function moveKid(k,dx,dz,spd,dt){const l=Math.hypot(dx,dz)||1;let ux=dx/l,uz=dz/l;
  if(k.turnT>0){k.turnT-=dt;const a=k.turn,c=Math.cos(a),s=Math.sin(a);const nx=ux*c-uz*s,nz=ux*s+uz*c;ux=nx;uz=nz}
  const ox=k.pos.x,oz=k.pos.z;k.pos.x+=ux*spd*dt;k.pos.z+=uz*spd*dt;pushOut(k.pos,.4);
  const moved=Math.hypot(k.pos.x-ox,k.pos.z-oz);if(moved<spd*dt*0.45&&k.turnT<=0){k.turn=(Math.random()<.5?-1:1)*rnd(1,1.6);k.turnT=rnd(.6,1.2)}
  const tf=Math.atan2(ux,uz);let d=tf-k.face;d=Math.atan2(Math.sin(d),Math.cos(d));k.face+=d*Math.min(1,dt*10);k.phase+=dt*spd*2.8}
function updKid(k,dt){k.pos.y=groundH(k.pos.x,k.pos.z)+.08;
  const[gx,gz]=grpCenter();
  if(k.gone>0){k.gone-=dt;if(k.gone<=0){const[x,z]=spawnPoint(gx,gz,28,46);k.pos.set(x,0,z);k.st='roam';k.mesh.visible=true;k.stamina=100}return}
  /* nejbližší člen družiny a největší hrozba */
  let ne=null,nd=1e9,threat=false,tx=0,tz=0;
  for(const e of ents){const d=Math.hypot(k.pos.x-e.pos.x,k.pos.z-e.pos.z);if(d<nd){nd=d;ne=e}
    const r=(e.running?11:6.5)*ROLE[e.role].respekt;if(d<r&&e.role!=='mikulas'){threat=true;tx+=(k.pos.x-e.pos.x)/(d||1);tz+=(k.pos.z-e.pos.z)/(d||1)}}
  if(Math.hypot(k.pos.x-gx,k.pos.z-gz)>95&&k.st!=='down'){k.gone=rnd(2,6);k.mesh.visible=false;k.bub.classList.add('hide');return}
  if(k.freeze>0&&k.st!=='down'){k.freeze-=dt;k.mesh.position.copy(k.pos);animWalk(k.mesh,k.phase,0);return}
  k.t-=dt;k.throwCd-=dt;let spd=0;const dx=k.pos.x-ne.pos.x,dz=k.pos.z-ne.pos.z,d=nd;
  if(k.st==='down'){/* leží na zádech a kope nohama */const u=k.mesh.userData,kk=Math.sin(k.t*16);
    k.mesh.position.copy(k.pos);k.mesh.position.y=k.pos.y+.22;k.mesh.rotation.set(-Math.PI/2,k.face,0,'YXZ');
    u.legL.rotation.x=kk*.8;u.legR.rotation.x=-kk*.8;u.armL.rotation.x=Math.sin(k.t*11)*1.2-1.5;u.armR.rotation.x=-Math.sin(k.t*11)*1.2-1.5;
    k.star.visible=true;k.star.position.set(k.pos.x+Math.cos(k.t*6)*.45,k.pos.y+.8,k.pos.z+Math.sin(k.t*6)*.45);
    if(k.t<=0){k.st='flee';k.t=2.5;k.stamina=60;k.star.visible=false;k.mesh.rotation.set(0,k.face,0);k.mesh.position.y=k.pos.y;k.throwCd=rnd(3,5);say(k,'Stejně vás budu napalovat!',2000)}
    if(k.bubT>0){k.bubT-=dt*1000;if(k.bubT<=0)k.bub.classList.add('hide')}return}
  else{
    if(threat){k.st='flee';k.t=rnd(2,3.5)}
    if(k.st==='flee'){const tired=k.stamina<=0;spd=tired?CFG.kidUnaveny:CFG.kidBeh;k.stamina=Math.max(0,k.stamina-11*dt);
      if(tired&&Math.random()<dt*0.6)say(k,'Uf… už nemůžu!',1500);
      moveKid(k,threat?tx:dx,threat?tz:dz,spd,dt);if(k.t<=0&&d>14)k.st='roam'}
    else{k.stamina=Math.min(100,k.stamina+14*dt);
      const keep=12*ROLE[ne.role].respekt;if(d>keep+8){spd=2.6;moveKid(k,-dx,-dz,spd,dt)}else if(d<keep){spd=1.8;moveKid(k,dx,dz,spd,dt)}
      else{const tf=Math.atan2(-dx,-dz);let dd=tf-k.face;dd=Math.atan2(Math.sin(dd),Math.cos(dd));k.face+=dd*Math.min(1,dt*6)}
      if(k.throwCd<=0&&d<22&&d>6){k.throwCd=rnd(3.5,7);const tgt=Math.random()<.5&&Math.hypot(k.pos.x-player.pos.x,k.pos.z-player.pos.z)<24?player:ne;throwBall(k,tgt);if(Math.random()<.5)say(k,POKRIK[Math.floor(Math.random()*POKRIK.length)])}
      else if(Math.random()<dt*0.08&&k.bubT<=0)say(k,POKRIK[Math.floor(Math.random()*POKRIK.length)])}}
  k.mesh.position.copy(k.pos);k.mesh.rotation.set(0,k.face,0);animWalk(k.mesh,k.phase,spd>0.1?Math.min(1,spd/5)*0.9:0);
  if(k.bubT>0){k.bubT-=dt*1000;if(k.bubT<=0)k.bub.classList.add('hide')}}
function throwBall(k,e){const t=Math.max(.5,Math.hypot(k.pos.x-e.pos.x,k.pos.z-e.pos.z)/15);
  const tx=e.pos.x+rnd(-1.3,1.3),tz=e.pos.z+rnd(-1.3,1.3),ty=e.pos.y+1.2,sx=k.pos.x,sz=k.pos.z,sy=k.pos.y+1.5;
  const v=new THREE.Vector3((tx-sx)/t,(ty-sy+0.5*9.8*t*t)/t,(tz-sz)/t);const m=new THREE.Mesh(ballGeo,ballMat);m.position.set(sx,sy,sz);scene.add(m);balls.push({m,v,life:400});
  k.mesh.userData.armR.rotation.x=-2.2;setTimeout(()=>{k.mesh.userData.armR.rotation.x=0},250)}

const projV=new THREE.Vector3();
function placeBubbles(){for(const k of kids){if(k.bub.classList.contains('hide'))continue;projV.set(k.pos.x,2.05,k.pos.z).project(camera);
  if(projV.z>1||Math.abs(projV.x)>1.1||Math.abs(projV.y)>1.1){k.bub.style.display='none';continue}k.bub.style.display='';
  k.bub.style.left=((projV.x+1)/2*innerWidth)+'px';k.bub.style.top=((1-projV.y)/2*innerHeight)+'px'}}

/* ===================== MINIMAPA ===================== */
const mapBg=document.createElement('canvas');
{const bx=M.box,w=bx[2]-bx[0],h=bx[3]-bx[1];mapBg.width=w;mapBg.height=h;const x=mapBg.getContext('2d');
 x.fillStyle='#1a2540';x.fillRect(0,0,w,h);x.lineCap='round';x.lineJoin='round';const P=p=>[p[0]-bx[0],p[1]-bx[1]];
 x.strokeStyle='#4f78a8';for(const r of M.w){x.lineWidth=r.w;x.beginPath();r.p.forEach((p,i)=>{const[a,b]=P(p);i?x.lineTo(a,b):x.moveTo(a,b)});x.stroke()}
 x.strokeStyle='#8a93a8';for(const r of M.r){x.lineWidth=Math.max(1.5,r.w);x.beginPath();r.p.forEach((p,i)=>{const[a,b]=P(p);i?x.lineTo(a,b):x.moveTo(a,b)});x.stroke()}
 x.fillStyle='#d6dbe6';for(const b of B){x.beginPath();b.p.forEach((p,i)=>{const[a,c]=P(p);i?x.lineTo(a,c):x.moveTo(a,c)});x.closePath();x.fill()}
 x.strokeStyle='#d1495b';x.lineWidth=2.5;x.setLineDash([6,5]);x.beginPath();M.poly.forEach((p,i)=>{const[a,b]=P(p);i?x.lineTo(a,b):x.moveTo(a,b)});x.closePath();x.stroke()}
const mapC=$('map'),mx=mapC.getContext('2d');
function drawMap(){const W=mapC.width,R=W/2,sc=W/160,bx=M.box,P=player;
  mx.save();mx.clearRect(0,0,W,W);mx.beginPath();mx.arc(R,R,R,0,Math.PI*2);mx.clip();mx.fillStyle='#1a2540';mx.fillRect(0,0,W,W);
  mx.translate(R,R);mx.rotate(cam.yaw);mx.scale(sc,sc);mx.translate(-(P.pos.x-bx[0]),-(P.pos.z-bx[1]));mx.drawImage(mapBg,0,0);
  route.forEach((o,i)=>{mx.fillStyle=i<ri?(o.with?'#4ade80':'#8899aa'):i===ri?'#ffd166':'rgba(255,255,255,.5)';mx.beginPath();mx.arc(o.b.cx-bx[0],o.b.cz-bx[1],i===ri?4:2.2,0,Math.PI*2);mx.fill()});
  mx.fillStyle='#ffffff';for(const e of ents){if(e.isPlayer)continue;mx.beginPath();mx.arc(e.pos.x-bx[0],e.pos.z-bx[1],e.role==='mikulas'?2.8:1.8,0,Math.PI*2);mx.fill()}
  mx.fillStyle='#ff4d6d';for(const k of kids){if(k.gone>0)continue;mx.beginPath();mx.arc(k.pos.x-bx[0],k.pos.z-bx[1],2.4,0,Math.PI*2);mx.fill()}
  mx.restore();
  mx.save();mx.translate(R,R);mx.rotate(cam.yaw-P.face+Math.PI);mx.fillStyle='#ffd166';mx.beginPath();mx.moveTo(0,-11);mx.lineTo(7,8);mx.lineTo(0,4);mx.lineTo(-7,8);mx.closePath();mx.fill();mx.restore();
  mx.save();mx.translate(R,R);mx.rotate(cam.yaw);mx.fillStyle='#fff';mx.font='bold 20px sans-serif';mx.textAlign='center';mx.textBaseline='middle';mx.fillText('S',0,-R+16);mx.restore()}

/* ===================== MENU / KONEC ===================== */
let selChar=store('obchuzka-postava')||'cert',selSide='polnak',selVar=+store('obchuzka-cert')||1;
if(!POSTAVY.some(p=>p.id===selChar&&!p.off))selChar='cert';
function opts(el,list,sel,cb,img){el.innerHTML=list.map(o=>`<button type="button" class="opt${img?' pic':''}" data-id="${o.id}" aria-pressed="${String(o.id)===String(sel)}" ${o.off?'disabled':''}>${img?`<img alt="" data-th="${img(o)}">`:''}${o.n}${o.d?`<small>${o.d}</small>`:''}</button>`).join('');
  el.onclick=e=>{const b=e.target.closest('.opt');if(!b||b.disabled)return;cb(b.dataset.id);el.querySelectorAll('.opt').forEach(x=>x.setAttribute('aria-pressed',x===b))}}
/* miniatury postav: vykreslí se jednou po načtení (celá postava, u čertů detail hlavy) */
const thumbs=(()=>{let r=null;const cache={};
  return (key)=>{if(cache[key])return cache[key];const[role,v,head]=key.split(':');
    if(!r){const c=document.createElement('canvas');c.width=240;c.height=300;r=new THREE.WebGLRenderer({canvas:c,antialias:true,alpha:true,preserveDrawingBuffer:true});r.setClearColor(0x000000,0)}
    const s=new THREE.Scene();s.add(new THREE.HemisphereLight(0xffffff,0x606060,1.05));const d=new THREE.DirectionalLight(0xffffff,.75);d.position.set(2,4,6);s.add(d);
    const m=makeRole(role,+v||1);s.add(m);m.rotation.y=.35;m.updateMatrixWorld(true);
    const bb=new THREE.Box3().setFromObject(m),c=bb.getCenter(new THREE.Vector3()),sz=bb.getSize(new THREE.Vector3());
    const cam=new THREE.PerspectiveCamera(24,240/300,.1,60);let cy=c.y,h=sz.y*1.08;if(head){cy=1.82;h=1.55;c.x=0;c.z=0;m.rotation.y=.2}
    const dist=h/2/Math.tan(12*Math.PI/180);cam.position.set(c.x,cy+(head?.05:.15),c.z+dist);cam.lookAt(c.x,cy,c.z);r.render(s,cam);
    s.traverse(o=>{if(o.geometry)o.geometry.dispose()});return cache[key]=r.domElement.toDataURL()}})();
function fillThumbs(root){const imgs=[...root.querySelectorAll('img[data-th]')].filter(i=>!i.src);let k=0;
  const step=()=>{const i=imgs[k++];if(!i)return;try{i.src=thumbs(i.dataset.th)}catch(e){console.warn(e)}setTimeout(step,0)};setTimeout(step,30)}
const VARIANTY=[1,2,3,4,5].map(v=>({id:v,n:String(v)}));
function charMenu(){opts($('oChar'),POSTAVY,selChar,v=>{selChar=v;store('obchuzka-postava',v);$('varW').classList.toggle('hide',v!=='cert')},o=>o.id+':'+(o.id==='cert'?selVar:1));
  opts($('oVar'),VARIANTY,selVar,v=>{selVar=+v;store('obchuzka-cert',selVar);const im=$('oChar').querySelector('[data-id=cert] img');if(im)im.src=thumbs('cert:'+selVar)},o=>'cert:'+o.id+':h');
  $('varW').classList.toggle('hide',selChar!=='cert');fillThumbs($('oVar'));fillThumbs($('oChar'))}
charMenu();opts($('oSide'),STRANY,selSide,v=>selSide=v);
$('keysPC').classList.toggle('hide',isTouch);$('keysTouch').classList.toggle('hide',!isTouch);
function showBest(el){const b=store('obchuzka-rekord');el.textContent=b?`Tvůj rekord: ${b} bodů`:''}
showBest($('best'));
function start(){resetGame();state='play';$('menu').classList.add('hide');$('end').classList.add('hide');$('ui').classList.remove('hide');$('touch').classList.toggle('hide',!isTouch);
  toast(player.role==='mikulas'?'Jsi Mikuláš – veď družinu k domům se žlutým světlem.':'Drž se družiny u domů a chytej napalovače!',3500);last=performance.now();
  if(isTouch&&document.documentElement.requestFullscreen)document.documentElement.requestFullscreen().catch(()=>{})}
$('bStart').onclick=start;$('bAgain').onclick=start;
function pause(on){if(on&&state==='play'){state='pause';$('pause').classList.remove('hide')}else if(!on&&state==='pause'){state='play';$('pause').classList.add('hide');last=performance.now()}}
$('bPause').onclick=()=>pause(true);$('bResume').onclick=()=>pause(false);
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause(true)});
$('bEnd').onclick=()=>finish(false);
function finish(timeUp,done){state='end';keys.clear();runHeld=false;$('ui').classList.add('hide');$('end').classList.remove('hide');
  for(const k of kids)k.bub.classList.add('hide');
  $('endT').textContent=done?'Strana obejitá!':timeUp?'Čas vypršel':'Obchůzka skončila';
  const used=CFG.limit-Math.max(0,timeLeft),m=Math.floor(used/60),s=Math.floor(used%60);
  $('endRes').innerHTML=`<span>Postava</span><b>${ROLE[player.role].n}</b><span>Domy s družinou</span><b>${houses} / ${ri}</b><span>Body za strašení</span><b>${scareP}</b><span>Chycení napalovači</span><b>${caught}</b>`+
    (penalty?`<span>Pokuta (Mikuláš se pral)</span><b>−${penalty}</b>`:'')+`<span>Čas na straně</span><b>${m}:${String(s).padStart(2,'0')}</b><span class="tot">Body celkem</span><b class="tot">${score}</b>`;
  const best=store('obchuzka-rekord')||0;if(score>best){store('obchuzka-rekord',score);$('endBest').textContent='Nový rekord!'}else $('endBest').textContent=`Rekord: ${best} bodů`;
  showBest($('best'))}

/* ===================== SMYČKA ===================== */
let last=performance.now();
function loop(now){requestAnimationFrame(loop);const dt=Math.min(0.05,(now-last)/1000);last=now;
  if(state==='play'){update(dt);placeBubbles()}
  else if(state==='menu'||state==='end'){const t=now/9000;const s=M.start||[0,0];camera.position.set(s[0]+Math.sin(t)*70,45+gy(s[0],s[1]+130),s[1]+130+Math.cos(t)*70);camera.lookAt(s[0],gy(s[0],s[1]+130),s[1]+130)}
  renderer.render(scene,camera)}
$('loading').remove();requestAnimationFrame(loop);
window.__hra={scene,gy,groundH,carve,camera,cam,get player(){return player},get kids(){return kids},get ents(){return ents},get grp(){return grp},get route(){return route},get cars(){return cars},get ri(){return ri},B,start,animAttack,state:()=>state,
  setChar:v=>{selChar=v},step:n=>{for(let i=0;i<n&&state==='play';i++)update(.05)},get timeLeft(){return timeLeft}};

