// Pinch service worker. Scope: this folder (/pinch/ on GitHub Pages), never
// the site root — Adam's other apps live on the same origin.
//
// · The app shell is precached and served cache-first, so Pinch opens
//   offline. 🚨 Bump VERSION with every deploy that changes a shell file, or
//   phones keep the old one. Activate deletes only OLD `pinch-` caches.
// · The CDN modules (supabase-js, ZXing) and photo signed URLs are cached at
//   runtime, cache-first, so a second launch works with no signal.
// · Supabase data, auth, the import function and Open Food Facts always go
//   to the network: recipes come from state.js's own offline copy instead.

const VERSION = 'v2';
const SHELL = `pinch-shell-${VERSION}`;
const RUNTIME = 'pinch-runtime-v1';

const SHELL_FILES = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/base.css',
  'css/components.css',
  'css/home.css',
  'css/splash.css',
  'css/tokens.css',
  'fonts/plus-jakarta-sans-latin-wght-italic.woff2',
  'fonts/plus-jakarta-sans-latin-wght-normal.woff2',
  'icons/apple-touch-icon.png',
  'icons/favicon.ico',
  'icons/favicon.svg',
  'icons/icon-192-maskable.png',
  'icons/icon-192.png',
  'icons/icon-512-maskable.png',
  'icons/icon-512.png',
  'icons/sprite.svg',
  'js/app.js',
  'js/claude.js',
  'js/components/dom.js',
  'js/components/flag.js',
  'js/components/icons.js',
  'js/components/photo.js',
  'js/components/sheet.js',
  'js/components/stepper.js',
  'js/components/toast.js',
  'js/demo-data.js',
  'js/lib/backup.js',
  'js/lib/bloc-import.js',
  'js/lib/claude-shape.js',
  'js/lib/cuisines.js',
  'js/lib/densities.js',
  'js/lib/format.js',
  'js/lib/ids.js',
  'js/lib/method.js',
  'js/lib/off.js',
  'js/lib/parse.js',
  'js/lib/recipes.js',
  'js/lib/rows.js',
  'js/lib/scale.js',
  'js/lib/units.js',
  'js/lib/validate.js',
  'js/prefs.js',
  'js/router.js',
  'js/state.js',
  'js/storage.js',
  'js/supabase.js',
  'js/theme-param.js',
  'js/views/bloc-import.js',
  'js/views/check.js',
  'js/views/editor.js',
  'js/views/home.js',
  'js/views/ingredient.js',
  'js/views/product.js',
  'js/views/recipe-sheet.js',
  'js/views/scanner.js',
  'js/views/settings.js',
  'js/views/signin.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL).then((c) => c.addAll(SHELL_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keep = new Set([SHELL, RUNTIME]);
    for (const key of await caches.keys()) {
      if (key.startsWith('pinch-') && !keep.has(key)) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

const RUNTIME_HOSTS = ['cdn.jsdelivr.net'];
const isPhoto = (url) => url.hostname.endsWith('.supabase.co') && url.pathname.includes('/storage/v1/object/sign/pinch-photos/');

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin === location.origin) {
    if (!url.pathname.startsWith(new URL(self.registration.scope).pathname)) return;
    if (url.pathname.endsWith('/tests.html') || url.pathname.includes('/tests/')) return;
    if (req.mode === 'navigate') {
      event.respondWith(caches.match('index.html').then((hit) => hit ?? fetch(req)).catch(() => fetch(req)));
      return;
    }
    event.respondWith(caches.match(req, { ignoreSearch: true }).then((hit) => hit ?? fetch(req)));
    return;
  }

  if (RUNTIME_HOSTS.includes(url.hostname) || isPhoto(url)) {
    event.respondWith((async () => {
      const cache = await caches.open(RUNTIME);
      const hit = await cache.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) cache.put(req, res.clone());
      return res;
    })());
  }
});
