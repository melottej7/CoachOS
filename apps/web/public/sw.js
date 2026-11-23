/*
 * CoachOS · lecture hors ligne de l’espace élève (CE-E-06, D-080).
 * Réseau d’abord, toujours : la page à jour est servie dès que le réseau répond, et gardée.
 * Sans réseau, la dernière version gardée de la page de l’élève s’affiche avec un bandeau « hors ligne ».
 * Seules les pages de l’élève (/athlete/…) et les fichiers de l’application sont gardés ; jamais l’API,
 * jamais l’espace coach. Tout est effacé à la déconnexion ou au changement d’identité.
 */
const PAGES = 'coachos-pages-v1';
const ASSETS = 'coachos-assets-v1';
const MAX_PAGES = 40;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== PAGES && k !== ASSETS) await caches.delete(k);
    await self.clients.claim();
  })());
});

const clearAll = () => Promise.all([caches.delete(PAGES), caches.delete(ASSETS)]);

self.addEventListener('message', (event) => {
  if (event.data === 'clear') event.waitUntil(clearAll());
});

const isAthletePage = (url) => /^\/athlete\/[^/]+\/(today|schedule|workouts|progress|coach|setup)(\/|$)/.test(url.pathname);
const isAsset = (url) => url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/') || url.pathname === '/apple-touch-icon.png' || url.pathname === '/manifest.webmanifest';

const MAX_ASSETS = 200;
async function trim(name, max) {
  const c = await caches.open(name);
  const keys = await c.keys();
  for (const k of keys.slice(0, Math.max(0, keys.length - max))) await c.delete(k);
}

function offlinePage(html, savedAt) {
  const when = savedAt ? new Date(savedAt).toLocaleString('fr-BE', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : null;
  const banner = `<div role="status" style="position:sticky;top:0;z-index:1000;background:#7a4b00;color:#fff;padding:8px 14px;font:600 14px/1.4 system-ui,sans-serif;text-align:center">Hors ligne · page enregistrée${when ? ` le ${when}` : ''}. Pour envoyer un retour, attends le réseau.</div>`;
  return html.replace(/<body([^>]*)>/i, (m) => `${m}${banner}`);
}

const FALLBACK = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Hors ligne · CoachOS</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0f1d24;color:#e8f0f2;font:16px/1.5 system-ui,sans-serif;padding:16px}main{max-width:420px;text-align:center}a{color:#5fd3b5}</style></head>
<body><main><h1>Pas de réseau</h1><p>Cette page n’a pas encore été ouverte sur ce téléphone, elle n’est donc pas disponible hors ligne.</p><p>Les pages déjà consultées (Aujourd’hui, Programme, tes séances) restent lisibles sans réseau.</p><p><a href="javascript:location.reload()">Réessayer</a></p></main></body></html>`;

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Déconnexion et changement d’identité : rien ne reste sur l’appareil.
  if ((req.method === 'POST' && url.pathname === '/auth/signout') || (req.mode === 'navigate' && (url.pathname === '/login' || url.pathname === '/demo'))) {
    event.waitUntil(clearAll());
    return;
  }
  if (req.method !== 'GET' || url.pathname.startsWith('/api/')) return;

  if (req.mode === 'navigate' && isAthletePage(url)) {
    event.respondWith((async () => {
      try {
        const res = await fetch(req);
        // Une redirection vers la connexion veut dire : plus de session ; on n’affichera plus rien de gardé.
        if (res.redirected && /^\/(login|demo)\b/.test(new URL(res.url).pathname)) { await clearAll(); return res; }
        if (res.ok && (res.headers.get('content-type') || '').includes('text/html')) {
          const copy = res.clone();
          const body = await copy.text();
          const c = await caches.open(PAGES);
          await c.delete(req.url);
          await c.put(req.url, new Response(body, { headers: { 'content-type': 'text/html; charset=utf-8', 'x-saved-at': new Date().toISOString() } }));
          event.waitUntil(trim(PAGES, MAX_PAGES));
        }
        return res;
      } catch {
        const c = await caches.open(PAGES);
        const hit = await c.match(req.url, { ignoreSearch: false }) || await c.match(url.origin + url.pathname, { ignoreSearch: true });
        if (hit) return new Response(offlinePage(await hit.text(), hit.headers.get('x-saved-at')), { headers: { 'content-type': 'text/html; charset=utf-8' } });
        return new Response(FALLBACK, { status: 503, headers: { 'content-type': 'text/html; charset=utf-8' } });
      }
    })());
    return;
  }

  if (isAsset(url) && !url.searchParams.has('v')) {
    event.respondWith((async () => {
      try {
        const res = await fetch(req);
        if (res.ok) { const c = await caches.open(ASSETS); await c.put(req, res.clone()); event.waitUntil(trim(ASSETS, MAX_ASSETS)); }
        return res;
      } catch {
        const hit = await caches.match(req);
        if (hit) return hit;
        throw new Error('hors ligne');
      }
    })());
  }
});

/*
 * D-118 · Rappels push : une alerte courte (titre, phrase, lien), jamais le texte d’un message. Le clic ouvre
 * l’écran utile par le résolveur de notification, qui revérifie les droits.
 */
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = {}; }
  const title = typeof data.title === 'string' && data.title ? data.title : 'CoachOS';
  const options = {
    body: typeof data.body === 'string' ? data.body : '',
    icon: '/icons/192.png',
    badge: '/icons/192.png',
    tag: typeof data.tag === 'string' ? data.tag : undefined,
    data: { url: typeof data.url === 'string' ? data.url : '/' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || '/', self.location.origin);
  if (target.origin !== self.location.origin) return;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of windows) {
      if ('focus' in c) {
        await c.focus();
        if ('navigate' in c) { await c.navigate(target.href); return; }
      }
    }
    await self.clients.openWindow(target.href);
  })());
});
