/* Strany (části Lidečka) – která se načte: ?strana=… v adrese, jinak poslední zvolená (localStorage), jinak Polňák.
   Každá strana má vlastní soubor mapy (polnak.js, stred.js, pila.js, nadrazi.js) a vlastní úpravy z editoru. */
window.STRANY_DEF=[{id:'polnak',n:'Polňák'},{id:'stred',n:'Střed'},{id:'pila',n:'Pila'},{id:'nadrazi',n:'Nádraží'}];
(()=>{const ok=id=>STRANY_DEF.some(s=>s.id===id);let s=new URLSearchParams(location.search).get('strana');
  if(!ok(s)){try{s=localStorage.getItem('obchuzka-strana')}catch(e){}}
  if(!ok(s))s='polnak';window.STRANA=s;window.STRANA_N=STRANY_DEF.find(x=>x.id===s).n;
  try{localStorage.setItem('obchuzka-strana',s)}catch(e){}})();
/* přepnutí strany = znovu načíst stránku (svět se staví při načtení); extra = další parametry adresy */
window.goStrana=(id,extra)=>{const u=new URL(location.href);u.searchParams.set('strana',id);
  for(const k of['scr','hra'])u.searchParams.delete(k);for(const k in extra||{})u.searchParams.set(k,extra[k]);
  try{localStorage.setItem('obchuzka-strana',id)}catch(e){}location.href=u.toString()};
