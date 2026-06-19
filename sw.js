// ─────────────────────────────────────────
//  sw.js — SH Grip Pro Service Worker
// ─────────────────────────────────────────

const APP_VERSION  = 'v1.0.0';
const CACHE_NAME   = `sh-grip-pro-${APP_VERSION}`;

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/css/main.css',
  '/js/app.js',
  '/js/db.js',
  '/js/engine.js',
  '/js/session.js',
  '/js/history.js',
  '/js/stats.js',
  '/js/settings.js',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// ── 설치 ─────────────────────────────────
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// ── 활성화 (구버전 캐시 삭제) ────────────
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(k => k !== CACHE_NAME)
          .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ── 패치 (캐시 우선, 네트워크 폴백) ──────
self.addEventListener('fetch', (e) => {
  // GET 요청만 처리
  if (e.request.method !== 'GET') return;

  // chrome-extension 등 외부 요청 무시
  if (!e.request.url.startsWith(self.location.origin)) return;

  e.respondWith(
    caches.match(e.request)
      .then(cached => {
        if (cached) return cached;

        return fetch(e.request, { cache: 'no-cache' })
          .then(response => {
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
            return response;
          })
          .catch(() => {
            // 오프라인 + 캐시 미스 → index.html 반환 (SPA fallback)
            if (e.request.headers.get('accept')?.includes('text/html')) {
              return caches.match('/index.html');
            }
          });
      })
  );
});

// ── 앱에서 업데이트 메시지 수신 ──────────
self.addEventListener('message', (e) => {
  if (e.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
