// Service Worker — Vegas OS
// "Rede primeiro": com internet sempre pega a versão mais nova publicada no
// GitHub; sem internet usa a última cópia salva. Suas alterações chegam
// sozinhas no app instalado.
const CACHE = 'vegas-os-v10';
const ARQUIVOS = ['./', './index.html', './manifest.json', './assets/icons/icon-192.png', './assets/icons/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARQUIVOS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Apps Script, fontes e CDN passam direto: dados sempre ao vivo
  if (url.origin !== location.origin) return;

  e.respondWith(
    fetch(req, { cache: 'no-store' })
      .then(res => {
        if (res && res.ok) {
          const copia = res.clone();
          caches.open(CACHE).then(c => c.put(req, copia));
        }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: req.mode === 'navigate' })
        .then(r => r || caches.match('./index.html')))
  );
});
