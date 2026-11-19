import { templateWeeks, type Block, type FouleeMeta, type LibraryCategory, type Sport, type LibraryWorkout, type WeekDay, type WeekTemplatePayload } from '@coachos/domain';
import { readAs } from '../db/client';

// Lectures de la bibliothèque (D-035), sous RLS : séances de l’auteur (ou partagées dans l’espace).

export interface LibraryItem { id: string; revision: number; category: LibraryCategory; archived: boolean; mine: boolean; workout: LibraryWorkout; updatedAt: string; meta: FouleeMeta | null }

type Row = { id: string; revision: number; archived: boolean; owner_id: string; payload: { category: LibraryCategory; workout: LibraryWorkout; meta?: FouleeMeta }; created_at: Date };
const toItem = (r: Row, uid: string): LibraryItem => ({
  id: r.id, revision: r.revision, category: r.payload.category ?? 'other', archived: r.archived, mine: r.owner_id === uid, workout: r.payload.workout,
  updatedAt: new Date(r.created_at).toISOString(), meta: r.payload.meta ?? null,
});

export async function listLibrary(userId: string, wid: string, archived = false): Promise<LibraryItem[]> {
  return readAs(userId, async (tx) => {
    const r = await tx.query<Row>(
      `select id, revision, archived, owner_id, payload, created_at from public.templates
       where workspace_id = $1 and kind = 'workout' and archived = $2 order by lower(title), id`,
      [wid, archived],
    );
    return r.rows.map((x) => toItem(x, userId));
  });
}

export async function readTemplate(userId: string, wid: string, tid: string): Promise<LibraryItem | null> {
  return readAs(userId, async (tx) => {
    const r = await tx.query<Row>(
      `select id, revision, archived, owner_id, payload, created_at from public.templates where workspace_id = $1 and id = $2 and kind = 'workout'`,
      [wid, tid],
    );
    return r.rows[0] ? toItem(r.rows[0], userId) : null;
  });
}

/** Semaines types de l’auteur (D-051). */
export interface WeekTemplateItem { id: string; revision: number; title: string; archived: boolean; days: WeekDay[]; weeks: number }

export async function listWeekTemplates(userId: string, wid: string, archived = false): Promise<WeekTemplateItem[]> {
  return readAs(userId, async (tx) => {
    const r = await tx.query<{ id: string; revision: number; title: string; archived: boolean; payload: WeekTemplatePayload }>(
      `select id, revision, title, archived, payload from public.templates
       where workspace_id = $1 and kind = 'week' and owner_id = auth.uid() and archived = $2 order by lower(title), id`,
      [wid, archived],
    );
    return r.rows.map((x) => ({ id: x.id, revision: x.revision, title: x.title, archived: x.archived, days: [...(x.payload.days ?? [])].sort((a, b) => a.offset - b.offset), weeks: templateWeeks({ days: x.payload.days ?? [], weeks: x.payload.weeks }) }));
  });
}

/** Blocs réutilisables du coach connecté (D-074). */
export interface BlockTemplateItem { id: string; title: string; sport: Sport | null; blocks: Block[] }

export async function listBlockTemplates(userId: string, wid: string): Promise<BlockTemplateItem[]> {
  return readAs(userId, async (tx) => {
    const r = await tx.query<{ id: string; title: string; payload: { sport: Sport | null; blocks: Block[] } }>(
      `select id, title, payload from public.templates where workspace_id = $1 and kind = 'block' and owner_id = auth.uid() and not archived order by lower(title), id`,
      [wid],
    );
    // Ordre alphabétique français (« Échauffement » avant « Retour »), pas l’ordre des octets de la base.
    return r.rows.map((x) => ({ id: x.id, title: x.title, sport: x.payload.sport ?? null, blocks: x.payload.blocks ?? [] }))
      .sort((a, b) => a.title.localeCompare(b.title, 'fr', { sensitivity: 'base' }));
  });
}

