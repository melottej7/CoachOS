import { readAs, type Tx } from '../db/client';

export interface WorkspaceSummary {
  id: string;
  name: string;
  timeZone: string;
  role: 'owner' | 'coach' | 'athlete';
  athleteId: string | null;
}

/** Espaces visibles et rôle de l’identité courante (X05). Lecture sous RLS. */
export async function listWorkspaces(userId: string): Promise<WorkspaceSummary[]> {
  return readAs(userId, async (tx) => {
    const r = await tx.query<{ id: string; name: string; time_zone: string; role: string | null; athlete_id: string | null }>(
      `select w.id, w.name, w.time_zone, m.role, a.id as athlete_id
       from public.workspaces w
       left join public.memberships m on m.workspace_id = w.id and m.user_id = auth.uid() and m.active
       left join public.athletes a on a.workspace_id = w.id and a.user_id = auth.uid()
       order by w.name`,
    );
    return r.rows.map((row) => ({
      id: row.id,
      name: row.name,
      timeZone: row.time_zone,
      role: (row.role ?? 'athlete') as WorkspaceSummary['role'],
      athleteId: row.athlete_id,
    }));
  });
}

export async function workspaceFor(tx: Tx, wid: string) {
  const r = await tx.query<{ id: string; name: string; time_zone: string }>(
    'select id, name, time_zone from public.workspaces where id = $1',
    [wid],
  );
  return r.rows[0] ?? null;
}

export interface CoachContext {
  workspace: { id: string; name: string; timeZone: string };
  role: 'owner' | 'coach';
}

/** Le paramètre wid choisit le contexte mais ne donne aucun droit : vérification en base. */
export async function coachContext(userId: string, wid: string): Promise<CoachContext | null> {
  if (!isUuid(wid)) return null;
  return readAs(userId, async (tx) => {
    const r = await tx.query<{ id: string; name: string; time_zone: string; role: 'owner' | 'coach' }>(
      `select w.id, w.name, w.time_zone, m.role from public.workspaces w
       join public.memberships m on m.workspace_id = w.id and m.user_id = auth.uid() and m.active
       where w.id = $1`,
      [wid],
    );
    const row = r.rows[0];
    return row ? { workspace: { id: row.id, name: row.name, timeZone: row.time_zone }, role: row.role } : null;
  });
}

export interface AthleteContext {
  workspace: { id: string; name: string };
  athlete: { id: string; displayName: string; timeZone: string };
}

export async function athleteContext(userId: string, wid: string): Promise<AthleteContext | null> {
  if (!isUuid(wid)) return null;
  return readAs(userId, async (tx) => {
    const r = await tx.query<{ wname: string; id: string; display_name: string; time_zone: string }>(
      `select w.name as wname, a.id, a.display_name, a.time_zone from public.athletes a
       join public.workspaces w on w.id = a.workspace_id
       where a.workspace_id = $1 and a.user_id = auth.uid() and a.state = 'active'`,
      [wid],
    );
    const row = r.rows[0];
    return row
      ? { workspace: { id: wid, name: row.wname }, athlete: { id: row.id, displayName: row.display_name, timeZone: row.time_zone } }
      : null;
  });
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: string) => UUID.test(v);
