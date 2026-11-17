import { athleteProfileSchema, parseWith, type AthleteProfileInput, type Experience, type Level, type Sport, type WeeklyHours, type WeeklySessions } from '@coachos/domain';
import { commandAs, readAs, type Tx } from '../db/client';
import { invalid, notVisible } from '../errors';
import { audit, idempotent, type StoredResponse } from './idempotency';

export interface AthleteProfile {
  sport: Sport;
  level: Level;
  experience: Experience;
  weeklySessions: WeeklySessions;
  weeklyHours: WeeklyHours | null;
  availableDays: number[];
  mainGoal: string | null;
  nextEventName: string | null;
  nextEventDate: string | null;
  revision: number;
  updatedAt: string;
}

type Row = {
  sport_code: Sport; level: Level; experience: Experience; weekly_sessions: WeeklySessions; weekly_hours: WeeklyHours | null;
  available_days: number[]; main_goal: string | null; next_event_name: string | null; next_event_date: string | null;
  revision: number; updated_at: Date;
};

const columns = `sport_code, level, experience, weekly_sessions, weekly_hours, available_days, main_goal, next_event_name,
  to_char(next_event_date, 'YYYY-MM-DD') as next_event_date, revision, updated_at`;

const toProfile = (r: Row): AthleteProfile => ({
  sport: r.sport_code,
  level: r.level,
  experience: r.experience,
  weeklySessions: r.weekly_sessions,
  weeklyHours: r.weekly_hours,
  availableDays: (r.available_days ?? []).map(Number),
  mainGoal: r.main_goal,
  nextEventName: r.next_event_name,
  nextEventDate: r.next_event_date,
  revision: r.revision,
  updatedAt: new Date(r.updated_at).toISOString(),
});

async function upsert(tx: Tx, wid: string, aid: string, p: AthleteProfileInput): Promise<AthleteProfile> {
  const r = await tx.query<Row>(
    `insert into public.athlete_profiles(workspace_id, athlete_id, sport_code, level, experience, weekly_sessions, weekly_hours,
       available_days, main_goal, next_event_name, next_event_date)
     values ($1, $2, $3, $4, $5, $6, $7, $8::smallint[], $9, $10, $11::date)
     on conflict (workspace_id, athlete_id) do update set
       sport_code = excluded.sport_code, level = excluded.level, experience = excluded.experience,
       weekly_sessions = excluded.weekly_sessions, weekly_hours = excluded.weekly_hours, available_days = excluded.available_days,
       main_goal = excluded.main_goal, next_event_name = excluded.next_event_name, next_event_date = excluded.next_event_date,
       revision = public.athlete_profiles.revision + 1, updated_at = now()
     returning ${columns}`,
    [wid, aid, p.sport, p.level, p.experience, p.weeklySessions, p.weeklyHours, p.availableDays, p.mainGoal, p.nextEventName, p.nextEventDate],
  );
  return toProfile(r.rows[0]!);
}

/** saveAthleteProfile · A : l’athlète décrit sa pratique pour cette relation. Le coach ne l’écrit pas. */
export async function saveAthleteProfile(meta: { actorId: string; idempotencyKey: string; requestId: string; workspaceId: string }, body: unknown): Promise<StoredResponse> {
  const parsed = parseWith(athleteProfileSchema, body);
  if (!parsed.ok) throw invalid(parsed.fields);
  const wid = meta.workspaceId;
  return commandAs(meta.actorId, async (tx) => {
    const r = await tx.query<{ id: string }>(
      `select id from public.athletes where workspace_id = $1 and user_id = auth.uid() and state = 'active' for update`,
      [wid],
    );
    const athlete = r.rows[0];
    if (!athlete) throw notVisible();
    return idempotent(tx, { workspaceId: wid, actorId: meta.actorId, action: 'athlete.profile', key: meta.idempotencyKey, body }, async () => {
      const item = await upsert(tx, wid, athlete.id, parsed.value);
      await audit(tx, wid, meta.actorId, 'athlete.profile', athlete.id, meta.requestId);
      return { status: 200, body: { item } };
    });
  });
}

/** Lecture sous RLS : l’athlète du dossier ou le coach affecté. null si absent ou non visible. */
export async function readAthleteProfile(userId: string, wid: string, aid: string): Promise<AthleteProfile | null> {
  return readAs(userId, async (tx) => {
    const r = await tx.query<Row>(`select ${columns} from public.athlete_profiles where workspace_id = $1 and athlete_id = $2`, [wid, aid]);
    return r.rows[0] ? toProfile(r.rows[0]) : null;
  });
}
