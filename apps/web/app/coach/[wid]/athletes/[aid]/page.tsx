import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireActor } from '@/server/auth/session';
import {
  APPOINTMENT_KIND_LABELS, APPOINTMENT_STATUS_LABELS, DAY_LABELS, EXPERIENCE_LABELS, formatLongDate, formatShortDate, formatWeekday, GOAL_STATE_LABELS,
  addDays, LEVEL_LABELS, RESULT_STATE_LABELS, SPORT_LABELS, todayIn, weekStart, urgencyLabel, utcToLocal, WEEKLY_HOURS_LABELS, WEEKLY_SESSIONS_LABELS,
  EQUIPMENT_LABELS, PREFERRED_TIME_LABELS, WEEKDAY_MINUTES_LABELS,
  measureFreshness, assessGoal, BILAN_FIELD_LABELS, BILAN_STATUS_LABELS, chronoFromTitle, BREAK_LENGTH_LABELS, DEFAULT_GOAL_KM, distanceFromTitle, FEASIBILITY_LABELS, bilanCompletion, deriveBilan, LONGEST_RECENT_LABELS, PRACTICE_STATUS_LABELS, RESUMED_SINCE_LABELS,
  type ResultState, type Sport, loadProgress,
} from '@coachos/domain';
import { readAthleteProfile, readBilanDraft, readBilanVersions } from '@/server/commands/athlete-profile';
import { goalsAwaitingProgram } from '@/server/commands/programs';
import { readAthleteReferences } from '@/server/commands/athlete-references';
import { latestInvitation } from '@/server/commands/invitations';
import { coachContext } from '@/server/repo/context';
import { athleteFile } from '@/server/repo/portfolio';
import { athleteStats, strengthHistory } from '@/server/repo/stats';
import { LoadProgress } from '@/components/load-progress';
import { StatsPanel } from '@/components/stats-panel';
import { HistoryTable } from '@/components/history-table';
import { WeekReviewCard } from '@/components/week-review';
import { athleteMeasureFacts, athleteWeekReview } from '@/server/repo/week-review';
import { FeasibilityPanel } from '@/components/feasibility-panel';
import { PerformancesPanel } from '@/components/performances-panel';
import { readPerformances } from '@/server/commands/performances';
import { readGoalDecisions } from '@/server/commands/goal-decisions';
import { ReferencesForm } from '@/components/references-form';
import { ResendInvitation, RevokeInvitation } from '@/components/roster-forms';
import {
  ActionButton, AppointmentForm, AppointmentReport, GoalForm, LevelConfirm, NoteForm, TaskActions, TaskForm, TeamMembership,
} from '@/components/portfolio-forms';
import { Notice, Pill } from '@/components/ui';

export const metadata = { title: 'Fiche élève' };

const NOTICES: Record<string, string> = {
  created: 'Fiche créée. Envoie l’invitation quand tu as l’adresse e-mail.',
  invited: 'Invitation envoyée. Le lien précédent, s’il existait, ne fonctionne plus.',
  revoked: 'Invitation annulée. Le lien ne permet plus de rejoindre l’espace.',
  bilan: 'Bilan de l’entretien enregistré et confirmé.',
};

const fmt = (iso: string, tz: string) => new Intl.DateTimeFormat('fr-BE', { dateStyle: 'long', timeZone: tz }).format(new Date(iso));
/** Retour vers la liste avec groupe, filtres et regroupement conservés (CE-G-04). */
const safeFrom = (from: string | undefined, wid: string) => (from && from.startsWith(`/coach/${wid}/`) && !from.includes('//') ? from : `/coach/${wid}/athletes`);

/** CE-G-06 : fiche élève centrale. */
export default async function AthletePage({ params, searchParams }: { params: Promise<{ wid: string; aid: string }>; searchParams: Promise<{ notice?: string; from?: string; periode?: string }> }) {
  const { wid, aid } = await params;
  const { notice, from, periode } = await searchParams;
  const actor = await requireActor();
  const ctx = await coachContext(actor.userId, wid);
  if (!ctx) notFound();
  const tz = ctx.workspace.timeZone;
  const file = await athleteFile(actor.userId, wid, aid, tz);
  const a = file.entry;
  if (!a) notFound();
  const today = todayIn(tz);
  const inv = a.state === 'invited' ? await latestInvitation(actor.userId, wid, aid) : null;
  const profile = a.state === 'active' ? await readAthleteProfile(actor.userId, wid, aid) : null;
  const bilanDraft = a.state === 'active' && !profile ? await readBilanDraft(actor.userId, wid, aid) : null;
  const bilanVersions = profile ? await readBilanVersions(actor.userId, wid, aid) : [];
  // CE-P-07 (D-057) : faisabilité du prochain objectif daté (sinon de la course déclarée dans le bilan).
  const goalToday = todayIn(a.timeZone);
  // D-073 : résumé de la semaine dernière (complète), dans le fuseau de l’élève.
  // Si la semaine dernière est trop mince, la semaine en cours (séances déjà passées) prend le relais.
  const pastMonday = addDays(weekStart(goalToday), -7);
  const lastReview = a.state === 'active' ? await athleteWeekReview(actor.userId, wid, aid, pastMonday, goalToday) : null;
  const thisReview = lastReview?.status === 'insufficient' ? await athleteWeekReview(actor.userId, wid, aid, weekStart(goalToday), goalToday) : null;
  const current = thisReview?.status === 'ok';
  const review = current ? thisReview : lastReview;
  const lastMonday = current ? weekStart(goalToday) : pastMonday;
  // D-075 : d’où viennent les chiffres de la fiche, et depuis quand.
  const measures = a.state === 'active' ? await athleteMeasureFacts(actor.userId, wid, aid, goalToday, a.timeZone) : null;
  const freshness = measures ? measureFreshness(measures, goalToday) : null;
  const goalCandidate = file.goals.filter((g) => g.state === 'planned' && g.targetDate && g.targetDate > goalToday).sort((x, y) => (x.targetDate! < y.targetDate! ? -1 : 1))[0]
    ?? (profile?.nextEventDate && profile.nextEventDate > goalToday ? { title: profile.nextEventName ?? 'Prochaine course', sport: profile.sport, targetDate: profile.nextEventDate } : null);
  // Passif (D-058) : ce que l’élève a vraiment fait ces 6 dernières semaines, sa régularité réelle et ses objectifs atteints.
  const past = profile && goalCandidate ? await athleteStats(actor.userId, wid, aid, addDays(goalToday, -41), goalToday, goalToday) : null;
  // D-096 (M4) : progression des charges, exercice par exercice.
  const loads = loadProgress(await strengthHistory(actor.userId, wid, aid));
  const done = (past?.history ?? []).filter((r) => !r.canceled && (r.state === 'completed' || r.state === 'partial'));
  const last4 = (past?.history ?? []).filter((r) => !r.canceled && r.localDate > addDays(goalToday, -28));
  const performances = await readPerformances(actor.userId, wid, aid);
  const achievedKm = Math.max(
    ...file.goals.filter((g) => g.state === 'achieved' && goalCandidate && g.sport === goalCandidate.sport).map((g) => distanceFromTitle(g.title) ?? 0),
    ...performances.filter((x) => goalCandidate && x.sport === goalCandidate.sport && x.kind === 'race').map((x) => x.distanceM / 1000),
    0,
  ) || null;
  const goalDecisions = a.state === 'active' ? await readGoalDecisions(actor.userId, wid, aid) : [];
  const feasibility = profile && goalCandidate ? {
    title: goalCandidate.title,
    goalId: 'id' in goalCandidate ? (goalCandidate.id as string) : null,
    input: {
      sport: goalCandidate.sport, distanceKm: distanceFromTitle(goalCandidate.title) ?? DEFAULT_GOAL_KM[goalCandidate.sport], eventDate: goalCandidate.targetDate!,
      targetSeconds: chronoFromTitle(goalCandidate.title), level: profile.level, practiceStatus: profile.practiceStatus, longestRecent: profile.longestRecent,
      weeklySessions: profile.weeklySessions, weeklyHours: profile.weeklyHours, today: goalToday,
      history: {
        experience: profile.experience, breakLength: profile.breakLength, resumedSince: profile.resumedSince,
        recentLongestDoneMin: done.reduce((m, r) => Math.max(m, Math.round((r.doneSeconds ?? (r.state === 'completed' ? r.plannedSeconds ?? 0 : 0)) / 60)), 0) || null,
        regularity: last4.length ? { due: last4.length, done: last4.filter((r) => r.state === 'completed' || r.state === 'partial').length } : null,
        achievedKm,
      },
    },
  } : null;
  const feasibilityStatus = feasibility ? assessGoal(feasibility.input).status : null;
  const bilanDraftDone = bilanDraft ? bilanCompletion(deriveBilan(bilanDraft.answers)) : null;
  const refs = await readAthleteReferences(actor.userId, wid, aid);
  const first = a.name.split(' ')[0] ?? a.name;
  const base = `/coach/${wid}`;
  const back = safeFrom(from, wid);
  const u = urgencyLabel(a.urgency);
  // Sports à confirmer : celui du profil, plus ceux déjà confirmés.
  // Suivi de l’entraînement (D-037) : semaines du fuseau de l’élève.
  const weeks = [4, 8, 12].includes(Number(periode)) ? Number(periode) : 8;
  const aToday = todayIn(a.timeZone);
  const stats = a.state === 'active'
    ? await athleteStats(actor.userId, wid, aid, addDays(weekStart(aToday), -7 * (weeks - 1)), addDays(weekStart(aToday), 6), aToday)
    : null;
  const periodHref = (n: number) => `${base}/athletes/${aid}?periode=${n}${from ? `&from=${encodeURIComponent(from)}` : ''}#suivi`;
  const sports = [...new Set([...(a.sport ? [a.sport] : []), ...a.levels.map((l) => l.sport)])] as Sport[];

  const awaiting = await goalsAwaitingProgram(actor.userId, wid, aid);
  return (
    <>
      <Link className="back" href={back}>← {back.includes('/planning') ? 'Planning' : 'Élèves'}</Link>
      <Notice message={notice ? NOTICES[notice] ?? null : null} />
      {awaiting.map((g) => (
        <div key={g.id} className="banner next-step" role="status">
          <span><strong>Prochaine étape :</strong> l’objectif « {g.title} » est validé. Génère le programme qui permet de l’atteindre (tu relis les risques, rien n’est publié).</span>
          <Link className="btn primary small" href={`/coach/${wid}/athletes/${aid}/programme?objectif=${g.id}`}>📅 Générer le programme</Link>
        </div>
      ))}
      <div className="head">
        <div>
          <div className="kicker">Fiche élève · {a.timeZone.replace(/_/g, ' ')}</div>
          <h1>{a.name}</h1>
          <p className="sub">
            {a.state === 'active' ? <Pill>A rejoint l’espace</Pill> : <Pill tone="neutral">Invité·e, pas encore connecté·e</Pill>}{' '}
            <Pill tone={u === 'Urgent' ? 'attn' : u === 'À suivre' ? '' : 'neutral'}>{u}</Pill>
          </p>
        </div>
        <span className="actions">
          <Link className="btn" href={`${base}/messages/${aid}`}>💬 Écrire à {first}</Link>
          <AppointmentForm wid={wid} athletes={[{ id: a.id, name: a.name, timeZone: a.timeZone }]} athleteId={a.id} timeZone={a.timeZone} today={today} label="📅 Planifier un appel" />
          <Link className="btn primary" href={`${base}/calendar?athlete=${aid}`}>Préparer ses séances</Link>
        </span>
      </div>

      {review ? (
        <section className="card" aria-labelledby="wr-title" id="semaine">
          <div className="card-head"><h2 id="wr-title">{current ? 'Cette semaine (en cours)' : 'Semaine dernière'}</h2><span className="muted">{current ? `Depuis le ${formatShortDate(lastMonday)}, jusqu’à hier` : `Du ${formatShortDate(lastMonday)} au ${formatShortDate(addDays(lastMonday, 6))}`} · calculé sur ses retours</span></div>
          <div className="card-body"><WeekReviewCard review={review} wid={wid} aid={aid} first={first ?? a.name} title={review.status === 'insufficient' ? 'Pas assez de séances publiées pour un résumé.' : 'Prévu, déclaré et manquant :'} /></div>
        </section>
      ) : null}

      <section className="card" aria-labelledby="groups-title">
        <div className="card-head"><h2 id="groups-title">Groupes</h2></div>
        <div className="card-body"><TeamMembership wid={wid} aid={aid} teams={a.teams} all={file.allTeams} /></div>
      </section>

      <section className="card" aria-labelledby="todo-title" id="todo">
        <div className="card-head">
          <h2 id="todo-title">À faire pour {first}</h2>
          <TaskForm wid={wid} athletes={[{ id: a.id, name: a.name }]} teams={[]} athleteId={a.id} today={today} />
        </div>
        {a.todo.length ? (
          <ul className="task-list">
            {a.todo.map((t) => (
              <li key={t.key} className={`task prio-${t.priority}`}>
                <div className="task-main">
                  <p className="task-title">{t.title}</p>
                  <p className="task-meta"><span className="task-why">{t.reason}</span>{t.dueOn ? ` · ${t.dueOn < today ? 'en retard, ' : ''}${formatWeekday(t.dueOn).toLowerCase()} ${formatShortDate(t.dueOn)}` : ''}
                    {t.source === 'auto' ? <> {' '}<Pill tone="neutral">Suivi automatique</Pill></> : null}</p>
                </div>
                <TaskActions wid={wid} source={t.source} id={t.id} rule={t.rule} sourceRef={t.ref} revision={t.revision} today={today} link={t.link?.startsWith(`${base}/athletes/${aid}`) ? (t.link.includes('#') ? `#${t.link.split('#')[1]}` : null) : t.link} athlete={{ id: a.id, name: a.name, timeZone: a.timeZone }} />
              </li>
            ))}
          </ul>
        ) : <p className="empty">Rien à faire pour {first} pour l’instant.</p>}
        {file.closedTasks ? <p className="muted foot-note">{file.closedTasks} tâche{file.closedTasks > 1 ? 's' : ''} terminée{file.closedTasks > 1 ? 's' : ''} ou annulée{file.closedTasks > 1 ? 's' : ''}.</p> : null}
      </section>

      <div className="split">
        <section className="card" aria-labelledby="levels-title" id="levels">
          <div className="card-head"><h2 id="levels-title">Niveau par sport</h2></div>
          <div className="card-body stack">
            {sports.length ? sports.map((s) => {
              const c = a.levels.find((l) => l.sport === s)?.level ?? null;
              const declared = a.sport === s ? a.declaredLevel : null;
              return (
                <div key={s} className="level-line">
                  <LevelConfirm wid={wid} aid={aid} sport={s} declared={declared} confirmed={c} />
                  <p className="muted">{c ? `Confirmé : ${LEVEL_LABELS[c].label}.` : 'Pas encore confirmé.'}{declared ? ` Déclaré par ${first} : ${LEVEL_LABELS[declared].label}.` : ''}</p>
                </div>
              );
            }) : <p className="muted">Le niveau s’affichera quand {first} aura rempli son profil sportif.</p>}
          </div>
        </section>

        <section className="card" aria-labelledby="goals-title">
          <div className="card-head"><h2 id="goals-title">Objectifs</h2><GoalForm wid={wid} aid={aid} sport={a.sport} /></div>
          <div className="card-body">
            {file.goals.length ? (
              <ul className="plain stack">
                {file.goals.map((g) => (
                  <li key={g.id} className={`goal goal-${g.state}`}>
                    <strong>{g.title}</strong> · {SPORT_LABELS[g.sport]}{g.targetDate ? ` · ${formatLongDate(g.targetDate).toLowerCase()}` : ''} <Pill tone={g.state === 'planned' ? '' : 'neutral'}>{GOAL_STATE_LABELS[g.state]}</Pill>
                    {goalDecisions.some((d) => d.goalId === g.id) ? <> <Pill tone="neutral">✓ Validé par toi</Pill>{g.state === 'planned' ? <> <Link className="link-btn" href={`${base}/athletes/${aid}/programme?objectif=${g.id}`}>📅 Programme</Link></> : null}</> : null}
                    {g.state === 'planned' ? (
                      <span className="actions inline">
                        <ActionButton method="PATCH" url={`/api/v1/workspaces/${wid}/athletes/${aid}/goals/${g.id}`} body={{ state: 'achieved' }} className="link-btn">Atteint</ActionButton>
                        <ActionButton method="PATCH" url={`/api/v1/workspaces/${wid}/athletes/${aid}/goals/${g.id}`} body={{ state: 'canceled' }} className="link-btn" confirm="Marquer cet objectif comme abandonné ?">Abandonné</ActionButton>
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : <p className="muted">Aucun objectif enregistré. {profile?.mainGoal ? `${first} a écrit : « ${profile.mainGoal} »` : ''}</p>}
            <p className="muted foot-note">Les objectifs sont visibles par {first}.</p>
          </div>
        </section>
      </div>

      {feasibility ? (
        <section className="card" aria-labelledby="fz-title" id="faisabilite">
          <details>
            <summary className="card-head"><h2 id="fz-title">Faisabilité · {feasibility.title}</h2><Pill tone={feasibilityStatus === 'realistic' ? '' : feasibilityStatus === 'ambitious' ? 'neutral' : 'attn'}>{FEASIBILITY_LABELS[feasibilityStatus!]}</Pill></summary>
            <div className="card-body"><FeasibilityPanel wid={wid} aid={aid} first={first} goalTitle={feasibility.title} goalId={feasibility.goalId} initial={feasibility.input}
              decision={goalDecisions.find((d) => d.goalId === feasibility.goalId) ?? null} performances={performances} /></div>
          </details>
        </section>
      ) : null}

      <div className="split">
        <section className="card" aria-labelledby="next-title">
          <div className="card-head"><h2 id="next-title">Prochaines séances</h2><Link className="link-btn" href={`${base}/calendar?athlete=${aid}`}>Planifier</Link></div>
          {file.upcoming.length ? (
            <ul className="plain list-rows">
              {file.upcoming.map((w) => (
                <li key={w.id}><Link href={`${base}/athletes/${aid}/workouts/${w.id}`}>{formatWeekday(w.localDate)} {formatShortDate(w.localDate)} · {w.title}</Link> {w.published ? null : <Pill tone="neutral">Brouillon</Pill>}</li>
              ))}
            </ul>
          ) : <p className="empty">Aucune séance sur les 14 prochains jours.</p>}
        </section>

        <section className="card" aria-labelledby="fb-title">
          <div className="card-head"><h2 id="fb-title">Derniers retours</h2></div>
          {file.recentFeedback.length ? (
            <ul className="plain list-rows">
              {file.recentFeedback.map((f) => (
                <li key={f.workoutId}><Link href={`${base}/athletes/${aid}/workouts/${f.workoutId}`}>{formatShortDate(f.localDate)} · {f.title}</Link> · {RESULT_STATE_LABELS[f.state as ResultState]} {f.reviewed ? <Pill tone="neutral">Traité</Pill> : <Pill tone="attn">À traiter</Pill>}</li>
              ))}
            </ul>
          ) : <p className="empty">Aucun retour pour l’instant.</p>}
        </section>
      </div>

      {stats ? (
        <section className="card" aria-labelledby="suivi-title" id="suivi">
          <div className="card-head"><h2 id="suivi-title">Suivi de l’entraînement</h2></div>
          <div className="card-body stack">
            {freshness ? (
              <div className={`measures${freshness.stale ? ' stale' : ''}`} aria-label="Source et fraîcheur des mesures">
                {freshness.lines.map((l, i) => <p key={i} className={i === 2 ? 'measures-warn' : 'muted'}>{l}</p>)}
              </div>
            ) : null}
            <StatsPanel s={stats.summary} delta={stats.delta} weeks={weeks} periodHref={periodHref} you={false} />
            <HistoryTable rows={stats.history} weeks={weeks} href={(sid) => `${base}/athletes/${aid}/workouts/${sid}`} />
          </div>
        </section>
      ) : null}

      {loads.length ? (
        <section className="card" aria-labelledby="charges-title" id="charges">
          <div className="card-head"><h2 id="charges-title">Charges en musculation</h2><span className="muted">Meilleure série par exercice, d’après ses retours</span></div>
          <div className="card-body"><LoadProgress series={loads} limit={12} /></div>
        </section>
      ) : null}

      <section className="card" aria-labelledby="rdv-title" id="rdv">
        <div className="card-head"><h2 id="rdv-title">Rendez-vous</h2><AppointmentForm wid={wid} athletes={[{ id: a.id, name: a.name, timeZone: a.timeZone }]} athleteId={a.id} timeZone={a.timeZone} today={today} label="📅 Planifier un appel" /></div>
        {file.appointments.length ? (
          <ul className="plain list-rows">
            {file.appointments.map((p) => {
              const local = utcToLocal(new Date(p.startsAt), p.timeZone);
              return (
                <li key={p.id} className="appt">
                  <p><strong>{formatWeekday(local.date)} {formatShortDate(local.date)} à {local.time}</strong> ({p.timeZone.replace(/_/g, ' ')}) · {p.title} · {APPOINTMENT_KIND_LABELS[p.kind]}, {p.durationMin} min <Pill tone={p.status === 'planned' ? '' : 'neutral'}>{APPOINTMENT_STATUS_LABELS[p.status]}</Pill></p>
                  {p.videoUrl && p.status === 'planned' ? <p><a href={p.videoUrl} target="_blank" rel="noopener noreferrer">Lien de visio</a></p> : null}
                  {p.prepNotes ? <p className="muted">Préparation : {p.prepNotes}</p> : null}
                  {p.report ? <p className="prose">Compte rendu : {p.report}</p> : null}
                  {p.status !== 'canceled' ? (
                    <span className="actions inline">
                      <AppointmentReport wid={wid} id={p.id} revision={p.revision} report={p.report} />
                      {p.status === 'planned' ? <ActionButton method="PATCH" url={`/api/v1/workspaces/${wid}/appointments/${p.id}`} body={{ expectedRevision: p.revision, status: 'canceled', notify: true }} className="link-btn" confirm={`Annuler ce rendez-vous ? ${first} sera prévenu·e dans la conversation.`}>Annuler</ActionButton> : null}
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : <p className="empty">Aucun rendez-vous. Planifie un appel ou une visio pour faire le point avec {first}.</p>}
      </section>

      <section className="card" aria-labelledby="refs-title">
        <div className="card-head"><h2 id="refs-title">Repères d’entraînement</h2><Pill tone="neutral">Fixés par toi</Pill></div>
        <div className="card-body"><ReferencesForm wid={wid} aid={aid} first={first} vmaKmh={refs.vmaKmh} ftpW={refs.ftpW} cssSecPer100={refs.cssSecPer100} /></div>
      </section>

      <section className="card" aria-labelledby="perf-title" id="resultats">
        <div className="card-head"><h2 id="perf-title">Résultats de référence</h2><Pill tone="neutral">Saisis par toi</Pill></div>
        <div className="card-body"><PerformancesPanel wid={wid} aid={aid} first={first} sport={a.sport} items={performances} today={goalToday} vmaKmh={refs.vmaKmh} /></div>
      </section>

      {a.state === 'active' ? (
        <section className="card" aria-labelledby="profile-title" id="bilan">
          <div className="card-head">
            <h2 id="profile-title">Bilan</h2>
            <span className="actions">
              <Pill tone={profile?.status === 'confirmed' ? 'neutral' : profile ? 'attn' : 'neutral'}>{BILAN_STATUS_LABELS[profile ? profile.status : bilanDraft ? 'draft' : 'none']}</Pill>
              <Link className="btn small" href={`${base}/athletes/${aid}/bilan`}>📞 {profile ? 'Compléter en entretien' : 'Remplir en entretien'}</Link>
            </span>
          </div>
          {profile ? (
            <div className="card-body stack">
              <dl className="details">
                {([
                  ['sport', 'Sport', SPORT_LABELS[profile.sport]],
                  ['practiceStatus', 'Situation', profile.practiceStatus ? PRACTICE_STATUS_LABELS[profile.practiceStatus] : null],
                  ['experience', 'Pratique régulière', EXPERIENCE_LABELS[profile.experience]],
                  ['breakLength', 'Durée de l’arrêt', profile.breakLength ? BREAK_LENGTH_LABELS[profile.breakLength] : null],
                  ['resumedSince', 'Reprise', profile.resumedSince ? RESUMED_SINCE_LABELS[profile.resumedSince] : null],
                  ['weeklySessions', 'Séances / semaine (4 dernières sem.)', WEEKLY_SESSIONS_LABELS[profile.weeklySessions]],
                  ['longestRecent', 'Plus longue sortie récente', profile.longestRecent ? LONGEST_RECENT_LABELS[profile.longestRecent] : null],
                  ['level', 'Niveau', LEVEL_LABELS[profile.level].label],
                  ['weeklyHours', 'Volume possible / semaine', profile.weeklyHours ? WEEKLY_HOURS_LABELS[profile.weeklyHours] : 'Non précisé'],
                  ['availableDays', 'Jours disponibles', profile.availableDays.length ? profile.availableDays.map((d) => DAY_LABELS[d - 1]).join(' ') : 'Non précisés'],
                  ['weekdayMinutes', 'Temps pour une séance en semaine', profile.weekdayMinutes ? WEEKDAY_MINUTES_LABELS[profile.weekdayMinutes] : null],
                  ['preferredTime', 'Moment préféré', profile.preferredTime ? PREFERRED_TIME_LABELS[profile.preferredTime] : null],
                  ['longDay', 'Jour de la séance longue', profile.longDay ? DAY_LABELS[profile.longDay - 1] ?? null : null],
                  ['equipment', 'Matériel', profile.equipment.length ? profile.equipment.map((e) => EQUIPMENT_LABELS[e]).join(', ') : null],
                  ['practicalConstraints', 'Contraintes', profile.practicalConstraints],
                ] as const).filter(([, , v]) => v !== null).map(([f, label, v]) => (
                  <div key={f}><dt>{label}</dt><dd>{v}{profile.sources[f] === 'interview' ? <> <Pill tone="neutral">Entretien</Pill></> : null}</dd></div>
                ))}
              </dl>
              <div><h3>Objectif {profile.sources.mainGoal === 'interview' ? <Pill tone="neutral">Entretien</Pill> : 'déclaré'}</h3><p className="prose">{profile.mainGoal ?? 'Non précisé.'}</p></div>
              {profile.nextEventName || profile.nextEventDate ? (
                <p><strong>Prochaine course :</strong> {profile.nextEventName ?? 'Sans nom'}{profile.nextEventDate ? `, ${formatLongDate(profile.nextEventDate).toLowerCase()}` : ''}</p>
              ) : null}
              {profile.status === 'confirmed' ? (
                <p className="muted">Confirmé{profile.confirmedAt ? ` le ${fmt(profile.confirmedAt, tz)}` : ''}. Si {first} le modifie, il repassera « à confirmer ».</p>
              ) : (
                <div className="actions">
                  <ActionButton method="POST" url={`/api/v1/workspaces/${wid}/athletes/${aid}/athlete-profile/confirm`} body={{ expectedRevision: profile.revision }} className="btn small primary">✓ Confirmer le bilan</ActionButton>
                  <span className="muted">Envoyé par {first} le {fmt(profile.updatedAt, tz)}.</span>
                </div>
              )}
              {bilanVersions.length > 1 ? (
                <details className="bilan-history">
                  <summary>Historique · {bilanVersions.length} versions</summary>
                  <ol className="plain">
                    {bilanVersions.map((v) => (
                      <li key={v.revision}>
                        <strong>{fmt(v.savedAt, tz)}</strong> · {v.source === 'interview' ? 'entretien' : `envoyé par ${first}`}
                        {' · '}{v.changed.length ? `modifié : ${v.changed.map((f) => BILAN_FIELD_LABELS[f].toLowerCase()).join(', ')}` : 'première version'}
                      </li>
                    ))}
                  </ol>
                </details>
              ) : null}
              <p className="muted">« Entretien » : réponse recueillie par toi ; les autres sont déclarées par {first}. Ce bilan ne contient aucune donnée de santé.</p>
            </div>
          ) : bilanDraft ? (
            <p className="empty">{first} a commencé son bilan : {bilanDraftDone!.answered} réponse{bilanDraftDone!.answered > 1 ? 's' : ''} obligatoire{bilanDraftDone!.answered > 1 ? 's' : ''} sur {bilanDraftDone!.total}, dernière réponse le {fmt(bilanDraft.updatedAt, tz)}. Tu peux le terminer avec {first} pendant un appel.</p>
          ) : <p className="empty">{first} n’a pas encore commencé son bilan. Tu peux le remplir avec {first} pendant l’appel de bienvenue.</p>}
        </section>
      ) : null}

      <section className="card" aria-labelledby="notes-title" id="notes">
        <div className="card-head"><h2 id="notes-title">Notes privées</h2><Pill tone="neutral">Visibles par toi seul·e</Pill></div>
        <div className="card-body stack">
          {file.notes.length ? (
            <ul className="plain stack">
              {file.notes.map((n) => (
                <li key={n.id} className="note">
                  <p className="prose">{n.body}</p>
                  <p className="muted">{fmt(n.createdAt, tz)} · <ActionButton method="DELETE" url={`/api/v1/workspaces/${wid}/athletes/${aid}/notes/${n.id}`} className="link-btn" confirm="Effacer cette note ? Elle ne pourra pas être récupérée.">Effacer</ActionButton></p>
                </li>
              ))}
            </ul>
          ) : null}
          <NoteForm wid={wid} aid={aid} />
        </div>
      </section>

      {a.state === 'invited' ? (
        <section className="card" aria-labelledby="inv-title">
          <div className="card-head"><h2 id="inv-title">Invitation</h2></div>
          <div className="card-body stack">
            {!inv ? <p>Aucune invitation envoyée pour l’instant.</p> : null}
            {inv?.state === 'pending' ? <p>Envoyée le {fmt(inv.createdAt, tz)}, valable jusqu’au {fmt(inv.expiresAt, tz)}. {first} doit se connecter avec l’adresse qui l’a reçue.</p> : null}
            {inv?.state === 'expired' ? <p className="banner warn">Le dernier lien a expiré le {fmt(inv.expiresAt, tz)}. Envoie-en un nouveau.</p> : null}
            {inv?.state === 'revoked' ? <p>Le dernier lien a été annulé.</p> : null}
            <p className="muted">Tu peux préparer et publier des séances dès maintenant : {first} les verra en rejoignant l’espace.</p>
            <h3>{inv ? 'Envoyer un nouveau lien' : 'Envoyer l’invitation'}</h3>
            <ResendInvitation wid={wid} aid={aid} label={inv ? 'Renvoyer l’invitation' : 'Envoyer l’invitation'} />
            {inv?.state === 'pending' && ctx.role === 'owner' ? <RevokeInvitation wid={wid} aid={aid} iid={inv.id} /> : null}
          </div>
        </section>
      ) : null}
    </>
  );
}
