import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

// D-080 : lecture hors ligne de l’espace élève. Le service worker est exécuté ici avec un réseau et un cache simulés.

const SRC = readFileSync(join(__dirname, '..', 'public', 'sw.js'), 'utf8');
const ORIGIN = 'https://coachos.test';
const TODAY = `${ORIGIN}/athlete/w1/today`;

function harness() {
  const stores = new Map<string, Map<string, Response>>();
  const open = (name: string) => {
    if (!stores.has(name)) stores.set(name, new Map());
    const m = stores.get(name)!;
    return {
      put: async (k: Request | string, r: Response) => { m.set(typeof k === 'string' ? k : k.url, r); },
      match: async (k: Request | string) => { const r = m.get(typeof k === 'string' ? k : k.url); return r ? r.clone() : undefined; },
      delete: async (k: string) => m.delete(k),
      keys: async () => [...m.keys()],
    };
  };
  const caches = {
    open: async (n: string) => open(n),
    delete: async (n: string) => stores.delete(n),
    keys: async () => [...stores.keys()],
    match: async (k: Request) => { for (const n of stores.keys()) { const r = await open(n).match(k); if (r) return r; } return undefined; },
  };
  let online = true;
  let page = '<html><body><main>Séance du jour : Footing 45′</main></body></html>';
  let redirectToLogin = false;
  const fetch = async (req: Request) => {
    if (!online) throw new TypeError('Failed to fetch');
    if (redirectToLogin) {
      const r = new Response('<html><body>Connexion</body></html>', { headers: { 'content-type': 'text/html' } });
      Object.defineProperty(r, 'redirected', { value: true });
      Object.defineProperty(r, 'url', { value: `${ORIGIN}/login` });
      return r;
    }
    return new Response(req.url.includes('/_next/static/') ? 'js' : page, { headers: { 'content-type': req.url.includes('/_next/static/') ? 'application/javascript' : 'text/html; charset=utf-8' } });
  };
  const listeners: Record<string, (e: unknown) => void> = {};
  const self = { addEventListener: (t: string, f: (e: unknown) => void) => { listeners[t] = f; }, location: { origin: ORIGIN }, skipWaiting: () => {}, clients: { claim: async () => {} } };
  runInNewContext(SRC, { self, caches, fetch, Response, Request, URL, Date, Promise, Math, Error, TypeError });

  async function go(url: string, init: { method?: string; mode?: string } = {}): Promise<Response | null> {
    const req = Object.assign(new Request(url, { method: init.method ?? 'GET' }), {}) as Request;
    Object.defineProperty(req, 'mode', { value: init.mode ?? 'navigate' });
    let res: Promise<Response> | null = null;
    const waits: Promise<unknown>[] = [];
    listeners.fetch!({ request: req, respondWith: (p: Promise<Response>) => { res = p; }, waitUntil: (p: Promise<unknown>) => waits.push(p) });
    const out = res ? await res : null;
    await Promise.all(waits);
    return out;
  }
  return {
    go, stores,
    set online(v: boolean) { online = v; }, set page(v: string) { page = v; }, set redirectToLogin(v: boolean) { redirectToLogin = v; },
  };
}

describe('service worker hors ligne (D-080)', () => {
  it('réseau d’abord ; sans réseau, la dernière page de l’élève avec un bandeau', async () => {
    const h = harness();
    expect(await (await h.go(TODAY))!.text()).toContain('Footing 45′');
    h.page = '<html><body><main>Séance du jour : Seuil 3×8</main></body></html>';
    expect(await (await h.go(TODAY))!.text()).toContain('Seuil 3×8'); // à jour dès que le réseau répond
    h.online = false;
    const off = await (await h.go(TODAY))!.text();
    expect(off).toContain('Seuil 3×8');
    expect(off).toMatch(/<body><div role="status"[^>]*>Hors ligne · page enregistrée le /);
    // Page jamais ouverte : écran « Pas de réseau ».
    const never = (await h.go(`${ORIGIN}/athlete/w1/progress`))!;
    expect(never.status).toBe(503);
    expect(await never.text()).toContain('Pas de réseau');
  });

  it('jamais l’espace coach ni l’API ; fichiers de l’application gardés', async () => {
    const h = harness();
    expect(await h.go(`${ORIGIN}/coach/w1/planning`)).toBeNull();
    expect(await h.go(`${ORIGIN}/api/v1/workspaces/w1/notifications`, { mode: 'cors' })).toBeNull();
    await h.go(`${ORIGIN}/_next/static/chunks/app.js`, { mode: 'no-cors' });
    expect([...h.stores.keys()]).toEqual(['coachos-assets-v1']);
    h.online = false;
    expect(await (await h.go(`${ORIGIN}/_next/static/chunks/app.js`, { mode: 'no-cors' }))!.text()).toBe('js');
  });

  it('déconnexion, changement d’identité ou session expirée : tout est effacé', async () => {
    const h = harness();
    await h.go(TODAY);
    expect(h.stores.get('coachos-pages-v1')?.size).toBe(1);
    await h.go(`${ORIGIN}/auth/signout`, { method: 'POST' });
    expect(h.stores.has('coachos-pages-v1')).toBe(false);
    await h.go(TODAY);
    await h.go(`${ORIGIN}/demo`);
    expect(h.stores.has('coachos-pages-v1')).toBe(false);
    await h.go(TODAY);
    h.redirectToLogin = true;
    await h.go(TODAY);
    expect(h.stores.has('coachos-pages-v1')).toBe(false);
  });
});
