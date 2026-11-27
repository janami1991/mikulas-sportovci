/* Mikulášská obchůzka – NASTAVENÍ hry (jen správci, stejně jako editor mapy).
   Hodnoty se ukládají do databáze (nastaveni/hra), hra je načte při startu stránky (window.NASTAVENI) a nastApply je zapíše do CFG / NAP / DPC / VISIT_S / ROUTE_N.
   Ve hře více hráčů pošle hostitel své hodnoty ve zprávě go/team, takže všichni hrají se stejnými.
   Načítá se po hra.js a doprava.js. Nový parametr = přidat řádek do NAST_DEF (k, název, výchozí, min, max, krok, jednotka, get/set). */
'use strict';
const NAST_DEF=[
  {g:'Obchůzka'},
  {k:'limitMin',n:'Délka obchůzky',d:25,min:5,max:60,u:'min',get:()=>CFG.limit/60,set:v=>{CFG.limit=v*60}},
  {k:'route',n:'Počet domů na trase',d:50,min:5,max:100,u:'domů',get:()=>ROUTE_N,set:v=>{ROUTE_N=v}},
  {k:'visit',n:'Čas u domu',d:10,min:3,max:60,u:'s',get:()=>VISIT_S,set:v=>{VISIT_S=v}},
  {k:'rebelS',n:'Mikuláš musí dojít k domu do',d:30,min:10,max:120,u:'s',get:()=>CFG.rebelS,set:v=>{CFG.rebelS=v}},
  {k:'napalovacu',n:'Napalovačů (počítač)',d:8,min:0,max:20,u:'',get:()=>CFG.napalovacu,set:v=>{CFG.napalovacu=v}},
  {g:'Body – družina'},
  {k:'bodyDum',n:'Dům s družinou',d:10,min:0,max:100,u:'b',get:()=>CFG.bodyDum,set:v=>{CFG.bodyDum=v}},
  {k:'bodyStrach',n:'Strašení u domu',d:3,min:0,max:50,u:'b',get:()=>CFG.bodyStrach,set:v=>{CFG.bodyStrach=v}},
  {k:'bodyChycen',n:'Přemožený napalovač',d:25,min:0,max:100,u:'b',get:()=>CFG.bodyChycen,set:v=>{CFG.bodyChycen=v}},
  {k:'bodyPes',n:'Zahnaný pes',d:13,min:0,max:100,u:'b',get:()=>CFG.bodyPes,set:v=>{CFG.bodyPes=v}},
  {k:'bodyKombo',n:'Kombo (napalovačem na napalovače)',d:15,min:0,max:100,u:'b',get:()=>CFG.bodyKombo,set:v=>{CFG.bodyKombo=v}},
  {g:'Body – Mikuláš'},
  {k:'bodyDumMik',n:'Dům',d:5,min:0,max:100,u:'b',get:()=>CFG.bodyDumMik,set:v=>{CFG.bodyDumMik=v}},
  {k:'bodyStrachMik',n:'Pochválit děti',d:1,min:0,max:50,u:'b',get:()=>CFG.bodyStrachMik,set:v=>{CFG.bodyStrachMik=v}},
  {k:'bodyNadilka',n:'Nadílka',d:2,min:0,max:50,u:'b',get:()=>CFG.bodyNadilka,set:v=>{CFG.bodyNadilka=v}},
  {k:'bodyBonbon',n:'Bonbon do napalovače',d:2,min:0,max:50,u:'b',get:()=>CFG.bodyBonbon,set:v=>{CFG.bodyBonbon=v}},
  {k:'rebelPen',n:'Pokuta, když nedojde k domu',d:5,min:0,max:100,u:'b',get:()=>CFG.rebelPen,set:v=>{CFG.rebelPen=v}},
  {g:'Body – napalovač (hráč)'},
  {k:'napKoule',n:'Zásah koulí',d:3,min:0,max:50,u:'b',get:()=>NAP.koule,set:v=>{NAP.koule=v}},
  {k:'napKradez',n:'Ukradená nadílka',d:10,min:0,max:100,u:'b',get:()=>NAP.kradez,set:v=>{NAP.kradez=v}},
  {k:'napZvonce',n:'Zazvonění čertovi',d:5,min:0,max:50,u:'b',get:()=>NAP.zvonce,set:v=>{NAP.zvonce=v}},
  {k:'napChycen',n:'Pokuta za chycení',d:20,min:0,max:100,u:'b',get:()=>NAP.chycen,set:v=>{NAP.chycen=v}},
  {g:'Doprava'},
  {k:'aut',n:'Auta po vesnici najednou',d:3,min:0,max:10,u:'',get:()=>CFG.aut,set:v=>{CFG.aut=v}},
  {k:'dpMax',n:'Vozidel na hlavní silnici najednou (0 = bez provozu)',d:20,min:0,max:40,u:'',get:()=>DPC.maxVeh,set:v=>{DPC.maxVeh=v}},
  {k:'dpInt',n:'Vozidlo vyjede každých (průměr, každý směr)',d:10,min:3,max:60,u:'s',get:()=>Math.round((DPC.spawn[0]+DPC.spawn[1])/2),set:v=>{DPC.spawn=[Math.max(1,v*.7),v*1.3]}},
  {k:'vlaky',n:'Vlaků za hru (0 = žádný)',d:10,min:0,max:30,u:'',get:()=>DPC.trainN,set:v=>{DPC.trainN=v}},
  {k:'bodySraz',n:'Pokuta za sražení',d:10,min:0,max:100,u:'b',get:()=>DPC.bodySraz,set:v=>{DPC.bodySraz=v}},
];
const NAST_ITEMS=NAST_DEF.filter(x=>x.k);
const nastClamp=(x,v)=>{v=Math.round(+v);if(!isFinite(v))v=x.d;return Math.min(x.max,Math.max(x.min,v))};
let NAST_CUR={};
/* zapsat hodnoty do hry; chybějící = výchozí */
function nastApply(ns){ns=ns||{};const cur={};for(const x of NAST_ITEMS){const v=nastClamp(x,ns[x.k]!==undefined?ns[x.k]:x.d);try{x.set(v)}catch(e){}if(v!==x.d)cur[x.k]=v}NAST_CUR=cur;return cur}
nastApply(window.NASTAVENI);

/* ---------- obrazovka Nastavení (menu → Nastavení, jen správce) ---------- */
(()=>{const $=id=>document.getElementById(id);
  const scr=document.createElement('div');scr.className='screen hide';scr.id='nastS';
  scr.innerHTML=`<div class="card"><h1>Nastavení hry</h1><p>Platí pro všechny strany a pro všechny hráče od další hry. Ve hře více hráčů platí nastavení toho, kdo hru zakládá.</p><div class="nast" id="nastList"></div><div class="keys" id="nastMsg"></div>
    <button class="big" id="nastSave" type="button">Uložit</button><button class="big2" id="nastDef" type="button">Výchozí hodnoty</button><button class="big2" id="nastBack" type="button">← Zpět do menu</button></div>`;
  document.body.appendChild(scr);
  const st=document.createElement('style');st.textContent=`.nast{display:grid;grid-template-columns:1fr auto;gap:6px 12px;align-items:center;font-size:15px}
.nast h4{grid-column:1/-1;margin:12px 0 2px;font-size:14px;text-transform:uppercase;letter-spacing:.06em;color:#bdbdbd;border-bottom:1px solid #444;padding-bottom:4px}
.nast label{color:#e6e6e6}.nast label small{display:block;color:#8a8a8a;font-size:12px}
.nast .in{display:flex;align-items:center;gap:6px;justify-content:flex-end}.nast .in span{color:#9a9a9a;font-size:13px;min-width:42px}
.nast input{width:78px;min-height:38px;border-radius:8px;border:1px solid #777;background:#111;color:#fff;font-size:16px;padding:0 8px;text-align:right}
.nast input.ch{border-color:#fff;border-width:2px}`;document.head.appendChild(st);
  function render(){$('nastList').innerHTML=NAST_DEF.map(x=>x.g?`<h4>${x.g}</h4>`:
      `<label for="ns_${x.k}">${x.n}<small>výchozí ${x.d}${x.u?' '+x.u:''} · ${x.min}–${x.max}</small></label><div class="in"><input id="ns_${x.k}" data-k="${x.k}" type="number" inputmode="numeric" min="${x.min}" max="${x.max}" step="1" value="${x.get()}"><span>${x.u}</span></div>`).join('');
    mark()}
  function mark(){for(const i of $('nastList').querySelectorAll('input')){const x=NAST_ITEMS.find(y=>y.k===i.dataset.k);i.classList.toggle('ch',+i.value!==x.d)}}
  const show=on=>{for(const id of['menu','sp','end','zebS','mp'])if($(id))$(id).classList.toggle('hide',on||id!=='menu');scr.classList.toggle('hide',!on)};
  $('nastList').addEventListener('input',mark);
  $('nastList').addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Enter')$('nastSave').click()});
  $('nastDef').onclick=()=>{for(const i of $('nastList').querySelectorAll('input')){const x=NAST_ITEMS.find(y=>y.k===i.dataset.k);i.value=x.d}mark();$('nastMsg').textContent='Výchozí hodnoty – ulož tlačítkem Uložit.'};
  $('nastBack').onclick=()=>show(false);
  $('nastSave').onclick=async()=>{const b=$('nastSave');if(b.disabled)return;const ns={};
    for(const i of $('nastList').querySelectorAll('input')){const x=NAST_ITEMS.find(y=>y.k===i.dataset.k);const v=nastClamp(x,i.value);i.value=v;if(v!==x.d)ns[x.k]=v}
    b.disabled=true;$('nastMsg').textContent='Ukládám…';
    try{if(!window.DB||!DB.saveNast)throw new Error('Databáze není dostupná.');await DB.saveNast(ns);nastApply(ns);mark();$('nastMsg').textContent='Uloženo. Platí od další hry; ostatním hráčům po načtení stránky.'}
    catch(e){console.warn(e);$('nastMsg').textContent=e&&e.code==='permission-denied'?'Uložit může jen správce.':'Uložení se nepovedlo: '+(e&&e.message||e)}
    b.disabled=false};
  /* tlačítko v menu (vidí jen správce) */
  const lb=$('lEditor');const bt=document.createElement('button');bt.className='big2 hide';bt.id='bNast';bt.type='button';bt.textContent='Nastavení';
  if(lb)lb.after(bt);bt.onclick=()=>{render();$('nastMsg').textContent='';show(true)};
})();
