import type { Sport } from './sports';
import { describeIntensity, describeMeasure, PHASE_LABELS, REP_SECONDS, stepEstimate, ZONE_CSS_PCT, ZONE_TARGET_PCT, type Block, type Phase, type References, type Step, type Zone } from './structure';

// CE-E-04 (D-040) : forme de la séance, une barre par étape dans l’ordre réel (répétitions dépliées).
// Largeur = durée (estimée si la séance est en distance), hauteur = niveau d’intensité 1 à 7.

export interface ProfileBar {
  /** Position dans la séance dépliée (0…n-1). */
  index: number;
  phase: Phase;
  /** Niveau 1 (très facile) à 7 (maximal). */
  level: number;
  /** Le niveau vient d’une zone, d’un effort, d’une FC, d’une puissance ou d’une allure + VMA ; sinon il est supposé d’après la phase. */
  levelKnown: boolean;
  seconds: number;
  /** Étape prescrite en durée : la durée est déjà dans le libellé. */
  timed: boolean;
  /** Durée supposée pour le dessin (distance sans allure connue, ou bloc libre). */
  secondsApprox: boolean;
  /** « Récupération · 200 m · Z1 » */
  label: string;
  /** « répétition 3 sur 5 », ou « série 1 sur 3 · répétition 3 sur 5 » pour des répétitions imbriquées. */
  repeat: string | null;
}

/** Vitesse moyenne supposée, pour dessiner seulement (jamais affichée comme une estimation). */
const DRAW_SPEED: Record<Sport, number> = { running: 10, trail: 8, cycling: 25, swimming: 3, triathlon: 10, duathlon: 10, strength: 10 };
const OPEN_SECONDS = 300;

function levelOfPct(pct: number, bounds: number[]): number {
  const k = bounds.findIndex((b) => pct < b);
  return k === -1 ? 7 : Math.max(1, k + 1);
}

/** Niveau d’intensité d’une étape (1 à 7) et s’il est connu. */
export function stepLevel(s: Step, sport: Sport, refs?: References): { level: number; known: boolean } {
  const i = s.intensity;
  switch (i.kind) {
    case 'zone': return { level: i.zone, known: true };
    case 'rpe': return { level: Math.max(1, Math.min(7, Math.round(((i.max ?? i.min) / 10) * 7))), known: true };
    case 'hr': if (i.unit === 'pct_max') return { level: levelOfPct(i.max ?? i.min, [65, 72, 80, 87, 92, 96]), known: true }; break;
    case 'power':
      if (i.unit === 'pct_ftp') return { level: levelOfPct(i.max ?? i.min, [56, 76, 91, 106, 121, 150]), known: true };
      if (refs?.ftpW) return { level: levelOfPct(((i.max ?? i.min) / refs.ftpW) * 100, [56, 76, 91, 106, 121, 150]), known: true };
      break;
    case 'pace':
      if (i.unit === 'per_km' && refs?.vmaKmh && (sport === 'running' || sport === 'trail' || s.sport === 'running' || s.sport === 'trail')) {
        const fastest = Math.min(i.min, i.max ?? i.min);
        const pct = (3600 / fastest / refs.vmaKmh) * 100;
        // Bornes basses des zones 2 à 7 (D-029).
        return { level: levelOfPct(pct, ([2, 3, 4, 5, 6, 7] as Zone[]).map((z) => ZONE_TARGET_PCT[z][0])), known: true };
      }
      if (i.unit === 'per_100m' && refs?.cssSecPer100) {
        const pct = (refs.cssSecPer100 / Math.min(i.min, i.max ?? i.min)) * 100;
        return { level: levelOfPct(pct, ([2, 3, 4, 5, 6, 7] as Zone[]).map((z) => ZONE_CSS_PCT[z][0])), known: true };
      }
      break;
    default: break;
  }
  const byPhase: Record<Phase, number> = { warmup: 2, cooldown: 2, recovery: 1, rest: 1, work: 4, other: 3 };
  return { level: byPhase[s.phase], known: false };
}

/** Séance dépliée en barres (plafonnée à 400 barres). */
export function sessionProfile(blocks: Block[], sport: Sport, refs?: References): ProfileBar[] {
  const out: ProfileBar[] = [];
  const walk = (bs: Block[], repeat: string | null) => {
    for (const b of bs) {
      if (out.length >= 400) return;
      if (b.type === 'repeat') {
        const nested = b.steps.some((x) => x.type === 'repeat');
        for (let k = 1; k <= b.times; k++) {
          const here = `${nested ? 'série' : 'répétition'} ${k} sur ${b.times}`;
          walk(b.steps, repeat ? `${repeat} · ${here}` : here);
        }
        continue;
      }
      const est = stepEstimate(b, sport, refs);
      const m = b.measure;
      let seconds: number;
      let approx = false;
      if (m.kind === 'time') seconds = m.seconds;
      else if (est.seconds) seconds = est.seconds;
      else if (m.kind === 'distance') { seconds = Math.round(m.meters / (DRAW_SPEED[b.sport ?? sport] / 3.6)); approx = true; }
      else if (m.kind === 'reps') { seconds = m.reps * REP_SECONDS; approx = true; }
      else { seconds = OPEN_SECONDS; approx = true; }
      const { level, known } = stepLevel(b, sport, refs);
      const intensity = describeIntensity(b.intensity);
      out.push({
        index: out.length, phase: b.phase, level, levelKnown: known, seconds: Math.max(1, seconds), timed: m.kind === 'time', secondsApprox: approx,
        label: [b.exercise ? b.exercise.name : PHASE_LABELS[b.phase], describeMeasure(m), intensity].filter(Boolean).join(' · '),
        repeat,
      });
    }
  };
  walk(blocks, null);
  return out;
}
