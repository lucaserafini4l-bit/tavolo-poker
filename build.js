const fs=require('fs');const src=p=>fs.readFileSync(__dirname+'/src/'+p,'utf8');
const nash=JSON.parse(src('nash.json'));
const scripts=[
  src('engine.js'),
  'var PREFLOP = '+src('preflop.json').trim()+';',
  src('advice.js'),
  'var NASH = '+JSON.stringify(nash)+';',
  src('dealer.js'),
  src('app.js'),
  src('calc.js'),
].map(s=>'<script>\n'+s+'\n</script>').join('\n');
const fonts='<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600&family=Barlow+Condensed:wght@500;600;700&display=swap">';
const css='<style>\n'+src('styles.css')+'\n</style>';
const body=src('body.html');
const VERSION=process.argv[2]||'1';
const sw=`<script>if('serviceWorker' in navigator && location.protocol==='https:'){window.addEventListener('load',function(){navigator.serviceWorker.register('sw.js').catch(function(){});});}</script>`;
const full=`<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Tavolo Poker</title>
<meta name="description" content="Timer dei bui, frecce di piccolo e grande buio, piatto, classifica e calcolatore di probabilità per le serate di poker.">
<meta name="theme-color" content="#0d1714">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Tavolo Poker">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="apple-touch-icon.png">
${fonts}
${css}
</head>
<body>
${body}
${scripts}
${sw}
</body>
</html>
`;
fs.mkdirSync(__dirname+'/dist',{recursive:true});
fs.writeFileSync(__dirname+'/dist/index.html',full);
// artifact preview: no doctype/head wrapper
fs.writeFileSync(__dirname+'/preview.html','<title>Tavolo Poker</title>\n'+fonts+'\n'+css+'\n'+body+'\n'+scripts+'\n');
fs.writeFileSync(__dirname+'/dist/manifest.webmanifest',JSON.stringify({
  name:'Tavolo Poker',short_name:'Tavolo Poker',lang:'it',start_url:'./',scope:'./',display:'standalone',orientation:'any',
  background_color:'#0d1714',theme_color:'#0d1714',description:'Timer dei bui, piatto, classifica e calcolatore per le serate di poker.',
  icons:[{src:'icon-192.png',sizes:'192x192',type:'image/png'},{src:'icon-512.png',sizes:'512x512',type:'image/png'},{src:'icon-512.png',sizes:'512x512',type:'image/png',purpose:'maskable'},{src:'icon.svg',sizes:'any',type:'image/svg+xml'}]
},null,2));
fs.writeFileSync(__dirname+'/dist/sw.js',`// Service worker: rende l'app disponibile anche senza connessione.
const CACHE = 'tavolo-poker-v${VERSION}';
const FILES = ['./', './index.html', './manifest.webmanifest', './icon.svg', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin === location.origin) {
    // pagina: prima la rete (per ricevere gli aggiornamenti), poi la cache se offline
    e.respondWith(fetch(e.request).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r; }).catch(() => caches.match(e.request).then(r => r || caches.match('./index.html'))));
  } else if (url.hostname.endsWith('fonts.googleapis.com') || url.hostname.endsWith('fonts.gstatic.com')) {
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return res; })));
  }
});
`);
fs.writeFileSync(__dirname+'/dist/.nojekyll','');
fs.copyFileSync(__dirname+'/src/icon.svg',__dirname+'/dist/icon.svg');
console.log('index.html',(full.length/1024).toFixed(0)+'KB');
