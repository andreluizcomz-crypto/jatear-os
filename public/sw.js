// Service worker do Jatear OS — cache do app shell apenas.
// Navegações: rede primeiro (garante versão nova), cache como reserva offline.
// Assets com hash do build: cache primeiro (são imutáveis).
const CACHE = 'jatear-os-shell-v1';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((nomes) =>
        Promise.all(nomes.filter((n) => n !== CACHE).map((n) => caches.delete(n)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (evento) => {
  const requisicao = evento.request;
  if (requisicao.method !== 'GET' || !requisicao.url.startsWith(self.location.origin)) {
    return;
  }
  const url = new URL(requisicao.url);

  if (requisicao.mode === 'navigate') {
    evento.respondWith(
      fetch(requisicao)
        .then((resposta) => {
          const copia = resposta.clone();
          caches.open(CACHE).then((cache) => cache.put('/index.html', copia));
          return resposta;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  const ehAsset =
    url.pathname.startsWith('/assets/') ||
    url.pathname === '/manifest.json' ||
    /\.(png|svg|ico|jpg)$/.test(url.pathname);
  if (ehAsset) {
    evento.respondWith(
      caches.match(requisicao).then(
        (emCache) =>
          emCache ||
          fetch(requisicao).then((resposta) => {
            const copia = resposta.clone();
            caches.open(CACHE).then((cache) => cache.put(requisicao, copia));
            return resposta;
          })
      )
    );
  }
});
