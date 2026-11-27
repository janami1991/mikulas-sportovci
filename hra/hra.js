/* Mikulášská obchůzka – Lidečko: hra (svět – terén, domy, cesty, objekty – je ve svet.js)
   Data mapy: © přispěvatelé OpenStreetMap (ODbL), ČÚZK (CC BY 4.0), viz polnak.js
   Grafická knihovna: three.js r128 (MIT) */
'use strict';
const CFG = {
  aut: 3,                // kolik aut může jezdit najednou
  limit: 25*60,          // délka obchůzky v sekundách
  napalovacu: 8,         // kolik jich je najednou ve hře (7 + 10 %)
  chuze: 3.4, beh: 6.6,  // rychlost čerta (m/s)
  kidBeh: 5.5, kidUnaveny: 3.0,
  bodyDum: 10, bodyChycen: 25, bodyPes: 13, bodyKombo: 15,   // pes = polovina napalovače (12,5 zaokrouhleno)
  bodyBonbon: 2, bodyNadilka: 2, bodyDumMik: 5, rebelS: 30, rebelPen: 5,   // Mikuláš-hráč nedojde k domu do 30 s → družina jde sama, Mikuláš −5 a bez bodů za dům
    // Mikuláš: dům +5, pochválit děti +1 (2× na dům)
    // Mikuláš: bonbon trefí napalovače / nadílka po odpovědi dětí
};
const POSTAVY = [
  {id:'cert', n:'Čert', d:'síla, rozsocha'},
  {id:'prda', n:'Prďa', d:'tichý, rychlý'},
  {id:'konik', n:'Koník', d:'nejrychlejší, šavle'},
  {id:'smrtka', n:'Smrtka', d:'dlouhý dosah kosy'},
  {id:'mikulas', n:'Mikuláš', d:'vede družinu'},
  {id:'napalovac', n:'Napalovač', d:'koule, zvonce, nadílka'},
];
/* strany: načtená je jen jedna (STRANA z strany.js); výběr jiné stránku znovu načte */
const STRANY = STRANY_DEF.map(x=>({id:x.id,n:x.n,d:x.id===STRANA?M.b.filter(b=>b.v).length+' domů':''}));
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



const JACKETS=[0xe63946,0x2a9d8f,0x457b9d,0xf4a261,0x8338ec,0x06d6a0,0xffbe0b,0xfb5607,0x3a86ff,0xff006e,0x6a994e,0xbc6c25];
const PANTS=[0x2b4c7e,0x22223b,0x3d405b,0x4a4e69,0x1d3557],BOOTS=[0x3b2a1e,0x1b1b1b,0x5c3d2e,0x7a1f1f];
function makeKid(i){
  const g=new THREE.Group(),jc=JACKETS[i%JACKETS.length],jacket=lam(jc),jeans=lam(PANTS[i%PANTS.length]),skin=lam(0xf1c9a0),hc=JACKETS[(i+3)%JACKETS.length],hat=lam(hc),
    dk=lam(0x1b1b1b),boot=lam(BOOTS[i%BOOTS.length]),glove=lam(JACKETS[(i+5)%JACKETS.length]),scarf=lam(JACKETS[(i+2)%JACKETS.length]),white=lam(0xffffff);
  const legL=limb(.18,.7,.2,jeans,-.11,.7,0),legR=limb(.18,.7,.2,jeans,.11,.7,0);
  for(const l of[legL,legR])l.add(box(.21,.16,.3,boot,0,-.64,.04));                       /* boty */
  const body=box(.5,.62,.32,jacket,0,1.02,0);
  const zip=box(.03,.5,.01,dk,0,1.04,.165),pk1=box(.12,.08,.01,dk,-.14,.86,.165),pk2=box(.12,.08,.01,dk,.14,.86,.165);
  const head=new THREE.Mesh(new THREE.SphereGeometry(.2,12,10),skin);head.position.y=1.52;
  /* obličej: oči, obočí, nos, pusa, červené tváře */
  const face=new THREE.Group();face.position.set(0,1.52,0);
  for(const x of[-.07,.07]){const ey=new THREE.Mesh(new THREE.SphereGeometry(.03,6,5),white);ey.position.set(x,.03,.175);const pu=new THREE.Mesh(new THREE.SphereGeometry(.017,6,5),dk);pu.position.set(x,.03,.2);
    const ch=new THREE.Mesh(new THREE.SphereGeometry(.035,6,5),lam(0xf08a8a));ch.position.set(x*1.55,-.04,.15);ch.scale.z=.4;face.add(ey,pu,ch,box(.07,.015,.01,lam(0x5a3a22),x,.08,.19))}
  const nose=new THREE.Mesh(new THREE.SphereGeometry(.035,6,5),lam(0xe8a888));nose.position.set(0,-.01,.2);face.add(nose,box(.09,.02,.01,lam(0x8a2b2b),0,-.08,.185));
  const cap=new THREE.Mesh(new THREE.SphereGeometry(.21,12,6,0,Math.PI*2,0,Math.PI/2),hat);cap.position.y=1.56;
  const rim=new THREE.Mesh(new THREE.TorusGeometry(.205,.035,6,16),lam(JACKETS[(i+6)%JACKETS.length]));rim.rotation.x=Math.PI/2;rim.position.y=1.585;
  const pom=new THREE.Mesh(new THREE.SphereGeometry(.08,6,5),white);pom.position.y=1.79;
  /* šála kolem krku s volným koncem */
  const sc=new THREE.Mesh(new THREE.TorusGeometry(.15,.05,6,14),scarf);sc.rotation.x=Math.PI/2;sc.position.y=1.33;const sce=box(.1,.32,.04,scarf,.1,1.2,.17);sce.rotation.z=.15;
  const armL=limb(.14,.58,.16,jacket,-.33,1.3,0),armR=limb(.14,.58,.16,jacket,.33,1.3,0);
  for(const a of[armL,armR])a.add(box(.15,.13,.17,glove,0,-.62,0));                       /* rukavice */
  g.add(legL,legR,body,zip,pk1,pk2,head,face,cap,rim,pom,sc,sce,armL,armR);g.userData={legL,legR,armL,armR};return g}
function animWalk(m,phase,amt){const u=m.userData;const s=Math.sin(phase)*amt;u.legL.rotation.x=s;u.legR.rotation.x=-s;if(!u.attack){u.armL.rotation.x=-s*.8;u.armR.rotation.x=s*.5}
  if(u.bells)u.bells.forEach((b,i)=>{b.rotation.x=Math.sin(phase*2+i)*amt*.5;b.rotation.z=Math.cos(phase*2+i*1.3)*amt*.35})}

/* ===================== ROLE A JEJICH SCHOPNOSTI ===================== */
const ROLE={
  cert:   {n:'Čert',   chuze:3.4,beh:6.6,drain:17,dosah:3.0,sila:1/5,respekt:1,   akce:'Strašit'},
  prda:   {n:'Prďa',   chuze:3.7,beh:7.3,drain:11,dosah:2.8,sila:1/8,respekt:1.25,akce:'Strašit'},
  konik:  {n:'Koník',  chuze:3.8,beh:7.6,drain:11,dosah:2.9,sila:1/8,respekt:1.25,akce:'Točit šavlí'},
  smrtka: {n:'Smrtka', chuze:3.7,beh:7.1,drain:11,dosah:3.4,sila:1/8,respekt:1.25,akce:'Klepat na kosu'},
  napalovac:{n:'Napalovač',chuze:3.6,beh:6.5,drain:13,dosah:0,sila:0,respekt:1,akce:'Zazvonit / ukrást'},
  mikulas:{n:'Mikuláš',chuze:3.52,beh:5.6,drain:18,dosah:2.6,sila:1/8,respekt:1,   akce:'Pochválit děti',pokuta:10},
};
const DRUZINA=['mikulas','cert','cert','cert','cert','cert','konik','smrtka','prda'];
const VISIT_S=10, ROUTE_N=50, GROUP_SPD=1.35;

/* ===================== STAV HRY ===================== */
const cam={yaw:Math.PI,pitch:0.42,dist:7};
let komboN=0,dogsN=0,ents=[],player=null,kids=[],balls=[],state='menu',score=0,houses=0,caught=0,scareP=0,penalty=0,timeLeft=CFG.limit;
let route=[],ri=0,grp={phase:'walk',path:[],pi:0,t:0,house:null,door:null,stuck:0};
/* hra více hráčů: NET vyplňuje mp.js; bez sítě hraje jen jeden hráč a vše počítá sám */
const NET={on:false,host:true,me:'me',board:{},send(){},ev(){}};
const isHost=()=>!NET.on||NET.host;
const humans=()=>ents.filter(e=>e.human);
const humansD=()=>ents.filter(e=>e.human&&!e.nap);
function nearHuman(x,z,noMik){let b=null,bd=1e9;for(const e of ents){if(!e.human||e.nap||(noMik&&e.role==='mikulas'))continue;const d=Math.hypot(e.pos.x-x,e.pos.z-z);if(d<bd){bd=d;b=e}}return b?{e:b,d:bd}:null}
const ballGeo=new THREE.SphereGeometry(.12,8,6),ballMat=new THREE.MeshLambertMaterial({color:0xffffff});
const starTex=(()=>{const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d');x.fillStyle='#ffd166';x.font='bold 40px sans-serif';x.textAlign='center';x.textBaseline='middle';x.fillText('★',32,34);return new THREE.CanvasTexture(c)})();
const leader=()=>ents.find(e=>e.role==='mikulas');
function grpCenter(){let x=0,z=0,n=0;for(const e of ents)if(!e.nap&&(!e.human||e.role==='mikulas')){x+=e.pos.x;z+=e.pos.z;n++}return [x/n,z/n]}

function newEnt(role,isPlayer,slot,v){const m=makeRole(role,v);scene.add(m);
  return {role,v:v||1,isPlayer,human:isPlayer,pid:null,name:'',id:slot,slot,mesh:m,atkN:0,scN:0,pos:new THREE.Vector3(),face:Math.PI,phase:rnd(0,6),stamina:100,tired:false,attack:0,atkT:0,hitDone:true,cool:0,
    st:'follow',target:null,chaseT:0,chaseCd:rnd(2,6),jump:0,scareT:0,running:false,nap:role==='napalovac',gone:0,hp:1}}
function spawnPoint(cx,cz,minD,maxD){for(let k=0;k<60;k++){const a=rnd(0,Math.PI*2),d=rnd(minD,maxD);const x=cx+Math.cos(a)*d,z=cz+Math.sin(a)*d;
  const bx=M.box;if(x<bx[0]+5||x>bx[2]-5||z<bx[1]+5||z>bx[3]-5)continue;if(insideAny(x,z,1.2)||inWater(x,z,1.5))continue;return [x,z]}return [cx+20,cz]}
function newKid(i){const m=makeKid(i);scene.add(m);const[cx,cz]=grpCenter();const[x,z]=spawnPoint(cx,cz,22,42);
  const b=document.createElement('div');b.className='bub hide';$('bubbles').appendChild(b);
  const star=new THREE.Sprite(new THREE.SpriteMaterial({map:starTex,transparent:true,depthWrite:false}));star.scale.set(.6,.6,1);star.visible=false;scene.add(star);
  return {i,mesh:m,pos:new THREE.Vector3(x,0,z),face:0,phase:rnd(0,6),st:'roam',t:rnd(1,3),stamina:100,throwCd:rnd(2,5),bub:b,bubT:0,star,turn:0,turnT:0,gone:0,freeze:0}}
function say(k,t,ms){NET.ev(['s',k.i,t,ms||0]);k.bub.textContent=t;k.bub.classList.remove('hide');k.bubT=ms||2200}

/* náhodný start: bod na silnici (ne pěšina) uvnitř strany, vybraný úměrně délce silnic – hraje se pokaždé jinde */
function randStart(){const segs=[];let tot=0;
  for(const r of M.r){if(r.t==='footway'||r.t==='path'||r.t==='steps'||r.t==='track'||r.br)continue;
    for(let i=1;i<r.p.length;i++){const a=r.p[i-1],b=r.p[i],L=Math.hypot(b[0]-a[0],b[1]-a[1]);if(L<.5)continue;
      const mx=(a[0]+b[0])/2,mz=(a[1]+b[1])/2;if(!inPoly(mx,mz,M.poly))continue;segs.push([a,b,L]);tot+=L}}
  for(let k=0;k<40&&tot>0;k++){let u=Math.random()*tot;for(const[a,b,L]of segs){if((u-=L)>0)continue;const f=Math.random(),x=a[0]+(b[0]-a[0])*f,z=a[1]+(b[1]-a[1])*f;
      if(inPoly(x,z,M.poly)&&!inWater(x,z,1)&&!insideAny(x,z,1))return [Math.round(x*100)/100,Math.round(z*100)/100];break}}
  return (M.start||[0,0]).slice()}
let curStart=null;
/* trasa: domy strany blízko cesty, postupně nejbližší další */
function makeRoute(sx,sz){const cand=B.filter(b=>b.v).map(b=>({b,d:doorOf(b)})).filter(o=>o.d.road<22);
  const out=[];let x=sx,z=sz;while(out.length<ROUTE_N&&cand.length){let bi=0,bd=1e9;cand.forEach((o,i)=>{const d=Math.hypot(o.d.x-x,o.d.z-z);if(d<bd){bd=d;bi=i}});
    const o=cand.splice(bi,1)[0];
    for(let i=cand.length-1;i>=0;i--)if(Math.hypot(cand[i].d.x-o.d.x,cand[i].d.z-o.d.z)<9)cand.splice(i,1);   /* sousední domy přeskočí, ať se jen nepřešlapuje */
    out.push(o);x=o.d.x;z=o.d.z}return out}
const routeMarks=[];
function setMarks(){routeMarks.forEach(s=>scene.remove(s));routeMarks.length=0;
  route.forEach((o,i)=>{const s=new THREE.Sprite(new THREE.SpriteMaterial({map:GLOW,transparent:true,depthWrite:false,fog:false}));s.position.set(o.b.cx,o.b.top+(o.b.r!==undefined?o.b.r:4)+1.8,o.b.cz);scene.add(s);routeMarks.push(s);o.mark=s});updMarks()}
function updMarks(){route.forEach((o,i)=>{const s=o.mark;if(i<ri){s.material.color.set(o.with?0x4ade80:0x8899aa);s.scale.set(1.2,1.2,1)}else if(i===ri){s.material.color.set(0xffd166);s.scale.set(3.2,3.2,1)}else{s.material.color.set(0xffffff);s.material.opacity=.45;s.scale.set(1.3,1.3,1)}})}
function planTo(i,from){const L=from||leader(),o=route[i];if(!o)return;grp.auto=false;grp.rebel=false;grp.wt=0;grp.warn=0;const a=nearestNode(L.pos.x,L.pos.z);const p=findPath(a,o.d.node)||[];grp.path=p.concat([[o.d.x,o.d.z]]);grp.pi=0;grp.phase='walk';grp.house=o.b;grp.door=o.d}

function spTeam(){const cv=[1,2,3,4,5].filter(v=>!(selChar==='cert'&&v===selVar));let ci=0,taken=false;
  const t=DRUZINA.map(r=>{const isP=!taken&&r===selChar;if(isP)taken=true;return {r,v:r==='cert'?(isP?selVar:cv[ci++%cv.length]):1,pid:isP?'me':null}});
  if(selChar==='napalovac')t.push({r:'napalovac',v:1,pid:'me'});return t}
function resetGame(team,st){HINT.clear();
  for(const e of ents)scene.remove(e.mesh);for(const k of kids){scene.remove(k.mesh);scene.remove(k.star);k.bub.remove()}for(const b of balls)scene.remove(b.m);
  for(const c of cars)scene.remove(c.mesh);cars=[];carT=rnd(6,12);
  clearRes();clearBins();clearBikes();clearTractors();for(const b of nballs)scene.remove(b.m);nballs.length=0;napSt={b:0,k:0,z:0,c:0};ents=[];kids=[];balls=[];score=0;houses=0;caught=0;scareP=0;penalty=0;dogsN=0;komboN=0;timeLeft=CFG.limit;ri=0;
  const s=curStart=st||randStart();player=null;
  /* čerti v družině mají každý jiný vzhled; hráč-čert ten, který si vybral */
  team=team||spTeam();
  team.forEach((t,i)=>{const e=addEnt(t,i,team.length);if(t.x===undefined){if(e.nap){/* napalovač začíná kus od družiny */const[x,z]=napSpawn(s[0],s[1],28,40);e.pos.set(x,0,z)}else{const a=i/team.length*Math.PI*2;e.pos.set(s[0]+Math.cos(a)*2.5,0,s[1]+Math.sin(a)*2.5);pushOut(e.pos,.45)}}});
  if(!player)player=ents[0];
  player.face=Math.PI;cam.yaw=Math.PI;cam.cur=undefined;
  route=makeRoute(s[0],s[1]);setMarks();planTo(0);makeDogs();makeBins();makeBikes();makeTractors();
  if(isHost()){const n=CFG.napalovacu+(NET.on?Math.floor(Math.max(0,humansD().length-1)*.77):0);for(let i=0;i<n;i++)kids.push(newKid(i))}
  $('hHousesT').textContent=route.length;$('tScare').textContent=ROLE[player.role].akce;$('tHit').textContent=player.nap?'Koule':player.role==='mikulas'?'Bonbon':'Udeřit';$('tHit').classList.toggle('nap',!!player.nap);hudLabels();updHud();
}

function addEnt(t,i){const me=NET.on?NET.me:'me',isP=t.pid!=null&&t.pid===me;const e=newEnt(t.r,isP,i,t.v);
  e.human=t.pid!=null;e.pid=t.pid||null;e.name=t.n||'';if(t.x!==undefined){e.pos.set(t.x,0,t.z);e.tx=t.x;e.tz=t.z;e.face=e.tf=t.f||0}
  ents[i]=e;if(isP)player=e;return e}

/* ===================== OVLÁDÁNÍ ===================== */
const keys=new Set();
addEventListener('keydown',e=>{const k=e.key.toLowerCase();keys.add(k);if(state!=='play')return;
  if(k===' '||k==='j'){e.preventDefault();if(isKidO(player.carry)){offBike();grabKey()}else if(canAim(player)){offBike();if(!e.repeat)aimStart()}else{offBike();if(player.carry)binKey();else attack(player)}}if(k==='f'){offBike();if(!grabKey())binKey()}if(k==='b'){if(!trakKey())bikeKey()}if(k==='q'||k==='e'){offBike();scare()}if(k==='r'){setAuto(!autoRun);toast(autoRun?'Automatický běh (R nebo S = stop)':'Automatický běh vypnut',1200)}if(k==='s'||k==='arrowdown')setAuto(false);if(k==='escape'||k==='p')pause(true);if(player.role==='mikulas'&&(k==='1'||k==='2'||k==='3'))otzAsk(+k-1);if(player.role==='mikulas'&&k==='n')otzGive()});
addEventListener('keyup',e=>{const k=e.key.toLowerCase();keys.delete(k);if((k===' '||k==='j')&&player&&canAim(player))aimRelease()});
const joy={id:null,x:0,y:0,dx:0,dy:0,run:false,lock:false},look={id:null,x:0,y:0};let runHeld=false,autoRun=false;
function setAuto(on){autoRun=on;$('autoRun').classList.toggle('hide',!on)}
canvas.addEventListener('pointerdown',e=>{if(state!=='play')return;
  if(e.pointerType!=='mouse'&&e.clientX<innerWidth*0.45&&joy.id===null){joy.id=e.pointerId;joy.x=e.clientX;joy.y=e.clientY;joy.dx=joy.dy=0;joy.run=joy.lock=false;setAuto(false);const j=$('joy');j.style.left=e.clientX+'px';j.style.top=e.clientY+'px';j.classList.remove('hide','run','lock')}
  else if(look.id===null){look.id=e.pointerId;look.x=e.clientX;look.y=e.clientY}
  try{canvas.setPointerCapture(e.pointerId)}catch(err){}});
canvas.addEventListener('pointermove',e=>{
  if(e.pointerId===joy.id){let dx=e.clientX-joy.x,dy=e.clientY-joy.y;const l=Math.hypot(dx,dy),mx=55;
    /* PUBG: přitáhnout až ke kraji = běh; táhnout dál nahoru až k zámku = automatický běh */
    joy.run=l>mx*.9;joy.lock=dy<-mx*1.75&&Math.abs(dx)<-dy*.6;$('joy').classList.toggle('run',joy.run&&!joy.lock);$('joy').classList.toggle('lock',joy.lock);
    if(l>mx){dx=dx/l*mx;dy=dy/l*mx}joy.dx=dx/mx;joy.dy=dy/mx;
    $('joy').firstElementChild.style.transform=`translate(${dx}px,${dy}px)`}
  else if(e.pointerId===look.id){cam.yaw-=(e.clientX-look.x)*0.006;cam.pitch=clamp(cam.pitch+(e.clientY-look.y)*0.004,0.12,1.1);look.x=e.clientX;look.y=e.clientY}});
function endPtr(e){if(e.pointerId===joy.id){if(joy.lock)setAuto(true);joy.id=null;joy.dx=joy.dy=0;joy.run=joy.lock=false;$('joy').classList.remove('run','lock');$('joy').classList.add('hide');$('joy').firstElementChild.style.transform=''}if(e.pointerId===look.id)look.id=null}
canvas.addEventListener('pointerup',endPtr);canvas.addEventListener('pointercancel',endPtr);
canvas.addEventListener('wheel',e=>{cam.dist=clamp(cam.dist+e.deltaY*0.01,4,14)},{passive:true});
const tb=(id,down,up)=>{const b=$(id);b.addEventListener('pointerdown',e=>{e.preventDefault();b.classList.add('on');down()});
  const u=e=>{b.classList.remove('on');up&&up()};b.addEventListener('pointerup',u);b.addEventListener('pointercancel',u);b.addEventListener('pointerleave',u)};
/* tlačítko Udeřit / Koule / Bonbon: u koule a bonbonu držet = mířit, tažením prstu vodorovně otáčet směr, svisle vzdálenost (nahoru = dál), pustit = hodit */
const aimPtr={id:null,x:0,y:0};
{const b=$('tHit');
  b.addEventListener('pointerdown',e=>{e.preventDefault();b.classList.add('on');if(state!=='play'||!player)return;
    if(isKidO(player.carry)){offBike();grabKey();return}
    if(canAim(player)){offBike();aimStart();if(player.aiming){aimPtr.id=e.pointerId;aimPtr.x=e.clientX;aimPtr.y=e.clientY;try{b.setPointerCapture(e.pointerId)}catch(err){}}return}
    offBike();if(player.carry)binKey();else attack(player)});
  b.addEventListener('pointermove',e=>{if(e.pointerId!==aimPtr.id||!player||!player.aiming)return;const dx=e.clientX-aimPtr.x,dy=e.clientY-aimPtr.y;aimPtr.x=e.clientX;aimPtr.y=e.clientY;
    cam.yaw-=dx*0.008;if(dy){if(player.aimD===undefined)player.aimD=aimPoint(player)[3];player.aimD=clamp(player.aimD-dy*0.06,NAP.min,NAP.max)}});
  const u=e=>{if(e.type==='pointerleave'&&e.pointerId===aimPtr.id)return;b.classList.remove('on');if(e.pointerId===aimPtr.id)aimPtr.id=null;if(player&&canAim(player))aimRelease()};
  ['pointerup','pointercancel','pointerleave'].forEach(t=>b.addEventListener(t,u))}tb('tBin',()=>{offBike();if(!grabKey())binKey()});tb('tKolo',()=>{if(!trakKey())bikeKey()});tb('tRun',()=>{runHeld=true;setAuto(false)},()=>runHeld=false);
$('autoRun').addEventListener('pointerdown',e=>{e.preventDefault();setAuto(false)});tb('tScare',()=>{offBike();scare()});
addEventListener('contextmenu',e=>e.preventDefault());

/* nápovědy (pravidla, ovládání) se ukážou jen 1× za hru – zbytek je v okně (i) u postavy */
const HINT=new Set(),HINT_TXT=['Body za strašení jsou jen u domu','Napalovač nad hlavou','Popelnice nad hlavou','Jedeš na kole','Jedeš na vlečce','Traktor zastavil','Traktor jede','Na vlečku můžou jen','Nejdřív hoď','Nejdřív se dětí na něco zeptej','Teď dej dětem nadílku','Nadílka jde ukrást jen','Připlíž se k Mikulášovi','Tenhle už bonbon dostal','Tomuhle čertovi už jsi zvonil','U tohoto domu už stačí','Nadílka už je rozdaná','Přijď blíž ke dveřím','Žádné kolo poblíž','Žádná popelnice poblíž','Vlečka je plná','V tomhle domě nikdo není',' ho drží – rychle udeř','Další nadílku můžeš ukrást'];
{const t0=toast;toast=function(t,ms){const h=typeof t==='string'&&HINT_TXT.find(x=>t.includes(x));if(h){if(HINT.has(h))return;HINT.add(h)}t0(t,ms)}}
/* ===================== ÚDER (pro hráče i počítač) ===================== */
const ATK={wind:.15,strike:.09,rec:.3};
function attack(e){if(e.attack>0||e.cool>0)return;e.attack=ATK.wind+ATK.strike+ATK.rec;e.atkT=0;e.hitDone=false;e.atkN++;if(!isHost())return;
  for(const k of kids){if(Math.hypot(k.pos.x-e.pos.x,k.pos.z-e.pos.z)<3.6)k.freeze=.2}}
function strikeHit(e){const fx=Math.sin(e.face),fz=Math.cos(e.face),R=ROLE[e.role],spin=e.role==='konik';
  if(!spin)puff(e.pos.x+fx*1.5,e.pos.z+fz*1.5);if(e.isPlayer)cam.shake=spin?.08:.18;const hits=[];
  for(const k of kids){if(kOutV(k))continue;const dx=k.pos.x-e.pos.x,dz=k.pos.z-e.pos.z,d=Math.hypot(dx,dz);
    if(d<R.dosah&&d>0.2&&(spin||(dx*fx+dz*fz)/d>0.4)){hits.push(k);e.st='return';if(!spin)break}}
  const hd=[];if(spin||!hits.length)for(const g of dogs){if(g.st==='down'||g.st==='gone')continue;const dx=g.pos.x-e.pos.x,dz=g.pos.z-e.pos.z,d=Math.hypot(dx,dz);
    if(d<R.dosah&&d>0.1&&(spin||(dx*fx+dz*fz)/d>0.3)){hd.push(g);e.st='return';if(!spin)break}}
  const hn=[];if(spin||(!hits.length&&!hd.length))for(const n of ents){if(!n.nap||!n.human||n.gone>0||napBusy(n)||n===e)continue;const dx=n.pos.x-e.pos.x,dz=n.pos.z-e.pos.z,d=Math.hypot(dx,dz);
    if(d<R.dosah&&d>0.1&&(spin||(dx*fx+dz*fz)/d>0.35)){hn.push(n);e.st='return';if(!spin)break}}
  if(!hits.length&&!hd.length&&!hn.length)return false;
  if(isHost()){hits.forEach(k=>hitKid(e,k));hd.forEach(g=>hitDog(e,g));hn.forEach(n=>hitNap(e,n))}else{NET.send({t:'hit',k:hits.map(k=>k.i),d:hd.map(g=>g.i),n:hn.map(n=>n.pid)});toast('Zásah!',500)}
  return true}
/* zásah napalovače (počítá hostitel) */
function hitKid(e,k,mult){const R=ROLE[e.role];if(kOut(k)||k.gone>0)return;k.hp=(k.hp===undefined?1:k.hp)-R.sila*(mult||1);
  if(k.hp>0.001){k.freeze=rnd(.2,.4);k.dash=rnd(.7,1.1);k.st='flee';k.t=rnd(2,3);say(k,['Au!','Jau!','Au au!','Nech mě!'][Math.floor(Math.random()*4)],900);const n=Math.round(1/R.sila),done=n-Math.round(k.hp/R.sila);award(e,'msg',0,`Zásah ${done}/${n}`,700)}
  else{k.st='down';k.t=rnd(5,7);k.hp=1;say(k,AU[Math.floor(Math.random()*AU.length)],2400);
    if(R.pokuta)award(e,'pen',R.pokuta,`Mikuláš se nemá prát! −${R.pokuta}`,1800);else award(e,'catch',CFG.bodyChycen,`Napalovač leží! +${CFG.bodyChycen}`,1200)}}
const puffs=[],puffGeo=new THREE.SphereGeometry(.07,5,4),puffMat=new THREE.MeshBasicMaterial({color:0xffffff});
function puff(x,z){for(let i=0;i<14;i++){const m=new THREE.Mesh(puffGeo,puffMat);m.position.set(x+rnd(-.2,.2),groundH(x,z)+.1,z+rnd(-.2,.2));scene.add(m);
  puffs.push({m,v:new THREE.Vector3(rnd(-1.6,1.6),rnd(1.5,3.5),rnd(-1.6,1.6)),t:.7,g:groundH(x,z)})}}
function myStrike(e){if(e.isPlayer||(isHost()&&!e.human))strikeHit(e)}
function animAttack(e,dt){const u=e.mesh.userData;e.cool-=dt;if(e.attack<=0){u.attack=false;u.fork.rotation.x=Math.PI;u.fork.rotation.z=0;u.rig.rotation.x=0;u.rig.rotation.y=0;return}
  u.attack=true;e.atkT+=dt;e.attack-=dt;const t=e.atkT,tot=ATK.wind+ATK.strike+ATK.rec;
  if(e.role==='konik'){/* šavlí seká do kříže: shora zprava dolů doleva, pak shora zleva dolů doprava */const f=Math.min(1,t/tot),h=f<.5?f*2:(f-.5)*2,sw=h*h*(3-2*h);
    const zA=f<.5?.95:-.55,zB=f<.5?-.55:.95;u.armR.rotation.x=-2.7+2.1*sw;u.armR.rotation.z=zA+(zB-zA)*sw;u.armR.rotation.y=0;u.fork.rotation.x=0;u.fork.rotation.z=0;
    u.armL.rotation.x=-.5;u.rig.rotation.x=.12*sw;u.rig.rotation.y=(f<.5?-.25:.25)*(1-2*sw);
    if(f>.3&&!e.hitDone){e.hitDone=true;myStrike(e)}if(e.attack<=0){e.cool=.08;u.armR.rotation.set(0,0,0);u.rig.rotation.set(0,0,0)}return}
  let arm,fk,lean;const ease=x=>x*x*(3-2*x);
  if(t<ATK.wind){const f=ease(t/ATK.wind);arm=-3.25*f;fk=Math.PI+Math.PI*f;lean=-.12*f}
  else if(t<ATK.wind+ATK.strike){const f=(t-ATK.wind)/ATK.strike;arm=-3.25+2.6*f*f;fk=0;lean=-.12+.34*f*f;if(f>.8&&!e.hitDone){e.hitDone=true;myStrike(e)}}
  else{const f=ease(Math.min(1,(t-ATK.wind-ATK.strike)/ATK.rec));arm=-.65*(1-f);fk=Math.PI*f;lean=.22*(1-f)}
  if(!e.hitDone&&t>=ATK.wind+ATK.strike){e.hitDone=true;myStrike(e)}
  u.armR.rotation.x=arm;u.armL.rotation.x=arm*.92;u.armL.rotation.z=-.35*Math.min(1,-arm/1.5);u.armR.rotation.z=.25*Math.min(1,-arm/1.5);u.fork.rotation.x=fk;u.rig.rotation.x=lean;
  if(e.attack<=0){e.cool=.08;u.armL.rotation.z=u.armR.rotation.z=0}}

/* ===================== STRAŠENÍ U DOMU ===================== */
function scare(){const e=player;if(e.nap){napAction();return}if(e.role==='mikulas'&&otz.ri===ri&&otz.st===2&&grp.phase==='visit'){otzGive();return}if(e.scareT>0)return;e.scareT=1.2;e.scN++;
  if(isHost())doScare(e);else NET.send({t:'scare'})}
/* strašení vyhodnotí hostitel: body jen u domu s družinou, nejvýš 4× na dům a hráče */
function doScare(e){
  if(grp.phase==='visit'&&grp.house&&Math.hypot(e.pos.x-grp.house.cx,e.pos.z-grp.house.cz)<16){if(e.scH!==ri){e.scH=ri;e.scC=0}
    const mk=e.role==='mikulas',sp=mk?1:3;if(e.scC<(mk?2:4)){e.scC++;award(e,'scare',sp,`${ROLE[e.role].akce}! +${sp}`,900)}else award(e,'msg',0,'U tohoto domu už stačí 🙂',900)}
  else award(e,'msg',0,'Body za strašení jsou jen u domu s družinou',1500)}

/* ===================== POHYB A AI ===================== */
function steer(e,tx,tz,spd,dt){const dx=tx-e.pos.x,dz=tz-e.pos.z,d=Math.hypot(dx,dz);if(d<0.05)return 0;const s=Math.min(spd*dt,d);
  const ox=e.pos.x,oz=e.pos.z;e.pos.x+=dx/d*s;e.pos.z+=dz/d*s;pushOut(e.pos,.45);const moved=Math.hypot(e.pos.x-ox,e.pos.z-oz);
  const tf=Math.atan2(dx,dz);let a=tf-e.face;a=Math.atan2(Math.sin(a),Math.cos(a));e.face+=a*Math.min(1,dt*8);e.phase+=moved*2.4;return moved/dt}
function updGroup(dt){
  const L=leader();
  if(grp.phase==='walk'){
    /* Mikuláš-hráč „rebel“: když do CFG.rebelS s od začátku cesty nedojde k domu, družina jde k domu bez něj */
    if(L.human&&!grp.auto){grp.wt=(grp.wt||0)+dt;
      if(grp.wt>CFG.rebelS-10&&!grp.warn){grp.warn=1;award(L,'msg',0,'Družina čeká – když do 10 s nedojdeš k domu, půjde bez tebe!',2500)}
      if(grp.wt>CFG.rebelS)rebelStart(L)}
    const G=guide();
    if(!G.human){const wp=grp.path[grp.pi];if(wp){
      /* počká na opozdilce (kromě hráče) */
      const lag=ents.some(e=>!e.human&&e!==G&&e.st==='follow'&&Math.hypot(e.pos.x-G.pos.x,e.pos.z-G.pos.z)>14);
      const sp=steer(G,wp[0],wp[1],lag?.5:GROUP_SPD*1.1,dt);   /* Mikuláš (počítač) chodí o 10 % rychleji */G.spd=sp;
      if(Math.hypot(wp[0]-G.pos.x,wp[1]-G.pos.z)<1.2)grp.pi++;
      if(sp<.3){grp.stuck+=dt;if(grp.stuck>3){grp.pi++;grp.stuck=0}}else grp.stuck=0}}
    const mikDoor=L.human&&Math.hypot(L.pos.x-grp.door.x,L.pos.z-grp.door.z)<3;
    if(mikDoor){grp.auto=false;grp.rebel=false}   /* Mikuláš to k domu stihl první – bez pokuty */
    if(mikDoor||(!G.human&&(Math.hypot(G.pos.x-grp.door.x,G.pos.z-grp.door.z)<1.5||grp.pi>=grp.path.length))){grp.phase='visit';grp.t=VISIT_S;
      toast(`Zastávka: ${route[ri].b.adr||'dům '+(ri+1)}`,1400);NET.ev(['z',ri])}
  }else{
    grp.t-=dt;if(grp.t<=0){const o=route[ri];
      for(const e of humansD()){const near=Math.hypot(e.pos.x-o.b.cx,e.pos.z-o.b.cz)<18;if(e.isPlayer)o.with=near;
        if(e.role==='mikulas'&&grp.rebel){if(e.isPlayer)o.with=false;award(e,'reb',CFG.rebelPen,`Družina navštívila dům bez Mikuláše −${CFG.rebelPen}`,2400)}
        else if(near){const bp=e.role==='mikulas'?CFG.bodyDumMik:CFG.bodyDum;award(e,'house',bp,`${o.b.adr?o.b.adr+': ':''}${DUM[Math.floor(Math.random()*DUM.length)]} +${bp}`,1800)}else award(e,'msg',0,'Družina odešla od domu bez tebe – body za dům propadly',2200)}
      ri++;updMarks();updHud();if(ri>=route.length){gameOver(false,true);return}planTo(ri)}}
}
/* vůdce družiny: Mikuláš, nebo neviditelný průvodce, když Mikuláš-hráč k domu nejde */
function guide(){return grp.auto&&grp.g?grp.g:leader()}
function rebelStart(L){let x=0,z=0,n=0;for(const e of ents)if(!e.human&&!e.nap&&e.role!=='mikulas'){x+=e.pos.x;z+=e.pos.z;n++}if(!n){x=L.pos.x;z=L.pos.z}else{x/=n;z/=n}
  const g={pos:new THREE.Vector3(x,0,z),face:L.face,phase:0,spd:0,human:false};planTo(ri,g);grp.g=g;grp.auto=true;grp.rebel=true;grp.wt=CFG.rebelS;
  award(L,'msg',0,`Družina jde k domu bez tebe! (−${CFG.rebelPen}, body za dům nedostaneš)`,3000)}
const SLOTS=[[-1.3,1.8],[1.3,1.8],[-1.6,3.4],[0,3.6],[1.6,3.4],[-1.3,5.2],[1.3,5.2],[0,6.8]];
function updMember(e,k,dt){
  const L=guide(),R=ROLE[e.role];let spd=0;
  if(e.human||e.nap)return;
  e.chaseCd-=dt;
  /* honička: napalovač blízko a družina není daleko (nejvýš 3 honí najednou) */
  const chasers=ents.filter(x=>x.st==='chase'||x.st==='hold').length;
  if(e.st!=='chase'&&e.st!=='hold'&&e.role!=='mikulas'&&e.chaseCd<=0&&chasers<3){
    let best=null,bd=grp.phase==='visit'?8:14;for(const kd of kids.concat(dogs.filter(g=>g.st==='atk'),ents.filter(n=>n.nap&&n.human))){if(kd.gone>0||kOut(kd))continue;const d=Math.hypot(kd.pos.x-e.pos.x,kd.pos.z-e.pos.z);if(d<bd){bd=d;best=kd}}
    if(best&&Math.hypot(e.pos.x-L.pos.x,e.pos.z-L.pos.z)<26){e.st='chase';e.target=best;e.herd=false;e.chaseT=rnd(5,8)}}
  if(e.st==='chase'){const t=e.target;e.chaseT-=dt;
    if(!t||t.gone>0||t.st==='down'||t.st==='gone'||(t.nap&&napBusy(t))||(t.dog&&t.st==='home')||e.chaseT<=0||Math.hypot(e.pos.x-L.pos.x,e.pos.z-L.pos.z)>34){e.st='return';e.chaseCd=rnd(3,6)}
    else{const d=Math.hypot(t.pos.x-e.pos.x,t.pos.z-e.pos.z);e.running=true;let tx=t.pos.x,tz=t.pos.z;
      /* nahánění k hráči: oběhne napalovače z druhé strany */
      if(e.herd&&d>3){const hp=e.herdP||player,ax=t.pos.x-hp.pos.x,az=t.pos.z-hp.pos.z,al=Math.hypot(ax,az)||1;tx=t.pos.x+ax/al*3;tz=t.pos.z+az/al*3}
      spd=steer(e,tx,tz,R.beh*.95,dt);
      if(d<R.dosah*.75&&e.attack<=0){const nh=nearHuman(t.pos.x,t.pos.z,true);
        if(nh&&nh.d<14&&!t.dog&&!t.nap){t.freeze=1.9;e.st='hold';e.holdT=1.9;say(t,'Pusť mě!',1800);award(nh.e,'msg',0,`${ROLE[e.role].n} ho drží – rychle udeř!`,1500)}
        else attack(e)}}}
  if(e.st==='hold'){const t=e.target;e.holdT-=dt;e.running=false;
    if(!t||t.st==='down'||e.holdT<=0){e.st='return';e.chaseCd=rnd(2,4)}else{const a=Math.atan2(t.pos.x-e.pos.x,t.pos.z-e.pos.z);e.face=a;spd=0}}
  if(e.st!=='chase')e.running=false;
  if(e.st==='return'||e.st==='follow'){
    let tx,tz;
    if(e===L){/* Mikuláš vede (řeší updGroup), u domu stojí u dveří */if(grp.phase==='visit'){tx=grp.door.x;tz=grp.door.z;spd=steer(e,tx,tz,1.5,dt);const fp=resFocus(),hf=fp?Math.atan2(fp[0]-e.pos.x,fp[1]-e.pos.z):Math.atan2(grp.house.cx-e.pos.x,grp.house.cz-e.pos.z);let a=hf-e.face;a=Math.atan2(Math.sin(a),Math.cos(a));e.face+=a*Math.min(1,dt*4)}else spd=L.spd||0}
    else if(grp.phase==='visit'){const h=grp.house,rad=Math.max(h.x1-h.x0,h.z1-h.z0)/2+2.6,a=k/9*Math.PI*2+(VISIT_S-grp.t)*.22;tx=h.cx+Math.cos(a)*rad;tz=h.cz+Math.sin(a)*rad;
      spd=steer(e,tx,tz,e.st==='return'?4.5:2.2,dt);e.jump+=dt*7}
    else{const fx=Math.sin(L.face),fz=Math.cos(L.face),sl=SLOTS[(k-1+SLOTS.length)%SLOTS.length];tx=L.pos.x-fx*sl[1]+fz*sl[0];tz=L.pos.z-fz*sl[1]-fx*sl[0];
      const d=Math.hypot(tx-e.pos.x,tz-e.pos.z);spd=steer(e,tx,tz,d>6?4.5:d>1.5?GROUP_SPD*1.5:GROUP_SPD*.8,dt)}
    if(e.st==='return'&&Math.hypot(e.pos.x-L.pos.x,e.pos.z-L.pos.z)<9)e.st='follow'}
  /* zaseknutý opozdilec: mimo dohled hráče se přenese k družině */
  if(e!==L&&e.st!=='chase'){const dl=Math.hypot(e.pos.x-L.pos.x,e.pos.z-L.pos.z);e.lagT=(dl>24&&spd<.6)?(e.lagT||0)+dt:0;
    if(e.lagT>2.5&&!humans().some(h=>Math.hypot(e.pos.x-h.pos.x,e.pos.z-h.pos.z)<22)){const[x,z]=spawnPoint(L.pos.x,L.pos.z,2,5);e.pos.set(x,0,z);e.lagT=0;e.st='follow'}}
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
function placeEnt(e,dt){if(e.nap){placeNap(e,dt);return}const m=e.mesh;e.pos.y=groundH(e.pos.x,e.pos.z)+.08;m.position.copy(e.pos);m.rotation.y=e.face;const sp=e.spd||0;
  animWalk(m,e.phase,sp>.15?Math.min(.9,.35+sp/9):0);
  if(e.human){if(e.scareT>0){e.scareT-=dt;if(e.role==='konik'&&e.twirl===undefined)e.twirl=Math.random()<.5?1:0;scareAnim(e,1-e.scareT/1.2,true)}else{e.twirl=undefined;scareAnim(e,0,false)}}
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
function spawnCar(){const P=(leader()||player).pos;let a=-1,b=-1;
  for(let k=0;k<40;k++){const i=Math.floor(Math.random()*CG.n.length),[x,z]=CG.n[i],d=Math.hypot(x-P.x,z-P.z);if(d>45&&d<120){a=i;break}}
  if(a<0)return;
  for(let k=0;k<60;k++){const i=Math.floor(Math.random()*CG.n.length),[x,z]=CG.n[i],d=Math.hypot(x-CG.n[a][0],z-CG.n[a][1]);if(d>140&&Math.hypot(x-P.x,z-P.z)<200){b=i;break}}
  if(b<0)return;const path=findPath(a,b,CG);if(!path||path.length<10)return;
  const m=makeCar();scene.add(m);const c={mesh:m,path,i:1,pos:new THREE.Vector3(path[0][0],0,path[0][1]),face:0,spd:6,honk:0};
  c.face=Math.atan2(path[1][0]-path[0][0],path[1][1]-path[0][1]);cars.push(c)}
function updCars(dt){carT-=dt;if(carT<=0){const n=cars.length;if(n<CFG.aut)spawnCar();carT=cars.length>n||n>=CFG.aut?rnd(8,20):1}   /* nepovedený výjezd (krátká trasa) zkusí znovu za 1 s */
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


/* ===================== TRAKTORY (2 červené: jeden s radlicí vzadu ohrnuje sníh, druhý s vlečkou vozí čerty) ===================== */
/* jezdí pořád po silnicích na straně; zastaví, když mu někdo stojí v cestě. Stojící traktor s vlečkou: čert naskočí (B), vlečka ho veze, B = seskočit */
const TRAK={spd:4.2,slots:[[-.45,-.55],[.45,-.55],[-.45,.25],[.45,.25],[-.45,1.05],[.45,1.05],[0,-.15],[0,.65]]};
function makeTractor(kind){const g=new THREE.Group(),red=lam(0xc62828),dk=lam(0x1a1a1a),gr=lam(0x6b6b6b),gl=lam(0x22303a),yel=lam(0xffe08a);
  const wh=(r,w,x,y,z)=>{const m=new THREE.Group();m.position.set(x,y,z);const t=new THREE.Mesh(new THREE.CylinderGeometry(r,r,w,16),dk);t.rotation.z=Math.PI/2;
    const h=new THREE.Mesh(new THREE.CylinderGeometry(r*.55,r*.55,w+.02,10),red);h.rotation.z=Math.PI/2;m.add(t,h);return m};
  const wheels=[wh(.62,.42,-.78,.62,-.55),wh(.62,.42,.78,.62,-.55),wh(.36,.26,-.66,.36,1.25),wh(.36,.26,.66,.36,1.25)];g.add(...wheels);
  g.add(box(.9,.55,1.1,dk,0,.75,.75),box(.92,.7,1.5,red,0,1.15,.95),box(.96,.12,.2,dk,0,1.05,1.72),box(.15,.1,.05,yel,-.32,1.25,1.71),box(.15,.1,.05,yel,.32,1.25,1.71));
  g.add(box(1.2,.35,1.3,red,0,.95,-.45),box(1.75,.08,.7,red,0,1.3,-.55));            /* tělo a blatníky */
  const cab=new THREE.Group();cab.position.set(0,1.1,-.5);g.add(cab);
  for(const x of[-.58,.58])for(const z of[-.6,.5])cab.add(box(.06,1.15,.06,dk,x,.6,z));
  cab.add(box(1.24,.08,1.3,red,0,1.2,-.05),box(1.1,.95,.02,gl,0,.6,.5),box(1.1,.95,.02,gl,0,.6,-.6),box(.02,.85,1,gl,-.58,.62,-.05),box(.02,.85,1,gl,.58,.62,-.05),box(.5,.12,.45,dk,0,.25,-.15));
  const ex=new THREE.Mesh(new THREE.CylinderGeometry(.04,.04,.9,8),dk);ex.position.set(.36,1.9,1.2);g.add(ex);
  const u={wheels,kind};
  if(kind==='radlice'){/* zadní radlice na sníh, šikmo */const b=new THREE.Group();b.position.set(0,.05,-1.55);b.rotation.y=.35;
    b.add(box(2.4,.62,.08,lam(0xf2b705),0,.36,0),box(2.4,.06,.12,gr,0,.04,.03),box(.1,.1,.6,gr,-.3,.6,.3),box(.1,.1,.6,gr,.3,.6,.3));g.add(b);u.blade=b}
  else{/* vlečka: oj, valník s bočnicemi, dvě kola */const t=new THREE.Group();g.userData.trailer=t;
    t.add(box(1.9,.12,3.2,lam(0x8a5a2b),0,.85,0));for(const x of[-.95,.95])t.add(box(.06,.4,3.2,red,x,1.1,0));t.add(box(1.9,.4,.06,red,0,1.1,-1.6),box(1.9,.4,.06,red,0,1.1,1.6));
    t.add(box(.08,.08,1.3,gr,0,.6,2.2));const tw=[wh(.42,.26,-.92,.42,0),wh(.42,.26,.92,.42,0)];t.add(...tw);u.twheels=tw;u.trailerM=t}
  Object.assign(g.userData,u);return g}
function cgNear(x,z){let b=-1,bd=1e9;for(let i=0;i<CG.n.length;i++){const d=(CG.n[i][0]-x)**2+(CG.n[i][1]-z)**2;if(d<bd){bd=d;b=i}}return b}
const tractors=[];let snowP=[];
function clearTractors(){for(const t of tractors){scene.remove(t.mesh);if(t.trailer)scene.remove(t.trailer)}tractors.length=0;for(const p of snowP)scene.remove(p.m);snowP=[];for(const e of ents)e.ride=null}
/* cíle na straně: uzly silnic u domů trasy */
function trakGoal(t){const o=route[Math.floor(Math.random()*route.length)];if(!o)return -1;const d=doorOf(o.b);return cgNear(d.x,d.z)}
function trakPlan(t){for(let k=0;k<8;k++){const a=cgNear(t.pos.x,t.pos.z),b=trakGoal(t);if(a<0||b<0||a===b)continue;const p=findPath(a,b,CG);if(p&&p.length>3){t.path=p;t.i=1;return true}}return false}
function makeTractors(){clearTractors();const P=(leader()||player).pos;
  for(const kind of['radlice','vlecka']){const m=makeTractor(kind);scene.add(m);let tr=null;if(m.userData.trailerM){tr=m.userData.trailerM;m.remove(tr);scene.add(tr)}
    const t={i:tractors.length,kind,mesh:m,trailer:tr,pos:new THREE.Vector3(),face:0,tface:0,spd:0,wait:0,go:0,path:null,honk:0,tpos:new THREE.Vector3()};
    for(let k=0;k<30;k++){const o=route[Math.floor(Math.random()*route.length)];if(!o)break;const d=doorOf(o.b),n=cgNear(d.x,d.z);if(n<0)continue;const[x,z]=CG.n[n];if((Math.hypot(x-P.x,z-P.z)>40&&tractors.every(o=>Math.hypot(o.pos.x-x,o.pos.z-z)>40))||k===29){t.pos.set(x,0,z);break}}
    trakPlan(t);if(t.path&&t.path[1])t.face=Math.atan2(t.path[1][0]-t.pos.x,t.path[1][1]-t.pos.z);t.tface=t.face;trailerFollow(t,0,true);tractors.push(t);placeTractor(t,0)}}
/* vlečka se táhne za ojí (jednoduché kloubové vlečení) */
function trailerFollow(t,dt,snap){if(!t.trailer)return;const hx=t.pos.x-Math.sin(t.face)*1.75,hz=t.pos.z-Math.cos(t.face)*1.75;
  if(snap){t.tface=t.face}else{const cx=t.tpos.x,cz=t.tpos.z,a=Math.atan2(hx-cx,hz-cz);if(Math.hypot(hx-cx,hz-cz)>.3){let d=a-t.tface;d=Math.atan2(Math.sin(d),Math.cos(d));t.tface+=d*Math.min(1,dt*6)}}
  t.tpos.set(hx-Math.sin(t.tface)*2.35,0,hz-Math.cos(t.tface)*2.35)}
function riders(t){return ents.filter(e=>e.ride===t)}
function updTractor(t,dt){if(!t.path||t.i>=t.path.length){if(!trakPlan(t)){t.spd=0;placeTractor(t,dt);return}}
  const p=t.path,[ax,az]=p[t.i-1],[bx,bz]=p[t.i];let dx=bx-ax,dz=bz-az;const l=Math.hypot(dx,dz)||1;dx/=l;dz/=l;
  const tx=bx-dz*1.4,tz=bz+dx*1.4,ddx=tx-t.pos.x,ddz=tz-t.pos.z,dist=Math.hypot(ddx,ddz);
  let want=TRAK.spd;if(t.i+1<p.length){const[cx2,cz2]=p[t.i+1];const ex=cx2-bx,ez=cz2-bz,el=Math.hypot(ex,ez)||1;if((dx*ex+dz*ez)/el<.85)want=2.2}
  const fx=Math.sin(t.face),fz=Math.cos(t.face);let block=false;
  for(const o of ents.concat(kids)){if(o.gone>0||o.ride)continue;const ox=o.pos.x-t.pos.x,oz=o.pos.z-t.pos.z,ahead=ox*fx+oz*fz,side=Math.abs(ox*fz-oz*fx);
    if(ahead>0&&ahead<8&&side<2.1){block=true;if(o===player&&t.honk<=0&&t.kind==='vlecka'&&player.role==='cert'){t.honk=6;toast('Traktor zastavil – naskoč na vlečku (B)',1800)}}}
  for(const o of cars.concat(tractors)){if(o===t)continue;const ox=o.pos.x-t.pos.x,oz=o.pos.z-t.pos.z,ahead=ox*fx+oz*fz,side=Math.abs(ox*fz-oz*fx);if(ahead>0&&ahead<9&&side<1.8)want=ahead<6?0:Math.min(want,o.spd)}
  t.honk-=dt;if(block){want=0;t.go=2.5}else if(t.go>0){t.go-=dt;want=0}      /* po zastavení chvíli počká (čas naskočit) */
  t.spd+=Math.max(-8*dt,Math.min(2*dt,want-t.spd));
  if(dist<1.2){t.i++;placeTractor(t,dt);return}
  const tf=Math.atan2(ddx,ddz);let da=tf-t.face;da=Math.atan2(Math.sin(da),Math.cos(da));t.face+=da*Math.min(1,dt*2.5);
  t.pos.x+=Math.sin(t.face)*t.spd*dt;t.pos.z+=Math.cos(t.face)*t.spd*dt;trailerFollow(t,dt);
  /* nikoho nepřejede (kromě těch, co jedou na vlečce) */
  const segs=[[t.pos.x,t.pos.z,t.face,2.2,1.2]];if(t.trailer)segs.push([t.tpos.x,t.tpos.z,t.tface,1.8,1.15]);
  for(const o of ents.concat(kids)){if(o.ride)continue;for(const[sx,sz,sf,hl,hw]of segs){const gx=Math.sin(sf),gz=Math.cos(sf),ox=o.pos.x-sx,oz=o.pos.z-sz,lz=ox*gx+oz*gz,lx=ox*gz-oz*gx;
    if(Math.abs(lz)<hl&&Math.abs(lx)<hw){const push=(hw+.15-Math.abs(lx))*(lx<0?-1:1);o.pos.x+=gz*push;o.pos.z-=gx*push}}}
  placeTractor(t,dt)}
function placeTractor(t,dt){const m=t.mesh,u=m.userData,fx=Math.sin(t.face),fz=Math.cos(t.face);t.pos.y=groundH(t.pos.x,t.pos.z)+.02;m.position.copy(t.pos);
  const hf=groundH(t.pos.x+fx*1.3,t.pos.z+fz*1.3),hb=groundH(t.pos.x-fx*1.3,t.pos.z-fz*1.3);m.rotation.set(-Math.atan2(hf-hb,2.6),t.face,0,'YXZ');
  u.wheels.forEach((w,i)=>w.rotation.x+=t.spd*dt/(i<2?.62:.36));
  if(t.trailer){const tr=t.trailer;tr.position.set(t.tpos.x,groundH(t.tpos.x,t.tpos.z)+.02,t.tpos.z);tr.rotation.set(0,t.tface,0);u.twheels.forEach(w=>w.rotation.x+=t.spd*dt/.42)}
  /* radlice: sníh odlétá do strany */
  if(t.kind==='radlice'&&t.spd>1&&dt>0&&snowP.length<60&&Math.random()<dt*25){const s=new THREE.Mesh(new THREE.BoxGeometry(.18,.18,.18),lam(0xf4f8ff));
    const bx=t.pos.x-fx*1.6+fz*1.2,bz=t.pos.z-fz*1.6-fx*1.2;s.position.set(bx,t.pos.y+.4,bz);scene.add(s);snowP.push({m:s,vx:fz*rnd(1.5,3)-fx*.5,vy:rnd(1.5,3),vz:-fx*rnd(1.5,3)-fz*.5,t:0})}}
function updSnow(dt){for(let i=snowP.length-1;i>=0;i--){const p=snowP[i];p.t+=dt;p.vy-=9.8*dt;p.m.position.x+=p.vx*dt;p.m.position.y+=p.vy*dt;p.m.position.z+=p.vz*dt;
  if(p.t>1.2||p.m.position.y<groundH(p.m.position.x,p.m.position.z)-.1){scene.remove(p.m);snowP.splice(i,1)}}}
/* ostatní hráči: traktory podle hostitele */
function viewTractor(t,dt){if(t.nx===undefined){placeTractor(t,0);return}const a=Math.min(1,dt*8);
  if(Math.hypot(t.nx-t.pos.x,t.nz-t.pos.z)>10){t.pos.x=t.nx;t.pos.z=t.nz}else{t.pos.x+=(t.nx-t.pos.x)*a;t.pos.z+=(t.nz-t.pos.z)*a}
  let d=t.nf-t.face;t.face+=Math.atan2(Math.sin(d),Math.cos(d))*a;d=t.ntf-t.tface;t.tface+=Math.atan2(Math.sin(d),Math.cos(d))*a;t.spd=t.ns;
  if(t.trailer){const hx=t.pos.x-Math.sin(t.face)*1.75,hz=t.pos.z-Math.cos(t.face)*1.75;t.tpos.set(hx-Math.sin(t.tface)*2.35,0,hz-Math.cos(t.tface)*2.35)}placeTractor(t,dt)}
function tractorsSnap(){return tractors.map(t=>[q2(t.pos.x),q2(t.pos.z),q2(t.face),q2(t.tface),q2(t.spd)])}
function tractorsApply(a){a.forEach((q,i)=>{const t=tractors[i];if(!t)return;t.nx=q[0];t.nz=q[1];t.nf=q[2];t.ntf=q[3];t.ns=q[4]})}
function tractorsHost(){for(const t of tractors){t.path=null;t.go=1}}
/* jízda na vlečce */
function slotPos(t,s){const[sx,sz]=TRAK.slots[s],f=t.tface;return[t.tpos.x+Math.cos(f)*sx+Math.sin(f)*sz,t.tpos.z-Math.sin(f)*sx+Math.cos(f)*sz]}
function freeSlot(t){const used=new Set(riders(t).map(e=>e.slot));for(let s=0;s<TRAK.slots.length;s++)if(!used.has(s))return s;return -1}
function nearTrailer(e){for(const t of tractors){if(!t.trailer)continue;if(Math.hypot(t.tpos.x-e.pos.x,t.tpos.z-e.pos.z)<3.2)return t}return null}
function boardTrak(e,t,s){e.ride=t;e.slot=s}
function leaveTrak(e,side){const t=e.ride;if(!t)return;const f=t.tface,sx=TRAK.slots[e.slot||0][0]<0?-1:1;e.ride=null;
  e.pos.x=t.tpos.x+Math.cos(f)*sx*1.7;e.pos.z=t.tpos.z-Math.sin(f)*sx*1.7;pushOut(e.pos,.45)}
/* B: u vlečky naskočit / na vlečce seskočit (jinak kolo) */
function trakKey(){const P=player;if(!P||state!=='play')return false;
  if(P.ride){const t=P.ride;leaveTrak(P);NET.send({t:'trak',a:'off',i:t.i});toast('Seskočil jsi z vlečky',900);return true}
  const t=nearTrailer(P);if(!t)return false;
  if(P.role!=='cert'){toast('Na vlečku můžou jen čerti',1100);return true}
  if(t.spd>.6){toast('Traktor jede – zastav ho (postav se před něj)',1300);return true}
  if(P.carry){toast(isKidO(P.carry)?'Nejdřív hoď napalovače':'Nejdřív hoď popelnici',900);return true}if(P.bike)offBike();
  const s=freeSlot(t);if(s<0){toast('Vlečka je plná',900);return true}
  boardTrak(P,t,s);NET.send({t:'trak',a:'on',i:t.i,s});toast('Jedeš na vlečce! B = seskočit',1600);return true}
function onTrak(m,e){const t=tractors[m.i];if(!t||!e)return;if(m.a==='on')boardTrak(e,t,m.s|0);else if(m.a==='off'&&e.ride){e.ride=null}}
/* jezdci stojí na vlečce */
function updRiders(){const P=player;
  if(P&&P.ride){const t=P.ride;if(!tractors.includes(t)){P.ride=null}else{const[x,z]=slotPos(t,P.slot||0);P.pos.x=x;P.pos.z=z}}
  for(const e of ents){if(!e.ride)continue;if(!tractors.includes(e.ride)){e.ride=null;continue}
    if(!e.isPlayer&&!e.human){e.ride=null;continue}
    e.mesh.position.y=groundH(e.ride.tpos.x,e.ride.tpos.z)+.93;if(e.isPlayer){const[x,z]=slotPos(e.ride,e.slot||0);e.mesh.position.x=x;e.mesh.position.z=z}}
  const h=$('trakHint');if(h&&P){const t=!P.ride&&P.role==='cert'?nearTrailer(P):null;const show=!!P.ride||(!!t&&t.spd<.6);h.classList.toggle('hide',!show);h.textContent=P.ride?(isTouch?'Tlačítko Vlečka: seskočit':'B: seskočit z vlečky'):(isTouch?'Tlačítko Vlečka: naskočit':'B: naskočit na vlečku')
    const tb=$('tKolo');if(tb&&isTouch&&show){tb.classList.remove('hide');tb.textContent='Vlečka'}}}


/* ===================== HRA ZA NAPALOVAČE ===================== */
/* Mezerník (podržet) = mířit (nejde běžet), pustit = hod koulí (+3 za zásah masky).
   Q u Mikuláše, když stojí u domu = krádež nadílky (+10, nejvýš 1× za minutu); Q u čerta = zazvonit mu na zvonce (+5, stejnému čertovi 1× za 20 s).
   Když družina napalovače chytí (rány jako u napalovačů počítače), −20 a za 5 s se objeví jinde. Psi si ho nevšímají. */
const NAP={koule:3,kradez:10,zvonce:5,chycen:20,cdK:60,cdZ:20,out:5,out2:2,lez:5,hody:1,min:5,max:18,charge:1.0};
const isNap=e=>!!e&&e.role==='napalovac';
const druzina=e=>!e.nap;
let napSt={b:0,k:0,z:0,c:0};
const nballs=[];
const aimMark=(()=>{const g=new THREE.Group(),m=new THREE.MeshBasicMaterial({color:0xffe066,transparent:true,opacity:.9,depthWrite:false,depthTest:false,fog:false});
  const r=new THREE.Mesh(new THREE.RingGeometry(.6,.85,28),m);r.rotation.x=-Math.PI/2;g.add(r);const d=new THREE.Mesh(new THREE.CircleGeometry(.18,10),m);d.rotation.x=-Math.PI/2;g.add(d);
  const dots=[];for(let i=0;i<12;i++){const s=new THREE.Mesh(new THREE.SphereGeometry(.08,6,5),m);dots.push(s);g.add(s)}g.userData.dots=dots;g.visible=false;scene.add(g);return g})();
/* míření: cíl ve směru kamery, vzdálenost roste s délkou držení */
const canAim=e=>!!e&&(isNap(e)||e.role==='mikulas');
function aimStart(){const P=player;if(!canAim(P)||state!=='play'||P.gone>0||napBusy(P)||performance.now()<(P.nextThrow||0))return;P.aiming=true;P.aimT=0;P.aimD=undefined}
function aimPoint(P){const d=P.aimD!==undefined?P.aimD:NAP.min+(NAP.max-NAP.min)*Math.min(1,P.aimT/NAP.charge),f=cam.yaw+Math.PI;let x=P.pos.x+Math.sin(f)*d,z=P.pos.z+Math.cos(f)*d;return [x,groundH(x,z)+1.1,z,d]}
function ballVel(sx,sy,sz,tx,ty,tz){const d=Math.hypot(tx-sx,tz-sz),t=Math.max(.45,d/16);return [(tx-sx)/t,(ty-sy+.5*9.8*t*t)/t,(tz-sz)/t]}
function aimRelease(){const P=player;if(!P||!P.aiming)return;P.aiming=false;aimMark.visible=false;if(P.gone>0||state!=='play')return;
  const[tx,ty,tz]=aimPoint(P),sx=P.pos.x+Math.sin(P.face)*.3,sz=P.pos.z+Math.cos(P.face)*.3,sy=P.pos.y+1.6,[vx,vy,vz]=ballVel(sx,sy,sz,tx,ty,tz);
  const c=P.role==='mikulas'?1:0;addNball(P,sx,sy,sz,vx,vy,vz,c);NET.send({t:'nb',x:q2(sx),y:q2(sy),z:q2(sz),vx:q2(vx),vy:q2(vy),vz:q2(vz),c});P.nextThrow=performance.now()+600;P.throwA=.25}
/* bonbon Mikuláše: barevný bonbon v papírku */
const CANDY_C=[0xe53935,0x43a047,0x1e88e5,0xfdd835,0x8e24aa,0xfb8c00],candyB=new THREE.SphereGeometry(.09,10,8),candyW=new THREE.ConeGeometry(.06,.1,8);
function makeCandy(){const g=new THREE.Group(),mt=new THREE.MeshLambertMaterial({color:CANDY_C[Math.floor(Math.random()*CANDY_C.length)]});const b=new THREE.Mesh(candyB,mt);b.scale.set(1.35,1,1);g.add(b);
  for(const sx of[-1,1]){const w=new THREE.Mesh(candyW,mt);w.rotation.z=sx*Math.PI/2;w.position.x=sx*.16;g.add(w)}return g}
function addNball(by,x,y,z,vx,vy,vz,c){const m=c?makeCandy():new THREE.Mesh(ballGeo,ballMat);m.position.set(x,y,z);scene.add(m);nballs.push({m,by,c:!!c,v:new THREE.Vector3(vx,vy,vz),life:3});if(by&&by!==player)by.throwA=.25}
function updAim(dt){const P=player;if(!P||!canAim(P)){aimMark.visible=false;return}
  if(!P.aiming){aimMark.visible=false;return}P.aimT+=dt;const f=cam.yaw+Math.PI;P.face=f;
  const[tx,ty,tz]=aimPoint(P);aimMark.visible=true;aimMark.renderOrder=10;aimMark.position.set(tx,groundH(tx,tz)+.15,tz);
  const sx=P.pos.x,sy=P.pos.y+1.6,sz=P.pos.z,[vx,vy,vz]=ballVel(sx,sy,sz,tx,ty,tz),T=Math.max(.45,Math.hypot(tx-sx,tz-sz)/16);
  aimMark.userData.dots.forEach((s,i)=>{const t=T*(i+1)/13;s.position.set(sx+vx*t-tx,sy+vy*t-4.9*t*t-groundH(tx,tz)-.15,sz+vz*t-tz)})}
/* koule napalovačů-hráčů: zásah masky počítače vyhodnotí hostitel, zásah hráče jeho prohlížeč */
function updNballs(dt){const P=player;
  for(let i=nballs.length-1;i>=0;i--){const b=nballs[i],p=b.m.position;b.v.y-=9.8*dt;p.addScaledVector(b.v,dt);b.life-=dt;let hit=null;
    if(b.c){/* bonbon: zásah napalovače počítače vyhodnotí hostitel, zásah napalovače-hráče jeho prohlížeč */b.m.rotation.x+=dt*11;b.m.rotation.y+=dt*8;let hk=null,me=false;
      if(isHost())for(const k of kids){if(kOut(k)||k.gone>0)continue;const ky=groundH(k.pos.x,k.pos.z);if(Math.hypot(p.x-k.pos.x,p.z-k.pos.z)<.65&&p.y>ky&&p.y<ky+1.7){hk=k;break}}
      if(!hk&&P&&P.nap&&!(P.gone>0)&&!napBusy(P)&&b.by!==P&&Math.hypot(p.x-P.pos.x,p.z-P.pos.z)<.7&&p.y>P.pos.y+.1&&p.y<P.pos.y+2)me=true;
      if(hk||me){if(hk)candyHit(b.by,hk);else{toast('Mikuláš tě trefil bonbonem 🍬',1200);if(isHost())candyHit(b.by,P);else NET.send({t:'bbhit',by:b.by&&b.by.pid})}
        scene.remove(b.m);nballs.splice(i,1);continue}
      if(p.y<groundH(p.x,p.z)||b.life<=0){scene.remove(b.m);nballs.splice(i,1)}continue}
    for(const e of ents){if(e.nap||e===b.by||(e.human&&!e.isPlayer))continue;if(!e.isPlayer&&!isHost())continue;
      if(Math.hypot(p.x-e.pos.x,p.z-e.pos.z)<.7&&p.y>e.pos.y+.2&&p.y<e.pos.y+2.2){hit=e;break}}
    if(hit){puff(p.x,p.z);
      if(hit.isPlayer){splat();if(isHost())napHit(b.by,hit);else NET.send({t:'nbhit',by:b.by&&b.by.pid})}
      else napHit(b.by,hit);
      scene.remove(b.m);nballs.splice(i,1);continue}
    if(p.y<groundH(p.x,p.z)||b.life<=0){scene.remove(b.m);nballs.splice(i,1)}}}
/* hostitel: bonbon trefil napalovače → +2 Mikulášovi (stejný napalovač nejvýš 1× za 8 s); napalovač počítače se zastaví a sebere ho */
function candyHit(by,t){if(!by||!t)return;const now=performance.now();if(t.bbT&&now-t.bbT<8000){award(by,'msg',0,'Tenhle už bonbon dostal – zkus jiného',900);return}t.bbT=now;
  award(by,'bb',CFG.bodyBonbon,`Bonbon trefil napalovače! +${CFG.bodyBonbon}`,1000);
  if(t.bub&&!t.human){t.freeze=1.3;say(t,['Bonbon!','Díky, Mikuláši!','Mňam!','Jé, bonbon!'][Math.floor(Math.random()*4)],1300)}}
function splat(){const P=player;P.stamina=Math.max(0,P.stamina-12);const sp=$('splat');sp.style.transition='none';sp.style.opacity='1';requestAnimationFrame(()=>{sp.style.transition='opacity .9s';sp.style.opacity='0'})}
/* hostitel: zásah koulí → body házejícímu; zasažená maska počítače se po něm občas rozběhne */
function napHit(by,e){if(!by)return;award(by,'nb',NAP.koule,`Zásah koulí (${ROLE[e.role].n})! +${NAP.koule}`,900);
  if(!e.human&&e.role!=='mikulas'&&e.st!=='chase'&&e.st!=='hold'&&Math.random()<.6){e.st='chase';e.target=by;e.herd=false;e.chaseT=rnd(4,6)}}
/* Q: krádež nadílky / zvonce */
function napAction(){const P=player;if(P.gone>0||napBusy(P))return;
  const L=leader(),dL=L?Math.hypot(L.pos.x-P.pos.x,L.pos.z-P.pos.z):1e9;let c=null,dc=1.9;
  for(const e of ents){if(e.role!=='cert'||e.nap)continue;const d=Math.hypot(e.pos.x-P.pos.x,e.pos.z-P.pos.z);if(d<dc){dc=d;c=e}}
  if(dL<2.3&&grp.phase==='visit'){if(isHost())doNap(P,'k');else NET.send({t:'nap',a:'k'})}
  else if(c){if(isHost())doNap(P,'z',c);else NET.send({t:'nap',a:'z',ti:ents.indexOf(c)})}
  else toast(dL<2.3?'Nadílka jde ukrást jen u domu, kde je družina':'Připlíž se k Mikulášovi u domu (nadílka) nebo k čertovi (zvonce)',1500)}
function doNap(e,a,c){if(!e||e.gone>0)return;const now=CFG.limit-timeLeft;
  if(a==='k'){const L=leader();if(!L||grp.phase!=='visit'||Math.hypot(L.pos.x-e.pos.x,L.pos.z-e.pos.z)>3.2)return;
    if(e.lastK!==undefined&&now-e.lastK<NAP.cdK){award(e,'msg',0,`Další nadílku můžeš ukrást za ${Math.ceil(NAP.cdK-(now-e.lastK))} s`,1200);return}
    e.lastK=now;award(e,'nk',NAP.kradez,`Ukradl jsi nadílku! +${NAP.kradez}`,1400);
    if(L.human)award(L,'msg',0,'Napalovač ti ukradl nadílku!',1500);
    /* družina se za zlodějem rozběhne */
    ents.filter(x=>!x.human&&!x.nap&&x.role!=='mikulas').sort((p,q)=>Math.hypot(p.pos.x-e.pos.x,p.pos.z-e.pos.z)-Math.hypot(q.pos.x-e.pos.x,q.pos.z-e.pos.z)).slice(0,3)
      .forEach(x=>{x.st='chase';x.target=e;x.herd=false;x.chaseT=rnd(6,9)})}
  else if(a==='z'&&c){if(Math.hypot(c.pos.x-e.pos.x,c.pos.z-e.pos.z)>2.6)return;e.zv=e.zv||new Map();const t0=e.zv.get(c);
    if(t0!==undefined&&now-t0<NAP.cdZ){award(e,'msg',0,'Tomuhle čertovi už jsi zvonil – zkus jiného',1100);return}
    e.zv.set(c,now);award(e,'nz',NAP.zvonce,`Cink cink! Zazvonil jsi čertovi +${NAP.zvonce}`,1100);c.jingle=1;NET.ev(['cink',ents.indexOf(c)]);
    if(c.human)award(c,'msg',0,'Napalovač ti zazvonil na zvonce!',1300);else if(c.st!=='chase'){c.st='chase';c.target=e;c.herd=false;c.chaseT=rnd(4,7)}}}
/* zásah napalovače-hráče maskou (počítá hostitel) */
function hitNap(e,n){if(!n||n.gone>0||napBusy(n))return;const R=ROLE[e.role];n.hp=(n.hp===undefined?1:n.hp)-R.sila;n.hpT=20;
  const N=Math.round(1/R.sila),done=N-Math.round(Math.max(0,n.hp)/R.sila);
  if(n.hp>0.001){award(n,'msg',0,`Dostal jsi ránu – utíkej! (${done}/${N})`,900);award(e,'msg',0,`Zásah ${done}/${N}`,700)}
  else{n.hp=1;award(n,'nc',NAP.chycen,`Chytili tě! −${NAP.chycen}`,2000);
    if(R.pokuta)award(e,'pen',R.pokuta,`Mikuláš se nemá prát! −${R.pokuta}`,1800);else award(e,'catch',CFG.bodyChycen,`Napalovač chycen! +${CFG.bodyChycen}`,1200);
    n.thr=0;const x=q2(n.pos.x),z=q2(n.pos.z);napDown(n,NAP.lez,x,z);NET.ev(['nd',n.pid,NAP.lez,x,z,1])}}
function napSpawn(cx,cz,a,b){for(let k=0;k<25;k++){const p=spawnPoint(cx,cz,a,b);if(inPoly(p[0],p[1],M.poly))return p}return spawnPoint(cx,cz,a*.6,b*.6)}
function napOut(n,x,z,t){t=t||NAP.out;for(const e of ents)if(e.carry===n)e.carry=null;n.dn=0;n.hb=null;n.fl=null;n.thr=0;n.mesh.rotation.set(0,n.face,0);nesLimbs(n);n.wasDown=false;
  n.gone=t;n.mesh.visible=false;n.pos.set(x,0,z);n.tx=x;n.tz=z;n.aiming=false;if(n.isPlayer){aimMark.visible=false;toast(`Za ${Math.ceil(t)} s budeš zase ve hře – jinde`,1800)}}
function updNaps(dt){for(const e of ents){if(!e.nap)continue;
  if(e.gone>0){e.gone-=dt;if(e.gone<=0){e.gone=0;e.mesh.visible=e.human}}
  if(e.hpT>0){e.hpT-=dt;if(e.hpT<=0)e.hp=1}}
  for(const e of ents)if(e.jingle>0){e.jingle-=dt;const u=e.mesh.userData;if(u.rig)u.rig.rotation.z=Math.sin(e.jingle*40)*.12*e.jingle;if(e.jingle<=0&&u.rig)u.rig.rotation.z=0}}
/* póza napalovače: chůze, mávnutí rukou při hodu, napřažení při míření */
function placeNap(e,dt){const m=e.mesh,u=m.userData;e.pos.y=groundH(e.pos.x,e.pos.z)+.08;
  if(e.human&&!(e.gone>0)&&napBusy(e)){e.wasDown=true;
    if(e.fl){nesPoseFly(e);return}
    if(e.hb&&ents.includes(e.hb)){nesPoseHeld(e,e.hb,dt);e.pos.y=groundH(e.pos.x,e.pos.z)+.08;return}
    /* leží na zádech a kope nohama (jako napalovač počítače) */
    e.dk=(e.dk||0)+dt;const t=e.dk,kk=Math.sin(t*16);m.visible=true;m.position.copy(e.pos);m.position.y=e.pos.y+.22;m.rotation.set(-Math.PI/2,e.face,0,'YXZ');
    u.legL.rotation.set(kk*.8,0,0);u.legR.rotation.set(-kk*.8,0,0);u.armL.rotation.set(Math.sin(t*11)*1.2-1.5,0,0);u.armR.rotation.set(-Math.sin(t*11)*1.2-1.5,0,0);return}
  if(e.wasDown){e.wasDown=false;m.rotation.set(0,e.face,0);nesLimbs(e)}
  m.position.copy(e.pos);m.rotation.y=e.face;m.visible=e.human&&!(e.gone>0);
  const sp=e.spd||0;animWalk(m,e.phase,sp>.15?Math.min(.9,.35+sp/9):0);
  if(e.throwA>0){e.throwA-=dt;u.armR.rotation.x=-2.6+ (1-e.throwA/.25)*2.2}else if(e.aiming){u.armR.rotation.x=-2.7;u.armL.rotation.x=-1}}

/* ===================== AKTUALIZACE ===================== */
function applyPts(b,f,p){if(f==='house'){b.houses++;b.score+=p}else if(f==='scare'){b.scareP+=p;b.score+=p}else if(f==='catch'){b.caught++;b.score+=p}else if(f==='pen'){b.caught++;b.penalty+=p;b.score-=p}else if(f==='pes'){b.psi=(b.psi||0)+1;b.score+=p}
  else if(f==='nb'){b.nb=(b.nb||0)+1;b.score+=p}else if(f==='nk'){b.nk=(b.nk||0)+1;b.score+=p}else if(f==='nz'){b.nz=(b.nz||0)+1;b.score+=p}else if(f==='nc'){b.nc=(b.nc||0)+1;b.score-=p}
  else if(f==='bb'){b.bb=(b.bb||0)+1;b.score+=p}else if(f==='nad'){b.nad=(b.nad||0)+1;b.score+=p}else if(f==='reb'){b.reb=(b.reb||0)+1;b.score-=p}else if(f==='kombo'){b.kombo=(b.kombo||0)+1;b.score+=p}}
function award(e,f,p,msg,ms){if(!e||!e.human)return;
  if(!NET.on){const b={score,houses,caught,scareP,penalty,psi:dogsN,kombo:komboN,nb:napSt.b,nk:napSt.k,nz:napSt.z,nc:napSt.c};applyPts(b,f,p);({score,houses,caught,scareP,penalty}=b);dogsN=b.psi;komboN=b.kombo;napSt={b:b.nb,k:b.nk,z:b.nz,c:b.nc};if(msg)toast(msg,ms);updHud();return}
  const b=NET.board[e.pid];if(b){applyPts(b,f,p);NET.bDirty=true}
  if(e.isPlayer){if(b)myStats(b);if(msg)toast(msg,ms)}else NET.send({t:'pts',pid:e.pid,f,p,m:msg||'',ms:ms||0,b:b||null})}
function myStats(b){dogsN=b.psi||0;komboN=b.kombo||0;napSt={b:b.nb||0,k:b.nk||0,z:b.nz||0,c:b.nc||0};score=b.score;houses=b.houses;caught=b.caught;scareP=b.scareP;penalty=b.penalty;updHud()}
function hudLabels(){const n=player&&player.nap;$('hHousesL').textContent=n?'Zásahy koulí':'Domy s družinou';$('hHousesS').classList.toggle('hide',!!n);$('hCaughtL').textContent=n?'Chycen':'Chyceno'}
function updHud(){$('hScore').textContent=score;const n=player&&player.nap;$('hHouses').textContent=n?napSt.b:houses;$('hCaught').textContent=n?napSt.c:caught}
const tmpV=new THREE.Vector3();
function update(dt){
  timeLeft-=dt;if(timeLeft<=0){timeLeft=0;if(isHost()){gameOver(true);return}}
  const m=Math.floor(timeLeft/60),s=Math.floor(timeLeft%60);$('hTime').textContent=`${m}:${String(s).padStart(2,'0')}`;
  /* hráč */
  const P=player,R=ROLE[P.role];
  let ix=0,iz=0;
  if(keys.has('w')||keys.has('arrowup'))iz-=1;if(keys.has('s')||keys.has('arrowdown'))iz+=1;
  if(keys.has('a'))ix-=1;if(keys.has('d'))ix+=1;
  if(keys.has('arrowleft'))cam.yaw+=1.8*dt;if(keys.has('arrowright'))cam.yaw-=1.8*dt;
  if(joy.id!==null){ix+=joy.dx;iz+=joy.dy}
  if(autoRun&&joy.id===null){iz=-1}
  if(P.ride||P.gone>0||napBusy(P)){ix=0;iz=0}
  let il=Math.hypot(ix,iz);if(il>1){ix/=il;iz/=il;il=1}
  const wantRun=(keys.has('shift')||runHeld||autoRun||(joy.id!==null&&joy.run))&&il>0.2;
  if(P.stamina<=0)P.tired=true;if(P.tired&&P.stamina>30)P.tired=false;
  const running=wantRun&&!P.tired&&!P.carry&&!P.aiming;P.running=running;
  if(P.slow>0)P.slow-=dt;const spd=(P.bike?(running?2*R.beh:R.beh):(running?R.beh:R.chuze))*il*(P.attack>0?.35:1)*(P.slow>0?.5:1);
  P.stamina=clamp(P.stamina+(running?-R.drain:il>0.1?9:15)*dt,0,100);
  if(il>0.05){const sy=Math.sin(cam.yaw),cy=Math.cos(cam.yaw);const fx=-sy*(-iz)+cy*ix,fz=-cy*(-iz)-sy*ix;
    const Lq=Math.hypot(fx,fz)||1;P.pos.x+=fx/Lq*spd*dt;P.pos.z+=fz/Lq*spd*dt;
    const tf=Math.atan2(fx,fz);let d=tf-P.face;d=Math.atan2(Math.sin(d),Math.cos(d));P.face+=d*Math.min(1,dt*12);P.phase+=dt*spd*2.4}
  if(!napBusy(P))pushOut(P.pos,.45);P.spd=spd;
  const st=$('stamina');st.style.width=P.stamina+'%';st.classList.toggle('low',P.tired);
  if(NET.on)netLocal(dt);
  /* družina (počítá hostitel, ostatní dostávají jeho stav) */
  if(isHost()){updGroup(dt);if(state!=='play')return;
  /* spolupráce: když hráč honí napalovače, přiběhnou pomoct až dva nejbližší */
  for(const H of humans()){if(!H.running||H.role==='mikulas')continue;let kd=null,bd=16;for(const k of kids){if(k.gone>0||kOut(k))continue;const d=Math.hypot(k.pos.x-H.pos.x,k.pos.z-H.pos.z);if(d<bd){bd=d;kd=k}}
    if(kd&&!ents.some(e=>e.target===kd&&(e.st==='chase'||e.st==='hold'))){
      const help=ents.filter(e=>!e.human&&e.role!=='mikulas'&&e.st!=='chase'&&e.st!=='hold'&&Math.hypot(e.pos.x-H.pos.x,e.pos.z-H.pos.z)<30)
        .sort((a,b)=>Math.hypot(a.pos.x-kd.pos.x,a.pos.z-kd.pos.z)-Math.hypot(b.pos.x-kd.pos.x,b.pos.z-kd.pos.z)).slice(0,2);
      help.forEach(e=>{e.st='chase';e.target=kd;e.herd=true;e.herdP=H;e.chaseT=8})}}
  ents.forEach((e,k)=>updMember(e,k,dt))}
  ents.forEach(e=>placeEnt(e,dt));
  if(isHost())for(const g of dogs)updDog(g,dt);else for(const g of dogs)viewDog(g,dt);
  updBins(dt);updBikes(dt);updRiders();updAim(dt);updNballs(dt);updNaps(dt);updNapDown(dt);updOtz(dt);
  updRes(dt);
  for(let i=puffs.length-1;i>=0;i--){const p=puffs[i];p.t-=dt;p.v.y-=9*dt;p.m.position.addScaledVector(p.v,dt);p.m.scale.setScalar(Math.max(.1,p.t/.7));if(p.t<=0||p.m.position.y<p.g){scene.remove(p.m);puffs.splice(i,1)}}
  /* ukazatele */
  const[gx,gz]=grpCenter(),far=Math.hypot(P.pos.x-gx,P.pos.z-gz)>28;
  $('warn').textContent=!inPoly(P.pos.x,P.pos.z,M.poly)?'Jsi mimo stranu '+STRANA_N+' – domy tady nepočítáme':'Družina je daleko – vrať se k ní';
  $('warn').classList.toggle('hide',(P.nap||!far)&&inPoly(P.pos.x,P.pos.z,M.poly));
  if(grp.phase==='visit'){$('prompt').classList.remove('hide');$('promptT').textContent=P.nap?`Družina je u domu ${route[ri].b.adr||''} – ještě ${Math.ceil(grp.t)} s · u Mikuláše ${isTouch?'tlačítko':'Q'}: ukrást nadílku`:`${route[ri].b.adr||'Dům'} (${ri+1}/${route.length}) – zbývá ${Math.ceil(grp.t)} s · ${isTouch?'tlačítko':'Q'}: ${P.role==='mikulas'&&otz.ri===ri&&otz.st===2?'Dát nadílku':ROLE[P.role].akce}`;
    $('promptBar').style.width=((VISIT_S-grp.t)/VISIT_S*100)+'%'}
  else if(P.role==='mikulas'){$('prompt').classList.remove('hide');const w=grp.wt||0;$('promptT').textContent=grp.auto?`Družina jde k domu ${ri+1}/${route.length} bez tebe! (−${CFG.rebelPen})`:`Veď družinu k domu ${ri+1}/${route.length} (žluté světlo) – zbývá ${Math.max(0,Math.ceil(CFG.rebelS-w))} s`;$('promptBar').style.width=grp.auto?'100%':Math.min(100,w/CFG.rebelS*100)+'%'}
  else $('prompt').classList.add('hide');
  /* napalovači a auta */
  if(isHost()){kidSep();for(const k of kids)updKid(k,dt);updCars(dt);for(const t of tractors)updTractor(t,dt)}else{for(const k of kids)viewKid(k,dt);viewCars(dt);for(const t of tractors)viewTractor(t,dt)}updSnow(dt);
  /* koule */
  for(let i=balls.length-1;i>=0;i--){const b=balls[i];b.v.y-=9.8*dt;b.m.position.addScaledVector(b.v,dt);
    const dx=b.m.position.x-P.pos.x,dz=b.m.position.z-P.pos.z;
    if(!P.nap&&Math.hypot(dx,dz)<0.7&&b.m.position.y>P.pos.y+0.2&&b.m.position.y<P.pos.y+2.2){P.stamina=Math.max(0,P.stamina-12);const sp=$('splat');sp.style.transition='none';sp.style.opacity='1';
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
  drawMap();updNav();
}
/* napalovači: škádlí družinu, utíkají před kýmkoli z ní */
function moveKid(k,dx,dz,spd,dt){const l=Math.hypot(dx,dz)||1;let ux=dx/l,uz=dz/l;
  if(k.turnT>0){k.turnT-=dt;const a=k.turn,c=Math.cos(a),s=Math.sin(a);const nx=ux*c-uz*s,nz=ux*s+uz*c;ux=nx;uz=nz}
  const ox=k.pos.x,oz=k.pos.z,wet=inWater(ox,oz);k.pos.x+=ux*spd*dt;k.pos.z+=uz*spd*dt;pushOut(k.pos,.4);
  if(!wet&&inWater(k.pos.x,k.pos.z)){k.pos.x=ox;k.pos.z=oz}   /* do vody nevleze */
  const moved=Math.hypot(k.pos.x-ox,k.pos.z-oz);if(moved<spd*dt*0.45&&k.turnT<=0){k.turn=(Math.random()<.5?-1:1)*rnd(1,1.6);k.turnT=rnd(.6,1.2)}
  const tf=Math.atan2(ux,uz);let d=tf-k.face;d=Math.atan2(Math.sin(d),Math.cos(d));k.face+=d*Math.min(1,dt*10);k.phase+=dt*spd*2.8}
/* napalovači počítače od sebe aspoň KID_MIN m (kromě ležících / nesených / letících) */
const KID_MIN=1;
function kidSep(){for(let i=0;i<kids.length;i++){const a=kids[i];if(a.gone>0||kOut(a))continue;
  for(let j=i+1;j<kids.length;j++){const b=kids[j];if(b.gone>0||kOut(b))continue;let dx=b.pos.x-a.pos.x,dz=b.pos.z-a.pos.z,d=Math.hypot(dx,dz);if(d>=KID_MIN)continue;
    if(d<1e-3){const r=Math.random()*Math.PI*2;dx=Math.cos(r);dz=Math.sin(r);d=1}else{dx/=d;dz/=d}const h=(KID_MIN-d)/2;
    a.pos.x-=dx*h;a.pos.z-=dz*h;b.pos.x+=dx*h;b.pos.z+=dz*h;pushOut(a.pos,.4);pushOut(b.pos,.4)}}}
function updKid(k,dt){k.pos.y=groundH(k.pos.x,k.pos.z)+.08;
  const[gx,gz]=grpCenter();
  if(k.gone>0){k.gone-=dt;if(k.gone<=0){const[x,z]=spawnPoint(gx,gz,28,46);k.pos.set(x,0,z);k.st='roam';k.mesh.visible=true;k.stamina=100}return}
  if(k.st==='held'||k.st==='fly'){nesUpd(k,dt);if(k.bubT>0){k.bubT-=dt*1000;if(k.bubT<=0)k.bub.classList.add('hide')}return}
  /* nejbližší člen družiny a největší hrozba */
  let ne=null,nd=1e9,threat=false,tx=0,tz=0;
  for(const e of ents){if(e.nap)continue;const d=Math.hypot(k.pos.x-e.pos.x,k.pos.z-e.pos.z);if(d<nd){nd=d;ne=e}
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
    if(k.st==='flee'){const tired=k.stamina<=0;spd=tired?CFG.kidUnaveny:CFG.kidBeh;if(k.dash>0){k.dash-=dt;spd=Math.max(spd,6.2)}   /* po zásahu vystřelí pryč */
      k.stamina=Math.max(0,k.stamina-11*dt);
      if(tired&&Math.random()<dt*0.6)say(k,'Uf… už nemůžu!',1500);
      moveKid(k,threat?tx:dx,threat?tz:dz,spd,dt);if(k.t<=0&&d>14)k.st='roam'}
    else{k.stamina=Math.min(100,k.stamina+14*dt);
      const keep=12*ROLE[ne.role].respekt;if(d>keep+8){spd=2.6;moveKid(k,-dx,-dz,spd,dt)}else if(d<keep){spd=1.8;moveKid(k,dx,dz,spd,dt)}
      else{const tf=Math.atan2(-dx,-dz);let dd=tf-k.face;dd=Math.atan2(Math.sin(dd),Math.cos(dd));k.face+=dd*Math.min(1,dt*6)}
      if(k.throwCd<=0&&d<22&&d>6){k.throwCd=rnd(3.5,7);const hs=humansD().filter(h=>Math.hypot(k.pos.x-h.pos.x,k.pos.z-h.pos.z)<24),tgt=Math.random()<.5&&hs.length?hs[Math.floor(Math.random()*hs.length)]:ne;throwBall(k,tgt);if(Math.random()<.5)say(k,POKRIK[Math.floor(Math.random()*POKRIK.length)])}
      else if(Math.random()<dt*0.08&&k.bubT<=0)say(k,POKRIK[Math.floor(Math.random()*POKRIK.length)])}}
  k.mesh.position.copy(k.pos);k.mesh.rotation.set(0,k.face,0);animWalk(k.mesh,k.phase,spd>0.1?Math.min(1,spd/5)*0.9:0);
  if(k.bubT>0){k.bubT-=dt*1000;if(k.bubT<=0)k.bub.classList.add('hide')}}
function addBall(x,y,z,vx,vy,vz){const m=new THREE.Mesh(ballGeo,ballMat);m.position.set(x,y,z);scene.add(m);balls.push({m,v:new THREE.Vector3(vx,vy,vz),life:400})}
function throwBall(k,e){const t=Math.max(.5,Math.hypot(k.pos.x-e.pos.x,k.pos.z-e.pos.z)/15);
  const tx=e.pos.x+rnd(-1.3,1.3),tz=e.pos.z+rnd(-1.3,1.3),ty=e.pos.y+1.2,sx=k.pos.x,sz=k.pos.z,sy=k.pos.y+1.5;
  const v=new THREE.Vector3((tx-sx)/t,(ty-sy+0.5*9.8*t*t)/t,(tz-sz)/t);addBall(sx,sy,sz,v.x,v.y,v.z);NET.ev(['b',+sx.toFixed(2),+sy.toFixed(2),+sz.toFixed(2),+v.x.toFixed(2),+v.y.toFixed(2),+v.z.toFixed(2),k.i]);
  k.mesh.userData.armR.rotation.x=-2.2;setTimeout(()=>{k.mesh.userData.armR.rotation.x=0},250)}


/* ===================== PSI U DOMŮ ===================== */
/* pes hlídá dvůr: když se družina přiblíží, napadá její členy; čert ho zažene 3 ranami, ostatní 4 (popelnice = 2 rány čerta). Počítá hostitel. */
const DOGC=[[0x6b4a2b,0x3b2a1e],[0x2a2522,0x111111],[0xd9cbb0,0x9a7b4f],[0x9a6a3a,0x5d4037],[0x8f8a85,0x4a4540]];
function makeDog(seed){const c=DOGC[seed%DOGC.length],fur=lam(c[0]),dark=lam(c[1]),g=new THREE.Group(),r=new THREE.Group();g.add(r);
  const body=box(.34,.32,.68,fur,0,.5,0),chest=box(.32,.3,.2,fur,0,.55,.3);
  const head=new THREE.Group();head.position.set(0,.68,.42);head.add(box(.24,.22,.24,fur,0,.04,.04),box(.13,.11,.17,fur,0,-.01,.22),box(.07,.05,.04,dark,0,.04,.31));
  for(const s of[-1,1]){head.add(box(.06,.12,.04,dark,s*.1,.18,-.02));head.add(box(.03,.03,.02,lam(0x111111),s*.06,.08,.17))}
  const legs=[[-.1,.27],[.1,.27],[-.1,-.27],[.1,-.27]].map(([x,z])=>limb(.1,.36,.1,fur,x,.38,z));
  const tail=limb(.05,.26,.05,dark,0,.6,-.35);tail.rotation.x=-2.3;
  r.add(body,chest,head,tail,...legs);g.userData={r,head,tail,legs};g.scale.setScalar(.9+(seed*37%10)/40);return g}
const q2=v=>Math.round(v*100)/100;
const dogs=[],dogInfo=new Map();
/* místa u domu: popelnice vedle dveří po jedné straně, pes po druhé */
function houseSpots(b){if(dogInfo.has(b.id))return dogInfo.get(b.id);const d=doorOf(b),E=d.E,ux=(E.bx-E.ax)/(E.l||1),uz=(E.bz-E.az)/(E.l||1),[cx,cz]=d.cp;
  const ok=(x,z,p)=>!insideAny(x,z,p)&&!inWater(x,z,.6);const at=(s,off,out)=>[cx+ux*s*off+E.nx*out,cz+uz*s*off+E.nz*out];let bin=null,dog=null,side=1;
  for(const s of[1,-1]){for(const off of[1.8,2.5,1.4]){const p=at(s,off,.75);if(ok(p[0],p[1],.35)){bin=p;side=s;break}}if(bin)break}
  for(const off of[2.2,3,1.6]){const p=at(-side,off,1.8);if(ok(p[0],p[1],.4)){dog=p;break}}
  if(!dog){const p=[d.x+E.nx*1.2,d.z+E.nz*1.2];if(ok(p[0],p[1],.4))dog=p}
  let bike=null,bface=Math.atan2(ux,uz);const far=(p,q)=>!q||Math.hypot(p[0]-q[0],p[1]-q[1])>1.2;
  for(const s of[side,-side]){for(const off of[3.4,4.2,2.8,5]){const p=at(s,off,1);if(ok(p[0],p[1],.55)&&far(p,bin)&&far(p,dog)){bike=p;break}}if(bike)break}
  const o={door:[d.x,d.z],bin,dog,bike,bface,face:Math.atan2(E.nx,E.nz)};dogInfo.set(b.id,o);return o}
function clearDogs(){for(const g of dogs){scene.remove(g.mesh);g.bub.remove()}dogs.length=0}
function makeDogs(){clearDogs();B.forEach(b=>{if(!pes(b))return;const s=houseSpots(b);if(!s.dog)return;const m=makeDog(b.i);scene.add(m);
  const bub=document.createElement('div');bub.className='bub hide';$('bubbles').appendChild(bub);
  dogs.push({dog:true,i:dogs.length,b,mesh:m,home:s.dog,door:s.door,pos:new THREE.Vector3(s.dog[0],0,s.dog[1]),face:s.face,hface:s.face,st:'home',hp:1,cd:0,fl:0,kx:0,kz:0,gone:0,phase:0,bub,bubT:0,bark:0,spd:0})})}
function sayDog(g,t,ms){NET.ev(['ds',g.i,t,ms||0]);g.bub.textContent=t;g.bub.classList.remove('hide');g.bubT=ms||1400}
function dogMove(g,tx,tz,spd,dt){const dx=tx-g.pos.x,dz=tz-g.pos.z,d=Math.hypot(dx,dz);if(d<.05){g.spd=0;return d}const s=Math.min(spd*dt,d),ox=g.pos.x,oz=g.pos.z,wet=inWater(ox,oz);
  g.pos.x+=dx/d*s;g.pos.z+=dz/d*s;pushOut(g.pos,.3);if(!wet&&inWater(g.pos.x,g.pos.z)){g.pos.x=ox;g.pos.z=oz}
  g.spd=Math.hypot(g.pos.x-ox,g.pos.z-oz)/dt;let a=Math.atan2(dx,dz)-g.face;a=Math.atan2(Math.sin(a),Math.cos(a));g.face+=a*Math.min(1,dt*10);g.phase+=g.spd*dt*4;return d}
const BARK=['Haf! Haf!','Vrrr… Haf!','Haf haf haf!','Grrr!'];
/* kousnutí: hráč přijde o sílu, počítačová postava se brání */
function biteMe(){const P=player;if(!P)return;P.stamina=Math.max(0,P.stamina-25);P.slow=.6;cam.shake=.15;toast('Pes tě kousl! Zažeň ho ranami.',1100);const sp=$('splat');sp.style.transition='none';sp.style.opacity='.6';requestAnimationFrame(()=>{sp.style.transition='opacity .7s';sp.style.opacity='0'})}
function dogBite(g,e){g.cd=rnd(1.2,1.6);const a=e.mesh.userData;if(e.isPlayer)biteMe();else if(e.human)NET.ev(['pb',e.pid]);
  else if(e.role!=='mikulas'&&e.st!=='chase'&&e.st!=='hold'){e.st='chase';e.target=g;e.herd=false;e.chaseT=7}
  if(Math.random()<.4)sayDog(g,BARK[Math.floor(Math.random()*BARK.length)],900)}
function updDog(g,dt){if(g.st==='gone')return;g.cd-=dt;g.bark-=dt;
  let ne=null,nd=1e9,nh=1e9;for(const e of ents){if(e.nap)continue;const d=Math.hypot(e.pos.x-g.pos.x,e.pos.z-g.pos.z),dh=Math.hypot(e.pos.x-g.home[0],e.pos.z-g.home[1]);if(dh<22&&d<nd){nd=d;ne=e}nh=Math.min(nh,dh)}
  const fromHome=Math.hypot(g.pos.x-g.home[0],g.pos.z-g.home[1]);
  if(g.st==='down'){/* zahnaný pes uteče domů a už nevyjde */if(dogMove(g,g.door[0],g.door[1],6.5,dt)<.7){g.st='gone';g.mesh.visible=false;g.bub.classList.add('hide')}}
  else if(g.fl>0){g.fl-=dt;g.pos.x+=g.kx*dt;g.pos.z+=g.kz*dt;pushOut(g.pos,.3);g.spd=0}
  else if(g.st==='home'){g.spd=0;let a=g.hface-g.face;a=Math.atan2(Math.sin(a),Math.cos(a));g.face+=a*Math.min(1,dt*4);
    if(fromHome>.4){g.st='back'}else if(nh<11){g.st='atk';sayDog(g,'Haf! Haf! Haf!',1300)}}
  else if(g.st==='atk'){if(!ne||fromHome>28){g.st='back'}else{const d=Math.hypot(ne.pos.x-g.pos.x,ne.pos.z-g.pos.z);
      if(d>1.05)dogMove(g,ne.pos.x,ne.pos.z,5.6,dt);else{g.spd=0;const a=Math.atan2(ne.pos.x-g.pos.x,ne.pos.z-g.pos.z);g.face=a}
      if(d<1.25&&g.cd<=0)dogBite(g,ne);if(g.bark<=0){g.bark=rnd(2.5,5);if(Math.random()<.6)sayDog(g,BARK[Math.floor(Math.random()*BARK.length)],1000)}}}
  else if(g.st==='back'){if(nh<9){g.st='atk'}else if(dogMove(g,g.home[0],g.home[1],3.2,dt)<.3)g.st='home'}
  if(g.bubT>0){g.bubT-=dt*1000;if(g.bubT<=0)g.bub.classList.add('hide')}
  placeDog(g,dt)}
function placeDog(g,dt){const m=g.mesh,u=m.userData;g.pos.y=groundH(g.pos.x,g.pos.z)+.02;m.position.copy(g.pos);m.rotation.y=g.face;
  const run=Math.min(1,g.spd/5),s=Math.sin(g.phase*2.2)*.9*run;
  u.legs[0].rotation.x=s;u.legs[3].rotation.x=s;u.legs[1].rotation.x=-s;u.legs[2].rotation.x=-s;u.r.position.y=Math.abs(Math.sin(g.phase*2.2))*.06*run;
  u.tail.rotation.z=Math.sin(performance.now()/(g.st==='down'?60:120))*.5;u.tail.rotation.x=g.st==='down'?-.6:-2.3;
  u.head.rotation.x=g.st==='atk'&&g.cd>1?.25:0}
/* zásah psa (počítá hostitel); mult = kolik ran naráz (popelnice 2) */
function hitDog(e,g,mult){if(g.st==='down'||g.st==='gone')return;const R=ROLE[e.role],n=e.role==='cert'?3:4,per=1/n;g.hp-=per*(mult||1);
  const dx=g.pos.x-e.pos.x,dz=g.pos.z-e.pos.z,l=Math.hypot(dx,dz)||1;
  if(g.hp>0.001){g.fl=.35;g.kx=dx/l*3.5;g.kz=dz/l*3.5;g.st='atk';g.cd=Math.max(g.cd,.8);sayDog(g,['Kaň!','Kaň kaň!','Vrrr!'][Math.floor(Math.random()*3)],700);
    award(e,'msg',0,`Pes: zásah ${n-Math.round(g.hp/per)}/${n}`,700)}
  else{g.st='down';g.hp=0;sayDog(g,'Kňuk kňuk!',1800);
    if(R.pokuta)award(e,'pen',R.pokuta,`Mikuláš se nemá prát! −${R.pokuta}`,1800);else award(e,'pes',CFG.bodyPes,`Pes zahnán! +${CFG.bodyPes}`,1300)}}
/* pes u ostatních hráčů: jen plynule přejde na polohu od hostitele */
const DOGST=['home','atk','back','down','gone'];
function viewDog(g,dt){const st=DOGST[g.code||0];g.st=st;if(st==='gone'){g.mesh.visible=false;g.bub.classList.add('hide');return}g.mesh.visible=true;
  const ox=g.pos.x,oz=g.pos.z;if(g.tx!==undefined){const a=Math.min(1,dt*10);if(Math.hypot(g.tx-ox,g.tz-oz)>8){g.pos.x=g.tx;g.pos.z=g.tz}else{g.pos.x+=(g.tx-ox)*a;g.pos.z+=(g.tz-oz)*a}
    let d=g.tf-g.face;d=Math.atan2(Math.sin(d),Math.cos(d));g.face+=d*a}
  g.spd=Math.hypot(g.pos.x-ox,g.pos.z-oz)/Math.max(dt,1e-3);g.phase+=g.spd*dt*4;if(g.bubT>0){g.bubT-=dt*1000;if(g.bubT<=0)g.bub.classList.add('hide')}placeDog(g,dt)}
function dogsSnap(){return dogs.map(g=>[q2(g.pos.x),q2(g.pos.z),q2(g.face),DOGST.indexOf(g.st)])}
function dogsApply(a){a.forEach((q,i)=>{const g=dogs[i];if(!g)return;if(g.tx===undefined){g.pos.x=q[0];g.pos.z=q[1]}g.tx=q[0];g.tz=q[1];g.tf=q[2];g.code=q[3]})}
function dogsHost(){for(const g of dogs){g.st=DOGST[g.code||0];g.fl=0;g.cd=1;g.hp=g.st==='down'||g.st==='gone'?0:1}}

/* ===================== NAPALOVAČ NA RAMENA (celá družina) ===================== */
/* přemožený (ležící) napalovač: F / tlačítko = zvednout nad hlavu (nejvýš 30 s, pak se vyškubne), F / Mezerník / Udeřit = hodit;
   letí roztažený jako hvězda a pomalu se točí; zásah jiného napalovače = kombo +15 (ten pak leží), zásah psa = 2 rány čerta. Počítá hostitel. */
const NES={reach:1.9,max:30,g:9.8};
function kOut(k){return k.st==='down'||k.st==='held'||k.st==='fly'||(!!k.nap&&napBusy(k))}
/* nezasažitelný: hostitel podle stavu, ostatní podle kódu ze snímku (k.st/k.gone se u nich neaktualizují) */
function kOutV(k){if(isHost())return kOut(k)||k.gone>0;return (k.code||0)>=2||!!k.fl}
function isKidO(o){return !!o&&(!!o.star||!!o.nap)}
function canNes(e){return !!e&&!isNap(e)&&e.role!=='napalovac'}
function nearDown(e){let best=null,bd=NES.reach;for(const k of kids){if(k.gone>0)continue;const down=isHost()?k.st==='down':(k.code===2&&!k.fl);if(!down)continue;
  const d=Math.hypot(k.pos.x-e.pos.x,k.pos.z-e.pos.z);if(d<bd){bd=d;best=k}}
  for(const n of ents){if(!n.nap||!n.human||n===e||!(n.dn>0)||n.hb||n.fl||n.gone>0)continue;const d=Math.hypot(n.pos.x-e.pos.x,n.pos.z-e.pos.z);if(d<bd){bd=d;best=n}}return best}
const _nV=new THREE.Vector3();
function nesLimbs(k){const u=k.mesh.userData;for(const l of[u.legL,u.legR,u.armL,u.armR])l.rotation.set(0,0,0)}
/* napalovač nad hlavou nosiče: leží napříč na zádech a kope nohama */
function nesPoseHeld(k,e,dt){const m=k.mesh,u=m.userData;k.ht=(k.ht||0)+dt;const t=k.ht;
  m.rotation.set(-Math.PI/2,e.face+Math.PI/2,0,'YXZ');_nV.set(0,.9,0).applyEuler(m.rotation);m.position.set(e.pos.x-_nV.x,e.pos.y+2.05-_nV.y,e.pos.z-_nV.z);
  const kk=Math.sin(t*14);u.legL.rotation.set(kk*.7,0,0);u.legR.rotation.set(-kk*.7,0,0);u.armL.rotation.set(Math.sin(t*10)*.9-1.2,0,0);u.armR.rotation.set(-Math.sin(t*10)*.9-1.2,0,0);
  k.pos.set(e.pos.x,e.pos.y,e.pos.z);if(k.star)k.star.visible=false;m.visible=true;
  const v=e.mesh.userData;if(!(e.attack>0)&&v.armL){v.armL.rotation.x=v.armR.rotation.x=-2.9;v.armL.rotation.z=-.15;v.armR.rotation.z=.15}}
/* let: hvězda – roztažené ruce i nohy, pomalá rotace */
function nesPoseFly(k){const m=k.mesh,u=m.userData;m.rotation.set(-Math.PI/2+.45*Math.sin(k.fT*1.7),k.spin,.25*Math.sin(k.fT*1.3),'YXZ');
  _nV.set(0,.92,0).applyEuler(m.rotation);m.position.set(k.fp.x-_nV.x,k.fp.y-_nV.y,k.fp.z-_nV.z);
  u.armL.rotation.set(0,0,-1.5);u.armR.rotation.set(0,0,1.5);u.legL.rotation.set(0,0,-.55);u.legR.rotation.set(0,0,.55);if(k.star)k.star.visible=false;m.visible=true}
function nesFly(k,e,x,y,z,vx,vy,vz){k.st='fly';k.by=e;if(e&&e.carry===k)e.carry=null;k.fp=new THREE.Vector3(x,y,z);k.fv=new THREE.Vector3(vx,vy,vz);k.fT=0;k.spin=(e?e.face:0)+Math.PI/2;k.fhit=new Set();k.pos.x=x;k.pos.z=z}
/* krok letu (hostitel i ostatní); vrací true při dopadu */
function nesStep(k,dt){k.fT+=dt;k.fv.y-=NES.g*dt;k.fp.addScaledVector(k.fv,dt);k.spin+=dt*2.4;k.pos.x=k.fp.x;k.pos.z=k.fp.z;nesPoseFly(k);
  const gh=groundH(k.fp.x,k.fp.z);return (k.fp.y<=gh+.3&&k.fv.y<0)||k.fT>4||(k.fT>.15&&insideAny(k.fp.x,k.fp.z,.1)&&k.fp.y<gh+3)}
function nesPick(e,k){if(!k||k.st!=='down'||k.gone>0||!e||e.carry)return false;k.st='held';k.by=e;k.hT=NES.max;k.ht=0;e.carry=k;e.carryT=performance.now();k.star.visible=false;
  say(k,['Pusť mě!','Hej, dej mě dolů!','Áááá!','Mami!'][Math.floor(Math.random()*4)],1400);return true}
/* položení (nosič zmizel) nebo vyškubnutí po 30 s */
function nesDrop(k,esc){const e=k.by;if(e&&e.carry===k)e.carry=null;k.by=null;nesLimbs(k);
  const fx=e?Math.sin(e.face):0,fz=e?Math.cos(e.face):0;k.pos.set((e?e.pos.x:k.pos.x)+fx*.9,0,(e?e.pos.z:k.pos.z)+fz*.9);pushOut(k.pos,.4);k.pos.y=groundH(k.pos.x,k.pos.z)+.08;
  k.mesh.rotation.set(0,k.face,0);k.mesh.position.copy(k.pos);
  if(esc){k.st='flee';k.t=3;k.dash=1.2;k.stamina=80;k.hp=1;k.throwCd=rnd(3,5);say(k,'Ha! Vyškubl jsem se!',1600);if(e)award(e,'msg',0,'Napalovač se ti vyškubl',1400)}
  else{k.st='down';k.t=2}}
function nesLand(k){const by=k.by;k.by=null;k.st='down';k.t=rnd(2.5,3.5);k.hp=1;k.face=k.spin;nesLimbs(k);k.pos.set(k.fp.x,0,k.fp.z);pushOut(k.pos,.45);
  if(insideAny(k.pos.x,k.pos.z,.3)){k.pos.x-=k.fv.x*.06;k.pos.z-=k.fv.z*.06;pushOut(k.pos,.5)}k.pos.y=groundH(k.pos.x,k.pos.z)+.08;puff(k.pos.x,k.pos.z);
  say(k,'Ha ha, nebolelo!',1800);if(player&&Math.hypot(k.pos.x-player.pos.x,k.pos.z-player.pos.z)<25)cam.shake=Math.max(cam.shake||0,.06)}
function nesCombo(e,o){o.st='down';o.t=rnd(5,7);o.hp=1;o.freeze=0;o.dash=0;say(o,AU[Math.floor(Math.random()*AU.length)],2000);
  award(e,'kombo',CFG.bodyKombo,`Kombo! Napalovačem na napalovače +${CFG.bodyKombo}`,1600)}
/* hostitel: každý snímek */
function nesUpd(k,dt){
  if(k.st==='held'){const e=k.by;k.hT-=dt;if(!e||!ents.includes(e)||e.carry!==k||k.hT<=0){nesDrop(k,!!e&&ents.includes(e)&&e.carry===k);return}nesPoseHeld(k,e,dt);return}
  const landed=nesStep(k,dt);nesColl(k);
  if(landed)nesLand(k)}
/* zásahy letícím napalovačem (hostitel): kombo / pes */
function nesColl(k){
  for(const o of kids.concat(dogs)){if(o===k||k.fhit.has(o)||(o.star&&kOut(o))||o.st==='gone'||o.gone>0)continue;
    const d=Math.hypot(o.pos.x-k.fp.x,o.pos.z-k.fp.z),g0=groundH(o.pos.x,o.pos.z);
    if(d<1.15&&k.fp.y<g0+(o.dog?1.2:1.9)&&k.fp.y>g0-.2){k.fhit.add(o);puff(o.pos.x,o.pos.z);if(k.by){if(o.dog)hitDog(k.by,o,2);else nesCombo(k.by,o)}k.fv.x*=-.25;k.fv.z*=-.25;k.fv.y=Math.max(k.fv.y,1.5)}}}
/* hod vlastního hráče */
function nesThrowMe(){const P=player,k=P.carry,t=binAim(P);if(k&&k.nap&&!(k.hb===P))return;let tx,tz,ty;
  if(t){tx=t.pos.x;tz=t.pos.z;ty=t.pos.y+(t.dog?.5:1)}else{tx=P.pos.x+Math.sin(P.face)*9;tz=P.pos.z+Math.cos(P.face)*9;ty=groundH(tx,tz)+.3}
  const sx=P.pos.x+Math.sin(P.face)*.5,sz=P.pos.z+Math.cos(P.face)*.5,sy=P.pos.y+2.05,d=Math.hypot(tx-sx,tz-sz),T=Math.max(.45,d/10);
  const vx=q2((tx-sx)/T),vz=q2((tz-sz)/T),vy=q2((ty-sy+.5*NES.g*T*T)/T),i=kids.indexOf(k),X=q2(sx),Y=q2(sy),Z=q2(sz);
  P.carry=null;cam.shake=.1;
  if(k.nap){napFly(k,P,X,Y,Z,vx,vy,vz);if(isHost())NET.ev(['nt',k.pid,X,Y,Z,vx,vy,vz,P.pid||NET.me]);else NET.send({t:'nes',a:'th',n:k.pid,x:X,y:Y,z:Z,vx,vy,vz});return}
  nesFly(k,P,X,Y,Z,vx,vy,vz);
  if(isHost())NET.ev(['kt',i,X,Y,Z,vx,vy,vz,NET.me]);else{k.fl=true;NET.send({t:'nes',a:'th',k:i,x:X,y:Y,z:Z,vx,vy,vz})}}
/* F / tlačítko: zvednout nebo hodit napalovače; false = nic (pak popelnice) */
function grabKey(){const P=player;if(state!=='play'||!P||!canNes(P))return false;
  if(isKidO(P.carry)){if(P.attack>0)return true;nesThrowMe();return true}
  if(P.carry)return false;const k=nearDown(P);if(!k)return false;if(P.attack>0)return true;
  if(k.nap){if(isHost()){if(!napPick(P,k))return false}else{P.carry=k;P.carryT=performance.now();k.heldMe=performance.now();NET.send({t:'nes',a:'pk',n:k.pid})}
    toast('Napalovač nad hlavou (nejvýš 30 s) – hoď ho: F / Mezerník',1600);return true}
  if(isHost()){if(!nesPick(P,k))return false}else{P.carry=k;P.carryT=performance.now();k.heldMe=performance.now();NET.send({t:'nes',a:'pk',k:kids.indexOf(k)})}
  toast('Napalovač nad hlavou (nejvýš 30 s) – hoď ho: F / Mezerník',1600);return true}
/* zprávy od ostatních hráčů (jen hostitel) */
function onNes(m,e){if(m.n!==undefined){const n=ents.find(x=>x.pid===m.n&&x.nap);if(!n||!e||!canNes(e))return;
    if(m.a==='pk'){if(Math.hypot(n.pos.x-e.pos.x,n.pos.z-e.pos.z)<NES.reach+2.5)napPick(e,n)}
    else if(m.a==='th'&&n.hb===e){napFly(n,e,m.x,m.y,m.z,m.vx,m.vy,m.vz);NET.ev(['nt',n.pid,m.x,m.y,m.z,m.vx,m.vy,m.vz,e.pid])}return}
  const k=kids[m.k];if(!k||!e||!canNes(e))return;
  if(m.a==='pk'){if(Math.hypot(k.pos.x-e.pos.x,k.pos.z-e.pos.z)<NES.reach+2.5)nesPick(e,k)}
  else if(m.a==='th'&&k.st==='held'&&k.by===e){nesFly(k,e,m.x,m.y,m.z,m.vx,m.vy,m.vz);NET.ev(['kt',m.k,m.x,m.y,m.z,m.vx,m.vy,m.vz,e.pid])}}

/* ===================== NAPALOVAČ-HRÁČ PŘEMOŽEN ===================== */
/* leží a kope nohama (NAP.lez s); člen družiny ho může zvednout a hodit (NAP.hody× – teď 1); pak (nebo když ho nikdo nezvedne) jde na nové místo.
   rozhoduje hostitel (události nd/nh/nt/nc), pózu a let počítá každý prohlížeč */
function napBusy(n){return !!n&&(n.dn>0||!!n.hb||!!n.fl)}
function napDown(n,t,x,z){if(n.hb&&n.hb.carry===n)n.hb.carry=null;n.dn=t;n.hb=null;n.fl=null;n.dk=0;n.aiming=false;
  if(x!==undefined){n.pos.x=x;n.pos.z=z;n.tx=x;n.tz=z}if(n.isPlayer){aimMark.visible=false;if(n.thr>0)toast('Ha ha, nebolelo!',1200)}}
function napRelocate(n){const[gx,gz]=grpCenter(),[x,z]=napSpawn(gx,gz,35,55);napOut(n,x,z,NAP.out2);NET.ev(['nc',n.pid,q2(x),q2(z),NAP.out2])}
function napPick(e,n){if(!n||!(n.dn>0)||n.hb||n.fl||n.gone>0||!e||e.carry)return false;n.hb=e;n.hT=NES.max;n.ht=0;n.dn=0;e.carry=n;e.carryT=performance.now();
  NET.ev(['nh',n.pid,e.pid||NET.me]);return true}
function napHeld(n,e){if(!n||!e)return;n.hb=e;n.hT=NES.max;n.ht=0;n.dn=0;n.fl=null;e.carry=n;if(n.isPlayer)toast('Družina tě nese nad hlavou!',1400)}
function napFly(n,e,x,y,z,vx,vy,vz){if(e&&e.carry===n)e.carry=null;n.hb=null;n.dn=0;n.fl=true;n.by=e||null;n.fp=new THREE.Vector3(x,y,z);n.fv=new THREE.Vector3(vx,vy,vz);n.fT=0;n.spin=(e?e.face:0)+Math.PI/2;n.fhit=new Set();n.pos.x=x;n.pos.z=z}
function napLand(n){const x=q2(n.fp.x),z=q2(n.fp.z);n.pos.x=x;n.pos.z=z;pushOut(n.pos,.45);n.face=n.spin;n.fl=null;nesLimbs(n);puff(n.pos.x,n.pos.z);
  if(player&&Math.hypot(n.pos.x-player.pos.x,n.pos.z-player.pos.z)<25)cam.shake=Math.max(cam.shake||0,.06);
  if(!isHost()){n.dn=3;n.dk=0;return}
  n.thr=(n.thr||0)+1;if(n.thr>=NAP.hody){napRelocate(n);return}
  const t=q2(rnd(2.5,3.5)),X=q2(n.pos.x),Z=q2(n.pos.z);napDown(n,t,X,Z);NET.ev(['nd',n.pid,t,X,Z,0])}
function updNapDown(dt){
  for(const e of ents)if(e.carry&&e.carry.nap&&(!ents.includes(e.carry)||e.carry.gone>0||!e.carry.human))e.carry=null;
  for(const n of ents)if(n.nap&&!n.human&&napBusy(n)){n.dn=0;n.hb=null;n.fl=null}
  for(const n of ents){if(!n.nap||!n.human||n.gone>0)continue;
    if(n.fl){const landed=nesStep(n,dt);if(isHost())nesColl(n);if(landed)napLand(n);continue}
    if(n.hb){n.hT-=dt;if(isHost()&&(!ents.includes(n.hb)||n.hb.carry!==n||n.hT<=0)){if(n.hT<=0&&n.hb)award(n.hb,'msg',0,'Napalovač se ti vyškubl',1400);napRelocate(n)}continue}
    if(n.dn>0){n.dn-=dt;if(n.dn<=0){if(isHost())napRelocate(n);else n.dn=.01}}}}

/* ===================== POPELNICE (čert je může hodit) ===================== */
/* u domů (z editoru nebo náhodně) a popelnice postavené v editoru; čert ji zvedne (F / tlačítko), hodí ji (F / Udeřit) – zásah = 2 rány čerta */
const BIN={reach:1.7,max:12,g:9.8};
const bins=[];
/* klasická černá plastová popelnice 120 l: dole užší, víko s přesahem a závěsem vzadu, madlo a dvě kolečka vzadu */
function makeBinMesh(c){const g=new THREE.Group(),col=new THREE.MeshLambertMaterial({color:c||0x202020}),dk=lam(0x0d0d0d),inner=new THREE.Group();g.add(inner);
  const bg=new THREE.BoxGeometry(.5,.9,.58),pa=bg.attributes.position;for(let i=0;i<pa.count;i++)if(pa.getY(i)<0){pa.setX(i,pa.getX(i)*.84);pa.setZ(i,pa.getZ(i)*.86)}bg.computeVertexNormals();
  const body=new THREE.Mesh(bg,col);body.position.y=.5;inner.add(body);
  inner.add(box(.54,.05,.66,col,0,.97,.02),box(.5,.08,.04,col,0,.9,.31),box(.44,.02,.02,dk,0,.75,.3),box(.44,.02,.02,dk,0,.55,.27));
  const h=new THREE.Mesh(new THREE.CylinderGeometry(.022,.022,.46,8),dk);h.rotation.z=Math.PI/2;h.position.set(0,.98,-.33);inner.add(h,box(.04,.12,.05,col,-.2,.92,-.31),box(.04,.12,.05,col,.2,.92,-.31));
  for(const x of[-.21,.21]){const w=new THREE.Mesh(new THREE.CylinderGeometry(.1,.1,.06,12),dk);w.rotation.z=Math.PI/2;w.position.set(x,.1,-.27);inner.add(w)}
  const ax=new THREE.Mesh(new THREE.CylinderGeometry(.015,.015,.48,6),dk);ax.rotation.z=Math.PI/2;ax.position.set(0,.1,-.27);inner.add(ax);
  g.userData.inner=inner;return g}
function clearBins(){for(const b of bins)scene.remove(b.mesh);bins.length=0;if(player)player.carry=null}
function addBin(x,z,face,c,oid){const m=makeBinMesh(c);scene.add(m);const b={i:bins.length,mesh:m,pos:new THREE.Vector3(x,0,z),face,st:'idle',by:null,v:new THREE.Vector3(),spin:0,hit:new Set(),oid};bins.push(b);placeBin(b);return b}
function makeBins(){clearBins();
  B.forEach(b=>{if(!popel(b))return;const s=houseSpots(b);if(s.bin)addBin(s.bin[0],s.bin[1],s.face)});
  /* popelnice z editoru: ve hře se dají hodit (pevná kopie se skryje i s kolizí) */
  for(const o of UPR.o){if(o.k!=='popelnice')continue;const m=objMeshes.get(o.id);if(m)m.visible=false;
    const cl=CIRC.get(Math.floor(o.x/WC)+','+Math.floor(o.z/WC));if(cl){const j=cl.findIndex(q=>q[0]===o.x&&q[1]===o.z);if(j>=0)cl.splice(j,1)}
    addBin(o.x,o.z,(+o.rot||0)*Math.PI/180,o.c&&o.c!=='#3c5a3c'?new THREE.Color(o.c).getHex():0x202020,o.id)}}
function placeBin(b){const m=b.mesh,inn=m.userData.inner;
  if(b.st==='carry'&&b.by){const e=b.by;m.position.set(e.pos.x+Math.sin(e.face)*.1,e.pos.y+2.2,e.pos.z+Math.cos(e.face)*.1);m.rotation.set(0,e.face,0);inn.rotation.set(Math.PI/2,0,0);inn.position.set(0,0,-.5)}
  else if(b.st==='fly'){m.position.copy(b.pos);m.rotation.set(0,b.face,0);inn.rotation.set(b.spin,0,0);inn.position.set(0,-.5,0);inn.position.applyAxisAngle(new THREE.Vector3(1,0,0),b.spin);inn.position.y+=.5}
  else{b.pos.y=groundH(b.pos.x,b.pos.z);m.position.copy(b.pos);m.rotation.set(0,b.face,0);
    if(b.st==='lie'){inn.rotation.set(Math.PI/2,0,0);inn.position.set(0,.3,-.48)}else{inn.rotation.set(0,0,0);inn.position.set(0,0,0)}}}
const canBin=e=>e&&e.role==='cert';
function nearBin(e){let best=null,bd=BIN.reach;for(const b of bins){if(b.st!=='idle'&&b.st!=='lie')continue;const d=Math.hypot(b.pos.x-e.pos.x,b.pos.z-e.pos.z);if(d<bd){bd=d;best=b}}return best}
function pickBin(e,b){b.st='carry';b.by=e;e.carry=b;b.hit.clear()}
/* cíl hodu: nejbližší napalovač nebo útočící pes před čertem (do 12 m) */
function binAim(e){const fx=Math.sin(e.face),fz=Math.cos(e.face);let best=null,bs=1e9;
  for(const o of kids.concat(dogs)){if(o===e.carry||kOut(o)||o.st==='gone'||o.gone>0||(o.dog&&o.st==='home'&&Math.hypot(o.pos.x-e.pos.x,o.pos.z-e.pos.z)>BIN.max))continue;
    const dx=o.pos.x-e.pos.x,dz=o.pos.z-e.pos.z,d=Math.hypot(dx,dz);if(d>BIN.max+.5||d<.6)continue;const c=(dx*fx+dz*fz)/d;if(c<.8)continue;const s=d*(2-c);if(s<bs){bs=s;best=o}}
  return best}
function throwBin(e,b,x,y,z,vx,vy,vz){b.st='fly';b.by=e;e.carry=null;b.pos.set(x,y,z);b.v.set(vx,vy,vz);b.spin=0;b.face=e.face;b.hit.clear();b.t=0}
function binKey(){const P=player;if(state!=='play'||!canBin(P))return;
  if(P.carry){const b=P.carry,t=binAim(P);let tx,tz,ty;
    if(t){tx=t.pos.x;tz=t.pos.z;ty=t.pos.y+.5}else{tx=P.pos.x+Math.sin(P.face)*8;tz=P.pos.z+Math.cos(P.face)*8;ty=groundH(tx,tz)+.4}
    const sx=P.pos.x+Math.sin(P.face)*.4,sz=P.pos.z+Math.cos(P.face)*.4,sy=P.pos.y+1.7,d=Math.hypot(tx-sx,tz-sz),T=Math.max(.35,d/11);
    const vx=(tx-sx)/T,vz=(tz-sz)/T,vy=(ty-sy+.5*BIN.g*T*T)/T;throwBin(P,b,sx,sy,sz,vx,vy,vz);
    NET.send({t:'bin',a:'th',i:b.i,x:q2(sx),y:q2(sy),z:q2(sz),vx:q2(vx),vy:q2(vy),vz:q2(vz)});cam.shake=.1;return}
  const b=nearBin(P);if(!b){toast('Žádná popelnice poblíž',900);return}if(P.attack>0)return;pickBin(P,b);NET.send({t:'bin',a:'pk',i:b.i});toast('Popelnice nad hlavou – hoď ji (F / Udeřit)',1400)}
/* zprávy od ostatních hráčů */
function onBin(m,e){const b=bins[m.i];if(!b||!e)return;if(m.a==='pk'){if(b.by&&b.by.carry===b&&b.by!==e)b.by.carry=null;pickBin(e,b)}
  else if(m.a==='th'){throwBin(e,b,m.x,m.y,m.z,m.vx,m.vy,m.vz)}}
function binsSnap(){return bins.map(b=>[q2(b.pos.x),q2(b.pos.z),q2(b.face),b.st==='lie'?1:0])}
function binsApply(a){a.forEach((q,i)=>{const b=bins[i];if(!b||b.st==='fly'||b.st==='carry')return;b.pos.x=q[0];b.pos.z=q[1];b.face=q[2];b.st=q[3]?'lie':'idle'})}
function updBins(dt){
  for(const b of bins){
    if(b.st==='carry'){const e=b.by;if(!e||!ents.includes(e)||e.carry!==b){b.st='lie';b.by=null}else{const u=e.mesh.userData;if(e.attack<=0){u.armL.rotation.x=u.armR.rotation.x=-2.9;u.armL.rotation.z=-.15;u.armR.rotation.z=.15}}}
    else if(b.st==='fly'){b.t+=dt;b.v.y-=BIN.g*dt;b.pos.addScaledVector(b.v,dt);b.spin+=dt*7;
      /* zásah počítá hostitel */
      if(isHost()&&b.by)for(const o of kids.concat(dogs)){if(b.hit.has(o)||kOut(o)||o.st==='gone'||o.gone>0)continue;
        const d=Math.hypot(o.pos.x-b.pos.x,o.pos.z-b.pos.z),gy0=groundH(o.pos.x,o.pos.z);if(d<1.0&&b.pos.y<gy0+(o.dog?1.1:1.8)&&b.pos.y>gy0-.2){b.hit.add(o);puff(o.pos.x,o.pos.z);
          if(o.dog)hitDog(b.by,o,2);else hitKid(b.by,o,2);b.v.x*=-.25;b.v.z*=-.25;b.v.y=Math.max(b.v.y,1.5)}}
      const gh=groundH(b.pos.x,b.pos.z);
      if(b.pos.y<=gh||b.t>4||(b.t>.15&&insideAny(b.pos.x,b.pos.z,.1)&&b.pos.y<gh+3)){b.pos.y=gh;pushOut(b.pos,.4);if(insideAny(b.pos.x,b.pos.z,.3)){const ox=b.pos.x-b.v.x*.05,oz=b.pos.z-b.v.z*.05;b.pos.x=ox;b.pos.z=oz;pushOut(b.pos,.45)}
        b.face=Math.atan2(b.v.x,b.v.z);b.st='lie';b.by=null;puff(b.pos.x,b.pos.z);if(Math.hypot(b.pos.x-player.pos.x,b.pos.z-player.pos.z)<25)cam.shake=Math.max(cam.shake||0,.06)}}
    placeBin(b)}
  /* tlačítko na dotyku */
  const P=player,kc=isKidO(P.carry),kd=!P.carry&&canNes(P)&&!!nearDown(P),show=kc||kd||(canBin(P)&&(!!P.carry||!!nearBin(P)));const tb=$('tBin');if(tb){tb.classList.toggle('hide',!show||!isTouch);tb.innerHTML=P.carry?'Hodit':kd?'Zved&shy;nout':'Popel&shy;nice'}
  const left=kc?Math.max(0,Math.ceil(isHost()&&P.carry.st==='held'?P.carry.hT:NES.max-(performance.now()-(P.carryT||0))/1000)):0;
  const hint=$('binHint');if(hint){hint.classList.toggle('hide',!show||isTouch);hint.textContent=kc?`F nebo Mezerník: hodit napalovače (vyškubne se za ${left} s)`:kd?'F: zvednout napalovače':P.carry?'F nebo Mezerník: hodit popelnici':'F: zvednout popelnici'}
  if(isTouch&&kc&&left<=5){const tl=$('tBin');if(tl)tl.innerHTML='Hodit '+left}}


/* ===================== KOLA U DOMŮ (nasednout může kdokoliv) ===================== */
/* pomalá jízda = rychlost běhu (výdrž se doplňuje jako při chůzi), rychlá jízda = 2× běh (ubírá výdrž jako běh) */
const BIKE={reach:1.8,cols:[0xb3261e,0x1f4fa8,0x2e7d32,0x222222,0xe0e0e0,0x7b1fa2]};
const bikes=[];
function makeBikeMesh(c){const g=new THREE.Group(),fr=lam(c),blk=lam(0x111111),met=lam(0x9aa0a6);
  const rod=(len,th,mat,x,y,z,rx)=>{const m=new THREE.Mesh(new THREE.CylinderGeometry(th,th,len,6),mat);m.position.set(x,y,z);m.rotation.x=rx||0;return m};
  const wheel=z=>{const w=new THREE.Group();w.position.set(0,.34,z);const t=new THREE.Mesh(new THREE.TorusGeometry(.31,.035,6,18),blk);t.rotation.y=Math.PI/2;w.add(t);
    for(let i=0;i<3;i++){const sp=rod(.6,.006,met,0,0,0,i*Math.PI/3);w.add(sp)}const hub=rod(.1,.03,met,0,0,0,0);hub.rotation.z=Math.PI/2;w.add(hub);return w};
  const wf=wheel(.52),wr=wheel(-.5);g.add(wf,wr);
  /* rám: horní a spodní trubka, sedlová trubka, zadní stavba, vidlice */
  g.add(rod(.62,.025,fr,0,.82,.05,Math.PI/2+.08),rod(.72,.025,fr,0,.6,.06,Math.PI/2-.55),rod(.52,.025,fr,0,.62,-.18,-.25),
    rod(.5,.02,fr,0,.38,-.32,Math.PI/2+.05),rod(.55,.02,fr,0,.58,-.36,-.95),rod(.6,.022,fr,0,.62,.45,.3));
  g.add(box(.12,.04,.24,blk,0,.92,-.24));/* sedlo */
  g.add(rod(.1,.015,met,0,.87,-.22,0));
  const bar=rod(.5,.018,blk,0,1.02,.36,0);bar.rotation.z=Math.PI/2;g.add(bar,rod(.2,.018,met,0,.93,.39,.3));
  const crank=new THREE.Group();crank.position.set(0,.36,0);crank.add(box(.04,.04,.34,met,.07,0,0),box(.04,.04,.34,met,-.07,0,0));const disc=new THREE.Mesh(new THREE.CylinderGeometry(.08,.08,.03,12),met);disc.rotation.z=Math.PI/2;disc.position.set(0,.36,0);g.add(crank,disc);
  g.userData={wf,wr,crank};return g}
function clearBikes(){for(const k of bikes)scene.remove(k.mesh);bikes.length=0;for(const e of ents)e.bike=null}
function addBike(x,z,face,seed){const m=makeBikeMesh(BIKE.cols[seed%BIKE.cols.length]);scene.add(m);const k={i:bikes.length,mesh:m,pos:new THREE.Vector3(x,0,z),face,by:null,rot:0};bikes.push(k);placeBike(k,0);return k}
function makeBikes(){clearBikes();B.forEach(b=>{if(!kolo(b))return;const s=houseSpots(b);if(s.bike)addBike(s.bike[0],s.bike[1],s.bface,b.i)})}
function placeBike(k,dt){const m=k.mesh,u=m.userData;
  if(k.by){const e=k.by;k.pos.copy(e.pos);k.face=e.face;k.rot+=(e.spd||0)*dt/.34;m.position.set(e.pos.x,groundH(e.pos.x,e.pos.z)+.02,e.pos.z);m.rotation.set(0,e.face,0)}
  else{m.position.set(k.pos.x,groundH(k.pos.x,k.pos.z)+.02,k.pos.z);m.rotation.set(0,k.face,.1)}
  u.wf.rotation.x=u.wr.rotation.x=k.rot;u.crank.rotation.x=k.rot*.6}
function nearBike(e){let best=null,bd=BIKE.reach;for(const k of bikes){if(k.by)continue;const d=Math.hypot(k.pos.x-e.pos.x,k.pos.z-e.pos.z);if(d<bd){bd=d;best=k}}return best}
function mountBike(e,k){if(k.by&&k.by!==e)k.by.bike=null;k.by=e;e.bike=k;e.pos.x=k.pos.x;e.pos.z=k.pos.z;e.face=k.face}
function dismountBike(e,x,z,f){const k=e.bike;if(!k)return;k.by=null;e.bike=null;
  if(x===undefined){x=e.pos.x+Math.cos(e.face)*.7;z=e.pos.z-Math.sin(e.face)*.7;f=e.face}k.pos.set(x,0,z);k.face=f;placeBike(k,0)}
/* klávesa B / tlačítko Kolo: nasednout nebo sesednout */
function bikeKey(){const P=player;if(state!=='play'||!P||P.ride)return;
  if(P.bike){offBike();return}
  if(P.carry){toast(isKidO(P.carry)?'Nejdřív hoď napalovače':'Nejdřív hoď popelnici',900);return}
  const k=nearBike(P);if(!k){toast('Žádné kolo poblíž',900);return}mountBike(P,k);NET.send({t:'kolo',a:'on',i:k.i});
  toast('Jedeš na kole – Shift / Běh = rychle (bere sílu), B = sesednout',2000)}
/* sesednutí hráče (volá se i před útokem, strašením a popelnicí) */
function offBike(){const P=player;if(!P||!P.bike)return;const k=P.bike;dismountBike(P);NET.send({t:'kolo',a:'off',i:k.i,x:q2(k.pos.x),z:q2(k.pos.z),f:q2(k.face)})}
function onKolo(m,e){const k=bikes[m.i];if(!k||!e)return;if(m.a==='on')mountBike(e,k);else if(m.a==='off'){if(e.bike===k)dismountBike(e,m.x,m.z,m.f);else{k.by=null;k.pos.set(m.x,0,m.z);k.face=m.f}}}
function bikesSnap(){return bikes.map(k=>[q2(k.pos.x),q2(k.pos.z),q2(k.face)])}
function bikesApply(a){a.forEach((q,i)=>{const k=bikes[i];if(!k||k.by)return;k.pos.x=q[0];k.pos.z=q[1];k.face=q[2]})}
/* jezdec: sedí na sedle, šlape, ruce na řídítkách */
function riderPose(e){const u=e.mesh.userData,k=e.bike;e.mesh.position.y+=.32;e.mesh.position.x-=Math.sin(e.face)*.12;e.mesh.position.z-=Math.cos(e.face)*.12;
  const a=k.rot*.6;u.legL.rotation.x=-1.1+Math.sin(a)*.45;u.legR.rotation.x=-1.1-Math.sin(a)*.45;
  if(!u.attack){u.armL.rotation.x=u.armR.rotation.x=-1.15;u.armL.rotation.z=-.12;u.armR.rotation.z=.12}}
function updBikes(dt){for(const e of ents){if(e.bike&&e.bike.by!==e)e.bike=null;if(e.bike)riderPose(e)}
  for(const k of bikes){if(k.by&&!ents.includes(k.by))k.by=null;placeBike(k,dt)}
  const P=player,show=!!P&&(!!P.bike||!!nearBike(P)),tb=$('tKolo');if(tb){tb.classList.toggle('hide',!show||!isTouch);tb.textContent=P&&P.bike?'Sesed':'Kolo'}
  const h=$('koloHint');if(h){h.classList.toggle('hide',!show||isTouch||!!(P&&P.carry));h.textContent=P&&P.bike?'Shift: rychlá jízda · B: sesednout':'B: nasednout na kolo'}}

const projV=new THREE.Vector3();
function placeBubbles(){for(const x of XB){const o=x.o;if(!o._bub||o._bub.classList.contains('hide'))continue;projV.set(o.pos.x,(o.pos.y||0)+x.h,o.pos.z).project(camera);
  if(projV.z>1||Math.abs(projV.x)>1.1||Math.abs(projV.y)>1.1){o._bub.style.display='none';continue}o._bub.style.display='';o._bub.style.left=((projV.x+1)/2*innerWidth)+'px';o._bub.style.top=((1-projV.y)/2*innerHeight)+'px'}
for(const k of kids){if(k.bub.classList.contains('hide'))continue;projV.set(k.pos.x,2.05,k.pos.z).project(camera);
  if(projV.z>1||Math.abs(projV.x)>1.1||Math.abs(projV.y)>1.1){k.bub.style.display='none';continue}k.bub.style.display='';
  k.bub.style.left=((projV.x+1)/2*innerWidth)+'px';k.bub.style.top=((1-projV.y)/2*innerHeight)+'px'}
  for(const g of dogs){if(g.bub.classList.contains('hide'))continue;projV.set(g.pos.x,g.pos.y+1.25,g.pos.z).project(camera);
    if(projV.z>1||Math.abs(projV.x)>1.1||Math.abs(projV.y)>1.1){g.bub.style.display='none';continue}g.bub.style.display='';
    g.bub.style.left=((projV.x+1)/2*innerWidth)+'px';g.bub.style.top=((1-projV.y)/2*innerHeight)+'px'}}

/* ===================== OBYVATELÉ DOMŮ ===================== */
/* když družina přijde k domu: otevřou se dveře a obyvatelé vyjdou ven před dům; po odchodu družiny se vrátí a dveře zavřou (počítá každý prohlížeč sám) */
const RES=[];
const COATS=[0x6d4c41,0x37474f,0x546e7a,0x8d6e63,0x455a64,0x5d4037,0x3e5641,0x7b3f3f],DRESS=[0x8e3b46,0x4a5a8a,0x6a4c7a,0x2f6f6a,0x9a6a3a,0x5b6b3b],HAIRC=[0x3b2a1e,0x6b4a2b,0x9a7b4f,0x2a2522,0xc9a46a,0x8f8a85];
function makePerson(kind,seed){const H=n=>((seed*2654435761+n*97)>>>0)%1000/1000,pick=(a,n)=>a[Math.floor(H(n)*a.length)];
  const g=new THREE.Group(),skin=lam(0xf1c9a0),hair=lam(pick(HAIRC,1)),child=kind==='h'||kind==='k',fem=kind==='z'||kind==='h';
  const top=lam(fem?pick(DRESS,2):pick(child?JACKETS:COATS,2)),pants=lam(fem?0x3a3a44:pick([0x2b4c7e,0x3a3a3a,0x4e4a42],3));
  const legL=limb(.17,.82,.19,pants,-.11,.82,0),legR=limb(.17,.82,.19,pants,.11,.82,0);
  const body=box(.52,.72,.3,top,0,1.18,0);
  const head=new THREE.Mesh(new THREE.SphereGeometry(.2,10,8),skin);head.position.y=1.76;
  const armL=limb(.13,.66,.15,top,-.33,1.5,0),armR=limb(.13,.66,.15,top,.33,1.5,0);
  g.add(legL,legR,body,head,armL,armR);
  if(fem){const sk=new THREE.Mesh(new THREE.CylinderGeometry(.27,.36,.5,10),top);sk.position.y=.62;g.add(sk);
    const hb=box(.38,.42,.12,hair,0,1.68,-.15);g.add(hb);const ht=new THREE.Mesh(new THREE.SphereGeometry(.21,10,6,0,Math.PI*2,0,Math.PI/2),hair);ht.position.y=1.78;g.add(ht)}
  else{const ht=new THREE.Mesh(new THREE.SphereGeometry(.205,10,6,0,Math.PI*2,0,Math.PI/2.4),hair);ht.position.y=1.79;g.add(ht);
    if(kind==='k'){const cap=new THREE.Mesh(new THREE.SphereGeometry(.215,10,6,0,Math.PI*2,0,Math.PI/2),lam(pick(JACKETS,4)));cap.position.y=1.8;g.add(cap)}}
  for(const sx of[-.075,.075]){const eye=box(.04,.04,.02,lam(0x222222),sx,1.79,.19);g.add(eye)}
  const s=child?.62+H(5)*.12:fem?.94+H(5)*.05:1+H(5)*.06;g.scale.setScalar(s);
  g.userData={legL,legR,armL,armR};return g}
function resGroup(i){const o=route[i],b=o.b,ob=obyv(b),n=ob.m+ob.z+ob.h+ob.k;if(!n||!b.door)return null;
  const d=b.door,E=d.E,dv=b.ov.dv||{},dw=+dv.w||1,dh=+dv.h||2.12,cp=d.cp,ry=Math.atan2(E.nx,E.nz),gh=gyC(cp[0],cp[1]);
  const ux=Math.cos(ry),uz=-Math.sin(ry);   /* směr podél stěny (lokální osa x dveří) */
  const G={ri:i,b,cp,E,ux,uz,open:0,leave:0,people:[],door:null};
  if(d.drawn){const piv=new THREE.Group();piv.position.set(cp[0]+E.nx*.12-ux*dw/2,gh,cp[1]+E.nz*.12-uz*dw/2);piv.rotation.y=ry;
    const leaf=box(dw,dh,.06,lam(dv.c||'#5a3a24'),dw/2,dh/2,0),knob=box(.08,.08,.06,lam(0xc9a227),dw-.15,Math.min(1,dh*.47),.06);piv.add(leaf,knob);
    const hole=new THREE.Mesh(new THREE.PlaneGeometry(dw,dh),new THREE.MeshBasicMaterial({color:0x6b4a24}));hole.position.set(cp[0]+E.nx*.105,gh+dh/2,cp[1]+E.nz*.105);hole.rotation.y=ry;hole.visible=false;
    scene.add(piv,hole);G.door={piv,hole,ry}}
  /* místa před domem: dospělí u zdi po stranách dveří, děti před nimi */
  const kinds=[...Array(ob.m).fill('m'),...Array(ob.z).fill('z'),...Array(ob.h).fill('h'),...Array(ob.k).fill('k')];
  let ai=0,ci=0;const side=j=>(j%2?1:-1)*(1.3+Math.floor(j/2)*.8);
  kinds.forEach((k,j)=>{const ch=k==='h'||k==='k',lat=ch?side(ci++)*.75:side(ai++),out=ch?1.9:.95;
    const sp={x:cp[0]+E.nx*out+ux*lat,z:cp[1]+E.nz*out+uz*lat};pushOut(sp,.35);
    const m=makePerson(k,b.i*13+j);m.visible=false;scene.add(m);
    G.people.push({k,mesh:m,pos:new THREE.Vector3(cp[0]-E.nx*.3,gh,cp[1]-E.nz*.3),face:ry,phase:rnd(0,6),slot:sp,st:'in',wp:0,delay:.9+j*.55,wave:0,t:rnd(0,5)})});
  return G}
function resPts(G,p){const{cp,E}=G;return [[cp[0]-E.nx*.3,cp[1]-E.nz*.3],[cp[0]+E.nx*.7,cp[1]+E.nz*.7],[p.slot.x,p.slot.z]]}
function resWalk(p,tx,tz,dt){const dx=tx-p.pos.x,dz=tz-p.pos.z,d=Math.hypot(dx,dz);if(d<.06)return true;const s=Math.min(1.3*dt,d);p.pos.x+=dx/d*s;p.pos.z+=dz/d*s;
  let a=Math.atan2(dx,dz)-p.face;a=Math.atan2(Math.sin(a),Math.cos(a));p.face+=a*Math.min(1,dt*9);p.phase+=s*2.8;return false}
/* kdo z obyvatel právě mluví (střídají se dospělí, občas dítě) a kam se dívá Mikuláš */
function resSpeaker(G){const st=G.people.filter(p=>p.st==='stand');if(!st.length)return null;const ad=st.filter(p=>p.k==='m'||p.k==='z'),pool=ad.length?ad.concat(st.length>ad.length?[st[ad.length]]:[]):st;
  G.talkT=(G.talkT||0);return pool[Math.floor(G.talkT/3.2)%pool.length]}
function resFocus(){const G=RES.find(G=>G.ri===ri&&!G.dead);if(!G)return null;const sp=G.people.find(q=>q.ans>0&&q.st==='stand')||resSpeaker(G);return sp?[sp.pos.x,sp.pos.z]:null}
function clearRes(){for(const G of RES){for(const p of G.people)scene.remove(p.mesh);if(G.door){scene.remove(G.door.piv,G.door.hole)}}RES.length=0}
function updRes(dt){
  if(grp.phase==='visit'&&route[ri]&&!RES.some(G=>G.ri===ri)){const G=resGroup(ri);if(G)RES.push(G);else RES.push({ri,people:[],dead:true})}
  const L=leader();
  for(let gi=RES.length-1;gi>=0;gi--){const G=RES[gi];if(G.dead){if(G.ri!==ri)RES.splice(gi,1);continue}
    const active=grp.phase==='visit'&&ri===G.ri;if(!active)G.leave+=dt;else G.talkT=(G.talkT||0)+dt;let moving=false,inside=0;
    for(const p of G.people){const P3=resPts(G,p);p.t+=dt;
      if(active&&p.st==='in'){p.delay-=dt;if(p.delay<=0&&G.open>.6){p.st='out';p.wp=1;p.mesh.visible=true}}
      if(!active&&p.st!=='in'&&p.st!=='back'&&G.leave>1.2+p.delay*.6){p.st='back';p.wp=1}
      if(!active&&p.st==='in')p.delay=0;
      let spd=0;
      if(p.st==='out'){moving=true;if(resWalk(p,P3[p.wp][0],P3[p.wp][1],dt)){if(p.wp<2)p.wp++;else{p.st='stand';p.wave=p.k==='m'||p.k==='z'?1.6:0}}spd=1}
      else if(p.st==='back'){moving=true;if(resWalk(p,P3[p.wp][0],P3[p.wp][1],dt)){if(p.wp>0)p.wp--;else{p.st='in';p.mesh.visible=false}}spd=1}
      else if(p.st==='stand'){const tx=L?L.pos.x:G.cp[0]+G.E.nx*3,tz=L?L.pos.z:G.cp[1]+G.E.nz*3,ansP=G.people.find(q=>q.ans>0);if(p.ans>0)p.ans-=dt;if(p.joy>0)p.joy-=dt;p.talk=active&&(ansP?p===ansP:p===resSpeaker(G)&&L&&Math.hypot(L.pos.x-p.pos.x,L.pos.z-p.pos.z)<5);let a=Math.atan2(tx-p.pos.x,tz-p.pos.z)-p.face;a=Math.atan2(Math.sin(a),Math.cos(a));p.face+=a*Math.min(1,dt*3)}
      if(p.st==='in')inside++;
      const u=p.mesh.userData;p.pos.y=groundH(p.pos.x,p.pos.z);
      let hop=0;if(p.st==='stand'){
        if(p.wave>0){p.wave-=dt;u.armR.rotation.x=-2.6;u.armR.rotation.z=Math.sin(p.t*9)*.35;if(p.wave<=0){u.armR.rotation.x=0;u.armR.rotation.z=0}}
        else if(p.talk){/* mluví s Mikulášem: gestikuluje */const g=Math.sin(p.t*3.1),h2=Math.sin(p.t*2.3+1);u.armR.rotation.x=-.55-.35*Math.max(0,g);u.armR.rotation.z=.15*h2;u.armL.rotation.x=-.25-.25*Math.max(0,-g);u.armL.rotation.z=0}
        else{u.armL.rotation.x=u.armR.rotation.x=Math.sin(p.t*1.3)*.05;u.armL.rotation.z=u.armR.rotation.z=0}
        if(p.k==='h'||p.k==='k'){/* děti poskakují, když je blízko strašící člen družiny */const sc=ents.some(e=>e.role!=='mikulas'&&(e.scareT>0||grp.phase==='visit'&&e.st2>0)&&Math.hypot(e.pos.x-p.pos.x,e.pos.z-p.pos.z)<4);
          if(sc||p.joy>0)hop=Math.abs(Math.sin(p.t*7))*.12}
        u.legL.rotation.x=u.legR.rotation.x=0}
      else animWalk(p.mesh,p.phase,spd?.8:0);
      p.mesh.position.set(p.pos.x,p.pos.y+hop,p.pos.z);p.mesh.rotation.y=p.face}
    const want=moving&&G.people.some(p=>(p.st==='out'&&p.wp<=1)||(p.st==='back'&&p.wp===0))||(active&&G.people.some(p=>p.st==='in'&&p.delay<.8));
    G.open=clamp(G.open+(want?1.6:-1.1)*dt,0,1);
    if(G.door){G.door.piv.rotation.y=G.door.ry-1.75*G.open*G.open*(3-2*G.open);G.door.hole.visible=G.open>.02}
    if(!active&&inside===G.people.length&&G.open<=0&&G.leave>2){for(const p of G.people)scene.remove(p.mesh);if(G.door)scene.remove(G.door.piv,G.door.hole);RES.splice(gi,1)}}}

/* ===================== MIKULÁŠ SE PTÁ DĚTÍ ===================== */
/* U domu s družinou (hráč = Mikuláš): 1–3 = otázka, dítě odpoví, pak Q / N / tlačítko = nadílka (+5) a družina jde k dalšímu domu. */
const OTAZKY=['Umíš se modlit?','Poslouchal jsi?','Jakou máme adventní neděli?'];
const XB=[];
function xsay(o,h,t,ms){if(!o._bub){o._bub=document.createElement('div');o._bub.className='bub long hide';$('bubbles').appendChild(o._bub);XB.push({o,h})}
  const x=XB.find(x=>x.o===o);if(x)x.h=h;o._bub.textContent=t;o._bub.classList.remove('hide');o._bubT=ms||2500}
function adventN(){/* adventní týden: dnes, je-li advent, jinak 5. prosince (Mikulášská obchůzka) */
  const t=new Date(),y=t.getFullYear(),s4=new Date(y,11,24-new Date(y,11,24).getDay()),s1=new Date(s4.getFullYear(),s4.getMonth(),s4.getDate()-21),end=new Date(y,11,25);
  const d=t>=s1&&t<end?t:new Date(y,11,5,18);if(d<s1)return 0;return Math.min(4,1+Math.floor((d-s1)/(7*864e5)))}
function otzAnswer(q,p,a){const ch=p.k==='h'||p.k==='k',f=p.k==='h'||p.k==='z',pick=l=>l[a%l.length];
  if(q===0)return ch?pick(['Andělíčku, můj strážníčku, opatruj mou dušičku!','Umím! Andělíčku, můj strážníčku, opatruj mou dušičku, ať je čistá jako křída, ať ji nikdo nepokydá.','Otče náš, jenž jsi na nebesích, posvěť se jméno tvé…','Trošku… Andělíčku, můj strážníčku!'])
    :pick(['Děti tu nemáme, ale pomodlíme se – Otče náš…','Umíme, Mikuláši. Otče náš, jenž jsi na nebesích…']);
  if(q===1)return ch?(f?pick(['Poslouchala! Uklízím si hračky.','Ano, pomáhám mamince.','Trochu jsem zlobila… už budu hodná!']):pick(['Poslouchal! Skoro vždycky.','Jo, a pomáhal jsem tátovi se dřevem.','Jednou jsem zlobil… ale už budu hodný!']))
    :pick(['Děti tu nemáme, ale snažíme se být hodní!',f?'Já poslouchám vždycky, Mikuláši!':'Snažím se, Mikuláši!']);
  const n=adventN(),O=['','první','druhou','třetí','čtvrtou'],J=['','železnou','bronzovou','stříbrnou','zlatou'],S=['','svítí jedna svíčka','svítí dvě svíčky','svítí tři svíčky','svítí čtyři svíčky'];
  if(!n)return 'Advent ještě nezačal, Mikuláši!';
  return pick([`${O[n][0].toUpperCase()+O[n].slice(1)}, ${J[n]}!`,`Už ${O[n]} – na věnci ${S[n]}.`,n<4?`Zlatou? … Ne, ${J[n]}!`:`${J[n][0].toUpperCase()+J[n].slice(1)}, už brzy budou Vánoce!`])}
let otz={ri:-1,st:0,q:-1,a:0,t:0};
function otzReset(){otz={ri,st:0,q:-1,a:0,t:0}}
function otzG(){return RES.find(G=>G.ri===ri&&!G.dead)}
function otzAsk(i){const P=player;if(!P||P.role!=='mikulas'||state!=='play'||grp.phase!=='visit')return;if(otz.ri!==ri)otzReset();
  if(otz.st===1)return;if(otz.st===3){toast('Nadílka už je rozdaná – veď družinu dál',1300);return}
  const G=otzG();if(!G||!G.people.length){toast('V tomhle domě nikdo není',1200);return}
  if(Math.hypot(P.pos.x-grp.door.x,P.pos.z-grp.door.z)>6){toast('Přijď blíž ke dveřím',1200);return}
  const a=Math.floor(Math.random()*1000);otzDo(P,i,a);NET.send({t:'otz',a:'q',q:i,r:a,ri})}
function otzDo(L,i,a){if(otz.ri!==ri)otzReset();otz.q=i;otz.a=a;otz.st=1;otz.t=1.6;xsay(L,2.45,OTAZKY[i],2600)}
function otzGive(){const P=player;if(!P||P.role!=='mikulas'||grp.phase!=='visit')return;if(otz.ri!==ri)otzReset();
  if(otz.st===3)return;if(otz.st!==2){toast('Nejdřív se dětí na něco zeptej (1–3)',1300);return}otzGiveDo(P);NET.send({t:'otz',a:'n',ri})}
function otzGiveDo(L){if(otz.ri!==ri)otzReset();otz.st=3;xsay(L,2.45,'Tady máte nadílku!',2000);
  const G=otzG();if(G){let j=0;for(const p of G.people){if(p.st!=='stand')continue;p.joy=2.5;if(p.k==='h'||p.k==='k'||j===0){if(j<3)xsay(p,p.k==='h'||p.k==='k'?1.5:2.1,['Děkujeme!','Děkuju, Mikuláši!','Jů, čokoláda!'][j%3],1800);j++}}}
  if(isHost()){award(L,'nad',CFG.bodyNadilka,`Nadílka předána! +${CFG.bodyNadilka} · veď družinu k dalšímu domu`,1800);grp.t=Math.min(grp.t,2.5)}}
function updOtz(dt){if(otz.ri!==ri)otzReset();
  for(const x of XB){const o=x.o;if(o._bubT>0){o._bubT-=dt*1000;if(o._bubT<=0)o._bub.classList.add('hide')}if(o.mesh&&!o.mesh.parent&&o._bub)o._bub.classList.add('hide')}
  if(otz.st===1&&grp.phase==='visit'){otz.t-=dt;if(otz.t<=0){const G=otzG(),st=G?G.people.filter(p=>p.st==='stand'):[];
    if(st.length){const ch=st.filter(p=>p.k==='h'||p.k==='k'),pool=ch.length?ch:st,p=pool[otz.a%pool.length],t=otzAnswer(otz.q,p,otz.a);
      p.ans=Math.max(2.5,t.length*.07);xsay(p,p.k==='h'||p.k==='k'?1.5:2.1,t,p.ans*1000+400);otz.st=2;
      if(player.role==='mikulas')setTimeout(()=>{if(otz.st===2&&state==='play')toast(`Teď dej dětem nadílku (${isTouch?'tlačítko':'Q'})`,1500)},Math.min(2500,p.ans*600))}
    else if(G&&!G.people.length)otz.st=0}}
  const P=player,el=$('otz');if(!el||!P)return;const G=otzG(),show=state==='play'&&P.role==='mikulas'&&grp.phase==='visit'&&G&&G.people.length&&otz.st<3;
  el.classList.toggle('hide',!show);if(!show)return;
  el.querySelectorAll('button[data-q]').forEach(b=>b.disabled=otz.st===1);$('otzN').classList.toggle('hide',otz.st!==2);$('otzN').textContent=isTouch?'Dát nadílku':'Q · Dát nadílku'}
document.querySelectorAll('#otz button[data-q]').forEach(b=>b.addEventListener('click',e=>{e.preventDefault();otzAsk(+b.dataset.q)}));
$('otzN').addEventListener('click',e=>{e.preventDefault();otzGive()});

/* ===================== MINIMAPA ===================== */
const mapBg=document.createElement('canvas');
{const bx=M.box,w=bx[2]-bx[0],h=bx[3]-bx[1];mapBg.width=w;mapBg.height=h;const x=mapBg.getContext('2d');
 x.fillStyle='#1a2540';x.fillRect(0,0,w,h);x.lineCap='round';x.lineJoin='round';const P=p=>[p[0]-bx[0],p[1]-bx[1]];
 x.strokeStyle='#4f78a8';for(const r of M.w){x.lineWidth=r.w;x.beginPath();r.p.forEach((p,i)=>{const[a,b]=P(p);i?x.lineTo(a,b):x.moveTo(a,b)});x.stroke()}
 x.strokeStyle='#8a93a8';for(const r of M.r){x.lineWidth=Math.max(1.5,r.w);x.beginPath();r.p.forEach((p,i)=>{const[a,b]=P(p);i?x.lineTo(a,b):x.moveTo(a,b)});x.stroke()}
 x.fillStyle='#d6dbe6';for(const b of B){x.beginPath();b.p.forEach((p,i)=>{const[a,c]=P(p);i?x.lineTo(a,c):x.moveTo(a,c)});x.closePath();x.fill()}
 x.strokeStyle='#d1495b';x.lineWidth=2.5;x.setLineDash([6,5]);x.beginPath();M.poly.forEach((p,i)=>{const[a,b]=P(p);i?x.lineTo(a,b):x.moveTo(a,b)});x.closePath();x.stroke()}
const mapC=$('map'),mx=mapC.getContext('2d');
/* velká mapa: klik na minimapu zvětší, klik / ✕ / Esc / M zmenší */
let mapBig=false,navOn=store('obchuzka-navadeni')===1;
function setMapBig(on){mapBig=on;mapC.classList.toggle('big',on);$('mapCtl').classList.toggle('hide',!on);$('mapBack').classList.toggle('hide',!on);
  mapC.width=mapC.height=on?800:300;navLbl();if(state==='play')drawMap()}
function navLbl(){if(!player)return;$('bNav').textContent=(player.nap?'Navádění k Mikulášovi: ':'Navádění k domu: ')+(navOn?'zap':'vyp');$('bNav').setAttribute('aria-pressed',navOn)}
mapC.addEventListener('click',()=>{if(state==='play')setMapBig(!mapBig)});
$('mapBack').addEventListener('click',()=>setMapBig(false));$('bMapClose').onclick=()=>setMapBig(false);
$('bNav').onclick=()=>{navOn=!navOn;store('obchuzka-navadeni',navOn?1:0);navLbl()};
addEventListener('keydown',e=>{if(state!=='play')return;const k=e.key.toLowerCase();if(k==='m')setMapBig(!mapBig);else if(mapBig&&k==='escape'){e.stopImmediatePropagation();setMapBig(false)}},true);
function drawMap(){const W=mapC.width,R=W/2,sc=W/(mapBig?420:160),f=mapBig?1.7:1,bx=M.box,P=player,blink=.5+.5*Math.sin(performance.now()/180);
  mx.save();mx.clearRect(0,0,W,W);mx.beginPath();if(mapBig)mx.rect(0,0,W,W);else mx.arc(R,R,R,0,Math.PI*2);mx.clip();mx.fillStyle='#1a2540';mx.fillRect(0,0,W,W);
  mx.translate(R,R);mx.rotate(cam.yaw);mx.scale(sc,sc);mx.translate(-(P.pos.x-bx[0]),-(P.pos.z-bx[1]));mx.drawImage(mapBg,0,0);
  /* domy na trase: hotové šedě, další bíle, aktuální bliká modře */
  route.forEach((o,i)=>{if(i===ri)return;mx.fillStyle=i<ri?(o.with?'#b8c0cc':'#5d6675'):'rgba(255,255,255,.5)';mx.beginPath();mx.arc(o.b.cx-bx[0],o.b.cz-bx[1],2.2*f,0,Math.PI*2);mx.fill()});
  const o=route[ri];if(o){const x=o.b.cx-bx[0],z=o.b.cz-bx[1];mx.globalAlpha=.25+.75*blink;mx.fillStyle='#3b82f6';mx.beginPath();mx.arc(x,z,(4+1.5*blink)*f,0,Math.PI*2);mx.fill();
    mx.globalAlpha=1-.6*blink;mx.strokeStyle='#93c5fd';mx.lineWidth=1.2*f;mx.beginPath();mx.arc(x,z,(6+4*blink)*f,0,Math.PI*2);mx.stroke();mx.globalAlpha=1}
  /* spoluhráči zeleně (Mikuláš větší s bílým okrajem), protivníci červeně */
  for(const e of ents){if(e.isPlayer)continue;if(e.nap&&(!e.human||e.gone>0))continue;const x=e.pos.x-bx[0],z=e.pos.z-bx[1],mk=e.role==='mikulas';mx.fillStyle=e.nap?'#ef4444':'#22c55e';mx.beginPath();mx.arc(x,z,(mk?3:e.human?2.6:1.9)*f,0,Math.PI*2);mx.fill();
    if(mk||e.human){mx.strokeStyle='#fff';mx.lineWidth=.8*f;mx.stroke()}}
  mx.fillStyle='#b91c1c';for(const t of tractors){mx.fillRect(t.pos.x-bx[0]-2.2*f,t.pos.z-bx[1]-2.2*f,4.4*f,4.4*f)}
  mx.fillStyle='#f59e0b';for(const g of dogs){if(g.st!=='atk'&&g.st!=='back')continue;mx.beginPath();mx.arc(g.pos.x-bx[0],g.pos.z-bx[1],1.8*f,0,Math.PI*2);mx.fill()}
  mx.fillStyle='#ef4444';for(const k of kids){if(k.gone>0)continue;mx.beginPath();mx.arc(k.pos.x-bx[0],k.pos.z-bx[1],2.2*f,0,Math.PI*2);mx.fill()}
  mx.restore();const a=mapBig?2:1;
  if(mapBig)mapNums(W,R,sc,P);
  mx.save();mx.translate(R,R);mx.rotate(cam.yaw-P.face+Math.PI);mx.scale(a,a);mx.fillStyle='#ffd166';mx.beginPath();mx.moveTo(0,-11);mx.lineTo(7,8);mx.lineTo(0,4);mx.lineTo(-7,8);mx.closePath();mx.fill();mx.restore();
  mx.save();mx.translate(R,R);mx.rotate(cam.yaw);mx.fillStyle='#fff';mx.font=`bold ${20*a}px sans-serif`;mx.textAlign='center';mx.textBaseline='middle';mx.fillText('S',0,-R+16*a);mx.restore()}

/* velká mapa: čísla popisná uvnitř budov (text vždy svisle, velikost podle budovy) */
function mapNums(W,R,sc,P){const c=Math.cos(cam.yaw),sn=Math.sin(cam.yaw),half=W/2+20;
  mx.save();mx.textAlign='center';mx.textBaseline='middle';mx.lineJoin='round';
  for(const b of B){const t=houseNum(b);if(!t)continue;const dx=(b.cx-P.pos.x)*sc,dz=(b.cz-P.pos.z)*sc,x=dx*c-dz*sn,y=dx*sn+dz*c;
    if(Math.abs(x)>half||Math.abs(y)>half)continue;
    const w=Math.min(b.x1-b.x0,b.z1-b.z0)*sc,fs=Math.max(11,Math.min(16,w/Math.max(2,t.length)*1.5));
    mx.font=`bold ${fs}px sans-serif`;mx.lineWidth=3;mx.strokeStyle='rgba(10,15,30,.85)';mx.strokeText(t,R+x,R+y);mx.fillStyle='#fff';mx.fillText(t,R+x,R+y)}
  mx.restore()}

/* navádění: šipka nad hráčem ukazuje k Mikulášovi (Mikuláš: k domu); u cíle zmizí */
const navArrow=(()=>{const sh=new THREE.Shape();sh.moveTo(0,.62);sh.lineTo(.42,.08);sh.lineTo(.16,.08);sh.lineTo(.16,-.45);sh.lineTo(-.16,-.45);sh.lineTo(-.16,.08);sh.lineTo(-.42,.08);sh.closePath();
  const mo={transparent:true,depthTest:false,depthWrite:false,fog:false};
  const m=new THREE.Mesh(new THREE.ExtrudeGeometry(sh,{depth:.16,bevelEnabled:false}),[new THREE.MeshBasicMaterial({color:0x38bdf8,...mo}),new THREE.MeshBasicMaterial({color:0x0b5d8a,...mo})]);
  m.geometry.translate(0,0,-.08);m.scale.setScalar(1.5);m.rotation.x=Math.PI/2;m.renderOrder=999;const g=new THREE.Group();g.add(m);g.visible=false;scene.add(g);return g})();
let navNear=false;
function updNav(){const P=player;if(!navOn||!P){navArrow.visible=false;return}
  let tx,tz,r;if(!P.nap){const o=route[ri];if(!o){navArrow.visible=false;return}tx=o.d.x;tz=o.d.z;r=6}else{const L=leader();if(!L){navArrow.visible=false;return}tx=L.pos.x;tz=L.pos.z;r=5}
  const dx=tx-P.pos.x,dz=tz-P.pos.z,d=Math.hypot(dx,dz);navNear=navNear?d<r+3:d<r;   /* malá rezerva, ať šipka u cíle nebliká */
  navArrow.visible=!navNear;if(navNear)return;
  if(P.topH===undefined){const bb=new THREE.Box3().setFromObject(P.mesh);P.topH=bb.max.y-P.mesh.position.y}
  navArrow.position.set(P.pos.x,P.pos.y+P.topH+.55+Math.sin(performance.now()/260)*.08,P.pos.z);navArrow.rotation.y=Math.atan2(dx,dz)}

/* ===================== MENU / KONEC ===================== */
let selChar=store('obchuzka-postava')||'cert',selSide=STRANA,selVar=+store('obchuzka-cert')||1;
if(!POSTAVY.some(p=>p.id===selChar&&!p.off))selChar='cert';
/* (i) u postav: účel a schopnosti (číselné údaje odpovídají ROLE, CFG, NAP) */
const SPOL=`<li>Přemoženého (ležícího) napalovače zvedne <b>F</b> a nosí nad hlavou nejvýš 30 s; <b>F / Mezerník</b> = hodit. Zásah jiného napalovače = <b>kombo +15</b>.</li><li>Na kolo u domu nasedne <b>B</b> (Shift / Běh = rychle, bere sílu; <b>B</b> = sesednout).</li>`;
const BODY_D=`<li>Dům s družinou <b>+10</b>, strašení <b>+3</b> (4× na dům, jen u domu s družinou), přemožený napalovač <b>+25</b>, zahnaný pes <b>+13</b>.</li>`;
const POSTAVA_INFO={
  cert:{u:'Chrání družinu před napalovači a u domů straší.',s:`<li><b>Nejsilnější rána</b>: napalovače složí 5 ranami (ostatní 8), psa 3 (ostatní 4).</li><li><b>Popelnice</b>: <b>F</b> zvedne, <b>F / Mezerník</b> hodí; zásah = 2 rány čerta.</li><li>Na stojící vlečku traktoru naskočí <b>B</b> (traktor zastavíš, když se mu postavíš do cesty); <b>B</b> = seskočit.</li><li>Při běhu se unaví nejrychleji z družiny (kromě Mikuláše).</li>${SPOL}`,b:BODY_D},
  prda:{u:'Rychlý pomocník družiny – honí napalovače a u domů straší.',s:`<li>Rychlý a s dlouhou výdrží při běhu.</li><li>Napalovači se ho bojí už z větší dálky (o 25 % víc než čerta).</li><li>Rána je slabší: napalovač 8 ran, pes 4.</li>${SPOL}`,b:BODY_D},
  konik:{u:'Nejrychlejší člen družiny – dožene utíkající napalovače.',s:`<li><b>Nejrychlejší běh</b> a dlouhá výdrž.</li><li>Útok = seknutí šavlí do kříže; u domu (Q) točí šavlí.</li><li>Napalovači se ho bojí z větší dálky (o 25 % víc než čerta).</li><li>Rána je slabší: napalovač 8 ran, pes 4.</li>${SPOL}`,b:BODY_D},
  smrtka:{u:'Drží napalovače od družiny dlouhou kosou.',s:`<li><b>Nejdelší dosah</b> úderu kosou (3,4 m).</li><li>U domu (Q) klepe na kosu.</li><li>Napalovači se jí bojí z větší dálky (o 25 % víc než čerta).</li><li>Rána je slabší: napalovač 8 ran, pes 4.</li>${SPOL}`,b:BODY_D},
  mikulas:{u:'Vede družinu od domu k domu (dům se žlutým světlem) a u dveří mluví s dětmi.',s:`<li>Od vyrážení k dalšímu domu má 30 s, aby došel ke dveřím domu, jinak jde družina sama: <b>−5</b> a body za dům nedostane.</li><li>U domu se ptá dětí (<b>1–3</b>), pak dá nadílku (<b>Q / N</b>) – jednou za dům.</li><li><b>Bonbony</b>: Mezerník držet = mířit, pustit = hodit (stejný napalovač nejvýš 1× za 8 s).</li><li>Nepere se; napalovači se ho nebojí.</li><li>Nejpomalejší běh a nejkratší výdrž.</li>${SPOL}`,b:`<li>Dům <b>+5</b>, pochválit děti <b>+1</b> (2× na dům), nadílka <b>+2</b>, bonbon do napalovače <b>+2</b>, kombo <b>+15</b>.</li>`},
  napalovac:{u:'Zlobí družinu – hází koule, krade nadílku a nesmí se nechat chytit.',s:`<li><b>Koule</b>: Mezerník držet = mířit (5–18 m), pustit = hodit. Na mobilu tlačítko Koule držet a táhnout prstem (do stran = směr, nahoru/dolů = vzdálenost).</li><li><b>Q</b> u Mikuláše při návštěvě domu = ukrást nadílku (1× za 60 s); pak ho honí 3 masky.</li><li><b>Q</b> u čerta = zazvonit mu zvonci (stejný čert 1× za 20 s).</li><li>Když ho družina přemůže, 5 s leží; člen družiny ho může zvednout a jednou hodit. Pak se objeví jinde.</li><li>Za domy body nedostává; psi si ho nevšímají.</li>`,b:`<li>Zásah masky koulí <b>+3</b>, ukradená nadílka <b>+10</b>, zvonce <b>+5</b>, chycení <b>−20</b>.</li>`},
};
function showInfo(id){const I=POSTAVA_INFO[id],R=ROLE[id];if(!I)return;let box=$('infBox');
  if(!box){box=document.createElement('div');box.id='infBox';box.innerHTML='<div class="infIn" role="dialog" aria-modal="true"><button type="button" class="infX" aria-label="Zavřít">✕</button><h3></h3><div class="infT"></div></div>';document.body.appendChild(box);
    box.onclick=e=>{if(e.target===box||e.target.closest('.infX'))box.classList.add('hide')};
    addEventListener('keydown',e=>{if(e.key==='Escape'&&!box.classList.contains('hide')){e.stopPropagation();box.classList.add('hide')}},true)}
  const f=v=>String(v).replace('.',',');
  box.querySelector('h3').textContent=R.n;
  box.querySelector('.infT').innerHTML=`<p>${I.u}</p><h4>Schopnosti</h4><ul><li>Chůze ${f(R.chuze)} m/s, běh ${f(R.beh)} m/s.</li>${I.s}</ul><h4>Body</h4><ul>${I.b}</ul>`;
  box.classList.remove('hide');box.querySelector('.infX').focus()}
function opts(el,list,sel,cb,img,offCb){el.innerHTML=list.map(o=>`<button type="button" class="opt${img?' pic':''}" data-id="${o.id}" aria-pressed="${String(o.id)===String(sel)}" ${o.off?(offCb?'aria-disabled="true"':'disabled'):''}>${img?`<img alt="" data-th="${img(o)}">`:''}${o.n}${o.d?`<small>${o.d}</small>`:''}${img&&POSTAVA_INFO[o.id]?`<span class="inf" data-inf="${o.id}" role="button" tabindex="0" aria-label="Co umí ${o.n}" title="Co umí">i</span>`:''}</button>`).join('');
  el.onkeydown=e=>{const i=e.target.closest&&e.target.closest('.inf');if(i&&(e.key==='Enter'||e.key===' ')){e.preventDefault();e.stopPropagation();showInfo(i.dataset.inf)}};
  el.onclick=e=>{const i=e.target.closest('.inf');if(i){e.preventDefault();e.stopPropagation();showInfo(i.dataset.inf);return}const b=e.target.closest('.opt');if(!b||b.disabled)return;if(b.getAttribute('aria-disabled')==='true'){if(offCb)offCb(b.dataset.id);return}cb(b.dataset.id);el.querySelectorAll('.opt').forEach(x=>x.setAttribute('aria-pressed',x===b))}}
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
charMenu();opts($('oSide'),STRANY,selSide,v=>{if(v!==STRANA)goStrana(v,{scr:'sp'})});
$('keysPC').classList.toggle('hide',isTouch);$('keysTouch').classList.toggle('hide',!isTouch);
function showBest(el){const b=store('obchuzka-rekord');el.textContent=b?`Tvůj rekord: ${b} bodů`:''}
showBest($('best'));
function start(){resetGame();state='play';setAuto(false);navNear=false;setMapBig(false);$('menu').classList.add('hide');$('sp').classList.add('hide');$('end').classList.add('hide');$('ui').classList.remove('hide');$('touch').classList.toggle('hide',!isTouch);
  if(player.nap)toast('Jsi napalovač! Mezerník držet = mířit, pustit = koule. Q u čerta = zvonce, u Mikuláše u domu = nadílka.',4500);else
  toast(player.role==='mikulas'?'Jsi Mikuláš – veď družinu k domům se žlutým světlem. Mezerník držet = mířit, pustit = bonbon (+2 za zásah napalovače). U domu se dětí zeptej (1–3) a dej nadílku (Q).':(player.role==='cert'?'Drž se družiny, chytej napalovače, zaháněj psy. Popelnici u domu zvedneš a hodíš (F).':'Drž se družiny u domů, chytej napalovače a zaháněj psy!'),3500);last=performance.now();
  if(isTouch&&document.documentElement.requestFullscreen)document.documentElement.requestFullscreen().catch(()=>{})}
$('bStart').onclick=start;$('bAgain').onclick=start;
function pause(on){if(NET.on)return;if(on&&state==='play'){setMapBig(false);state='pause';$('pause').classList.remove('hide')}else if(!on&&state==='pause'){state='play';$('pause').classList.add('hide');last=performance.now()}}
$('bPause').onclick=()=>pause(true);$('bResume').onclick=()=>pause(false);
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause(true)});
$('bEnd').onclick=()=>{if(NET.on)NET.leave('Odešel jsi ze hry.');else finish(false)};
function gameOver(timeUp,done){if(NET.on&&NET.host){NET.endGame(timeUp?'time':done?'done':'stop');return}finish(timeUp,done)}
function finish(timeUp,done){state='end';$('pause').classList.add('hide');setAuto(false);$('bAgain').textContent='Hrát znovu';navArrow.visible=false;setMapBig(false);keys.clear();runHeld=false;$('ui').classList.add('hide');$('end').classList.remove('hide');
  for(const k of kids)k.bub.classList.add('hide');for(const g of dogs)g.bub.classList.add('hide');
  $('endT').textContent=done?'Strana obejitá!':timeUp?'Čas vypršel':'Obchůzka skončila';
  const used=CFG.limit-Math.max(0,timeLeft),m=Math.floor(used/60),s=Math.floor(used%60);
  if(player.nap)$('endRes').innerHTML=`<span>Postava</span><b>Napalovač</b><span>Zásahy koulí</span><b>${napSt.b}</b><span>Ukradené nadílky</span><b>${napSt.k}</b><span>Zazvonění na zvonce</span><b>${napSt.z}</b><span>Chytili tě</span><b>${napSt.c}×</b>`+
    `<span>Čas na straně</span><b>${m}:${String(s).padStart(2,'0')}</b><span class="tot">Body celkem</span><b class="tot">${score}</b>`;else
  $('endRes').innerHTML=`<span>Postava</span><b>${ROLE[player.role].n}</b><span>Domy s družinou</span><b>${houses} / ${ri}</b><span>Body za strašení</span><b>${scareP}</b><span>Chycení napalovači</span><b>${caught}</b><span>Zahnaní psi</span><b>${dogsN}</b>${komboN?`<span>Komba s napalovačem</span><b>${komboN}</b>`:''}`+
    (penalty?`<span>Pokuta (Mikuláš se pral)</span><b>−${penalty}</b>`:'')+`<span>Čas na straně</span><b>${m}:${String(s).padStart(2,'0')}</b><span class="tot">Body celkem</span><b class="tot">${score}</b>`;
  const best=store('obchuzka-rekord')||0;if(score>best){store('obchuzka-rekord',score);$('endBest').textContent='Nový rekord!'}else $('endBest').textContent=`Rekord: ${best} bodů`;
  zebEnd({s:score,h:player.nap?0:houses,c:player.nap?napSt.b:caught,p:player.nap?0:dogsN,r:player.role,mp:false});
  showBest($('best'))}

/* ===================== ŽEBŘÍČEK (databáze, zapíše se kdokoliv s přezdívkou) ===================== */
const ZEB={st:null,saved:null,busy:false};
const zesc=t=>String(t).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const zebScr=id=>{for(const x of['menu','sp','end','zebS'])$(x).classList.toggle('hide',x!==id);if($('mp'))$('mp').classList.add('hide')};
const zebOn=()=>!!(window.DB&&DB.configured&&DB.topScores);
const zebAdm=()=>{try{const m=window.DB&&DB.me&&DB.me();return !!(m&&m.role===3)}catch(e){return false}};
const zebRow=(z,i,me,del)=>{const d=z.ts?new Date(z.ts):null;return `<span class="${me?'me':''}">${i+1}.</span><span class="n ${me?'me':''}">${zesc(z.n)} <span class="r">${(STRANY_DEF.find(x=>x.id===(z.st||'polnak'))||{n:''}).n} · ${(ROLE[z.r]||{}).n||''}${z.mp?' · ve více':''}${d?' · '+d.getDate()+'. '+(d.getMonth()+1)+'. '+d.getFullYear():''}</span>${del?` <button type="button" class="zdel" data-zdel="${zesc(z.id)}" title="Smazat záznam (správce)">✕</button>`:''}</span><span class="r">${z.h} domů</span><b class="${me?'me':''}">${z.s}</b>`};
async function zebLoad(el,n,del){if(!zebOn()){el.innerHTML='<span class="h" style="grid-column:1/-1">Žebříček teď není dostupný.</span>';return}
  try{const L=await DB.topScores(n||10);el.innerHTML=L.length?`<span class="h"></span><span class="h">Hráč</span><span class="h"></span><span class="h" style="text-align:right">Body</span>`+L.map((z,i)=>zebRow(z,i,z.id===ZEB.saved,del&&zebAdm())).join(''):'<span class="h" style="grid-column:1/-1">Zatím tu nikdo není – buď první!</span>';
    el.querySelectorAll('[data-zdel]').forEach(b=>b.onclick=async()=>{if(b.dataset.ok!=='1'){b.dataset.ok='1';b.textContent='Smazat?';return}b.disabled=true;try{await DB.delScore(b.dataset.zdel);zebLoad(el,n,del)}catch(e){console.warn(e);b.textContent='Nepovedlo se'}})}
  catch(e){console.warn(e);el.innerHTML='<span class="h" style="grid-column:1/-1">Žebříček se nenačetl.</span>'}}
/* konec hry: nabídne zápis a ukáže prvních 10 */
function zebEnd(st,name){ZEB.st=st;ZEB.saved=null;const ok=zebOn()&&st.s>0;$('zebW').classList.toggle('hide',!ok);$('zebMsg').textContent='';$('zebSave').disabled=false;
  $('zebName').value=(name||store('obchuzka-jmeno')||'').slice(0,20);$('zebEnd').innerHTML='';if(zebOn())zebLoad($('zebEnd'),10)}
$('zebSave').onclick=async()=>{if(ZEB.busy||!ZEB.st||ZEB.saved)return;const n=$('zebName').value.trim().replace(/\s+/g,' ').slice(0,20);
  if(!n){$('zebMsg').textContent='Napiš přezdívku.';$('zebName').focus();return}store('obchuzka-jmeno',n);ZEB.busy=true;$('zebMsg').textContent='Zapisuji…';
  const z={n,r:ZEB.st.r,s:Math.round(ZEB.st.s),h:ZEB.st.h|0,c:ZEB.st.c|0,p:ZEB.st.p|0,mp:!!ZEB.st.mp,st:STRANA};
  try{try{ZEB.saved=await DB.addScore(z)}
    catch(e){/* starší pravidla databáze (bez strany, nejvýš 18 domů): zapíše aspoň bez strany */if(e&&e.code!=='permission-denied')throw e;const{st,...z2}=z;z2.h=Math.min(z2.h,18);ZEB.saved=await DB.addScore(z2)}$('zebMsg').textContent='Zapsáno.';$('zebSave').disabled=true;$('zebW').classList.add('hide');zebLoad($('zebEnd'),10)}
  catch(e){console.warn(e);$('zebMsg').textContent='Zápis se nepovedl.'}ZEB.busy=false};
$('zebName').addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Enter')$('zebSave').click()});
$('bZeb').onclick=()=>{zebScr('zebS');zebLoad($('zebList'),20,true)};
$('zebBack').onclick=()=>zebScr('menu');
$('bSingle').onclick=()=>zebScr('sp');$('spBack').onclick=()=>zebScr('menu');
{const q=new URLSearchParams(location.search);if(q.get('scr')==='sp'){zebScr('sp');q.delete('scr');try{history.replaceState(null,'',location.pathname+(q.toString()?'?'+q:''))}catch(e){}}}   /* po přepnutí strany zpět na výběr */

/* ===================== SMYČKA ===================== */
let last=performance.now();
function loop(now){requestAnimationFrame(loop);const dt=Math.min(0.05,(now-last)/1000);last=now;
  if(state==='play'){update(dt);placeBubbles()}
  else if(state==='menu'||state==='end'){const t=now/9000;const s=M.start||[0,0];camera.position.set(s[0]+Math.sin(t)*70,45+gy(s[0],s[1]+130),s[1]+130+Math.cos(t)*70);camera.lookAt(s[0],gy(s[0],s[1]+130),s[1]+130)}
  renderer.render(scene,camera)}
$('loading').remove();requestAnimationFrame(loop);
window.__hra={showInfo,grabKey,nesPick,NES,get otz(){return otz},otzAsk,otzGive,candyHit,NET,get board(){return NET.board},scene,gy,groundH,carve,camera,cam,get player(){return player},get kids(){return kids},get ents(){return ents},get grp(){return grp},get route(){return route},get cars(){return cars},nballs,aimStart,aimRelease,napAction,hitNap,get napSt(){return napSt},tractors,trakKey,dogs,bins,binKey,hitDog,bikes,bikeKey,get ri(){return ri},RES,B,start,animAttack,state:()=>state,
  setChar:v=>{selChar=v},setTime:v=>{timeLeft=v},step:n=>{for(let i=0;i<n&&state==='play';i++)update(.05)},get timeLeft(){return timeLeft}};

