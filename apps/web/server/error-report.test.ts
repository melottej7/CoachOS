import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildEnvelope, errorReportingEnabled, parseDsn, reportError, scrub } from './error-report';

// D-168 · Suivi des erreurs : éteint sans SENTRY_DSN, aucune donnée personnelle dans ce qui part.
const DSN = 'https://abc123@o42.ingest.de.sentry.io/4507';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('suivi des erreurs (D-168)', () => {
  it('lit l’adresse Sentry et refuse une valeur mal formée', () => {
    expect(parseDsn(DSN)).toMatchObject({ endpoint: 'https://o42.ingest.de.sentry.io/api/4507/envelope/', publicKey: 'abc123' });
    expect(parseDsn('https://k@sentry.example.com/relais/12')?.endpoint).toBe('https://sentry.example.com/relais/api/12/envelope/');
    for (const bad of [undefined, '', 'pas une adresse', 'https://o42.ingest.sentry.io/4507', 'https://k@h/abc', 'ftp://k@h/1']) {
      expect(parseDsn(bad)).toBeNull();
    }
  });

  it('éteint sans SENTRY_DSN : rien n’est envoyé', async () => {
    vi.stubEnv('SENTRY_DSN', '');
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    expect(errorReportingEnabled()).toBe(false);
    expect(await reportError(new Error('x'), { module: 'test' })).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('masque adresses, identifiants, nombres et textes cités', () => {
    const out = scrub('duplicate key "lea@ex.be" for user 2f1c1a9e-1b2c-4d3e-8f90-123456789abc at 14:32, note « genou douloureux »');
    expect(out).not.toMatch(/lea@ex\.be|2f1c1a9e|14:32|genou/);
    expect(out).toContain('duplicate key');
    expect(scrub('contact: lea.dupont@exemple.be')).toBe('contact: <adresse>');
    expect(scrub('x'.repeat(500))).toHaveLength(300);
  });

  it('l’envoi porte la référence, le module et la pile, jamais le message brut', () => {
    const err = Object.assign(new TypeError('cannot read "lea@ex.be"'), { digest: '998877' });
    const { eventId, body } = buildEnvelope(parseDsn(DSN)!, err, { module: 'sessions', code: 'UNEXPECTED', digest: '998877', requestId: 'r-1', route: '/coach/athletes/[id]' });
    const [header, item, event] = body.trim().split('\n').map((l) => JSON.parse(l));
    expect(header).toMatchObject({ event_id: eventId, dsn: DSN });
    expect(item).toEqual({ type: 'event' });
    expect(event.tags).toEqual({ module: 'sessions', code: 'UNEXPECTED', digest: '998877', reqId: 'r-1' });
    expect(event.transaction).toBe('/coach/athletes/[id]');
    expect(event.exception.values[0].type).toBe('TypeError');
    expect(event.exception.values[0].stacktrace.frames.length).toBeGreaterThan(0);
    expect(body).not.toContain('lea@ex.be');
    expect(body).not.toContain(process.cwd()); // chemins relatifs : ni dossier du serveur, ni nom d’utilisateur
    expect(event).not.toHaveProperty('request');
    expect(event).not.toHaveProperty('user');
  });

  it('envoie à Sentry avec la clé publique et ne lève jamais', async () => {
    vi.stubEnv('SENTRY_DSN', DSN);
    const fetchSpy = vi.fn(async () => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchSpy);
    const id = await reportError(new Error('boum'), { module: 'test' });
    expect(id).toMatch(/^[0-9a-f]{32}$/);
    const [url, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://o42.ingest.de.sentry.io/api/4507/envelope/');
    expect((init.headers as Record<string, string>)['x-sentry-auth']).toContain('sentry_key=abc123');

    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('réseau coupé'); }));
    expect(await reportError(new Error('boum'), { module: 'test' })).toBeNull();
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 429 })));
    expect(await reportError(new Error('boum'), { module: 'test' })).toBeNull();
  });
});
