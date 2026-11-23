import { describe, expect, it } from 'vitest';
import nextConfig, { securityHeaders } from '../next.config';

// D-116 · Hors développement (ici : test), chaque réponse porte les en-têtes de sécurité.
describe('en-têtes de sécurité', () => {
  it('sont posés sur toutes les routes hors développement', async () => {
    const rules = await nextConfig.headers!();
    expect(rules).toHaveLength(1);
    expect(rules[0]!.source).toBe('/(.*)');
    const keys = rules[0]!.headers.map((h) => h.key);
    expect(keys).toEqual(expect.arrayContaining(['Content-Security-Policy', 'X-Frame-Options', 'X-Content-Type-Options', 'Referrer-Policy', 'Strict-Transport-Security', 'Permissions-Policy']));
  });
  it('interdisent le cadre et le mauvais typage, gardent le micro pour les vocaux', () => {
    const h = Object.fromEntries(securityHeaders().map((x) => [x.key, x.value]));
    expect(h['Content-Security-Policy']).toContain("frame-ancestors 'none'");
    expect(h['Content-Security-Policy']).not.toContain('script-src');
    expect(h['X-Content-Type-Options']).toBe('nosniff');
    expect(h['Permissions-Policy']).toContain('microphone=(self)');
  });
});
