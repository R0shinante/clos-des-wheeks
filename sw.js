/* Mode hors ligne du Clos des Wheeks.
   La page est demandée au réseau d'abord (on a toujours la dernière version quand on est en ligne), puis, à défaut, prise dans la réserve.
   La partie n'est jamais touchée ici : elle vit dans le stockage du navigateur, pas dans cette réserve. */
'use strict';
const VERSION = '5f096a30';
const CACHE = 'clos-wheeks-' + VERSION;
const KEY = new URL('index.html', self.registration.scope).href;
const FILES = ['index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'maskable-512.png', 'apple-touch-icon.png', 'favicon-32.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(FILES.map(f => fetch(new Request(f, { cache: 'reload' })).then(r => { if (!r.ok) throw new Error(f); return c.put(f === 'index.html' ? KEY : new URL(f, self.registration.scope).href, r); })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.indexOf('clos-wheeks-') === 0 && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url); if (url.origin !== location.origin) return;
  const page = req.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('/index.html');
  e.respondWith(page ? pageFirstNet() : assetFirstCache(req));
});

async function pageFirstNet() {
  const cache = await caches.open(CACHE), kept = await cache.match(KEY);
  try {
    // « no-cache » : on redemande au serveur même si l'hébergeur autorise de garder la page quelques minutes
    const net = await new Promise((ok, no) => {
      const t = kept ? setTimeout(() => no(new Error('lent')), 4000) : 0;
      fetch(new Request(KEY, { cache: 'no-cache' })).then(r => { clearTimeout(t); ok(r); }, er => { clearTimeout(t); no(er); });
    });
    if (!net.ok) throw new Error('http ' + net.status);
    const body = await net.blob(), copy = () => new Response(body, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    cache.put(KEY, copy()); return copy();
  } catch (err) {
    return kept || Response.error();
  }
}
async function assetFirstCache(req) {
  const cache = await caches.open(CACHE), hit = await cache.match(req);
  if (hit) return hit;
  const net = await fetch(req); if (net.ok) cache.put(req, net.clone()); return net;
}
