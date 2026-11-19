import type { LibraryCategory, LibraryWorkout } from '@coachos/domain';
import { readAs } from '../db/client';

// Lectures de la bibliothèque (D-035), sous RLS : séances de l’auteur (ou partagées dans l’espace).

export interface LibraryItem { id: string; revision: number; category: LibraryCategory; archived: boolean; mine: boolean; workout: LibraryWorkout; updatedAt: string }

type Row = { id: string; revision: number; archived: boolean; owner_id: string; payload: { category: LibraryCategory; workout: LibraryWorkout }; created_at: Date };
const toItem = (r: Row, uid: string): LibraryItem => ({
  id: r.id, revision: r.revision, category: r.payload.category ?? 'other', archived: r.archived, mine: r.owner_id === uid, workout: r.payload.workout,
  updatedAt: new Date(r.created_at).toISOString(),
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
