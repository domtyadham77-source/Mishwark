const CACHE = 'mishwark-shell-v2';
const SHELL = ['/', '/styles.css', '/app.js','/ride-map.js', '/ride-flow.js', '/manifest.webmanifest', '/offline.html', '/assets/icon.svg'];
self.addEventListener('install', (event) => event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener('activate', (event) => event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  event.respondWith(fetch(event.request).then((response) => { if (response.ok) { const copy = response.clone(); caches.open(CACHE).then((cache) => cache.put(event.request, copy)); } return response; }).catch(async () => (await caches.match(event.request)) || caches.match('/offline.html')));
});
self.addEventListener('push', (event) => {
  let payload = { title: 'مِشوارك', body: 'عندك تحديث جديد بخصوص رحلتك.', url: '/' };
  try { if (event.data) payload = { ...payload, ...event.data.json() }; } catch {}
  event.waitUntil(self.registration.showNotification(payload.title, { body: payload.body, icon: '/assets/icon.svg', badge: '/assets/icon.svg', data: { url: payload.url }, dir: 'rtl', lang: 'ar' }));
});
self.addEventListener('notificationclick', (event) => { event.notification.close(); const target = new URL(event.notification.data?.url || '/', self.location.origin).href; event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => { const match = windows.find((client) => client.url === target); return match ? match.focus() : clients.openWindow(target); })); });
