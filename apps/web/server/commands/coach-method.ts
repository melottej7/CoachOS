import {
  EMPTY_METHOD, coachMethodSchema, learnCandidates, observeEdit, observeKept, observeTweaks, parseWith, saveMethodSchema, weekStart, LEARNING,
  type Block, type CoachMethod, type Level, type MethodCandidate, type MethodEvidence, type ProgramTweaks, type Sport,
} from '@coachos/domain';
import { commandAs, readAs, type Tx } from '../db/client';
import { conflict, invalid } from '../errors';
import { audit, idempotent, type StoredResponse } from './idempotency';
import { requireCoach } from './portfolio';

/**
 * Méthode du coach (Coach DNA, D-072) : profil versionné dans coach_dna (une version active par coach et par espace).
 * Les règles s’appliquent par défaut au générateur ; les candidates viennent des corrections du coach lui-même,
 * jamais d’un autre coach (docs/09).
 */

export interface MethodVersion { version: number; createdAt: string; reason: string | null }
export interface MethodView { version: number; method: CoachMethod; history: MethodVersion[] }

async function activeIn(tx: Tx, wid: string): Promise<{ version: number; method: CoachMethod }> {
  const r = await tx.query<{ version: number; profile: unknown }>(
    `select version, profile from public.coach_dna where workspace_id = $1 and coach_id = auth.uid() and state = 'active'`, [wid],
  );
  const row = r.rows[0];
  if (!row) return { version: 0, method: EMPTY_METHOD };
  const p = coachMethodSchema.safeParse(row.profile);
  return { version: row.version, method: p.success ? p.data : EMPTY_METHOD };
}

/** Méthode active du coach connecté (vide s’il n’en a pas encore) et historique des versions. */
export async function readCoachMethod(userId: string, wid: string): Promise<MethodView> {
  return readAs(userId, async (tx) => {
    const { version, method } = await activeIn(tx, wid);
    const h = await tx.query<{ version: number; created_at: Date; reason: string | null }>(
      `select version, created_at, reason from public.coach_dna where workspace_id = $1 and coach_id = auth.uid() order by version desc limit 30`, [wid],
    );
    return { version, method, history: h.rows.map((x) => ({ version: x.version, createdAt: new Date(x.created_at).toISOString(), reason: x.reason })) };
  });
}

/** saveCoachMethod · C : nouvelle version active (la précédente est retirée, jamais modifiée). Version attendue contrôlée. */
export async function saveCoachMethod(meta: { actorId: string; idempotencyKey: string; requestId: string; workspaceId: string }, body: unknown): Promise<StoredResponse> {
  const p = parseWith(saveMethodSchema, body);
  if (!p.ok) throw invalid(p.fields);
  const v = p.value as { expectedVersion: number; method: CoachMethod; reason: string | null };
  if (new Set(v.method.rules.map((r) => r.id)).size !== v.method.rules.length) throw invalid([{ path: 'method.rules', rule: 'Règle en double' }]);
  const wid = meta.workspaceId;
  return commandAs(meta.actorId, async (tx) => {
    await requireCoach(tx, wid);
    return idempotent(tx, { workspaceId: wid, actorId: meta.actorId, action: 'method.save', key: meta.idempotencyKey, body }, async () => {
      await tx.query(`select 1 from public.coach_dna where workspace_id = $1 and coach_id = auth.uid() for update`, [wid]);
      const cur = await activeIn(tx, wid);
      if (cur.version !== v.expectedVersion) throw conflict('Ta méthode a été modifiée ailleurs. Recharge la page.', { version: cur.version });
      await tx.query(`update public.coach_dna set state = 'retired' where workspace_id = $1 and coach_id = auth.uid() and state = 'active'`, [wid]);
      const next = cur.version + 1;
      await tx.query(
        `insert into public.coach_dna(workspace_id, coach_id, version, state, profile, policy_version, reason, created_by)
         values ($1, auth.uid(), $2, 'active', $3::jsonb, 'method-v1', $4, auth.uid())`,
        [wid, next, JSON.stringify(v.method), v.reason],
      );
      await audit(tx, wid, meta.actorId, 'method.save', meta.actorId, meta.requestId);
      return { status: 200, body: { version: next } };
    });
  });
}

type Rev = { date: string; title: string; blocks: Block[]; canceled: boolean };

/**
 * Preuves pour l’apprentissage (90 jours, programmes générés par ce coach, élèves qui lui sont affectés) :
 * séances générées retouchées (observations), publiées telles quelles (contre-exemples), réglages de programme.
 */
export async function methodEvidence(userId: string, wid: string): Promise<{ obs: MethodEvidence[]; counters: MethodEvidence[] }> {
  return readAs(userId, async (tx) => {
    const rows = await tx.query<{
      athlete_id: string; level: Level | null; sport: Sport; edited: boolean; kept: boolean;
      g_date: string; g_title: string; g_blocks: Block[]; c_date: string; c_title: string; c_blocks: Block[]; c_canceled: boolean;
    }>(
      `select w.athlete_id, ap.level, g.sport_code as sport,
              (w.working_revision <> w.generated_revision) as edited,
              (w.working_revision = w.generated_revision and w.published_revision = w.working_revision and not c.canceled) as kept,
              to_char(g.local_date, 'YYYY-MM-DD') as g_date, g.title as g_title, g.intervals as g_blocks,
              to_char(c.local_date, 'YYYY-MM-DD') as c_date, c.title as c_title, c.intervals as c_blocks, c.canceled as c_canceled
       from public.workouts w
       join public.plans p on p.workspace_id = w.workspace_id and p.id = w.plan_id and p.generator is not null and p.created_by = auth.uid()
       join public.workout_revisions g on g.workspace_id = w.workspace_id and g.athlete_id = w.athlete_id and g.workout_id = w.id and g.number = w.generated_revision
       join public.workout_revisions c on c.workspace_id = w.workspace_id and c.athlete_id = w.athlete_id and c.workout_id = w.id and c.number = w.working_revision
       left join public.athlete_profiles ap on ap.workspace_id = w.workspace_id and ap.athlete_id = w.athlete_id
       where w.workspace_id = $1 and w.generated_revision is not null and private.assigned(w.workspace_id, w.athlete_id)
         and c.created_at > now() - make_interval(days => $2)`,
      [wid, LEARNING.windowDays],
    );
    const obs: MethodEvidence[] = [], counters: MethodEvidence[] = [];
    for (const r of rows.rows) {
      const who = { athleteId: r.athlete_id, week: weekStart(r.g_date), level: r.level, sport: r.sport };
      const gen: Rev = { date: r.g_date, title: r.g_title, blocks: Array.isArray(r.g_blocks) ? r.g_blocks : [], canceled: false };
      if (r.edited) for (const o of observeEdit(gen, { date: r.c_date, title: r.c_title, blocks: Array.isArray(r.c_blocks) ? r.c_blocks : [], canceled: r.c_canceled })) obs.push({ ...who, ...o });
      else if (r.kept) for (const key of observeKept(gen)) counters.push({ ...who, key });
    }
    // Réglages appliqués à un programme (création et régénérations).
    const plans = await tx.query<{ athlete_id: string; level: Level | null; created_at: Date; generator: { tweaks?: ProgramTweaks | null; regenerations?: { at: string; tweaks?: ProgramTweaks | null }[] } }>(
      `select p.athlete_id, ap.level, p.created_at, p.generator from public.plans p
       left join public.athlete_profiles ap on ap.workspace_id = p.workspace_id and ap.athlete_id = p.athlete_id
       where p.workspace_id = $1 and p.created_by = auth.uid() and p.generator is not null and private.assigned(p.workspace_id, p.athlete_id)
         and p.created_at > now() - make_interval(days => $2)`,
      [wid, LEARNING.windowDays],
    );
    const sportOf = new Map(rows.rows.map((r) => [r.athlete_id, r.sport]));
    for (const p of plans.rows) {
      const entries = [{ at: new Date(p.created_at).toISOString(), tweaks: p.generator.tweaks ?? null }, ...(p.generator.regenerations ?? []).map((x) => ({ at: x.at, tweaks: x.tweaks ?? null }))];
      for (const e of entries) if (e.tweaks) for (const o of observeTweaks(e.tweaks)) obs.push({ ...o, athleteId: p.athlete_id, week: weekStart(e.at.slice(0, 10)), level: p.level, sport: sportOf.get(p.athlete_id) ?? null });
    }
    return { obs, counters };
  });
}

/** Propositions de règles tirées des corrections du coach (rien n’est appliqué sans lui). */
export async function methodCandidates(userId: string, wid: string, method: CoachMethod): Promise<MethodCandidate[]> {
  const { obs, counters } = await methodEvidence(userId, wid);
  return learnCandidates(obs, counters, method);
}
