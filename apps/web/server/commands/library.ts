import {
  createTemplateSchema, parseWith, starterLibrary, updateTemplateSchema,
  type LibraryCategory, type LibraryWorkout,
} from '@coachos/domain';
import { commandAs, type Tx } from '../db/client';
import { conflict, invalid, notVisible } from '../errors';
import { audit, idempotent, type StoredResponse } from './idempotency';
import { requireAssigned, requireCoach } from './portfolio';

// Bibliothèque de séances (CE-B-01, D-035) : table `templates` (kind = 'workout'), visible par son auteur.
// Charge utile : { category, workout } ; la séance n’a ni date, ni élève, ni fuseau.

interface Meta { actorId: string; idempotencyKey: string; requestId: string; workspaceId: string }

const parse = <T>(schema: Parameters<typeof parseWith>[0], body: unknown): T => {
  const p = parseWith(schema, body);
  if (!p.ok) throw invalid(p.fields);
  return p.value as T;
};

async function insertTemplate(tx: Tx, wid: string, category: LibraryCategory, workout: LibraryWorkout): Promise<{ id: string; revision: number }> {
  const r = await tx.query<{ id: string; revision: number }>(
    `insert into public.templates(workspace_id, owner_id, kind, title, payload) values ($1, auth.uid(), 'workout', $2, $3::jsonb) returning id, revision`,
    [wid, workout.title, JSON.stringify({ category, workout })],
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
      const payload = { category: v.category ?? t.payload.category, workout: v.workout ?? t.payload.workout };
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
