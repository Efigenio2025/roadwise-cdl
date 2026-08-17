const CACHE="roadwise-sites-v15";
const BASE=new URL("./",self.registration.scope).pathname;
const asset=name=>`${BASE}${name}`;
const CORE=[asset(""),asset("questions.json"),asset("manifest.webmanifest"),asset("icon-1024.png"),asset("og-adaptive.png")];
async function cacheApp(){
  const cache=await caches.open(CACHE);
  await cache.addAll(CORE);
  const response=await fetch(asset(""));
  const html=await response.clone().text();
  const shellAssets=[...html.matchAll(/(?:src|href)=["']([^"']+\.(?:js|css))["']/g)].map(match=>new URL(match[1],self.registration.scope).pathname);
  if(shellAssets.length)await cache.addAll([...new Set(shellAssets)]);
  await cache.put(asset(""),response);
}
self.addEventListener("install",event=>event.waitUntil(cacheApp()));
self.addEventListener("message",event=>{if(event.data==="SKIP_WAITING")self.skipWaiting()});
self.addEventListener("activate",event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET")return;
  if(event.request.mode==="navigate"){
    event.respondWith(fetch(event.request).then(response=>{const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(asset(""),copy));return response}).catch(()=>caches.match(asset(""))));
    return;
  }
  event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy))}return response})));
});
