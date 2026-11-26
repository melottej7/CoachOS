import Link from 'next/link';
import { SectionTabFromHash } from '@/views/coach/athlete-file-hash';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { requireActor } from '@/server/auth/session';
import { athleteFileTab,
  APPOINTMENT_KIND_LABELS, APPOINTMENT_STATUS_LABELS, DAY_LABELS, EXPERIENCE_LABELS, formatLongDate, formatShortDate, formatWeekday, GOAL_STATE_LABELS,
  addDays, LEVEL_LABELS, RESULT_STATE_LABELS, SPORT_LABELS, todayIn, weekStart, urgencyLabel, utcToLocal, WEEKLY_HOURS_LABELS, WEEKLY_SESSIONS_LABELS,
  EQUIPMENT_LABELS, PREFERRED_TIME_LABELS, WEEKDAY_MINUTES_LABELS, STRENGTH_FOCUS_LABELS, TRAINING_PLACE_LABELS,
  measureFreshness, assessGoal, BILAN_FIELD_LABELS, BILAN_STATUS_LABELS, chronoFromTitle, BREAK_LENGTH_LABELS, DEFAULT_GOAL_KM, distanceFromTitle, FEASIBILITY_LABELS, bilanCompletion, deriveBilan, LONGEST_RECENT_LABELS, PRACTICE_STATUS_LABELS, RESUMED_SINCE_LABELS,
  type ResultState, type Sport, loadProgress,
} from '@coachos/domain';
import { readAthleteProfile, readBilanDraft, readBilanVersions } from '@/server/commands/athlete-profile';
import { goalsAwaitingProgram } from '@/server/commands/programs';
import { readAthleteReferences } from '@/server/commands/athlete-references';
import { latestInvitation } from '@/server/commands/invitations';
import { pendingErasure } from '@/server/commands/privacy';
import { coachContext } from '@/server/repo/context';
import { athleteFile } from '@/server/repo/portfolio';
import { athleteStats, strengthHistory } from '@/server/repo/stats';
import { athleteMeasureFacts, athleteWeekReview } from '@/server/repo/week-review';
import { readPerformances } from '@/server/commands/performances';
import { readGoalDecisions } from '@/server/commands/goal-decisions';
import {
  Avatar, Badge, Banner, Card, Cluster, Disclosure, EmptyState, Eyebrow, Facts, Heading, LinkButton, SectionTabs, Stack, Text, type Tone,
} from '@/design';
import { ActionButton } from '@/views/coach/action-button';
import { HomeActions } from '@/views/coach/home/home-actions';
import { TaskItem } from '@/views/coach/home/task-item';
import { taskView } from '@/views/coach/home/task-view';
import { ResendInvitation, RevokeInvitation } from '@/views/coach/roster/invitation';
import { ArchiveAthlete } from '@/views/coach/athlete/archive-athlete';
import { AppointmentReport, EraseAthlete, GoalForm, LevelConfirm, NoteForm, TeamMembership, WeekReviewCard } from '@/views/coach/athlete/fiche-panels';
import { FeasibilityPanel, FEASIBILITY_TONE } from '@/views/coach/athlete/feasibility-panel';
import { HistoryTable } from '@/views/coach/athlete/history-table';
import { PerformancesPanel } from '@/views/coach/athlete/performances-panel';
import { ReferencesForm } from '@/views/coach/athlete/references-form';
import { LoadProgress } from '@/views/stats/load-progress';
import { StatsPanel } from '@/views/stats/stats-panel';
import s from '@/views/coach/athlete/fiche.module.css';

export const metadata = { title: 'Fiche élève' };

const NOTICES: Record<string, { title: string; text?: string }> = {
  created: { title: 'Fiche créée', text: 'Crée son lien d’invitation quand tu as son adresse.' },
  invited: { title: 'Invitation envoyée', text: 'Le lien précédent, s’il existait, ne fonctionne plus.' },
  revoked: { title: 'Invitation annulée', text: 'Le lien ne permet plus de rejoindre l’espace.' },
  bilan: { title: 'Bilan de l’entretien enregistré et confirmé' },
};
const TABS = [
  { k: 'apercu', label: 'Vue d’ensemble' },
  { k: 'progression', label: 'Progression' },
  { k: 'bilan', label: 'Bilan' },
  { k: 'notes', label: 'Notes' },
  { k: 'donnees', label: 'Données' },
] as const;
type Tab = (typeof TABS)[number]['k'];
const URGENCY_TONE: Record<string, Tone> = { Urgent: 'danger', 'À suivre': 'warning', 'À jour': 'neutral' };

const fmt = (iso: string, tz: string) => new Intl.DateTimeFormat('fr-BE', { dateStyle: 'long', timeZone: tz }).format(new Date(iso));
/** Retour vers la liste avec groupe, filtres et regroupement conservés (CE-G-04). */
const safeFrom = (from: string | undefined, wid: string) => (from && from.startsWith(`/coach/${wid}/`) && !from.includes('//') ? from : `/coach/${wid}/athletes`);

function Section({ id, title, aside, children }: { id: string; title: ReactNode; aside?: ReactNode; children: ReactNode }) {
  return (
    <Card as="section" pad={5} aria-labelledby={`${id}-title`} id={id}>
      <Stack gap={4}>
        <Cluster between gap={2}><Heading level={2} size={4} id={`${id}-title`}>{title}</Heading>{aside}</Cluster>
        {children}
      </Stack>
    </Card>
  );
}

/**
 * CE-G-06, refonte Chrono (D-151) : fiche élève centrale, en onglets (docs/18_REFONTE.md §2.2) — vue d’ensemble, progression,
 * bilan, notes, données. Toutes les fonctions de l’ancienne fiche sont gardées ; les lectures indépendantes partent ensemble.
 */
export default async function AthletePage({ params, searchParams }: { params: Promise<{ wid: string; aid: string }>; searchParams: Promise<{ notice?: string; from?: string; periode?: string; onglet?: string }> }) {
  const { wid, aid } = await params;
  const { notice, from, periode, onglet } = await searchParams;
  const actor = await requireActor();
  const ctx = await coachContext(actor.userId, wid);
  if (!ctx) notFound();
  const tz = ctx.workspace.timeZone;
  const file = await athleteFile(actor.userId, wid, aid, tz);
  const a = file.entry;
  if (!a) notFound();
  const owner = ctx.role === 'owner';
  const tab: Tab = TABS.some((t) => t.k === onglet) && (onglet !== 'donnees' || owner) ? (onglet as Tab) : 'apercu';
  const today = todayIn(tz);
  const goalToday = todayIn(a.timeZone);
  const active = a.state === 'active';
  // D-073 : résumé de la semaine dernière (complète), dans le fuseau de l’élève.
  const pastMonday = addDays(weekStart(goalToday), -7);
  const weeks = [4, 8, 12].includes(Number(periode)) ? Number(periode) : 8;
  const [inv, erasure, profile, bilanDraft, lastReview, measures, history, performances, goalDecisions, refs, awaiting, stats] = await Promise.all([
    a.state === 'invited' ? latestInvitation(actor.userId, wid, aid) : Promise.resolve(null),
    // D-115 : demande d’effacement en cours, visible du propriétaire seulement.
    owner ? pendingErasure(actor.userId, wid, aid) : Promise.resolve(null),
    active ? readAthleteProfile(actor.userId, wid, aid) : Promise.resolve(null),
    active ? readBilanDraft(actor.userId, wid, aid) : Promise.resolve(null),
    active ? athleteWeekReview(actor.userId, wid, aid, pastMonday, goalToday) : Promise.resolve(null),
    // D-075 : d’où viennent les chiffres de la fiche, et depuis quand.
    active ? athleteMeasureFacts(actor.userId, wid, aid, goalToday, a.timeZone) : Promise.resolve(null),
    strengthHistory(actor.userId, wid, aid),
    readPerformances(actor.userId, wid, aid),
    active ? readGoalDecisions(actor.userId, wid, aid) : Promise.resolve([]),
    readAthleteReferences(actor.userId, wid, aid),
    goalsAwaitingProgram(actor.userId, wid, aid),
    // Suivi de l’entraînement (D-037) : semaines du fuseau de l’élève.
    active ? athleteStats(actor.userId, wid, aid, addDays(weekStart(goalToday), -7 * (weeks - 1)), addDays(weekStart(goalToday), 6), goalToday) : Promise.resolve(null),
  ]);
  const shownDraft = profile ? null : bilanDraft;
  const bilanVersions = profile ? await readBilanVersions(actor.userId, wid, aid) : [];
  // Si la semaine dernière est trop mince, la semaine en cours (séances déjà passées) prend le relais.
  const thisReview = lastReview?.status === 'insufficient' ? await athleteWeekReview(actor.userId, wid, aid, weekStart(goalToday), goalToday) : null;
  const current = thisReview?.status === 'ok';
  const review = current ? thisReview : lastReview;
  const lastMonday = current ? weekStart(goalToday) : pastMonday;
  const freshness = measures ? measureFreshness(measures, goalToday) : null;
  // CE-P-07 (D-057) : faisabilité du prochain objectif daté (sinon de la course déclarée dans le bilan).
  const goalCandidate = file.goals.filter((g) => g.state === 'planned' && g.targetDate && g.targetDate > goalToday).sort((x, y) => (x.targetDate! < y.targetDate! ? -1 : 1))[0]
    ?? (profile?.nextEventDate && profile.nextEventDate > goalToday ? { title: profile.nextEventName ?? 'Prochaine course', sport: profile.sport, targetDate: profile.nextEventDate } : null);
  // Passif (D-058) : ce que l’élève a vraiment fait ces 6 dernières semaines, sa régularité réelle et ses objectifs atteints.
  const past = profile && goalCandidate ? await athleteStats(actor.userId, wid, aid, addDays(goalToday, -41), goalToday, goalToday) : null;
  // D-096 (M4) : progression des charges, exercice par exercice.
  const loads = loadProgress(history);
  const done = (past?.history ?? []).filter((r) => !r.canceled && (r.state === 'completed' || r.state === 'partial'));
  const last4 = (past?.history ?? []).filter((r) => !r.canceled && r.localDate > addDays(goalToday, -28));
  const achievedKm = Math.max(
    ...file.goals.filter((g) => g.state === 'achieved' && goalCandidate && g.sport === goalCandidate.sport).map((g) => distanceFromTitle(g.title) ?? 0),
    ...performances.filter((x) => goalCandidate && x.sport === goalCandidate.sport && x.kind === 'race').map((x) => x.distanceM / 1000),
    0,
  ) || null;
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
  const bilanDraftDone = shownDraft ? bilanCompletion(deriveBilan(shownDraft.answers)) : null;
  const first = a.name.split(' ')[0] ?? a.name;
  const base = `/coach/${wid}`;
  const back = safeFrom(from, wid);
  const u = urgencyLabel(a.urgency);
  const sports = [...new Set([...(a.sport ? [a.sport] : []), ...a.levels.map((l) => l.sport)])] as Sport[];
  const keep = (extra: Record<string, string>) => {
    const q = new URLSearchParams(Object.entries({ onglet: tab, from: from ?? '', periode: periode ?? '', ...extra }).filter(([, v]) => v) as [string, string][]);
    return `${base}/athletes/${aid}${q.size ? `?${q}` : ''}`;
  };
  const periodHref = (n: number) => `${keep({ periode: String(n), onglet: 'progression' })}#suivi`;
  // D-183 : un lien de tâche vers ce dossier reste sur la page si sa section est dans l’onglet ouvert (simple ancre),
  // sinon il ouvre l’onglet de la section (« Confirmer le bilan » → onglet Bilan).
  const here = (link: string | null | undefined): string | null => {
    if (!link?.startsWith(`${base}/athletes/${aid}`)) return link ?? null;
    const section = link.includes('#') ? link.split('#')[1]! : '';
    const target = section ? athleteFileTab(section) : 'apercu';
    if (target === tab) return section ? `#${section}` : null;
    return `${keep({ onglet: target === 'apercu' ? '' : target })}${section ? `#${section}` : ''}`;
  };
  const n = notice ? NOTICES[notice] : null;
  const self = { id: a.id, name: a.name, timeZone: a.timeZone };

  return (
    <Stack gap={6}>
      <Cluster><LinkButton href={back} variant="ghost" size="sm" icon="chevronLeft">{back.includes('/planning') ? 'Accueil' : 'Élèves'}</LinkButton></Cluster>
      {n ? <Banner tone="success" title={n.title}>{n.text}</Banner> : null}
      {awaiting.map((g) => (
        <Banner key={g.id} tone="coach" title="Prochaine étape"
          action={<LinkButton href={`${base}/athletes/${aid}/programme?objectif=${g.id}`} size="sm" variant="primary" icon="calendar">Générer le programme</LinkButton>}>
          L’objectif « {g.title} » est validé. Génère le programme qui permet de l’atteindre : tu relis les risques, rien n’est publié.
        </Banner>
      ))}

      <Stack gap={4}>
        <Cluster gap={4} nowrap>
          <Avatar name={a.name} size={64} />
          <Stack gap={1}>
            <Eyebrow tone="coach">Élève · {a.timeZone.replace(/_/g, ' ')}</Eyebrow>
            <Heading level={1} size={1}>{a.name}</Heading>
            <Cluster gap={2}>
              {active ? <Badge tone="success" dot>A rejoint l’espace</Badge> : <Badge>Invité·e, pas encore connecté·e</Badge>}
              <Badge tone={URGENCY_TONE[u] ?? 'neutral'}>{u}</Badge>
            </Cluster>
          </Stack>
        </Cluster>
        <Cluster gap={2}>
          <LinkButton href={`${base}/calendar?athlete=${aid}`} variant="primary" icon="calendar">Préparer ses séances</LinkButton>
          <LinkButton href={`${base}/messages/${aid}`} icon="chat">Écrire à {first}</LinkButton>
        </Cluster>
        <HomeActions wid={wid} athletes={[self]} teams={[]} today={today} timeZone={a.timeZone} athleteId={a.id} labels={{ task: 'Tâche', appointment: 'Planifier un appel' }} />
      </Stack>

      {/* Onglets soulignés : ils défilent sur téléphone au lieu d’élargir la page. */}
      <SectionTabFromHash current={tab} />
      <SectionTabs label={`Fiche de ${first}`} items={TABS.filter((t) => t.k !== 'donnees' || owner).map((t) => ({ href: keep({ onglet: t.k === 'apercu' ? '' : t.k }), label: t.label, current: tab === t.k }))} />

      {tab === 'apercu' ? (
        <Stack gap={6}>
          {a.state === 'invited' ? (
            <Section id="inv" title="Invitation">
              {!inv ? <Text>Aucune invitation pour l’instant.</Text> : null}
              {inv?.state === 'pending' ? <Text>Créée le {fmt(inv.createdAt, tz)}, valable jusqu’au {fmt(inv.expiresAt, tz)}. {first} doit créer son compte avec l’adresse saisie pour l’invitation. Lien perdu ? Crée un nouveau lien ci-dessous : l’ancien cessera de fonctionner.</Text> : null}
              {inv?.state === 'expired' ? <Banner tone="warning" title="Lien expiré">Le dernier lien a expiré le {fmt(inv.expiresAt, tz)}. Crée-en un nouveau.</Banner> : null}
              {inv?.state === 'revoked' ? <Text>Le dernier lien a été annulé.</Text> : null}
              <Text size="sm" muted>Tu peux préparer et publier des séances dès maintenant : {first} les verra en rejoignant l’espace.</Text>
              <ResendInvitation wid={wid} aid={aid} name={first} label={inv ? 'Renvoyer l’invitation' : 'Envoyer l’invitation'} />
              {inv?.state === 'pending' && owner ? <RevokeInvitation wid={wid} aid={aid} iid={inv.id} /> : null}
            </Section>
          ) : null}

          {review ? (
            <Section id="semaine" title={current ? 'Cette semaine (en cours)' : 'Semaine dernière'}
              aside={<Text size="sm" muted>{current ? `Depuis le ${formatShortDate(lastMonday)}, jusqu’à hier` : `Du ${formatShortDate(lastMonday)} au ${formatShortDate(addDays(lastMonday, 6))}`} · d’après ses retours</Text>}>
              <WeekReviewCard review={review} wid={wid} aid={aid} first={first} title={review.status === 'insufficient' ? 'Pas assez de séances publiées pour un résumé.' : 'Prévu, déclaré et manquant :'} />
            </Section>
          ) : null}

          <Section id="todo" title={`À faire pour ${first}`}>
            {a.todo.length ? (
              <Stack as="ul" gap={2}>
                {a.todo.map((t) => (
                  <TaskItem key={t.key} wid={wid} today={today} timeZone={a.timeZone}
                    task={taskView({ ...t, athlete: t.athlete ?? self }, today, { athleteHref: null, link: here(t.link) })} />
                ))}
              </Stack>
            ) : <Text muted>Rien à faire pour {first} pour l’instant.</Text>}
            {file.closedTasks ? <Text size="sm" muted>{file.closedTasks} tâche{file.closedTasks > 1 ? 's' : ''} terminée{file.closedTasks > 1 ? 's' : ''} ou annulée{file.closedTasks > 1 ? 's' : ''}.</Text> : null}
          </Section>

          <div className={s.grid}>
            <Section id="next" title="Prochaines séances" aside={<Link href={`${base}/calendar?athlete=${aid}`}>Calendrier</Link>}>
              {file.upcoming.length ? (
                <ul className={s.list}>
                  {file.upcoming.map((w) => (
                    <li key={w.id}><Link className={s.grow} href={`${base}/athletes/${aid}/workouts/${w.id}`}>{formatWeekday(w.localDate)} {formatShortDate(w.localDate)} · {w.title}</Link>{w.published ? null : <Badge>Brouillon</Badge>}</li>
                  ))}
                </ul>
              ) : <Text muted>Aucune séance sur les 14 prochains jours.</Text>}
            </Section>
            <Section id="fb" title="Derniers retours">
              {file.recentFeedback.length ? (
                <ul className={s.list}>
                  {file.recentFeedback.map((f) => (
                    <li key={f.workoutId}>
                      <Link className={s.grow} href={`${base}/athletes/${aid}/workouts/${f.workoutId}`}>{formatShortDate(f.localDate)} · {f.title} · {RESULT_STATE_LABELS[f.state as ResultState]}</Link>
                      {f.reviewed ? <Badge>Traité</Badge> : <Badge tone="signal" dot>À traiter</Badge>}
                    </li>
                  ))}
                </ul>
              ) : <Text muted>Aucun retour pour l’instant.</Text>}
            </Section>
          </div>

          <Section id="rdv" title="Rendez-vous">
            {file.appointments.length ? (
              <ul className={s.list}>
                {file.appointments.map((p) => {
                  const local = utcToLocal(new Date(p.startsAt), p.timeZone);
                  return (
                    <li key={p.id}>
                      <Stack gap={1} className={s.grow}>
                        <Cluster gap={2}><Text strong>{formatWeekday(local.date)} {formatShortDate(local.date)} à {local.time}</Text><Badge tone={p.status === 'planned' ? 'info' : 'neutral'}>{APPOINTMENT_STATUS_LABELS[p.status]}</Badge></Cluster>
                        <Text size="sm">{p.title} · {APPOINTMENT_KIND_LABELS[p.kind]}, {p.durationMin} min <Text as="span" size="sm" muted>({p.timeZone.replace(/_/g, ' ')})</Text></Text>
                        {p.videoUrl && p.status === 'planned' ? <a href={p.videoUrl} target="_blank" rel="noopener noreferrer">Lien de visio</a> : null}
                        {p.prepNotes ? <Text size="sm" muted>Préparation : {p.prepNotes}</Text> : null}
                        {p.report ? <Text size="sm" prose>Compte rendu : {p.report}</Text> : null}
                      </Stack>
                      {p.status !== 'canceled' ? (
                        <Cluster gap={2}>
                          <AppointmentReport wid={wid} id={p.id} revision={p.revision} report={p.report} />
                          {p.status === 'planned' ? <ActionButton method="PATCH" url={`/api/v1/workspaces/${wid}/appointments/${p.id}`} body={{ expectedRevision: p.revision, status: 'canceled', notify: true }} confirm={`Annuler ce rendez-vous ? ${first} sera prévenu·e dans la conversation.`}>Annuler</ActionButton> : null}
                        </Cluster>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            ) : <Text muted>Aucun rendez-vous. « Planifier un appel », plus haut, pour faire le point avec {first}.</Text>}
          </Section>

          <Section id="groups" title="Groupes"><TeamMembership wid={wid} aid={aid} teams={a.teams} all={file.allTeams} /></Section>

          {/* Bilan produit : retirer l’élève en un geste, réversible (l’effacement définitif reste dans Données). */}
          {owner ? <ArchiveAthlete wid={wid} aid={aid} first={first} /> : null}
        </Stack>
      ) : null}

      {tab === 'progression' ? (
        <Stack gap={6}>
          {stats ? (
            <Section id="suivi" title="Suivi de l’entraînement">
              {freshness ? (
                <Stack gap={1} aria-label="Source et fraîcheur des mesures">
                  {freshness.lines.map((l, i) => <Text key={i} size="sm" tone={i === 2 && freshness.stale ? 'danger' : undefined} muted={!(i === 2 && freshness.stale)}>{l}</Text>)}
                </Stack>
              ) : null}
              <StatsPanel s={stats.summary} delta={stats.delta} weeks={weeks} periodHref={periodHref} you={false} />
              <HistoryTable rows={stats.history} weeks={weeks} href={(sid) => `${base}/athletes/${aid}/workouts/${sid}`} />
            </Section>
          ) : <EmptyState icon="chart" title="Pas encore de suivi">Le suivi apparaîtra quand {first} aura rejoint l’espace et fait ses premières séances.</EmptyState>}

          {loads.length ? (
            <Section id="charges" title="Charges en musculation" aside={<Text size="sm" muted>Meilleure série par exercice, d’après ses retours</Text>}>
              <LoadProgress series={loads} limit={12} />
            </Section>
          ) : null}

          <div className={s.grid}>
            <Section id="levels" title="Niveau par sport">
              {sports.length ? sports.map((x) => (
                <LevelConfirm key={x} wid={wid} aid={aid} sport={x} first={first} declared={a.sport === x ? a.declaredLevel : null} confirmed={a.levels.find((l) => l.sport === x)?.level ?? null} />
              )) : <Text muted>Le niveau s’affichera quand {first} aura rempli son profil sportif.</Text>}
            </Section>
            <Section id="goals" title="Objectifs" aside={<Text size="sm" muted>Visibles par {first}</Text>}>
              {file.goals.length ? (
                <ul className={s.list}>
                  {file.goals.map((g) => (
                    <li key={g.id}>
                      <Stack gap={1} className={s.grow}>
                        <Cluster gap={2}>
                          <Text strong>{g.title}</Text>
                          <Badge tone={g.state === 'planned' ? 'info' : 'neutral'}>{GOAL_STATE_LABELS[g.state]}</Badge>
                          {goalDecisions.some((d) => d.goalId === g.id) ? <Badge tone="success">Validé par toi</Badge> : null}
                        </Cluster>
                        <Text size="sm" muted>{SPORT_LABELS[g.sport]}{g.targetDate ? ` · ${formatLongDate(g.targetDate).toLowerCase()}` : ''}</Text>
                      </Stack>
                      {g.state === 'planned' ? (
                        <Cluster gap={1}>
                          {goalDecisions.some((d) => d.goalId === g.id) ? <LinkButton href={`${base}/athletes/${aid}/programme?objectif=${g.id}`} size="sm" icon="calendar">Programme</LinkButton> : null}
                          <ActionButton method="PATCH" url={`/api/v1/workspaces/${wid}/athletes/${aid}/goals/${g.id}`} body={{ state: 'achieved' }}>Atteint</ActionButton>
                          <ActionButton method="PATCH" url={`/api/v1/workspaces/${wid}/athletes/${aid}/goals/${g.id}`} body={{ state: 'canceled' }} confirm="Marquer cet objectif comme abandonné ?">Abandonné</ActionButton>
                        </Cluster>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : <Text muted>Aucun objectif enregistré.{profile?.mainGoal ? ` ${first} a écrit : « ${profile.mainGoal} »` : ''}</Text>}
              <GoalForm wid={wid} aid={aid} sport={a.sport} />
            </Section>
          </div>

          {feasibility ? (
            <Section id="faisabilite" title={`Faisabilité · ${feasibility.title}`} aside={<Badge tone={FEASIBILITY_TONE[feasibilityStatus!]} dot>{FEASIBILITY_LABELS[feasibilityStatus!]}</Badge>}>
              <Disclosure summary="Voir le détail, les solutions et décider">
                <FeasibilityPanel wid={wid} aid={aid} first={first} goalTitle={feasibility.title} goalId={feasibility.goalId} initial={feasibility.input}
                  decision={goalDecisions.find((d) => d.goalId === feasibility.goalId) ?? null} performances={performances} />
              </Disclosure>
            </Section>
          ) : null}

          <Section id="refs" title="Repères d’entraînement" aside={<Badge>Fixés par toi</Badge>}>
            <ReferencesForm wid={wid} aid={aid} first={first} vmaKmh={refs.vmaKmh} ftpW={refs.ftpW} cssSecPer100={refs.cssSecPer100} />
          </Section>
          <Section id="resultats" title="Résultats de référence" aside={<Badge>Saisis par toi</Badge>}>
            <PerformancesPanel wid={wid} aid={aid} first={first} sport={a.sport} items={performances} today={goalToday} vmaKmh={refs.vmaKmh} />
          </Section>
        </Stack>
      ) : null}

      {tab === 'bilan' ? (
        <Section id="bilan" title="Bilan" aside={(
          <Cluster gap={2}>
            <Badge tone={profile?.status === 'confirmed' ? 'success' : profile ? 'warning' : 'neutral'}>{BILAN_STATUS_LABELS[profile ? profile.status : shownDraft ? 'draft' : 'none']}</Badge>
            {active ? <LinkButton href={`${base}/athletes/${aid}/bilan`} size="sm" icon="edit">{profile ? 'Compléter en entretien' : 'Remplir en entretien'}</LinkButton> : null}
          </Cluster>
        )}>
          {!active ? <Text muted>Le bilan sera disponible quand {first} aura rejoint l’espace.</Text> : profile ? (
            <Stack gap={4}>
              <Facts items={([
                ['sport', profile.otherSports.length ? 'Sport principal' : 'Sport', SPORT_LABELS[profile.sport]],
                ['otherSports', 'Autres sports', profile.otherSports.length ? profile.otherSports.map((x) => SPORT_LABELS[x]).join(', ') : null],
                ['strengthFocus', 'Musculation : à travailler', profile.strengthFocus.length ? profile.strengthFocus.map((x) => STRENGTH_FOCUS_LABELS[x]).join(', ') : null],
                ['trainingPlaces', 'Musculation : où', profile.trainingPlaces.length ? profile.trainingPlaces.map((x) => TRAINING_PLACE_LABELS[x]).join(', ') : null],
                ['practiceStatus', 'Situation', profile.practiceStatus ? PRACTICE_STATUS_LABELS[profile.practiceStatus] : null],
                ['experience', 'Pratique régulière', EXPERIENCE_LABELS[profile.experience]],
                ['breakLength', 'Durée de l’arrêt', profile.breakLength ? BREAK_LENGTH_LABELS[profile.breakLength] : null],
                ['resumedSince', 'Reprise', profile.resumedSince ? RESUMED_SINCE_LABELS[profile.resumedSince] : null],
                ['weeklySessions', 'Séances par semaine (4 dernières sem.)', WEEKLY_SESSIONS_LABELS[profile.weeklySessions]],
                ['longestRecent', 'Plus longue sortie récente', profile.longestRecent ? LONGEST_RECENT_LABELS[profile.longestRecent] : null],
                ['level', 'Niveau', LEVEL_LABELS[profile.level].label],
                ['weeklyHours', 'Volume possible par semaine', profile.weeklyHours ? WEEKLY_HOURS_LABELS[profile.weeklyHours] : 'Non précisé'],
                ['availableDays', 'Jours disponibles', profile.availableDays.length ? profile.availableDays.map((d) => DAY_LABELS[d - 1]).join(' ') : 'Non précisés'],
                ['weekdayMinutes', 'Temps pour une séance en semaine', profile.weekdayMinutes ? WEEKDAY_MINUTES_LABELS[profile.weekdayMinutes] : null],
                ['preferredTime', 'Moment préféré', profile.preferredTime ? PREFERRED_TIME_LABELS[profile.preferredTime] : null],
                ['longDay', 'Jour de la séance longue', profile.longDay ? DAY_LABELS[profile.longDay - 1] ?? null : null],
                ['equipment', 'Matériel', profile.equipment.length ? profile.equipment.map((e) => EQUIPMENT_LABELS[e]).join(', ') : null],
                ['practicalConstraints', 'Contraintes', profile.practicalConstraints],
              ] as const).filter(([, , v]) => v !== null).map(([f, label, v]) => ({
                label, value: <>{v}{profile.sources[f] === 'interview' ? <> <Badge>Entretien</Badge></> : null}</>,
              }))} />
              <Stack gap={1}>
                <Text strong>Objectif {profile.sources.mainGoal === 'interview' ? <Badge>Entretien</Badge> : 'déclaré'}</Text>
                <Text prose>{profile.mainGoal ?? 'Non précisé.'}</Text>
                {profile.nextEventName || profile.nextEventDate ? <Text size="sm">Prochaine course : {profile.nextEventName ?? 'Sans nom'}{profile.nextEventDate ? `, ${formatLongDate(profile.nextEventDate).toLowerCase()}` : ''}</Text> : null}
              </Stack>
              {profile.status === 'confirmed' ? (
                <Text size="sm" muted>Confirmé{profile.confirmedAt ? ` le ${fmt(profile.confirmedAt, tz)}` : ''}. Si {first} le modifie, il repassera « à confirmer ».</Text>
              ) : (
                <Cluster gap={2}>
                  <ActionButton method="POST" url={`/api/v1/workspaces/${wid}/athletes/${aid}/athlete-profile/confirm`} body={{ expectedRevision: profile.revision }} variant="primary" icon="check">Confirmer le bilan</ActionButton>
                  <Text as="span" size="sm" muted>Envoyé par {first} le {fmt(profile.updatedAt, tz)}.</Text>
                </Cluster>
              )}
              {bilanVersions.length > 1 ? (
                <Disclosure summary={`Historique · ${bilanVersions.length} versions`}>
                  <Stack as="ol" gap={1}>
                    {bilanVersions.map((v) => (
                      <li key={v.revision}><Text size="sm"><strong>{fmt(v.savedAt, tz)}</strong> · {v.source === 'interview' ? 'entretien' : `envoyé par ${first}`} · {v.changed.length ? `modifié : ${v.changed.map((f) => BILAN_FIELD_LABELS[f].toLowerCase()).join(', ')}` : 'première version'}</Text></li>
                    ))}
                  </Stack>
                </Disclosure>
              ) : null}
              <Text size="sm" muted>« Entretien » : réponse recueillie par toi ; les autres sont déclarées par {first}. Ce bilan ne contient aucune donnée de santé.</Text>
            </Stack>
          ) : shownDraft ? (
            <Text>{first} a commencé son bilan : {bilanDraftDone!.answered} réponse{bilanDraftDone!.answered > 1 ? 's' : ''} obligatoire{bilanDraftDone!.answered > 1 ? 's' : ''} sur {bilanDraftDone!.total}, dernière réponse le {fmt(shownDraft.updatedAt, tz)}. Tu peux le terminer avec {first} pendant un appel.</Text>
          ) : <Text muted>{first} n’a pas encore commencé son bilan. Tu peux le remplir avec {first} pendant l’appel de bienvenue.</Text>}
        </Section>
      ) : null}

      {tab === 'notes' ? (
        <Section id="notes" title="Notes privées" aside={<Badge>Visibles par toi seul·e</Badge>}>
          {file.notes.length ? (
            <ul className={s.list}>
              {file.notes.map((x) => (
                <li key={x.id}>
                  <Stack gap={1} className={s.grow}><Text prose>{x.body}</Text><Text size="sm" muted>{fmt(x.createdAt, tz)}</Text></Stack>
                  <ActionButton method="DELETE" url={`/api/v1/workspaces/${wid}/athletes/${aid}/notes/${x.id}`} icon="trash" confirm="Effacer cette note ? Elle ne pourra pas être récupérée.">Effacer</ActionButton>
                </li>
              ))}
            </ul>
          ) : null}
          <NoteForm wid={wid} aid={aid} />
        </Section>
      ) : null}

      {tab === 'donnees' && owner ? (
        <Section id="donnees" title={`Données de ${first}`} aside={<Badge>Propriétaire</Badge>}>
          {erasure
            ? <Banner tone="warning" title="Demande d’effacement">{first} a demandé l’effacement de ses données le {fmt(erasure.createdAt, tz)}. À traiter avant le {fmt(erasure.dueAt, tz)}.</Banner>
            : <Text muted>Si {first} arrête d’être suivi·e ou te demande d’effacer ses données, tu peux tout supprimer ici : séances, retours, échanges, bilan. Son compte est supprimé s’il n’est lié à aucun autre espace.</Text>}
          <EraseAthlete wid={wid} aid={aid} name={a.name} requested={Boolean(erasure)} />
        </Section>
      ) : null}
    </Stack>
  );
}
