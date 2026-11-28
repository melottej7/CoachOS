import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { fold, HELP_ARTICLES, helpHref, searchHelp } from './articles';

// D-194 · Centre d’aide : chaque article est complet et mène à une vraie page ; la recherche ignore accents et majuscules.

const app = path.join(__dirname, '..', 'app');

describe('centre d’aide (D-194)', () => {
  it('des articles complets, un identifiant unique par public', () => {
    for (const who of ['coach', 'athlete'] as const) {
      const mine = HELP_ARTICLES.filter((a) => a.audience === who);
      expect(mine.length).toBeGreaterThan(5);
      expect(new Set(mine.map((a) => a.slug)).size).toBe(mine.length);
    }
    for (const a of HELP_ARTICLES) {
      expect(a.title.length, a.slug).toBeLessThanOrEqual(60);
      expect(a.summary.length, a.slug).toBeGreaterThan(20);
      expect(a.steps?.length ?? 0, a.slug).toBeGreaterThan(0);
      expect(a.slug).toMatch(/^[a-z0-9-]+$/);
    }
  });

  it('chaque « Y aller » mène à une page qui existe', () => {
    for (const a of HELP_ARTICLES) {
      for (const l of a.links ?? []) {
        const href = helpHref(a.audience === 'coach' ? '/coach/[wid]' : '/athlete/[wid]', l.to).split('?')[0]!;
        const dir = path.join(app, ...href.split('/').filter(Boolean));
        expect(fs.existsSync(path.join(dir, 'page.tsx')), `${a.slug} → ${href}`).toBe(true);
      }
    }
  });

  it('trouve par le sens, sans tenir compte des accents ni des majuscules', () => {
    expect(fold('Écrire une SÉANCE !')).toBe('ecrire une seance');
    expect(searchHelp('ecrire', 'coach')[0]!.slug).toBe('ecrire-seance');
    expect(searchHelp('INVITER', 'coach')[0]!.slug).toBe('inviter-eleves');
    expect(searchHelp('pyramide', 'coach')[0]!.slug).toBe('series-charges');
    // D-198 : l’interrupteur clair ou sombre se trouve par la recherche, des deux côtés.
    expect(searchHelp('sombre', 'coach')[0]!.slug).toBe('mode-sombre');
    expect(searchHelp('thème nuit', 'athlete')[0]!.slug).toBe('mode-sombre');
    expect(searchHelp('carte bancaire', 'coach').map((a) => a.slug)).toContain('abonnement');
    expect(searchHelp('silencieux', 'athlete')[0]!.slug).toBe('son-voix');
    expect(searchHelp('pause', 'athlete')[0]!.slug).toBe('suivre-seance');
    expect(searchHelp('zzzz introuvable', 'coach')).toEqual([]);
    // Un élève ne voit pas l’aide du coach, et inversement.
    expect(searchHelp('inviter', 'athlete').some((a) => a.audience === 'coach')).toBe(false);
    expect(searchHelp('', 'athlete').every((a) => a.audience === 'athlete')).toBe(true);
  });
});
