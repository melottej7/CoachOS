import type { ProgramPhase, ProgramWeek } from './program';

/**
 * D-106 · Blocs d’un programme, tels que le fondateur les écrit (« 3 semaines + 1 de repos ») : le tremplin
 * (3 semaines + 1 de décharge, D-107), chaque cycle de développement fermé par sa semaine allégée, puis l’affûtage.
 */
export interface ProgramBlock { n: number; phase: Exclude<ProgramPhase, 'recuperation'> | 'recuperation'; weeks: ProgramWeek[]; loadWeeks: number; lightWeeks: number }

export function programBlocks(weeks: ProgramWeek[]): ProgramBlock[] {
  const out: ProgramBlock[] = [];
  let open: ProgramBlock | null = null;
  for (const w of weeks) {
    if (w.phase === 'recuperation' && (open?.phase === 'developpement' || open?.phase === 'tremplin')) {
      open.weeks.push(w); open.lightWeeks++;
      open = null; // la semaine allégée ferme le cycle
      continue;
    }
    if (!open || open.phase !== w.phase) {
      open = { n: out.length + 1, phase: w.phase, weeks: [], loadWeeks: 0, lightWeeks: 0 };
      out.push(open);
    }
    open.weeks.push(w);
    if (w.phase === 'recuperation') open.lightWeeks++; else open.loadWeeks++;
  }
  return out;
}

/** Variation de volume d’une semaine par rapport à la précédente, en % arrondi (null pour la première). */
export function weekDelta(weeks: ProgramWeek[], index: number): number | null {
  const i = weeks.findIndex((w) => w.index === index);
  const prev = weeks[i - 1], cur = weeks[i];
  if (!prev || !cur || !prev.minutes) return null;
  return Math.round((cur.minutes / prev.minutes - 1) * 100);
}
