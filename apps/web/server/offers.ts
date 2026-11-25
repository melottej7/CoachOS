/**
 * D-174 · Offres de CoachOS (hypothèses de docs/13), modifiables sans toucher au code.
 *
 * - `COACHOS_OFFERS` (JSON, facultatif) corrige une offre par son identifiant, par exemple
 *   `[{"id":"starter","price":25},{"id":"pro","athletes":80}]`. Une valeur invalide est ignorée, le reste tient.
 * - `COACHOS_BILLING=1` est l’interrupteur commercial : prix affichés, essai et abonnement (mode test).
 *   Éteint (par défaut, donc en production) : phase pilote gratuite, aucun prix publié, rien n’est facturé.
 * - `COACHOS_TRIAL_DAYS` : durée de l’essai gratuit (30 jours par défaut, de 7 à 90).
 */

export type OfferId = 'starter' | 'pro' | 'elite';

export interface Offer {
  id: OfferId;
  name: string;
  /** Prix mensuel hors taxes, en euros. */
  price: number;
  /** Élèves actifs au plus : invitations acceptées et dossiers non archivés. */
  athletes: number;
  /** Pour qui, en une ligne. */
  pitch: string;
}

export const DEFAULT_OFFERS: readonly Offer[] = [
  { id: 'starter', name: 'Starter', price: 29, athletes: 20, pitch: 'Pour un coach indépendant et ses premiers élèves.' },
  { id: 'pro', name: 'Pro', price: 59, athletes: 100, pitch: 'Pour un coach à plein temps, ses groupes et ses programmes.' },
  { id: 'elite', name: 'Elite', price: 99, athletes: 300, pitch: 'Pour un club ou une structure qui suit beaucoup d’élèves.' },
];

type Env = Record<string, string | undefined>;

const isPrice = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 10_000;
const isAthletes = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 100_000;
const isLabel = (max: number) => (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0 && v.trim().length <= max;

/** Les trois offres, corrigées par `COACHOS_OFFERS` champ par champ ; une correction illisible laisse l’hypothèse. */
export function offers(env: Env = process.env): Offer[] {
  const list = DEFAULT_OFFERS.map((o) => ({ ...o }));
  const raw = (env.COACHOS_OFFERS ?? '').trim();
  if (!raw) return list;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return list;
  }
  if (!Array.isArray(parsed)) return list;
  for (const patch of parsed) {
    if (!patch || typeof patch !== 'object') continue;
    const p = patch as Record<string, unknown>;
    const offer = list.find((o) => o.id === p.id);
    if (!offer) continue;
    if (isPrice(p.price)) offer.price = Math.round(p.price * 100) / 100;
    if (isAthletes(p.athletes)) offer.athletes = p.athletes;
    if (isLabel(40)(p.name)) offer.name = p.name.trim();
    if (isLabel(140)(p.pitch)) offer.pitch = p.pitch.trim();
  }
  return list;
}

/** Interrupteur commercial (D-120) : éteint tant que `COACHOS_BILLING` ne vaut pas exactement « 1 ». */
export function billingEnabled(env: Env = process.env): boolean {
  return env.COACHOS_BILLING === '1';
}

export function trialDays(env: Env = process.env): number {
  const n = Number(env.COACHOS_TRIAL_DAYS);
  return Number.isInteger(n) && n >= 7 && n <= 90 ? n : 30;
}

/** « 29 € », « 24,90 € » : prix lisible en français, sans décimales inutiles. */
export function formatPrice(price: number): string {
  const s = Number.isInteger(price) ? String(price) : price.toFixed(2).replace('.', ',');
  return `${s} €`;
}

/** L’offre la plus petite qui accueille ce nombre d’élèves actifs, sinon la plus grande. */
export function offerFor(activeAthletes: number, list: Offer[] = offers()): Offer {
  const sorted = [...list].sort((a, b) => a.athletes - b.athletes);
  return sorted.find((o) => o.athletes >= activeAthletes) ?? sorted[sorted.length - 1]!;
}
