import {
  athleteProfileSchema, BILAN_FIELDS, bilanDraftSchema, coachBilanSchema, confirmBilanSchema, nextSources, parseWith,
  type AthleteProfileInput, type BilanAnswers, type BilanDraftInput, type BilanField, type BilanSource, type BilanStep,
  type BreakLength, type Equipment, type Experience, type Level, type LongestRecent, type PracticeStatus, type PreferredTime, type ResumedSince, type Sport,
  type WeekdayMinutes, type WeeklyHours, type WeeklySessions, type StrengthFocus, type TrainingPlace,
} from '@coachos/domain';
import { commandAs, readAs, type Tx } from '../db/client';
import { conflict, invalid, notVisible } from '../errors';
import { audit, idempotent, type StoredResponse } from './idempotency';
import { requireAssigned } from './portfolio';
import { notify } from './notifications';

// Profil sportif et bilan d’arrivée (D-021, D-054). Aucune donnée de santé.

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
  practiceStatus: PracticeStatus | null;
  breakLength: BreakLength | null;
  resumedSince: ResumedSince | null;
  longestRecent: LongestRecent | null;
  /** D-066 : temps, préférences et matériel. */
  weekdayMinutes: WeekdayMinutes | null;
  preferredTime: PreferredTime | null;
  longDay: number | null;
  equipment: Equipment[];
  practicalConstraints: string | null;
  /** D-108 : autres sports pratiqués, et ce que l’élève veut travailler en musculation. */
  otherSports: Sport[];
  strengthFocus: StrengthFocus[];
  /** D-110 : où l’élève fait sa musculation. */
  trainingPlaces: TrainingPlace[];
  /** Envoyé par l’élève (ou modifié depuis), ou confirmé par le coach. */
  status: 'submitted' | 'confirmed';
  confirmedAt: string | null;
  /** Provenance de chaque réponse : déclarée par l’élève ou recueillie en entretien. */
  sources: Partial<Record<BilanField, BilanSource>>;
  revision: number;
  updatedAt: string;
}

type Meta = { actorId: string; idempotencyKey: string; requestId: string; workspaceId: string };

type Row = {
  sport_code: Sport; level: Level; experience: Experience; weekly_sessions: WeeklySessions; weekly_hours: WeeklyHours | null;
  available_days: number[]; main_goal: string | null; next_event_name: string | null; next_event_date: string | null;
  practice_status: PracticeStatus | null; break_length: BreakLength | null; resumed_since: ResumedSince | null; longest_recent: LongestRecent | null;
  weekday_minutes: WeekdayMinutes | null; preferred_time: PreferredTime | null; long_day: number | null; equipment: Equipment[] | null; practical_constraints: string | null;
  other_sports: Sport[] | null; strength_focus: StrengthFocus[] | null; training_places: TrainingPlace[] | null;
  status: 'submitted' | 'confirmed'; confirmed_at: Date | null; sources: Partial<Record<BilanField, BilanSource>> | null;
  revision: number; updated_at: Date;
};

const columns = `sport_code, level, experience, weekly_sessions, weekly_hours, available_days, main_goal, next_event_name,
  to_char(next_event_date, 'YYYY-MM-DD') as next_event_date, practice_status, break_length, resumed_since, longest_recent,
  weekday_minutes, preferred_time, long_day, equipment, practical_constraints, other_sports, strength_focus, training_places,
  status, confirmed_at, sources, revision, updated_at`;

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
  practiceStatus: r.practice_status,
  breakLength: r.break_length,
  resumedSince: r.resumed_since,
  longestRecent: r.longest_recent,
  weekdayMinutes: r.weekday_minutes,
  preferredTime: r.preferred_time,
  longDay: r.long_day === null ? null : Number(r.long_day),
  equipment: r.equipment ?? [],
  practicalConstraints: r.practical_constraints,
  otherSports: r.other_sports ?? [],
  strengthFocus: r.strength_focus ?? [],
  trainingPlaces: r.training_places ?? [],
  status: r.status,
  confirmedAt: r.confirmed_at ? new Date(r.confirmed_at).toISOString() : null,
  sources: r.sources ?? {},
  revision: r.revision,
  updatedAt: new Date(r.updated_at).toISOString(),
});

/**
 * Enregistre le bilan. Source « athlete » : statut « envoyé » (une modification après confirmation la retire) ;
 * source « interview » (coach) : statut « confirmé ». Les champs modifiés prennent la nouvelle provenance.
 */
async function upsert(tx: Tx, wid: string, aid: string, p: AthleteProfileInput, source: BilanSource): Promise<AthleteProfile> {
  const prev = await tx.query<Row>(`select ${columns} from public.athlete_profiles where workspace_id = $1 and athlete_id = $2 for update`, [wid, aid]);
  const before = prev.rows[0] ? toProfile(prev.rows[0]) : null;
  // Rien de changé (ex. l’élève n’a modifié que son nom) : pas de nouvelle version, la confirmation reste.
  const same = before && BILAN_FIELDS.every((f) => JSON.stringify((before as unknown as Record<string, unknown>)[f] ?? null) === JSON.stringify(p[f] ?? null));
  if (before && same && (source === 'athlete' || before.status === 'confirmed')) {
    await tx.query('delete from public.athlete_profile_drafts where workspace_id = $1 and athlete_id = $2', [wid, aid]);
    return before;
  }
  const sources = nextSources(before as BilanAnswers | null, p, before?.sources ?? {}, source);
  const confirmed = source === 'interview';
  const r = await tx.query<Row>(
    `insert into public.athlete_profiles(workspace_id, athlete_id, sport_code, level, experience, weekly_sessions, weekly_hours,
       available_days, main_goal, next_event_name, next_event_date, practice_status, break_length, resumed_since, longest_recent,
       status, confirmed_at, confirmed_by, sources, weekday_minutes, preferred_time, long_day, equipment, practical_constraints, other_sports, strength_focus, training_places)
     values ($1, $2, $3, $4, $5, $6, $7, $8::smallint[], $9, $10, $11::date, $12, $13, $14, $15,
       case when $16 then 'confirmed' else 'submitted' end, case when $16 then now() end, case when $16 then auth.uid() end, $17::jsonb,
       $18, $19, $20, $21::text[], $22, $23::text[], $24::text[], $25::text[])
     on conflict (workspace_id, athlete_id) do update set
       sport_code = excluded.sport_code, level = excluded.level, experience = excluded.experience,
       weekly_sessions = excluded.weekly_sessions, weekly_hours = excluded.weekly_hours, available_days = excluded.available_days,
       main_goal = excluded.main_goal, next_event_name = excluded.next_event_name, next_event_date = excluded.next_event_date,
       practice_status = excluded.practice_status, break_length = excluded.break_length, resumed_since = excluded.resumed_since,
       longest_recent = excluded.longest_recent, status = excluded.status, confirmed_at = excluded.confirmed_at,
       confirmed_by = excluded.confirmed_by, sources = excluded.sources,
       weekday_minutes = excluded.weekday_minutes, preferred_time = excluded.preferred_time, long_day = excluded.long_day,
       equipment = excluded.equipment, practical_constraints = excluded.practical_constraints,
       other_sports = excluded.other_sports, strength_focus = excluded.strength_focus, training_places = excluded.training_places,
       revision = public.athlete_profiles.revision + 1, updated_at = now()
     returning ${columns}`,
    [wid, aid, p.sport, p.level, p.experience, p.weeklySessions, p.weeklyHours, p.availableDays, p.mainGoal, p.nextEventName, p.nextEventDate,
      p.practiceStatus, p.breakLength, p.resumedSince, p.longestRecent, confirmed, JSON.stringify(sources),
      p.weekdayMinutes ?? null, p.preferredTime ?? null, p.longDay ?? null, p.equipment ?? [], p.practicalConstraints ?? null,
      (p.otherSports ?? []).filter((x) => x !== p.sport), p.strengthFocus ?? [], p.trainingPlaces ?? []],
  );
  await tx.query('delete from public.athlete_profile_drafts where workspace_id = $1 and athlete_id = $2', [wid, aid]);
  const saved = toProfile(r.rows[0]!);
  // D-059 : version immuable des réponses, pour l’historique du bilan.
  await tx.query(
    `insert into public.athlete_profile_versions(workspace_id, athlete_id, revision, source, answers, saved_by)
     values ($1, $2, $3, $4, $5::jsonb, auth.uid()) on conflict do nothing`,
    [wid, aid, saved.revision, source, JSON.stringify(profileAnswers(saved))],
  );
  if (source === 'athlete') await notify(tx, { wid, aid, kind: 'bilan_submitted', entityId: aid, to: 'coaches' }); // D-067
  return saved;
}

async function ownAthlete(tx: Tx, wid: string): Promise<string> {
  const r = await tx.query<{ id: string }>(`select id from public.athletes where workspace_id = $1 and user_id = auth.uid() and state = 'active' for update`, [wid]);
  if (!r.rows[0]) throw notVisible();
  return r.rows[0].id;
}

/** D-059 : confirmer le bilan confirme le niveau déclaré pour ce sport, sauf si le coach en a déjà fixé un. */
async function confirmDeclaredLevel(tx: Tx, wid: string, aid: string) {
  await tx.query(
    `insert into public.athlete_sport_levels(workspace_id, athlete_id, sport_code, level, confirmed_by)
     select workspace_id, athlete_id, sport_code, level, auth.uid() from public.athlete_profiles where workspace_id = $1 and athlete_id = $2
     on conflict (workspace_id, athlete_id, sport_code) do nothing`,
    [wid, aid],
  );
}

/** saveAthleteProfile · A : l’athlète envoie son bilan pour cette relation. Le brouillon est effacé. */
export async function saveAthleteProfile(meta: Meta, body: unknown): Promise<StoredResponse> {
  const parsed = parseWith(athleteProfileSchema, body);
  if (!parsed.ok) throw invalid(parsed.fields);
  const wid = meta.workspaceId;
  return commandAs(meta.actorId, async (tx) => {
    const aid = await ownAthlete(tx, wid);
    return idempotent(tx, { workspaceId: wid, actorId: meta.actorId, action: 'athlete.profile', key: meta.idempotencyKey, body }, async () => {
      const item = await upsert(tx, wid, aid, parsed.value, 'athlete');
      await audit(tx, wid, meta.actorId, 'athlete.profile', aid, meta.requestId);
      return { status: 200, body: { item } };
    });
  });
}

/** saveBilanDraft · A : réponses en cours et écran atteint, pour reprendre plus tard sur n’importe quel appareil. */
export async function saveBilanDraft(meta: Meta, body: unknown): Promise<StoredResponse> {
  const parsed = parseWith(bilanDraftSchema, body);
  if (!parsed.ok) throw invalid(parsed.fields);
  const v = parsed.value as BilanDraftInput;
  const wid = meta.workspaceId;
  return commandAs(meta.actorId, async (tx) => {
    const aid = await ownAthlete(tx, wid);
    return idempotent(tx, { workspaceId: wid, actorId: meta.actorId, action: 'athlete.bilan-draft', key: meta.idempotencyKey, body }, async () => {
      await tx.query(
        `insert into public.athlete_profile_drafts(workspace_id, athlete_id, step, answers) values ($1, $2, $3, $4::jsonb)
         on conflict (workspace_id, athlete_id) do update set step = excluded.step, answers = excluded.answers, updated_at = now()`,
        [wid, aid, v.step, JSON.stringify(v.answers)],
      );
      return { status: 200, body: { step: v.step } };
    });
  });
}

/** saveBilanByCoach · C (CE-B-05) : le coach affecté remplit le même bilan pendant ou après l’entretien. */
export async function saveBilanByCoach(meta: Meta & { athleteId: string }, body: unknown): Promise<StoredResponse> {
  const parsed = parseWith(coachBilanSchema, body);
  if (!parsed.ok) throw invalid(parsed.fields);
  const v = parsed.value as { expectedRevision: number | null; data: AthleteProfileInput };
  const wid = meta.workspaceId;
  return commandAs(meta.actorId, async (tx) => {
    await requireAssigned(tx, wid, meta.athleteId);
    return idempotent(tx, { workspaceId: wid, actorId: meta.actorId, action: 'athlete.bilan-interview', key: meta.idempotencyKey, body: { aid: meta.athleteId, ...v } }, async () => {
      const cur = await tx.query<{ revision: number }>('select revision from public.athlete_profiles where workspace_id = $1 and athlete_id = $2 for update', [wid, meta.athleteId]);
      const revision = cur.rows[0]?.revision ?? null;
      if (revision !== v.expectedRevision) throw conflict('Le bilan a changé entre-temps (l’élève l’a peut-être complété). Recharge la page.', { revision });
      const item = await upsert(tx, wid, meta.athleteId, v.data, 'interview');
      await confirmDeclaredLevel(tx, wid, meta.athleteId);
      await audit(tx, wid, meta.actorId, 'athlete.bilan-interview', meta.athleteId, meta.requestId);
      return { status: 200, body: { item } };
    });
  });
}

/** confirmBilan · C (CE-B-04) : le coach affecté confirme le bilan envoyé ; une modification de l’élève le remet « à confirmer ». */
export async function confirmBilan(meta: Meta & { athleteId: string }, body: unknown): Promise<StoredResponse> {
  const parsed = parseWith(confirmBilanSchema, body);
  if (!parsed.ok) throw invalid(parsed.fields);
  const { expectedRevision } = parsed.value as { expectedRevision: number };
  const wid = meta.workspaceId;
  return commandAs(meta.actorId, async (tx) => {
    await requireAssigned(tx, wid, meta.athleteId);
    return idempotent(tx, { workspaceId: wid, actorId: meta.actorId, action: 'athlete.bilan-confirm', key: meta.idempotencyKey, body: { aid: meta.athleteId, expectedRevision } }, async () => {
      const cur = await tx.query<{ revision: number }>('select revision from public.athlete_profiles where workspace_id = $1 and athlete_id = $2 for update', [wid, meta.athleteId]);
      if (!cur.rows[0]) throw invalid([{ path: 'expectedRevision', rule: 'Aucun bilan envoyé' }]);
      if (cur.rows[0].revision !== expectedRevision) throw conflict('Le bilan a changé depuis ta lecture. Relis-le avant de confirmer.', { revision: cur.rows[0].revision });
      const r = await tx.query<Row>(
        `update public.athlete_profiles set status = 'confirmed', confirmed_at = now(), confirmed_by = auth.uid(), revision = revision + 1
         where workspace_id = $1 and athlete_id = $2 returning ${columns}`,
        [wid, meta.athleteId],
      );
      await confirmDeclaredLevel(tx, wid, meta.athleteId);
      await audit(tx, wid, meta.actorId, 'athlete.bilan-confirm', meta.athleteId, meta.requestId);
      return { status: 200, body: { item: toProfile(r.rows[0]!) } };
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

export interface BilanDraft { step: BilanStep; answers: BilanAnswers; updatedAt: string }

/** Brouillon du bilan, sous RLS (élève ou coach affecté). */
export async function readBilanDraft(userId: string, wid: string, aid: string): Promise<BilanDraft | null> {
  return readAs(userId, async (tx) => {
    const r = await tx.query<{ step: BilanStep; answers: BilanAnswers; updated_at: Date }>(
      'select step, answers, updated_at from public.athlete_profile_drafts where workspace_id = $1 and athlete_id = $2', [wid, aid],
    );
    const x = r.rows[0];
    return x ? { step: x.step, answers: x.answers, updatedAt: new Date(x.updated_at).toISOString() } : null;
  });
}

/** Réponses du bilan à partir du profil enregistré (pour le reprendre ou le compléter). */
export function profileAnswers(p: AthleteProfile): BilanAnswers {
  return {
    sport: p.sport, otherSports: p.otherSports, strengthFocus: p.strengthFocus, trainingPlaces: p.trainingPlaces, practiceStatus: p.practiceStatus, experience: p.experience, breakLength: p.breakLength, resumedSince: p.resumedSince,
    weeklySessions: p.weeklySessions, longestRecent: p.longestRecent, level: p.level, weeklyHours: p.weeklyHours, availableDays: p.availableDays,
    mainGoal: p.mainGoal, nextEventName: p.nextEventName, nextEventDate: p.nextEventDate,
    weekdayMinutes: p.weekdayMinutes, preferredTime: p.preferredTime, longDay: p.longDay, equipment: p.equipment, practicalConstraints: p.practicalConstraints,
  };
}

export interface BilanVersion { revision: number; source: BilanSource; savedAt: string; answers: BilanAnswers; changed: BilanField[] }

/** Historique du bilan, du plus récent au plus ancien, avec les réponses changées par rapport à la version précédente. */
export async function readBilanVersions(userId: string, wid: string, aid: string): Promise<BilanVersion[]> {
  return readAs(userId, async (tx) => {
    const r = await tx.query<{ revision: number; source: BilanSource; saved_at: Date; answers: BilanAnswers }>(
      'select revision, source, saved_at, answers from public.athlete_profile_versions where workspace_id = $1 and athlete_id = $2 order by revision',
      [wid, aid],
    );
    const out: BilanVersion[] = [];
    let prev: BilanAnswers | null = null;
    for (const x of r.rows) {
      const changed = prev ? BILAN_FIELDS.filter((f) => JSON.stringify(prev![f] ?? null) !== JSON.stringify(x.answers[f] ?? null)) : [];
      out.push({ revision: x.revision, source: x.source, savedAt: new Date(x.saved_at).toISOString(), answers: x.answers, changed });
      prev = x.answers;
    }
    return out.reverse();
  });
}

/** D-111 : matériel de musculation de l’élève (lieux et matériel de maison), avec son prénom, pour guider le choix des exercices. */
export async function athleteGear(userId: string, wid: string, aid: string): Promise<{ first: string; gear: { places: TrainingPlace[]; equipment: string[] } } | null> {
  const p = await readAthleteProfile(userId, wid, aid);
  if (!p || !p.trainingPlaces.length) return null;
  const name = await readAs(userId, async (tx) => (await tx.query<{ display_name: string }>('select display_name from public.athletes where workspace_id = $1 and id = $2', [wid, aid])).rows[0]?.display_name ?? '');
  return { first: name.split(' ')[0] || 'L’élève', gear: { places: p.trainingPlaces, equipment: p.equipment } };
}

