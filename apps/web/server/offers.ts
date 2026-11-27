/**
 * D-174 · Offres de CoachOS (hypothèses de docs/13), modifiables sans toucher au code.
 *
 * - `COACHOS_OFFERS` (JSON, facultatif) corrige une offre par son identifiant, par exemple
 *   `[{"id":"starter","price":25},{"id":"pro","athletes":80}]`. Une valeur invalide est ignorée, le reste tient.
 * - `COACHOS_BILLING=1` est l’interrupteur commercial : prix affichés, essai et abonnement (mode test).
 *   Éteint (par défaut, donc en production) : phase pilote gratuite, aucun prix publié, rien n’est facturé.
 * - `COACHOS_TRIAL_DAYS` : durée de l’essai gratuit (30 jours par défaut, de 7 à 90).
 * - D-188 · `STRIPE_SECRET_KEY` (clé de test `sk_test_…`) et `STRIPE_WEBHOOK_SECRET` : le paiement. Sans la clé, rien n’est
 *   bloqué : un essai terminé reste affiché sans lecture seule, puisqu’on ne peut pas encore payer.
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

/** D-175 · Pendant l’essai, l’espace a les limites de cette offre (assez large pour reprendre un vrai portefeuille). */
export const TRIAL_OFFER: OfferId = 'pro';

/** D-188 · État Stripe de l’abonnement d’un espace (statuts de Stripe), tel que les événements l’ont décrit. */
export type SubscriptionStatus = 'incomplete' | 'incomplete_expired' | 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid' | 'paused';
export interface BillingState { status: SubscriptionStatus | null; pastDueSince: Date | null; periodEnd: Date | null }

export interface WorkspaceOffer {
  plan: OfferId | null;
  trialEndsAt: Date | null;
  billing?: BillingState | null;
}

/**
 * Où en est un espace : phase pilote (sans limite), essai, essai terminé, offre payée ; D-188 : paiement refusé
 * (14 jours de grâce, tout marche), impayé après la grâce, abonnement arrêté.
 */
export type Standing =
  | { kind: 'pilot' }
  | { kind: 'trial'; offer: Offer; endsAt: Date; daysLeft: number }
  | { kind: 'trial_over'; offer: Offer; endedAt: Date }
  | { kind: 'plan'; offer: Offer; renewsAt: Date | null }
  | { kind: 'grace'; offer: Offer; since: Date; until: Date; daysLeft: number }
  | { kind: 'unpaid'; offer: Offer; since: Date }
  | { kind: 'canceled'; offer: Offer };

const DAY = 86_400_000;
/** docs/13 : sur retard de paiement, grâce de 14 jours, puis lecture et export. */
export const GRACE_DAYS = 14;

export function standing(ws: WorkspaceOffer, now: Date = new Date(), env: Env = process.env): Standing {
  if (!billingEnabled(env)) return { kind: 'pilot' };
  const list = offers(env);
  const find = (id: OfferId) => list.find((o) => o.id === id)!;
  const b = ws.billing ?? null;
  const offer = find(ws.plan ?? TRIAL_OFFER);
  if (b?.status === 'past_due' || b?.status === 'unpaid') {
    const since = b.pastDueSince ?? now;
    const until = new Date(since.getTime() + GRACE_DAYS * DAY);
    const left = until.getTime() - now.getTime();
    return left > 0 ? { kind: 'grace', offer, since, until, daysLeft: Math.ceil(left / DAY) } : { kind: 'unpaid', offer, since };
  }
  if (b && (b.status === 'canceled' || b.status === 'incomplete_expired' || b.status === 'paused') && !(ws.trialEndsAt && ws.trialEndsAt > now)) {
    return { kind: 'canceled', offer };
  }
  // Offre payée (ou attribuée à la main par le fondateur, sans Stripe).
  if (ws.plan && (!b || b.status === 'active' || b.status === 'trialing' || b.status === null)) return { kind: 'plan', offer: find(ws.plan), renewsAt: b?.periodEnd ?? null };
  if (!ws.trialEndsAt) return { kind: 'pilot' };
  const trial = find(TRIAL_OFFER);
  const left = ws.trialEndsAt.getTime() - now.getTime();
  if (left <= 0) return { kind: 'trial_over', offer: trial, endedAt: ws.trialEndsAt };
  return { kind: 'trial', offer: trial, endsAt: ws.trialEndsAt, daysLeft: Math.ceil(left / DAY) };
}

/** Élèves actifs au plus ; null : sans limite (phase pilote). */
export function athleteLimit(s: Standing): number | null {
  return s.kind === 'pilot' ? null : s.offer.athletes;
}

/** D-188 · Le paiement est possible : interrupteur allumé et clé Stripe présente. */
export function paymentsReady(env: Env = process.env): boolean {
  return billingEnabled(env) && /^sk_(test|live)_[A-Za-z0-9]+$/.test(env.STRIPE_SECRET_KEY ?? '');
}

/**
 * D-188 · Espace en lecture (et export) : essai terminé sans offre, impayé après la grâce, abonnement arrêté —
 * seulement quand on peut payer (sinon on bloquerait un coach qui n’a aucun moyen de régler).
 */
export function readOnly(s: Standing, env: Env = process.env): boolean {
  return paymentsReady(env) && (s.kind === 'trial_over' || s.kind === 'unpaid' || s.kind === 'canceled');
}

/** Fin d’essai d’un espace créé maintenant ; null quand l’interrupteur est éteint (phase pilote). */
export function trialEndForNewWorkspace(now: Date = new Date(), env: Env = process.env): Date | null {
  return billingEnabled(env) ? new Date(now.getTime() + trialDays(env) * DAY) : null;
}
