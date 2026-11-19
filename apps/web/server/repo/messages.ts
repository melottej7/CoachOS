import { commandAs, readAs, type Tx } from '../db/client';

// Lectures de la messagerie (D-033), sous RLS : fil privé (coach affecté ou élève lui-même),
// fil de groupe (coach de l’espace ou élève membre).

/** Carte de rendez-vous visible dans la conversation (sans préparation ni compte rendu). */
export interface AppointmentCard {
  id: string; title: string; kind: 'video' | 'call' | 'in_person'; startsAt: string; durationMin: number; timeZone: string; videoUrl: string | null; status: 'planned' | 'done' | 'canceled';
}

/** Séance citée par un message ou par un retour (D-036). */
export interface WorkoutRef { id: string; title: string; localDate: string }

/** Retour de séance affiché dans la conversation : il y retrouve sa place dans l’histoire de l’échange. */
export interface FeedbackEvent { id: string; createdAt: string; workout: WorkoutRef; state: string; rpe: number | null; comment: string | null; reviewed: boolean }

export interface ThreadMessage {
  appointment?: AppointmentCard | null;
  appointmentId?: string | null;
  workoutId?: string | null;
  workout?: WorkoutRef | null;
  id: string;
  createdAt: string;
  body: string;
  mine: boolean;
  senderName: string;
  fromCoach: boolean;
  voiceId: string | null;
  voiceDurationS: number | null;
}

export interface InboxEntry {
  kind: 'athlete' | 'team';
  id: string;
  name: string;
  last: { body: string; createdAt: string; mine: boolean } | null;
  unread: number;
  state?: 'invited' | 'active';
}

type MsgRow = { id: string; created_at: Date; body: string; sender_id: string | null; voice_id: string | null; voice_duration_s: number | null; appointment_id?: string | null; workout_id?: string | null };

async function me(tx: Tx): Promise<string> {
  return (await tx.query<{ uid: string }>('select auth.uid() as uid')).rows[0]!.uid;
}

/** Boîte de réception du coach : un fil par élève affecté, puis un fil par groupe actif. */
export async function coachInbox(userId: string, wid: string): Promise<InboxEntry[]> {
  return readAs(userId, async (tx) => {
    const athletes = await tx.query<{ id: string; display_name: string; state: 'invited' | 'active'; body: string | null; created_at: Date | null; sender_id: string | null; unread: number }>(
      `select a.id, a.display_name, a.state, lm.body, lm.created_at, lm.sender_id,
              (select count(*)::int from public.messages m
                where m.workspace_id = a.workspace_id and m.conversation_id = c.id and m.sender_id is distinct from auth.uid()
                  and m.created_at > coalesce((select rr.read_through_at from public.read_receipts rr
                       where rr.workspace_id = c.workspace_id and rr.conversation_id = c.id and rr.user_id = auth.uid()), '-infinity'::timestamptz)) as unread
       from public.athletes a
       left join public.conversations c on c.workspace_id = a.workspace_id and c.athlete_id = a.id
       left join lateral (select m.body, m.created_at, m.sender_id from public.messages m
                          where m.workspace_id = c.workspace_id and m.conversation_id = c.id order by m.created_at desc, m.id desc limit 1) lm on true
       where a.workspace_id = $1 and a.state <> 'archived'
       order by lm.created_at desc nulls last, a.display_name`,
      [wid],
    );
    const teams = await teamEntries(tx, wid, `select id, name from public.teams where workspace_id = $1 and archived_at is null order by sort_order, name`);
    const uid = await me(tx);
    return [
      ...athletes.rows.map((x) => ({
        kind: 'athlete' as const, id: x.id, name: x.display_name, state: x.state, unread: x.unread,
        last: x.body ? { body: x.body, createdAt: new Date(x.created_at!).toISOString(), mine: x.sender_id === uid } : null,
      })),
      ...teams,
    ];
  });
}

async function teamEntries(tx: Tx, wid: string, teamSql: string): Promise<InboxEntry[]> {
  const teams = await tx.query<{ id: string; name: string }>(teamSql, [wid]);
  const uid = await me(tx);
  const out: InboxEntry[] = [];
  for (const t of teams.rows) {
    const last = await tx.query<{ body: string; created_at: Date; sender_id: string | null }>(
      'select body, created_at, sender_id from public.team_messages where workspace_id = $1 and team_id = $2 order by created_at desc, id desc limit 1',
      [wid, t.id],
    );
    const unread = await tx.query<{ n: number }>(
      `select count(*)::int as n from public.team_messages m where m.workspace_id = $1 and m.team_id = $2 and m.sender_id is distinct from auth.uid()
         and m.created_at > coalesce((select read_through_at from public.team_reads where workspace_id = $1 and team_id = $2 and user_id = auth.uid()), '-infinity'::timestamptz)`,
      [wid, t.id],
    );
    const l = last.rows[0];
    out.push({ kind: 'team', id: t.id, name: t.name, unread: unread.rows[0]?.n ?? 0, last: l ? { body: l.body, createdAt: new Date(l.created_at).toISOString(), mine: l.sender_id === uid } : null });
  }
  return out;
}

export interface DirectThread { athleteId: string; athleteName: string; athleteTimeZone: string; coachName: string; conversationId: string | null; messages: ThreadMessage[]; feedbacks: FeedbackEvent[] }

/** Fil privé d’un élève (vu par son coach affecté ou par l’élève). null si non visible. */
export async function directThread(userId: string, wid: string, aid: string): Promise<DirectThread | null> {
  return readAs(userId, async (tx) => {
    const a = await tx.query<{ display_name: string; user_id: string | null; time_zone: string }>(
      `select display_name, user_id, time_zone from public.athletes where workspace_id = $1 and id = $2 and state <> 'archived'`,
      [wid, aid],
    );
    const athlete = a.rows[0];
    if (!athlete) return null;
    const c = await tx.query<{ id: string }>('select id from public.conversations where workspace_id = $1 and athlete_id = $2', [wid, aid]);
    const cid = c.rows[0]?.id ?? null;
    const uid = await me(tx);
    // Coachs visibles de l’espace : un message de coach n’est jamais compté comme venant de l’élève.
    const coachIds = new Set((await tx.query<{ user_id: string }>('select user_id from public.memberships where workspace_id = $1 and active', [wid])).rows.map((r) => r.user_id));
    const rows = cid
      ? (await tx.query<MsgRow>(
          `select * from (select id, created_at, body, sender_id, voice_id, voice_duration_s, appointment_id, workout_id from public.messages
             where workspace_id = $1 and conversation_id = $2 order by created_at desc, id desc limit 200) x order by created_at, id`,
          [wid, cid],
        )).rows
      : [];
    // Noms : l’élève connaît le nom de son coach par l’espace ; le coach connaît l’élève.
    const coach = await tx.query<{ name: string | null }>(
      `select coalesce((select display_name from public.users where id = auth.uid() and private.current_coach($1)), 'Ton coach') as name`,
      [wid],
    );
    return {
      athleteId: aid, athleteName: athlete.display_name, athleteTimeZone: athlete.time_zone, coachName: coach.rows[0]?.name ?? 'Ton coach', conversationId: cid,
      messages: rows.map((m) => {
        const fromAthlete = m.sender_id !== null && m.sender_id === athlete.user_id && !coachIds.has(m.sender_id);
        return {
          id: m.id, createdAt: new Date(m.created_at).toISOString(), body: m.body, mine: m.sender_id === uid,
          senderName: fromAthlete ? athlete.display_name : 'Coach', fromCoach: !fromAthlete,
          voiceId: m.voice_id, voiceDurationS: m.voice_duration_s === null ? null : Number(m.voice_duration_s),
          appointment: null,
          appointmentId: m.appointment_id ?? null,
          workoutId: m.workout_id ?? null,
          workout: null,
        };
      }),
      // Retours de séance de l’élève (version observée), lisibles par l’élève et son coach affecté.
      feedbacks: (await tx.query<{ id: string; created_at: Date; workout_id: string; title: string; local_date: string; state: string; rpe: number | null; comment: string | null; reviewed: boolean }>(
        `select f.id, f.created_at, res.workout_id, rev.title, to_char(rev.local_date, 'YYYY-MM-DD') as local_date, res.state, f.rpe, f.comment, (f.reviewed_at is not null) as reviewed
         from public.feedbacks f
         join public.workout_results res on res.workspace_id = f.workspace_id and res.athlete_id = f.athlete_id and res.id = f.result_id
         join public.workout_revisions rev on rev.workspace_id = res.workspace_id and rev.athlete_id = res.athlete_id and rev.workout_id = res.workout_id and rev.number = res.workout_revision
         where f.workspace_id = $1 and f.athlete_id = $2 order by f.created_at desc limit 50`,
        [wid, aid],
      )).rows.map((f) => ({
        id: f.id, createdAt: new Date(f.created_at).toISOString(), workout: { id: f.workout_id, title: f.title, localDate: f.local_date },
        state: f.state, rpe: f.rpe, comment: f.comment, reviewed: Boolean(f.reviewed),
      })),
    };
  }).then(async (t) => (t ? withCards(userId, wid, aid, t) : t));
}

/** Séances citées par les messages : titre et date de la version publiée (ou de travail pour le coach affecté). */
async function withWorkouts(userId: string, wid: string, aid: string, t: DirectThread): Promise<DirectThread> {
  const ids = [...new Set(t.messages.map((m) => m.workoutId).filter(Boolean))] as string[];
  if (!ids.length) return t;
  const rows = await commandAs(userId, async (tx) => (await tx.query<{ id: string; title: string; local_date: string }>(
    `select w.id, r.title, to_char(r.local_date, 'YYYY-MM-DD') as local_date
     from public.workouts w join public.workout_revisions r on r.workspace_id = w.workspace_id and r.athlete_id = w.athlete_id and r.workout_id = w.id
       and r.number = case when private.assigned($1, $2) then w.working_revision else w.published_revision end
     where w.workspace_id = $1 and w.athlete_id = $2 and w.id = any($3::uuid[])`,
    [wid, aid, ids],
  )).rows);
  const byId = new Map(rows.map((r) => [r.id, { id: r.id, title: r.title, localDate: r.local_date }]));
  return { ...t, messages: t.messages.map((m) => ({ ...m, workout: m.workoutId ? byId.get(m.workoutId) ?? null : null })) };
}

/**
 * Cartes de rendez-vous des messages visibles. L’élève n’a pas accès à la table des rendez-vous (préparation,
 * compte rendu) : seuls les champs utiles à la carte sont lus côté serveur, pour les rendez-vous de cet élève
 * cités par un message qu’il voit déjà.
 */
async function withCards(userId: string, wid: string, aid: string, t0: DirectThread): Promise<DirectThread> {
  const t = await withWorkouts(userId, wid, aid, t0);
  const ids = [...new Set(t.messages.map((m) => m.appointmentId).filter(Boolean))] as string[];
  if (!ids.length) return t;
  const rows = await commandAs(userId, async (tx) => (await tx.query<{ id: string; title: string; kind: AppointmentCard['kind']; starts_at: Date; duration_min: number; time_zone: string; video_url: string | null; status: AppointmentCard['status'] }>(
    `select id, title, kind, starts_at, duration_min, time_zone, video_url, status from public.appointments
     where workspace_id = $1 and athlete_id = $2 and id = any($3::uuid[])`,
    [wid, aid, ids],
  )).rows);
  const byId = new Map(rows.map((r) => [r.id, {
    id: r.id, title: r.title, kind: r.kind, startsAt: new Date(r.starts_at).toISOString(), durationMin: Number(r.duration_min), timeZone: r.time_zone, videoUrl: r.video_url, status: r.status,
  } satisfies AppointmentCard]));
  return { ...t, messages: t.messages.map((m) => ({ ...m, appointment: byId.get(m.appointmentId ?? '') ?? null })) };
}



export interface TeamThread { teamId: string; name: string; messages: ThreadMessage[]; members: string[] | null }

/** Fil d’un groupe (coach de l’espace ou élève membre). null si non visible ou archivé. */
export async function teamThread(userId: string, wid: string, tid: string): Promise<TeamThread | null> {
  return readAs(userId, async (tx) => {
    const t = await tx.query<{ name: string }>('select name from public.teams where workspace_id = $1 and id = $2 and archived_at is null', [wid, tid]);
    if (!t.rows[0]) return null;
    const uid = await me(tx);
    const rows = (await tx.query<MsgRow & { sender_name: string; sender_role: string }>(
      `select * from (select id, created_at, body, sender_id, sender_name, sender_role, voice_id, voice_duration_s from public.team_messages
         where workspace_id = $1 and team_id = $2 order by created_at desc, id desc limit 200) x order by created_at, id`,
      [wid, tid],
    )).rows;
    // Liste des membres : visible par le coach (affectations), pas par les élèves.
    const members = await tx.query<{ display_name: string }>(
      `select a.display_name from public.team_athletes ta join public.athletes a on a.workspace_id = ta.workspace_id and a.id = ta.athlete_id
       where ta.workspace_id = $1 and ta.team_id = $2 and a.state <> 'archived' order by a.display_name`,
      [wid, tid],
    );
    const isCoach = (await tx.query<{ ok: boolean }>('select private.current_coach($1) as ok', [wid])).rows[0]?.ok;
    return {
      teamId: tid, name: t.rows[0].name, members: isCoach ? members.rows.map((m) => m.display_name) : null,
      messages: rows.map((m) => ({
        id: m.id, createdAt: new Date(m.created_at).toISOString(), body: m.body, mine: m.sender_id === uid, senderName: m.sender_name,
        fromCoach: m.sender_role === 'coach', voiceId: m.voice_id, voiceDurationS: m.voice_duration_s === null ? null : Number(m.voice_duration_s),
      })),
    };
  });
}

/** Côté élève : fil avec le coach et fils des groupes dont il est membre. */
export async function athleteInbox(userId: string, wid: string, aid: string): Promise<InboxEntry[]> {
  return readAs(userId, async (tx) => {
    const unread = await tx.query<{ n: number; body: string | null; created_at: Date | null; sender_id: string | null }>(
      `select (select count(*)::int from public.messages m where m.workspace_id = c.workspace_id and m.conversation_id = c.id and m.sender_id is distinct from auth.uid()
                 and m.created_at > coalesce((select read_through_at from public.read_receipts where workspace_id = c.workspace_id and conversation_id = c.id and user_id = auth.uid()), '-infinity'::timestamptz)) as n,
              lm.body, lm.created_at, lm.sender_id
       from public.conversations c
       left join lateral (select body, created_at, sender_id from public.messages m where m.workspace_id = c.workspace_id and m.conversation_id = c.id order by created_at desc, id desc limit 1) lm on true
       where c.workspace_id = $1 and c.athlete_id = $2`,
      [wid, aid],
    );
    const uid = await me(tx);
    const x = unread.rows[0];
    const coachEntry: InboxEntry = {
      kind: 'athlete', id: aid, name: 'Ton coach', unread: x?.n ?? 0,
      last: x?.body ? { body: x.body, createdAt: new Date(x.created_at!).toISOString(), mine: x.sender_id === uid } : null,
    };
    // RLS « member » : seuls les groupes dont l’élève est membre sont visibles.
    const teams = await teamEntries(tx, wid, `select id, name from public.teams where workspace_id = $1 and archived_at is null order by sort_order, name`);
    return [coachEntry, ...teams];
  });
}

/** Total des messages non lus (pastille du menu). */
export async function unreadTotal(entries: InboxEntry[]): Promise<number> {
  return entries.reduce((n, e) => n + e.unread, 0);
}

/** Vocal : visible seulement si le message qui le porte est visible (RLS), puis lecture des octets côté serveur. */
export async function readVoice(userId: string, wid: string, vid: string): Promise<{ type: string; bytes: Buffer } | null> {
  const visible = await readAs(userId, async (tx) => {
    const r = await tx.query<{ ok: boolean }>(
      `select exists(select 1 from public.messages where workspace_id = $1 and voice_id = $2)
           or exists(select 1 from public.team_messages where workspace_id = $1 and voice_id = $2) as ok`,
      [wid, vid],
    );
    return Boolean(r.rows[0]?.ok);
  });
  if (!visible) return null;
  return commandAs(userId, async (tx) => {
    const r = await tx.query<{ content_type: string; bytes: Buffer | Uint8Array }>('select content_type, bytes from public.voice_clips where workspace_id = $1 and id = $2', [wid, vid]);
    const x = r.rows[0];
    return x ? { type: x.content_type, bytes: Buffer.from(x.bytes) } : null;
  });
}
