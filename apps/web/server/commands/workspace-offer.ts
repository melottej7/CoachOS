import { commandAs, type Tx } from '../db/client';
import { AppError, notVisible } from '../errors';
import { athleteLimit, billingEnabled, offers, paymentsReady, readOnly, standing, type Offer, type OfferId, type Standing, type SubscriptionStatus } from '../offers';

/**
 * D-175 · Offre et essai d’un espace. La limite porte sur les élèves actifs (invitation acceptée, dossier non archivé) :
 * elle bloque une nouvelle activation, jamais ce qui existe (docs/13). Phase pilote (interrupteur éteint) : aucune limite.
 */

interface Row {
  plan: OfferId | null; trial_ends_at: Date | string | null; active: number;
  // D-188 : état Stripe (table réservée au serveur).
  status: SubscriptionStatus | null; past_due_since: Date | string | null; current_period_end: Date | string | null; customer: boolean;
}

async function readRow(tx: Tx, wid: string, lock: boolean): Promise<Row | null> {
  // Le verrou sur l’espace range deux acceptations simultanées l’une après l’autre : la limite ne peut pas être dépassée d’un.
  if (lock) await tx.query('select 1 from public.workspaces where id = $1 for update', [wid]);
  const r = await tx.query<Row>(
    `select w.plan, w.trial_ends_at, b.status, b.past_due_since, b.current_period_end, coalesce(b.stripe_customer_id is not null, false) as customer,
            (select count(*)::int from public.athletes a where a.workspace_id = w.id and a.state = 'active') as active
     from public.workspaces w left join public.workspace_billing b on b.workspace_id = w.id where w.id = $1`,
    [wid],
  );
  return r.rows[0] ?? null;
}

const date = (v: Date | string | null) => (v ? new Date(v) : null);
const toStanding = (row: Row, now: Date) => standing({
  plan: row.plan, trialEndsAt: date(row.trial_ends_at),
  billing: row.status ? { status: row.status, pastDueSince: date(row.past_due_since), periodEnd: date(row.current_period_end) } : null,
}, now);

/** D-188 · Ce qu’on peut encore faire dans un espace en lecture seule : régler, exporter ses données, ses notifications. */
const WRITABLE_WHEN_LOCKED = new Set(['billing', 'privacy', 'push', 'notifications']);
export const READ_ONLY = 'Cet espace est en lecture seule : l’essai ou l’abonnement est terminé. Tout reste consultable et exportable ; le propriétaire de l’espace peut choisir une offre dans Paramètres › Abonnement.';

/** D-188 · Avant toute modification dans un espace : refusée s’il est en lecture seule. Sans paiement ouvert, rien n’est lu. */
export async function assertWritable(actorId: string, wid: string, module: string, now: Date = new Date()): Promise<void> {
  if (!paymentsReady() || WRITABLE_WHEN_LOCKED.has(module)) return;
  const row = await commandAs(actorId, (tx) => readRow(tx, wid, false));
  if (row && readOnly(toStanding(row, now))) throw new AppError('ACTION_FORBIDDEN_OR_FEATURE_DISABLED', READ_ONLY);
}

/** D-188 · Pour le bandeau de l’espace coach : lecture seule, ou paiement refusé à régulariser ; null sinon (et toujours sans paiement ouvert). */
export async function workspaceAlert(actorId: string, wid: string, now: Date = new Date()): Promise<Standing | null> {
  if (!paymentsReady()) return null;
  const row = await commandAs(actorId, (tx) => readRow(tx, wid, false));
  if (!row) return null;
  const s = toStanding(row, now);
  return readOnly(s) || s.kind === 'grace' ? s : null;
}

export const LIMIT_REACHED = 'L’espace de ton coach a atteint le nombre d’élèves prévu par son offre. Préviens ton coach : ton lien reste valable en attendant.';

/** À l’activation d’un élève : refuse s’il n’y a plus de place dans l’offre de l’espace. */
export async function assertRoomForAthlete(tx: Tx, wid: string, now: Date = new Date()): Promise<void> {
  // Interrupteur éteint (production) : aucune limite, rien à lire.
  if (!billingEnabled()) return;
  const row = await readRow(tx, wid, true);
  if (!row) return;
  const limit = athleteLimit(toStanding(row, now));
  if (limit !== null && row.active >= limit) throw new AppError('ACTION_FORBIDDEN_OR_FEATURE_DISABLED', LIMIT_REACHED);
}

export interface WorkspaceOfferView {
  standing: Standing; active: number; limit: number | null;
  /** D-188 : les offres, le paiement ouvert, un client Stripe connu (portail), l’espace en lecture seule. */
  offers: Offer[]; canPay: boolean; hasCustomer: boolean; readOnly: boolean;
}

/** Pour la rubrique Abonnement : réservé aux coachs de l’espace. */
export async function readWorkspaceOffer(actorId: string, wid: string, now: Date = new Date()): Promise<WorkspaceOfferView> {
  return commandAs(actorId, async (tx) => {
    const ok = await tx.query<{ coach: boolean }>('select private.current_coach($1) as coach', [wid]);
    if (!ok.rows[0]?.coach) throw notVisible();
    const row = await readRow(tx, wid, false);
    if (!row) throw notVisible();
    const s = toStanding(row, now);
    return { standing: s, active: row.active, limit: athleteLimit(s), offers: offers(), canPay: paymentsReady(), hasCustomer: row.customer, readOnly: readOnly(s) };
  });
}
