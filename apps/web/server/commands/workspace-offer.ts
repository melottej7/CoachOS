import { commandAs, type Tx } from '../db/client';
import { AppError, notVisible } from '../errors';
import { athleteLimit, standing, type OfferId, type Standing } from '../offers';

/**
 * D-175 · Offre et essai d’un espace. La limite porte sur les élèves actifs (invitation acceptée, dossier non archivé) :
 * elle bloque une nouvelle activation, jamais ce qui existe (docs/13). Phase pilote (interrupteur éteint) : aucune limite.
 */

interface Row { plan: OfferId | null; trial_ends_at: Date | string | null; active: number }

async function readRow(tx: Tx, wid: string, lock: boolean): Promise<Row | null> {
  // Le verrou sur l’espace range deux acceptations simultanées l’une après l’autre : la limite ne peut pas être dépassée d’un.
  if (lock) await tx.query('select 1 from public.workspaces where id = $1 for update', [wid]);
  const r = await tx.query<Row>(
    `select w.plan, w.trial_ends_at,
            (select count(*)::int from public.athletes a where a.workspace_id = w.id and a.state = 'active') as active
     from public.workspaces w where w.id = $1`,
    [wid],
  );
  return r.rows[0] ?? null;
}

const toStanding = (row: Row, now: Date) =>
  standing({ plan: row.plan, trialEndsAt: row.trial_ends_at ? new Date(row.trial_ends_at) : null }, now);

export const LIMIT_REACHED = 'L’espace de ton coach a atteint le nombre d’élèves prévu par son offre. Préviens ton coach : ton lien reste valable en attendant.';

/** À l’activation d’un élève : refuse s’il n’y a plus de place dans l’offre de l’espace. */
export async function assertRoomForAthlete(tx: Tx, wid: string, now: Date = new Date()): Promise<void> {
  const row = await readRow(tx, wid, true);
  if (!row) return;
  const limit = athleteLimit(toStanding(row, now));
  if (limit !== null && row.active >= limit) throw new AppError('ACTION_FORBIDDEN_OR_FEATURE_DISABLED', LIMIT_REACHED);
}

export interface WorkspaceOfferView { standing: Standing; active: number; limit: number | null }

/** Pour la rubrique Abonnement : réservé aux coachs de l’espace. */
export async function readWorkspaceOffer(actorId: string, wid: string, now: Date = new Date()): Promise<WorkspaceOfferView> {
  return commandAs(actorId, async (tx) => {
    const ok = await tx.query<{ coach: boolean }>('select private.current_coach($1) as coach', [wid]);
    if (!ok.rows[0]?.coach) throw notVisible();
    const row = await readRow(tx, wid, false);
    if (!row) throw notVisible();
    const s = toStanding(row, now);
    return { standing: s, active: row.active, limit: athleteLimit(s) };
  });
}
