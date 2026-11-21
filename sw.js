// Resposta Afiada — service worker
const SHELL = 'afiada-shell-v1';
const ARQS = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(ARQS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== SHELL && k !== 'afiada-shared').map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Recebe o que foi compartilhado do WhatsApp
  if (e.request.method === 'POST' && url.pathname.endsWith('/share-target')) {
    e.respondWith((async () => {
      try {
        const fd = await e.request.formData();
        const c = await caches.open('afiada-shared');
        for (const k of await c.keys()) await c.delete(k);
        const files = fd.getAll('media').filter(f => f && typeof f !== 'string');
        let i = 0;
        for (const f of files) {
          await c.put('./shared/' + i, new Response(f, {
            headers: { 'content-type': f.type || 'application/octet-stream', 'x-name': encodeURIComponent(f.name || ('arquivo' + i)) }
          }));
          i++;
        }
        const meta = { title: fd.get('title') || '', text: fd.get('text') || '', url: fd.get('url') || '', n: i, t: Date.now() };
        await c.put('./shared/meta', new Response(JSON.stringify(meta), { headers: { 'content-type': 'application/json' } }));
      } catch (err) { /* abre o app mesmo assim */ }
      return Response.redirect('./?shared=1', 303);
    })());
    return;
  }

  if (e.request.method !== 'GET' || url.origin !== location.origin) return;

  // Rede primeiro, cache se estiver sem internet
  e.respondWith(
    fetch(e.request)
      .then(r => { const copia = r.clone(); caches.open(SHELL).then(c => c.put(e.request, copia)); return r; })
      .catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
  );
});
