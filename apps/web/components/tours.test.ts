import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { matchPath, TOURS } from './tours';

const WEB = path.resolve(import.meta.dirname, '..');

function sources(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) sources(p, out);
    else if (p.endsWith('.tsx')) out.push(p);
  }
  return out;
}

describe('visites du guide CoachOS (CE-C-01)', () => {
  it('reconnaît les pages attendues', () => {
    const root = '/athlete/w1';
    expect(matchPath('/athlete/:wid/today', '/athlete/w1/today', root)).toBe(true);
    expect(matchPath('/athlete/:wid/today', '/athlete/w1/today/', root)).toBe(true);
    expect(matchPath('/athlete/:wid/workouts/:id', '/athlete/w1/workouts/42', root)).toBe(true);
    expect(matchPath('/athlete/:wid/workouts/:id', '/athlete/w1/workouts/42/feedback', root)).toBe(false);
    expect(matchPath('/athlete/:wid/today', '/athlete/w1/schedule', root)).toBe(false);
    expect(matchPath('any', '/athlete/w1/profile', root)).toBe(true);
    expect(matchPath('any', '/coach/w1/calendar', root)).toBe(false);
  });

  it('chaque élément visé existe dans les écrans', () => {
    // D-129 : la refonte écrit ses écrans aussi dans design/ et views/.
    const code = [...sources(path.join(WEB, 'app')), ...sources(path.join(WEB, 'components')), ...sources(path.join(WEB, 'design')), ...sources(path.join(WEB, 'views'))]
      .map((f) => readFileSync(f, 'utf8'))
      .join('\n');
    const targets = new Set(Object.values(TOURS).flatMap((steps) => steps.flatMap((s) => s.targets ?? [])));
    for (const t of targets) {
      // Marqueur fixe (data-tour="x", tour="x") ou conditionnel (data-tour={… ? 'x' : undefined}).
      const present = code.includes(`tour="${t}"`) || code.includes(`tour: '${t}'`) || new RegExp(`data-tour=\\{[^}]*'${t}'`).test(code);
      expect(present, `data-tour="${t}" introuvable`).toBe(true);
    }
  });

  it('chaque visite commence sur une page connue et se termine là où elle se relance', () => {
    for (const [id, steps] of Object.entries(TOURS)) {
      expect(steps[0]!.path).not.toBe('any');
      expect(steps[0]!.href).toBeDefined();
      // Élève (D-129, D-141) : le Profil ; coach (D-143) : le menu du compte. C’est de là que la visite se relance.
      expect(steps.at(-1)!.targets).toEqual([id === 'athlete' ? 'tab-profile' : 'account-menu']);
      for (const s of steps) {
        if (s.action === 'click') expect(s.targets?.length).toBeGreaterThan(0);
        for (const k of Object.keys(s.textFor ?? {})) expect(s.targets).toContain(k);
      }
    }
  });
});
