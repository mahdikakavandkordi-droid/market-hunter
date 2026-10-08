const CACHE='market-hunter-shell-v27';
const SHELL=['/','/index.html','/app.css','/mobile-polish.css','/theme.css','/ui-polish.css','/app.js','/i18n.js','/market-status.js','/quote-policy.js','/engine-dashboard.js','/engine-matches.js','/fundamental-context.js','/engine-dashboard.css','/clean-ui.css','/manifest.webmanifest','/market-hunter-icon.svg','/icons/icon-192.png','/icons/icon-512.png','/icons/icon-maskable.png','/icons/apple-touch-icon.png'];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET')return;
  const url=new URL(req.url);
  if(url.origin!==self.location.origin)return;
  if(url.pathname.startsWith('/api/')||url.pathname.startsWith('/data/')){
    event.respondWith(fetch(req));
    return;
  }
  event.respondWith(
    fetch(req).then(res=>{
      if(res&&res.ok){
        const copy=res.clone();
        caches.open(CACHE).then(cache=>cache.put(req,copy));
      }
      return res;
    }).catch(()=>caches.match(req).then(hit=>hit||(req.mode==='navigate'?caches.match('/index.html'):Response.error())))
  );
});
