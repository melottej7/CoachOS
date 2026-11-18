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
    const code = [...sources(path.join(WEB, 'app')), ...sources(path.join(WEB, 'components'))]
      .map((f) => readFileSync(f, 'utf8'))
      .join('\n');
    const targets = new Set(Object.values(TOURS).flatMap((steps) => steps.flatMap((s) => s.targets ?? [])));
    for (const t of targets) {
      // Marqueur fixe (data-tour="x", tour="x") ou conditionnel (data-tour={… ? 'x' : undefined}).
      const present = code.includes(`tour="${t}"`) || new RegExp(`data-tour=\\{[^}]*'${t}'`).test(code);
      expect(present, `data-tour="${t}" introuvable`).toBe(true);
    }
  });

  it('chaque visite commence sur une page connue et se termine sur le bouton du guide', () => {
    for (const steps of Object.values(TOURS)) {
      expect(steps[0]!.path).not.toBe('any');
      expect(steps[0]!.href).toBeDefined();
      expect(steps.at(-1)!.targets).toEqual(['guide-help']);
      for (const s of steps) {
        if (s.action === 'click') expect(s.targets?.length).toBeGreaterThan(0);
        for (const k of Object.keys(s.textFor ?? {})) expect(s.targets).toContain(k);
      }
    }
  });
});
