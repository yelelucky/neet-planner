/* Offline support. The app files are kept on the device, so the planner opens without internet.
   Bump VERSION on every release so devices pick up the new files. */
const VERSION='neet27-v1.2.0';
const APP=['./','index.html','app.css','app.js','storage.js','shared-data.js','config.js','manifest.webmanifest',
  'icons/icon.svg','icons/icon-192.png','icons/icon-512.png','icons/maskable-192.png','icons/maskable-512.png','icons/apple-touch-icon.png','icons/favicon-32.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(VERSION).then(c=>c.addAll(APP)))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==VERSION&&k!=='neet27-fonts').map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('message',e=>{if(e.data==='skip')self.skipWaiting()});
self.addEventListener('fetch',e=>{const r=e.request;if(r.method!=='GET')return;const u=new URL(r.url);
  /* fonts: keep the first copy, then serve it offline */
  if(u.hostname==='fonts.googleapis.com'||u.hostname==='fonts.gstatic.com'){e.respondWith(caches.open('neet27-fonts').then(async c=>{const hit=await c.match(r);if(hit)return hit;
    try{const res=await fetch(r);if(res.ok||res.type==='opaque')c.put(r,res.clone());return res}catch(err){return hit||Response.error()}}));return}
  if(u.origin!==location.origin)return; /* sync calls go straight to the network */
  /* app files: device copy first; pages fall back to the app shell */
  e.respondWith(caches.match(r,{ignoreSearch:true}).then(hit=>hit||fetch(r).catch(()=>r.mode==='navigate'?caches.match('index.html'):Response.error())))});
