import { readAs } from '../db/client';
import { coachContext } from './context';

/** D-160 · Ce que la palette ⌘K du coach peut proposer : les élèves qu’il voit, groupes actifs et séances types (sous RLS, comme les pages). */
export interface PaletteData {
  athletes: { id: string; name: string; invited: boolean }[];
  teams: { id: string; name: string }[];
  /** `mine` : modifiable par ce coach (sinon la palette ouvre la bibliothèque). */
  templates: { id: string; title: string; mine: boolean }[];
}

export async function readPalette(userId: string, wid: string): Promise<PaletteData | null> {
  if (!(await coachContext(userId, wid))) return null;
  return readAs(userId, async (tx) => {
    const [a, t, l] = await Promise.all([
      tx.query<{ id: string; display_name: string; state: string }>(
        `select a.id, a.display_name, a.state from public.athletes a
          where a.workspace_id = $1 and a.state <> 'archived'
          order by a.display_name, a.id`, [wid]),
      tx.query<{ id: string; name: string }>('select id, name from public.teams where workspace_id = $1 and archived_at is null order by sort_order, name', [wid]),
      tx.query<{ id: string; title: string; mine: boolean }>(
        `select id, title, owner_id = auth.uid() as mine from public.templates
          where workspace_id = $1 and kind = 'workout' and not archived order by lower(title), id limit 400`, [wid]),
    ]);
    return {
      athletes: a.rows.map((r) => ({ id: r.id, name: r.display_name, invited: r.state === 'invited' })),
      teams: t.rows,
      templates: l.rows.filter((r) => r.title).map((r) => ({ id: r.id, title: r.title, mine: r.mine })),
    };
  });
}
