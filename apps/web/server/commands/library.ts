import {
  addDays, applyWeekSchema, createBlockTemplateSchema, createTemplateSchema, fouleeLibrary, type FouleeMeta, parseWith, starterLibrary, updateTemplateSchema, updateWeekTemplateSchema, weekFromAthleteSchema, weekStart,
  type BlockTemplatePayload, type LibraryCategory, type LibraryWorkout, type WeekDay, type WeekTemplatePayload,
} from '@coachos/domain';
import { commandAs, type Tx } from '../db/client';
import { conflict, invalid, notVisible } from '../errors';
import { audit, idempotent, type StoredResponse } from './idempotency';
import { requireAssigned, requireCoach } from './portfolio';
import { insertRevision } from './workouts';

// Bibliothèque de séances (CE-B-01, D-035) : table `templates` (kind = 'workout'), visible par son auteur.
// Charge utile : { category, workout } ; la séance n’a ni date, ni élève, ni fuseau.

interface Meta { actorId: string; idempotencyKey: string; requestId: string; workspaceId: string }

const parse = <T>(schema: Parameters<typeof parseWith>[0], body: unknown): T => {
  const p = parseWith(schema, body);
  if (!p.ok) throw invalid(p.fields);
  return p.value as T;
};

async function insertTemplate(tx: Tx, wid: string, category: LibraryCategory, workout: LibraryWorkout, meta?: FouleeMeta): Promise<{ id: string; revision: number }> {
  const r = await tx.query<{ id: string; revision: number }>(
    `insert into public.templates(workspace_id, owner_id, kind, title, payload) values ($1, auth.uid(), 'workout', $2, $3::jsonb) returning id, revision`,
    [wid, workout.title, JSON.stringify(meta ? { category, workout, meta } : { category, workout })],
  );
  return r.rows[0]!;
}

/** createTemplate · C : nouvelle séance de bibliothèque. */
export async function createTemplate(meta: Meta, body: unknown): Promise<StoredResponse> {
  const v = parse<{ category: LibraryCategory; workout: LibraryWorkout }>(createTemplateSchema, body);
  const wid = meta.workspaceId;
  return commandAs(meta.actorId, async (tx) => {
    await requireCoach(tx, wid);
    return idempotent(tx, { workspaceId: wid, actorId: meta.actorId, action: 'template.create', key: meta.idempotencyKey, body }, async () => {
      const t = await insertTemplate(tx, wid, v.category, v.workout);
      await audit(tx, wid, meta.actorId, 'template.create', t.id, meta.requestId);
      return { status: 201, body: t };
    });
  });
}

/** updateTemplate · C : l’auteur modifie, reclasse ou archive ; révision attendue (409 sinon). */
export async function updateTemplate(meta: Meta & { templateId: string }, body: unknown): Promise<StoredResponse> {
  const v = parse<{ expectedRevision: number; category?: LibraryCategory; workout?: LibraryWorkout; archive?: boolean }>(updateTemplateSchema, body);
  const wid = meta.workspaceId;
  return commandAs(meta.actorId, async (tx) => {
    await requireCoach(tx, wid);
    return idempotent(tx, { workspaceId: wid, actorId: meta.actorId, action: 'template.update', key: meta.idempotencyKey, body: { id: meta.templateId, ...v } }, async () => {
      const cur = await tx.query<{ revision: number; payload: { category: LibraryCategory; workout: LibraryWorkout } }>(
        `select revision, payload from public.templates where workspace_id = $1 and id = $2 and owner_id = auth.uid() and kind = 'workout' for update`,
        [wid, meta.templateId],
      );
      const t = cur.rows[0];
      if (!t) throw notVisible();
      if (t.revision !== v.expectedRevision) throw conflict('Cette séance a été modifiée ailleurs. Recharge la page.', { revision: t.revision });
      // Les métadonnées (ex. niveaux et phases Foulée, D-068) restent avec la séance modifiée.
      const payload = { ...t.payload, category: v.category ?? t.payload.category, workout: v.workout ?? t.payload.workout };
      const r = await tx.query<{ id: string; revision: number }>(
        `update public.templates set title = $3, payload = $4::jsonb, archived = coalesce($5, archived), revision = revision + 1
         where workspace_id = $1 and id = $2 returning id, revision`,
        [wid, meta.templateId, payload.workout.title, JSON.stringify(payload), v.archive ?? null],
      );
      await audit(tx, wid, meta.actorId, 'template.update', meta.templateId, meta.requestId);
      return { status: 200, body: r.rows[0]! };
    });
  });
}

/** addStarterLibrary · C : ajoute les séances de départ absentes (même titre = déjà là). */
export async function addStarterLibrary(meta: Meta): Promise<StoredResponse> {
  const wid = meta.workspaceId;
  return commandAs(meta.actorId, async (tx) => {
    await requireCoach(tx, wid);
    return idempotent(tx, { workspaceId: wid, actorId: meta.actorId, action: 'template.starter', key: meta.idempotencyKey, body: {} }, async () => {
      const have = new Set((await tx.query<{ title: string }>(
        `select lower(title) as title from public.templates where workspace_id = $1 and owner_id = auth.uid() and kind = 'workout' and not archived`, [wid],
      )).rows.map((r) => r.title));
      let added = 0;
      for (const s of starterLibrary()) {
        if (have.has(s.workout.title.toLowerCase())) continue;
        await insertTemplate(tx, wid, s.category, s.workout);
        added++;
      }
      await audit(tx, wid, meta.actorId, 'template.starter', wid, meta.requestId);
      return { status: 200, body: { added } };
    });
  });
}

/**
 * addFouleeLibrary · C : bibliothèque Foulée (D-068), 79 familles, 324 séances par paliers, ajoutée à la bibliothèque
 * du coach qui la demande. Les séances déjà présentes (même titre) ne sont pas doublées ; rejouer ne fait rien de plus.
 */
export async function addFouleeLibrary(meta: Meta): Promise<StoredResponse> {
  const wid = meta.workspaceId;
  return commandAs(meta.actorId, async (tx) => {
    await requireCoach(tx, wid);
    return idempotent(tx, { workspaceId: wid, actorId: meta.actorId, action: 'template.foulee', key: meta.idempotencyKey, body: {} }, async () => {
      const have = new Set((await tx.query<{ title: string }>(
        `select lower(title) as title from public.templates where workspace_id = $1 and owner_id = auth.uid() and kind = 'workout' and not archived`, [wid],
      )).rows.map((r) => r.title));
      let added = 0, skipped = 0;
      for (const s of fouleeLibrary()) {
        if (have.has(s.workout.title.toLowerCase())) {
          // Déjà là : repères complétés (meta) et note interne retirée des consignes d’un import précédent (D-077).
          await tx.query(
            `update public.templates set
               payload = jsonb_set(payload || jsonb_build_object('meta', $3::jsonb), '{workout,instructions}',
                 case when payload->'workout'->>'instructions' like 'Bibliothèque Foulée%' then 'null'::jsonb else coalesce(payload->'workout'->'instructions', 'null'::jsonb) end),
               revision = revision + 1
             where workspace_id = $1 and owner_id = auth.uid() and kind = 'workout' and lower(title) = lower($2) and not archived
               and (payload->'workout'->>'instructions' like 'Bibliothèque Foulée%' or coalesce(payload->'meta'->>'source', '') = 'foulee')
               and (payload->'meta' is distinct from $3::jsonb or payload->'workout'->>'instructions' like 'Bibliothèque Foulée%')`,
            [wid, s.workout.title, JSON.stringify(s.meta)],
          );
          skipped++; continue;
        }
        await insertTemplate(tx, wid, s.category, s.workout, s.meta);
        have.add(s.workout.title.toLowerCase());
        added++;
      }
      await audit(tx, wid, meta.actorId, 'template.foulee', wid, meta.requestId);
      return { status: 200, body: { added, skipped } };
    });
  });
}

/** templateFromWorkout · C : enregistre dans la bibliothèque la version de travail d’une séance d’un élève affecté. */
export async function templateFromWorkout(meta: Meta & { athleteId: string; workoutId: string }, body: unknown): Promise<StoredResponse> {
  const category = parse<{ category: LibraryCategory }>(createTemplateSchema.pick({ category: true }), body).category;
  const wid = meta.workspaceId;
  return commandAs(meta.actorId, async (tx) => {
    await requireAssigned(tx, wid, meta.athleteId);
    return idempotent(tx, { workspaceId: wid, actorId: meta.actorId, action: 'template.from-workout', key: meta.idempotencyKey, body: { sid: meta.workoutId, category } }, async () => {
      const r = await tx.query<{ sport_code: LibraryWorkout['sport']; title: string; instructions: string | null; duration_seconds: number | null; distance_m: number | null; intervals: LibraryWorkout['intervals'] }>(
        `select r.sport_code, r.title, nullif(r.instructions, '') as instructions, r.duration_seconds, r.distance_m, r.intervals
         from public.workouts w join public.workout_revisions r
           on r.workspace_id = w.workspace_id and r.athlete_id = w.athlete_id and r.workout_id = w.id and r.number = w.working_revision
         where w.workspace_id = $1 and w.athlete_id = $2 and w.id = $3`,
        [wid, meta.athleteId, meta.workoutId],
      );
      const x = r.rows[0];
      if (!x) throw notVisible();
      const t = await insertTemplate(tx, wid, category, {
        sport: x.sport_code, title: x.title, instructions: x.instructions, durationSeconds: x.duration_seconds, distanceM: x.distance_m, intervals: x.intervals ?? [],
      });
      await audit(tx, wid, meta.actorId, 'template.from-workout', t.id, meta.requestId);
      return { status: 201, body: t };
    });
  });
}

// ---------- Semaines types (CE-B-02, D-051) ----------

/**
 * weekFromAthlete · C : enregistre la semaine d’un élève affecté comme semaine type (kind = 'week').
 * Chaque séance non annulée de la semaine (version de travail) devient un jour de la semaine type.
 */
export async function weekFromAthlete(meta: Meta, body: unknown): Promise<StoredResponse> {
  const v = parse<{ athleteId: string; monday: string; title: string }>(weekFromAthleteSchema, body);
  if (weekStart(v.monday) !== v.monday) throw invalid([{ path: 'monday', rule: 'La semaine commence un lundi' }]);
  const wid = meta.workspaceId;
  return commandAs(meta.actorId, async (tx) => {
    await requireAssigned(tx, wid, v.athleteId);
    return idempotent(tx, { workspaceId: wid, actorId: meta.actorId, action: 'template.week-from-athlete', key: meta.idempotencyKey, body: v }, async () => {
      const r = await tx.query<{ local_date: string; sport_code: LibraryWorkout['sport']; title: string; instructions: string | null; duration_seconds: number | null; distance_m: number | null; intervals: LibraryWorkout['intervals'] }>(
        `select to_char(r.local_date, 'YYYY-MM-DD') as local_date, r.sport_code, r.title, nullif(r.instructions, '') as instructions, r.duration_seconds, r.distance_m, r.intervals
         from public.workouts w join public.workout_revisions r
           on r.workspace_id = w.workspace_id and r.athlete_id = w.athlete_id and r.workout_id = w.id and r.number = w.working_revision
         where w.workspace_id = $1 and w.athlete_id = $2 and r.local_date between $3::date and $4::date and not r.canceled
         order by r.local_date, r.sort_order, w.created_at`,
        [wid, v.athleteId, v.monday, addDays(v.monday, 6)],
      );
      if (!r.rows.length) throw invalid([{ path: 'monday', rule: 'Aucune séance cette semaine' }]);
      const days: WeekDay[] = r.rows.map((x) => ({
        offset: Math.round((Date.parse(`${x.local_date}T12:00:00Z`) - Date.parse(`${v.monday}T12:00:00Z`)) / 86_400_000),
        workout: { sport: x.sport_code, title: x.title, instructions: x.instructions, durationSeconds: x.duration_seconds, distanceM: x.distance_m, intervals: x.intervals ?? [] },
      }));
      const t = await tx.query<{ id: string; revision: number }>(
        `insert into public.templates(workspace_id, owner_id, kind, title, payload) values ($1, auth.uid(), 'week', $2, $3::jsonb) returning id, revision`,
        [wid, v.title, JSON.stringify({ days } satisfies WeekTemplatePayload)],
      );
      await audit(tx, wid, meta.actorId, 'template.week-from-athlete', t.rows[0]!.id, meta.requestId);
      return { status: 201, body: { ...t.rows[0]!, sessions: days.length } };
    });
  });
}

/**
 * applyWeekTemplate · C : un brouillon par séance de la semaine type, aux jours correspondants de la semaine choisie,
 * dans le fuseau de l’élève. Rien n’est publié ; les séances déjà présentes ne sont pas touchées.
 */
export async function applyWeekTemplate(meta: Meta & { templateId: string }, body: unknown): Promise<StoredResponse> {
  const v = parse<{ athleteId: string; monday: string }>(applyWeekSchema, body);
  if (weekStart(v.monday) !== v.monday) throw invalid([{ path: 'monday', rule: 'La semaine commence un lundi' }]);
  const wid = meta.workspaceId;
  return commandAs(meta.actorId, async (tx) => {
    await requireAssigned(tx, wid, v.athleteId);
    const t = await tx.query<{ payload: WeekTemplatePayload; archived: boolean }>(
      `select payload, archived from public.templates where workspace_id = $1 and id = $2 and kind = 'week' and owner_id = auth.uid()`,
      [wid, meta.templateId],
    );
    const tpl = t.rows[0];
    if (!tpl) throw notVisible();
    if (tpl.archived) throw invalid([{ path: 'templateId', rule: 'Cette semaine type est archivée' }]);
    return idempotent(tx, { workspaceId: wid, actorId: meta.actorId, action: 'template.week-apply', key: meta.idempotencyKey, body: { id: meta.templateId, ...v } }, async () => {
      const a = await tx.query<{ time_zone: string; state: string }>('select time_zone, state from public.athletes where workspace_id = $1 and id = $2', [wid, v.athleteId]);
      if (!a.rows[0] || a.rows[0].state === 'archived') throw notVisible();
      const created: { workoutId: string; localDate: string }[] = [];
      const order = new Map<number, number>();
      for (const d of tpl.payload.days) {
        const localDate = addDays(v.monday, d.offset);
        const sortOrder = order.get(d.offset) ?? 0;
        order.set(d.offset, sortOrder + 1);
        const w = await tx.query<{ id: string }>(
          'insert into public.workouts(workspace_id, athlete_id, working_revision) values ($1, $2, 1) returning id', [wid, v.athleteId],
        );
        await insertRevision(tx, wid, v.athleteId, w.rows[0]!.id, 1, { ...d.workout, localDate, timeZone: a.rows[0].time_zone, sortOrder });
        created.push({ workoutId: w.rows[0]!.id, localDate });
      }
      await audit(tx, wid, meta.actorId, 'template.week-apply', meta.templateId, meta.requestId);
      return { status: 201, body: { created } };
    });
  });
}

/** updateWeekTemplate · C : l’auteur renomme ou archive une semaine type ; révision attendue. */
export async function updateWeekTemplate(meta: Meta & { templateId: string }, body: unknown): Promise<StoredResponse> {
  const v = parse<{ expectedRevision: number; title?: string; archive?: boolean }>(updateWeekTemplateSchema, body);
  const wid = meta.workspaceId;
  return commandAs(meta.actorId, async (tx) => {
    await requireCoach(tx, wid);
    return idempotent(tx, { workspaceId: wid, actorId: meta.actorId, action: 'template.week-update', key: meta.idempotencyKey, body: { id: meta.templateId, ...v } }, async () => {
      const cur = await tx.query<{ revision: number }>(
        `select revision from public.templates where workspace_id = $1 and id = $2 and owner_id = auth.uid() and kind = 'week' for update`, [wid, meta.templateId],
      );
      if (!cur.rows[0]) throw notVisible();
      if (cur.rows[0].revision !== v.expectedRevision) throw conflict('Cette semaine type a été modifiée ailleurs. Recharge la page.', { revision: cur.rows[0].revision });
      const r = await tx.query<{ id: string; revision: number }>(
        `update public.templates set title = coalesce($3, title), archived = coalesce($4, archived), revision = revision + 1
         where workspace_id = $1 and id = $2 returning id, revision`,
        [wid, meta.templateId, v.title ?? null, v.archive ?? null],
      );
      await audit(tx, wid, meta.actorId, 'template.week-update', meta.templateId, meta.requestId);
      return { status: 200, body: r.rows[0]! };
    });
  });
}

// ---------- Blocs réutilisables (D-074) ----------

/** createBlockTemplate · C : enregistre une partie de séance comme bloc de la bibliothèque du coach. */
export async function createBlockTemplate(meta: Meta, body: unknown): Promise<StoredResponse> {
  const v = parse<BlockTemplatePayload>(createBlockTemplateSchema, body);
  const wid = meta.workspaceId;
  return commandAs(meta.actorId, async (tx) => {
    await requireCoach(tx, wid);
    return idempotent(tx, { workspaceId: wid, actorId: meta.actorId, action: 'template.block', key: meta.idempotencyKey, body }, async () => {
      const r = await tx.query<{ id: string }>(
        `insert into public.templates(workspace_id, owner_id, kind, title, payload) values ($1, auth.uid(), 'block', $2, $3::jsonb) returning id`,
        [wid, v.title, JSON.stringify({ sport: v.sport, blocks: v.blocks })],
      );
      await audit(tx, wid, meta.actorId, 'template.block', r.rows[0]!.id, meta.requestId);
      return { status: 201, body: { id: r.rows[0]!.id } };
    });
  });
}

/** archiveBlockTemplate · C : retire un de ses blocs (archivé, les séances qui l’ont utilisé ne changent pas). */
export async function archiveBlockTemplate(meta: Meta & { templateId: string }): Promise<StoredResponse> {
  const wid = meta.workspaceId;
  return commandAs(meta.actorId, async (tx) => {
    await requireCoach(tx, wid);
    return idempotent(tx, { workspaceId: wid, actorId: meta.actorId, action: 'template.block.archive', key: meta.idempotencyKey, body: { id: meta.templateId } }, async () => {
      const r = await tx.query(`update public.templates set archived = true, revision = revision + 1 where workspace_id = $1 and id = $2 and owner_id = auth.uid() and kind = 'block' and not archived returning id`, [wid, meta.templateId]);
      if (!r.rows.length) throw notVisible();
      await audit(tx, wid, meta.actorId, 'template.block.archive', meta.templateId, meta.requestId);
      return { status: 200, body: { id: meta.templateId } };
    });
  });
}

