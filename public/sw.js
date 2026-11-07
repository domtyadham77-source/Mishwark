const CACHE = 'mishwark-shell-v3';
const SHELL = ['/', '/styles.css', '/app.js','/ride-map.js','/ride-catalog.js','/ride-flow.js','/manifest.webmanifest','/offline.html','/assets/icon.svg'];
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('mishwark-shell-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('fetch', event => {
 const request=event.request,url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/api/'))return;
 if(request.mode==='navigate'){
  event.respondWith((async()=>{
   const cached=await caches.match('/');
   try{
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),3500);
    const fresh=await fetch(request,{signal:controller.signal});clearTimeout(timer);
    if(fresh.ok){const copy=fresh.clone();caches.open(CACHE).then(cache=>cache.put('/',copy));}
    return fresh;
   }catch{return cached||caches.match('/offline.html');}
  })());
  return;
 }
 event.respondWith((async()=>{
  const cached=await caches.match(request);
  const refresh=fetch(request).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(request,copy));}return response;});
  if(cached){event.waitUntil(refresh.catch(()=>{}));return cached;}
  try{return await refresh;}catch{return caches.match('/offline.html');}
 })());
});
self.addEventListener('push',event=>{
 let payload={title:'مِشوارك',body:'عندك تحديث جديد بخصوص رحلتك.',url:'/'};
 try{if(event.data)payload={...payload,...event.data.json()};}catch{}
 event.waitUntil(self.registration.showNotification(payload.title,{body:payload.body,icon:'/assets/icon.svg',badge:'/assets/icon.svg',data:{url:payload.url},dir:'rtl',lang:'ar'}));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();const target=new URL(event.notification.data?.url||'/',self.location.origin).href;
 event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(windows=>{const match=windows.find(client=>client.url===target);return match?match.focus():clients.openWindow(target);}));
});
