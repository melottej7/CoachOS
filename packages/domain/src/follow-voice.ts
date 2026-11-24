import { setLabel, type FollowStep } from './exercises';
import { describeIntensity, describeMeasure, PHASE_LABELS } from './structure';

/**
 * D-166 · Ce que la voix annonce pendant « Suivre la séance » : à chaque étape, l’essentiel en une phrase,
 * avec les unités en toutes lettres (« 20 secondes », « 16 kilos ») pour la synthèse vocale du téléphone.
 */

/** Unités écrites → mots, pour qu’une voix ne lise pas « s » ou « kg ». */
export function spoken(text: string): string {
  return text
    .replace(/\/500 m/g, 'au 500 mètres')
    .replace(/\/100 m/g, 'aux 100 mètres')
    .replace(/\/km(?!\p{L})/gu, 'au kilomètre')
    .replace(/(\d+(?:,\d+)?) km\/h/g, '$1 kilomètres heure')
    .replace(/tr\/min/g, 'tours minute')
    .replace(/(pas|coups|marches)\/min/g, '$1 par minute')
    .replace(/(\d+):(\d{2})(?!\d)/g, (_, m: string, s: string) => `${m} minute${Number(m) > 1 ? 's' : ''} ${s}`)
    .replace(/(\d+) h (\d+)/g, (_, h: string, m: string) => `${h} heure${Number(h) > 1 ? 's' : ''} ${Number(m)}`)
    .replace(/(\d+) min (\d+) s(?!\p{L})/gu, (_, m: string, s: string) => `${m} minute${Number(m) > 1 ? 's' : ''} ${s}`)
    .replace(/(\d+) min(?!\p{L})/gu, (_, m: string) => `${m} minute${Number(m) > 1 ? 's' : ''}`)
    .replace(/(\d+) s(?!\p{L})/gu, (_, s: string) => `${s} seconde${Number(s) > 1 ? 's' : ''}`)
    .replace(/(\d+(?:,\d+)?) kg(?!\p{L})/gu, '$1 kilos')
    .replace(/(\d+(?:,\d+)?) km(?!\p{L})/gu, '$1 kilomètres')
    .replace(/(\d+) m(?!\p{L})/gu, '$1 mètres')
    .replace(/(\d+) W(?!\p{L})/gu, '$1 watts')
    .replace(/(\d+) ?%/g, '$1 pour cent')
    .replace(/(\d+)\/10(?!\p{L})/gu, '$1 sur 10')
    .replace(/\bZ(\d)(?!\p{L})/gu, 'zone $1')
    .replace(/ · /g, ', ')
    .replace(/\s+/g, ' ')
    .trim();
}

const isRest = (f: FollowStep) => f.step.phase === 'rest' || f.step.phase === 'recovery';
const nameOf = (f: FollowStep) => f.stage?.name ?? f.step.exercise?.name ?? (isRest(f) ? 'Récupération' : PHASE_LABELS[f.step.phase]);

/** Annonce d’une étape au moment où elle commence. */
export function announce(f: FollowStep, next: FollowStep | null): string {
  const measure = f.step.measure.kind === 'open' ? null : describeMeasure(f.step.measure);
  if (f.stage) {
    return spoken([`Palier ${f.stage.k} sur ${f.stage.n}`, f.stage.settings || null, measure].filter(Boolean).join('. ') + '.');
  }
  if (isRest(f)) {
    const then = next ? `Ensuite : ${nameOf(next)}` : 'Dernière étape';
    return spoken([`Récupération${measure ? `, ${measure}` : ''}`, then].join('. ') + '.');
  }
  const intensity = describeIntensity(f.step.intensity);
  return spoken([setLabel(f.sets), nameOf(f), measure, intensity].filter(Boolean).join('. ') + '.');
}

/** Rappels pendant un chrono : à 1 minute de la fin pour les étapes de 3 minutes et plus, à 10 secondes pour celles de 30 secondes et plus. */
export function reminderAt(totalSeconds: number, left: number): string | null {
  if (totalSeconds >= 180 && left === 60) return 'Encore 1 minute.';
  if (totalSeconds >= 30 && left === 10) return 'Encore 10 secondes.';
  return null;
}

/** Temps écoulé lisible : « 4:07 », « 1:02:30 ». */
export function formatElapsed(ms: number): string {
  const t = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}
