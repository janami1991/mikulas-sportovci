/* Otevření v normálním prohlížeči: když se stránka načte ve vestavěném prohlížeči aplikace
   (Facebook, Messenger, Instagram, TikTok, LinkedIn, Snapchat …), nabídne přechod do Chrome / Safari.
   Android: tlačítko přes intent (Chrome / výchozí prohlížeč) – automatické přesměrování záměrně ne (ve WebView může skončit chybou).
   iOS: tlačítka Safari / Chrome + návod přes menu aplikace (spolehlivá cesta ven z aplikace neexistuje). */
(function(){
  var ua=navigator.userAgent||'';
  var app=/FBAN|FBAV|FB_IAB|FBIOS|FB4A/.test(ua)?'Facebook':/Messenger|MESSENGER/.test(ua)?'Messenger':/Instagram/.test(ua)?'Instagram':
    /musical_ly|BytedanceWebview|TikTok/i.test(ua)?'TikTok':/LinkedInApp/.test(ua)?'LinkedIn':/Snapchat/.test(ua)?'Snapchat':/\bLine\//.test(ua)?'LINE':
    /Twitter|TwitterAndroid/.test(ua)?'X':null;
  var test=/[?&]inapp=1\b/.test(location.search);           /* ruční test: ?inapp=1 */
  if(!app&&!test)return;
  app=app||'aplikace';
  var android=/Android/i.test(ua),ios=/iPhone|iPad|iPod/i.test(ua)||(/Macintosh/.test(ua)&&navigator.maxTouchPoints>1);
  var url=location.href.replace(/([?&])inapp=1(&|$)/,function(m,a,b){return b?a:''}).replace(/[?&]$/,'');
  var noProto=url.replace(/^https?:\/\//,'');
  var chromeAndroid='intent://'+noProto+'#Intent;scheme='+location.protocol.replace(':','')+';package=com.android.chrome;S.browser_fallback_url='+encodeURIComponent(url)+';end';
  var anyAndroid='intent:'+url+'#Intent;end';

  function show(){
    if(document.getElementById('vprohl'))return;
    var css=document.createElement('style');
    css.textContent='#vprohl{position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.88);display:flex;align-items:center;justify-content:center;padding:18px;font:16px/1.45 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#fff}'+
      '#vprohl .bx{background:#111;border:1px solid #555;border-radius:14px;max-width:420px;width:100%;padding:22px 20px;text-align:center}'+
      '#vprohl h2{margin:0 0 8px;font-size:20px}#vprohl p{margin:0 0 14px;color:#ccc}'+
      '#vprohl a,#vprohl button{display:block;width:100%;box-sizing:border-box;margin:8px 0;padding:13px 10px;border-radius:10px;font:600 16px system-ui,sans-serif;text-decoration:none;cursor:pointer}'+
      '#vprohl .hl{background:#fff;color:#000;border:2px solid #fff}#vprohl .ob{background:transparent;color:#fff;border:2px solid #fff}'+
      '#vprohl .mn{background:none;border:0;color:#999;font-weight:400;text-decoration:underline}#vprohl .nv{font-size:14px;color:#bbb;text-align:left;margin:12px 0 4px}';
    document.head.appendChild(css);
    var d=document.createElement('div');d.id='vprohl';
    var b='<div class="bx"><h2>Otevři v prohlížeči</h2><p>Stránka se otevřela uvnitř aplikace '+app+'. Tady nemusí vše fungovat správně (hra, zvuk, celá obrazovka, přihlášení). Otevři ji v Chrome nebo Safari.</p>';
    if(android){b+='<a class="hl" href="'+chromeAndroid+'">Otevřít v Chrome</a><a class="ob" href="'+anyAndroid+'">Otevřít v jiném prohlížeči</a>'}
    else if(ios){b+='<a class="hl" href="x-safari-'+url+'">Otevřít v Safari</a><a class="ob" href="googlechrome'+(url.indexOf('https')===0?'s':'')+'://'+noProto+'">Otevřít v Chrome</a>'}
    b+='<button class="ob" id="vprohlCp">Kopírovat odkaz</button>'+
      '<div class="nv">Když tlačítko nefunguje: v aplikaci klepni na <b>⋯</b> (nebo <b>⋮</b>) vpravo nahoře a zvol <b>Otevřít v prohlížeči</b> / <b>Otevřít v Safari</b>.</div>'+
      '<button class="mn" id="vprohlX">Pokračovat tady</button></div>';
    d.innerHTML=b;document.body.appendChild(d);
    document.getElementById('vprohlX').onclick=function(){d.remove()};
    document.getElementById('vprohlCp').onclick=function(){var t=this;
      function ok(){t.textContent='Odkaz zkopírován – vlož ho do prohlížeče'}
      function fb(){var i=document.createElement('textarea');i.value=url;document.body.appendChild(i);i.select();try{document.execCommand('copy');ok()}catch(e){prompt('Zkopíruj odkaz:',url)}i.remove()}
      if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(url).then(ok,fb);else fb()};
  }
  if(document.body)show();else document.addEventListener('DOMContentLoaded',show);
})();
