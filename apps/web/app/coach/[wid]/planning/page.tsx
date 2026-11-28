import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import {
  addDays, BUCKET_LABELS, BUCKETS, bucketOf, dayLoad, formatEstimate, formatLongDate, formatShortDate, formatWeekday, isLocalDate,
  PRIORITY_LABELS, TASK_KIND_LABELS, TASK_KINDS, TASK_RECURRENCE_LABELS, todayIn, weekStart, workDate, type Priority, type TaskKind,
} from '@coachos/domain';
import { requireActor } from '@/server/auth/session';
import { coachContext } from '@/server/repo/context';
import { home, type HomeTask } from '@/server/repo/portfolio';
import { relances } from '@/server/repo/relances';
import { firstSteps, openReviewCount } from '@/server/repo/coach';
import { coachInbox } from '@/server/repo/messages';
import { isSimpleMode } from '@/server/simple-mode';
import { FirstSteps } from '@/views/coach/home/first-steps';
import { Button, Card, Cluster, Disclosure, EmptyState, Eyebrow, Heading, LinkButton, Select, Stack, Text } from '@/design';
import { Agenda } from '@/views/coach/home/agenda';
import { HomeActions } from '@/views/coach/home/home-actions';
import { Relances } from '@/views/coach/home/relances';
import { TaskItem } from '@/views/coach/home/task-item';
import { taskView } from '@/views/coach/home/task-view';
import s from '@/views/coach/home/home.module.css';
import { aiEnabled } from '@/server/ai/settings';
import { AskPanel } from '@/views/coach/home/ask-panel';

export const metadata = { title: 'Accueil' };

type Search = { week?: string; athlete?: string; team?: string; kind?: string; priority?: string };


/** « une tâche », « un rendez-vous », « 3 élèves » : le nombre en lettres pour un, accordé au genre. */
const n = (k: number, one: string, many: string, fem = false) => `${k === 1 ? (fem ? 'une' : 'un') : k} ${k > 1 ? many : one}`;
/** D-202 : en tête de phrase, la majuscule (« Un élève n’a pas… »). */
const N = (k: number, one: string, many: string) => { const t = n(k, one, many); return t[0]!.toUpperCase() + t.slice(1); };
const list = (parts: ReactNode[]) => parts.flatMap((p, i) => (i === 0 ? [p] : [i === parts.length - 1 ? ' et ' : ', ', p]));

/**
 * Accueil du coach (CE-H-01, CE-H-05), refonte Chrono (D-144) : le brief du jour en une phrase, puis qui a besoin de moi
 * (relances, à faire avec leur raison et leur échéance) et ma semaine. Toutes les fonctions du Planning sont gardées.
 */
export default async function CoachHome({ params, searchParams }: { params: Promise<{ wid: string }>; searchParams: Promise<Search> }) {
  const { wid } = await params;
  const sp = await searchParams;
  const actor = await requireActor();
  const ctx = await coachContext(actor.userId, wid);
  if (!ctx) notFound();
  const tz = ctx.workspace.timeZone;
  const monday = weekStart(sp.week && isLocalDate(sp.week) ? sp.week : todayIn(tz));
  const [data, rl, pendingReviews, inbox, steps, simple] = await Promise.all([
    home(actor.userId, wid, tz, monday), relances(actor.userId, wid), openReviewCount(actor.userId, wid), coachInbox(actor.userId, wid),
    firstSteps(actor.userId, wid), isSimpleMode(),
  ]);
  const unread = inbox.reduce((k, e) => k + e.unread, 0);
  const today = data.today;
  const base = `/coach/${wid}`;
  const keep = (extra: Record<string, string>) => {
    const q = new URLSearchParams(Object.entries({ ...sp, ...extra }).filter(([, v]) => v) as [string, string][]);
    return `${base}/planning${q.size ? `?${q}` : ''}`;
  };

  // Filtres (élève, groupe, type, priorité), conservés dans l’adresse.
  const inTeam = (t: HomeTask) => !sp.team || t.team?.id === sp.team || (t.athlete && data.roster.find((a) => a.id === t.athlete!.id)?.teams.some((m) => m.id === sp.team));
  const tasks = data.tasks.filter((t) =>
    (!sp.athlete || t.athlete?.id === sp.athlete) && inTeam(t) && (!sp.kind || t.kind === sp.kind) && (!sp.priority || t.priority >= Number(sp.priority)),
  );
  const filtered = Boolean(sp.athlete || sp.team || sp.kind || sp.priority);
  // D-169 : après un ajout groupé, une seule ligne pour les invitations en attente plutôt qu’une par élève.
  const isInvite = (t: HomeTask) => t.source === 'auto' && t.rule === 'invite_pending';
  const invites = tasks.filter(isInvite);
  const listed = invites.length >= 3 ? tasks.filter((t) => !isInvite(t)) : tasks;

  // Le brief (D-144, D-169) : ce qui m’attend aujourd’hui, par urgence et avec son lien — retours, messages, tâches,
  // rendez-vous, relances —, puis les élèves sans séance et ceux qui n’ont pas encore rejoint.
  const overdue = data.tasks.filter((t) => bucketOf(t.dueOn, today) === 'overdue').length;
  const dueToday = data.tasks.filter((t) => bucketOf(workDate(t, today), today) === 'today').length;
  const appts = (data.week.find((d) => d.date === today)?.appointments ?? []).filter((a) => a.status !== 'done');
  const toRelance = rl.filter((x) => x.relance && x.relance !== 'bravo' && !x.waitingSince).length;
  const toPlan = data.roster.filter((a) => a.state === 'active' && !a.upcoming7).length;
  const load = dayLoad(data.tasks, today);
  const apptMin = appts.reduce((m, a) => m + a.durationMin, 0);
  const invited = data.roster.filter((a) => a.state === 'invited').length;
  const parts: ReactNode[] = [];
  if (pendingReviews) parts.push(<Link key="r" href={`${base}/review`}>{n(pendingReviews, 'retour', 'retours')} à traiter</Link>);
  if (unread) parts.push(<Link key="m" href={`${base}/messages`}>{n(unread, 'message non lu', 'messages non lus')}</Link>);
  if (dueToday + overdue) parts.push(`${n(dueToday + overdue, 'tâche', 'tâches', true)}${overdue ? ` (dont ${overdue} en retard)` : ''}`);
  if (appts.length) parts.push(`${n(appts.length, 'rendez-vous', 'rendez-vous')} (${appts.map((a) => a.localTime).join(', ')})`);
  if (toRelance) parts.push(`${n(toRelance, 'élève', 'élèves')} à relancer`);
  const brief = data.roster.length
    ? (
      <>
        {parts.length ? <>Aujourd’hui, tu as {list(parts)}.</> : 'Rien d’urgent aujourd’hui : tout le monde est en rythme.'}
        {toPlan ? <> <Link href={`${base}/to-plan`}>{N(toPlan, 'élève n’a', 'élèves n’ont')} pas de séance publiée</Link> sur les 7 prochains jours.</> : null}
        {invited ? <> <Link href={`${base}/athletes?status=invited`}>{N(invited, 'élève n’a', 'élèves n’ont')} pas encore rejoint ton espace</Link>.</> : null}
        {!simple && load.minutes + apptMin ? <> Environ {formatEstimate(load.minutes + apptMin)} de travail prévu.</> : null}
      </>
    )
    : 'Ajoute tes élèves : chaque jour, cet écran te dira ensuite qui a besoin de toi.';
  const owner = ctx.role === 'owner';
  const stepsState = { athletes: data.roster.length, teams: data.teams.length, published: steps.published, joined: data.roster.some((a) => a.state === 'active'), reviewed: steps.reviewed };
  const showSteps = owner && !(stepsState.athletes && stepsState.published && stepsState.joined && stepsState.reviewed);

  const athletes = data.roster.map((a) => ({ id: a.id, name: a.name, timeZone: a.timeZone }));
  const first = actor.displayName.split(' ')[0] ?? actor.displayName;

  return (
    <Stack gap={8}>
      <Stack gap={5}>
        <Stack gap={2}>
          <Eyebrow tone="coach">{formatLongDate(today)}</Eyebrow>
          <Heading level={1} size={1}>Bonjour {first}</Heading>
          <Text className={s.brief}>{brief}</Text>
        </Stack>
        {simple ? null : <HomeActions wid={wid} athletes={athletes} teams={data.teams} today={today} timeZone={tz} />}
        {data.roster.length && await aiEnabled(actor.userId, wid) ? <AskPanel wid={wid} compact /> : null}
      </Stack>

      {showSteps ? <FirstSteps base={base} state={stepsState} /> : !data.roster.length ? (
        <EmptyState icon="users" title="Pas encore d’élève">Le propriétaire de l’espace ajoute les élèves ; ton Accueil te dira ensuite quoi faire chaque jour.</EmptyState>
      ) : null}

      <div className={s.columns}>
        <Stack gap={6}>
          {data.roster.length ? (
            <Relances wid={wid} items={rl.map((x) => ({ athleteId: x.athleteId, name: x.name, first: x.first, status: x.status, reason: x.reason, relance: x.relance, draft: x.draft, waitingSince: x.waitingSince, workoutId: x.workout?.id ?? null }))} />
          ) : null}

          {data.roster.length || data.tasks.length ? (
          <Card as="section" pad={5} aria-labelledby="todo-title" data-tour="planning-todo">
            <Stack gap={5}>
              <Cluster between gap={2}>
                <Heading level={2} size={4} id="todo-title">À faire</Heading>
                <Text size="sm" muted>{tasks.length} au total · <Link href={`${base}/settings?onglet=suivis`}>Régler les suivis</Link></Text>
              </Cluster>
              {simple && !filtered ? null : <Disclosure summary={filtered ? 'Filtres actifs' : 'Filtrer par élève, groupe, type ou priorité'} open={filtered}>
              <form method="get" action={`${base}/planning`}>
                {sp.week ? <input type="hidden" name="week" value={sp.week} /> : null}
                <div className={s.filters}>
                  <Select name="athlete" aria-label="Élève" defaultValue={sp.athlete ?? ''}>
                    <option value="">Tous les élèves</option>{data.roster.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </Select>
                  {data.teams.length ? (
                    <Select name="team" aria-label="Groupe" defaultValue={sp.team ?? ''}>
                      <option value="">Tous les groupes</option>{data.teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </Select>
                  ) : null}
                  <Select name="kind" aria-label="Type" defaultValue={sp.kind ?? ''}>
                    <option value="">Tous les types</option>{TASK_KINDS.map((k) => <option key={k} value={k}>{TASK_KIND_LABELS[k]}</option>)}
                  </Select>
                  <Select name="priority" aria-label="Priorité minimale" defaultValue={sp.priority ?? ''}>
                    <option value="">Toutes priorités</option><option value="2">Haute et urgente</option><option value="3">Urgente</option>
                  </Select>
                  <Cluster gap={2}>
                    <Button type="submit" size="sm">Filtrer</Button>
                    {filtered ? <LinkButton href={keep({ athlete: '', team: '', kind: '', priority: '' })} size="sm" variant="ghost">Effacer</LinkButton> : null}
                  </Cluster>
                </div>
              </form>
              </Disclosure>}

              {listed !== tasks ? (
                <Stack as="section" gap={2} aria-labelledby="bucket-invites">
                  <Eyebrow as="h3" id="bucket-invites">Invitations · {invites.length}</Eyebrow>
                  <Cluster between gap={3}>
                    <Text size="sm">{invites.length} élèves n’ont pas encore rejoint ton espace : envoie-leur leur lien, ou renvoie-le s’il a expiré.</Text>
                    <LinkButton href={`${base}/athletes?status=invited`} size="sm" icon="send">Élèves à inviter</LinkButton>
                  </Cluster>
                </Stack>
              ) : null}
              {listed.length ? BUCKETS.map((b) => {
                // D-065 : une tâche planifiée avant son échéance se range au jour de son créneau.
                const inBucket = listed.filter((t) => bucketOf(workDate(t, today), today) === b);
                if (!inBucket.length) return null;
                return (
                  <Stack as="section" key={b} gap={2} aria-labelledby={`bucket-${b}`}>
                    <Eyebrow as="h3" id={`bucket-${b}`} tone={b === 'overdue' ? 'signal' : undefined}>{BUCKET_LABELS[b]} · {inBucket.length}</Eyebrow>
                    <ul className={s.tasks}>
                      {inBucket.map((t) => <TaskItem key={t.key} wid={wid} task={taskView(t, today, { athleteHref: t.athlete ? `${base}/athletes/${t.athlete.id}?from=${encodeURIComponent(keep({}))}` : null })} today={today} timeZone={tz} />)}
                    </ul>
                  </Stack>
                );
              }) : listed !== tasks ? null : (
                <EmptyState icon="check" title={filtered ? 'Aucune tâche pour ces filtres' : 'Rien à faire pour l’instant'}>
                  {filtered ? 'Change ou efface les filtres.' : 'Tes élèves sont à jour.'}
                </EmptyState>
              )}
              <Text size="sm" muted>Ordre : échéance (en retard d’abord), puis priorité, puis date. Les suivis automatiques se ferment seuls quand la situation est réglée (retour traité, séance publiée, profil rempli…).</Text>
            </Stack>
          </Card>
          ) : null}
        </Stack>

        <Agenda base={base} week={data.week} monday={monday} today={today} timeZone={tz} href={(w) => keep({ week: w })} />
      </div>
      {simple ? (
        <Text size="sm" muted>Mode simple : tâches manuelles, rendez-vous, filtres, méthode et notifications sont masqués. <Link href={`${base}/settings?onglet=apparence`}>Tout afficher</Link></Text>
      ) : null}
    </Stack>
  );
}
