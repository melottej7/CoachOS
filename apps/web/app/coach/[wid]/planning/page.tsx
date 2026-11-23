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
import { Button, Card, Cluster, Disclosure, EmptyState, Eyebrow, Heading, LinkButton, Select, Stack, Text } from '@/design';
import { Agenda } from '@/views/coach/home/agenda';
import { HomeActions } from '@/views/coach/home/home-actions';
import { Relances } from '@/views/coach/home/relances';
import { TaskItem, type TaskView } from '@/views/coach/home/task-item';
import s from '@/views/coach/home/home.module.css';

export const metadata = { title: 'Accueil' };

type Search = { week?: string; athlete?: string; team?: string; kind?: string; priority?: string };

function dueText(t: HomeTask, today: string): string {
  if (!t.dueOn) return 'Sans échéance';
  if (t.dueOn === today) return 'Aujourd’hui';
  if (t.dueOn < today) {
    const days = Math.round((Date.parse(today) - Date.parse(t.dueOn)) / 86_400_000);
    return `En retard de ${days} jour${days > 1 ? 's' : ''}`;
  }
  if (t.dueOn === addDays(today, 1)) return 'Demain';
  return `${formatWeekday(t.dueOn)} ${formatShortDate(t.dueOn)}`;
}

/** « une tâche », « un rendez-vous », « 3 élèves » : le nombre en lettres pour un, accordé au genre. */
const n = (k: number, one: string, many: string, fem = false) => `${k === 1 ? (fem ? 'une' : 'un') : k} ${k > 1 ? many : one}`;
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
  const [data, rl] = await Promise.all([home(actor.userId, wid, tz, monday), relances(actor.userId, wid)]);
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

  // Le brief : ce qui m’attend aujourd’hui, en une phrase (sur toutes les tâches, pas seulement celles filtrées).
  const overdue = data.tasks.filter((t) => bucketOf(t.dueOn, today) === 'overdue').length;
  const dueToday = data.tasks.filter((t) => bucketOf(workDate(t, today), today) === 'today').length;
  const appts = (data.week.find((d) => d.date === today)?.appointments ?? []).filter((a) => a.status !== 'done');
  const toRelance = rl.filter((x) => x.relance && x.relance !== 'bravo' && !x.waitingSince).length;
  const toPlan = data.roster.filter((a) => a.state === 'active' && !a.upcoming7).length;
  const load = dayLoad(data.tasks, today);
  const apptMin = appts.reduce((m, a) => m + a.durationMin, 0);
  const parts: ReactNode[] = [];
  if (dueToday + overdue) parts.push(`${n(dueToday + overdue, 'tâche', 'tâches', true)}${overdue ? ` (dont ${overdue} en retard)` : ''}`);
  if (appts.length) parts.push(`${n(appts.length, 'rendez-vous', 'rendez-vous')} (${appts.map((a) => a.localTime).join(', ')})`);
  if (toRelance) parts.push(`${n(toRelance, 'élève', 'élèves')} à relancer`);
  const brief = data.roster.length
    ? (
      <>
        {parts.length ? <>Aujourd’hui, tu as {list(parts)}.</> : 'Rien d’urgent aujourd’hui : tes élèves sont à jour.'}
        {toPlan ? <> <Link href={`${base}/to-plan`}>{n(toPlan, 'élève n’a', 'élèves n’ont')} pas de séance publiée</Link> sur les 7 prochains jours.</> : null}
        {load.minutes + apptMin ? <> Environ {formatEstimate(load.minutes + apptMin)} de travail prévu.</> : null}
      </>
    )
    : 'Ajoute ton premier élève : chaque jour, cet écran te dira ensuite quoi faire.';

  const athletes = data.roster.map((a) => ({ id: a.id, name: a.name, timeZone: a.timeZone }));
  const slotText = (t: HomeTask) => t.slotOn
    ? `Créneau ${t.slotOn === today ? 'aujourd’hui' : t.slotOn === addDays(today, 1) ? 'demain' : `${formatWeekday(t.slotOn).toLowerCase()} ${formatShortDate(t.slotOn)}`}${t.slotTime ? ` à ${t.slotTime}` : ''}`
    : null;
  const view = (t: HomeTask): TaskView => ({
    key: t.key, source: t.source, id: t.id, rule: t.rule, ref: t.ref, revision: t.revision, link: t.link, athlete: t.athlete,
    athleteHref: t.athlete ? `${base}/athletes/${t.athlete.id}?from=${encodeURIComponent(keep({}))}` : null, team: t.team?.name ?? null,
    title: t.title, reason: t.reason, priority: t.priority, priorityLabel: `Priorité ${PRIORITY_LABELS[t.priority as Priority].toLowerCase()}`,
    recurrence: t.recurrence ? TASK_RECURRENCE_LABELS[t.recurrence] : null, notes: t.notes,
    meta: [
      t.slotOn ? `Échéance : ${dueText(t, today).toLowerCase()}` : dueText(t, today),
      slotText(t), t.estimateMin ? `≈ ${formatEstimate(t.estimateMin)}` : null, TASK_KIND_LABELS[t.kind as TaskKind],
    ].filter((x): x is string => Boolean(x)),
    slot: { slotOn: t.slotOn ?? null, slotTime: t.slotTime ?? null, estimateMin: t.estimateMin ?? null },
  });
  const first = actor.displayName.split(' ')[0] ?? actor.displayName;

  return (
    <Stack gap={8}>
      <Stack gap={5}>
        <Stack gap={2}>
          <Eyebrow tone="coach">{formatLongDate(today)}</Eyebrow>
          <Heading level={1} size={1}>Bonjour {first}</Heading>
          <Text className={s.brief}>{brief}</Text>
        </Stack>
        <HomeActions wid={wid} athletes={athletes} teams={data.teams} today={today} timeZone={tz} />
      </Stack>

      {!data.roster.length ? (
        <EmptyState icon="users" title="Commence par ton premier élève"
          action={ctx.role === 'owner' ? <LinkButton href={`${base}/athletes/new`} variant="primary" icon="plus" data-tour="add-athlete">Ajouter un élève</LinkButton> : null}>
          Ajoute-le et envoie-lui son invitation : ton Accueil te dira ensuite quoi faire chaque jour.
        </EmptyState>
      ) : null}

      <div className={s.columns}>
        <Stack gap={6}>
          {data.roster.length ? (
            <Relances wid={wid} items={rl.map((x) => ({ athleteId: x.athleteId, name: x.name, first: x.first, status: x.status, reason: x.reason, relance: x.relance, draft: x.draft, waitingSince: x.waitingSince, workoutId: x.workout?.id ?? null }))} />
          ) : null}

          <Card as="section" pad={5} aria-labelledby="todo-title" data-tour="planning-todo">
            <Stack gap={5}>
              <Cluster between gap={2}>
                <Heading level={2} size={4} id="todo-title">À faire</Heading>
                <Text size="sm" muted>{tasks.length} au total · <Link href={`${base}/settings#suivis`}>Régler les suivis</Link></Text>
              </Cluster>
              <Disclosure summary={filtered ? 'Filtres actifs' : 'Filtrer par élève, groupe, type ou priorité'} open={filtered}>
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
              </Disclosure>

              {tasks.length ? BUCKETS.map((b) => {
                // D-065 : une tâche planifiée avant son échéance se range au jour de son créneau.
                const inBucket = tasks.filter((t) => bucketOf(workDate(t, today), today) === b);
                if (!inBucket.length) return null;
                return (
                  <Stack as="section" key={b} gap={2} aria-labelledby={`bucket-${b}`}>
                    <Eyebrow as="h3" id={`bucket-${b}`} tone={b === 'overdue' ? 'signal' : undefined}>{BUCKET_LABELS[b]} · {inBucket.length}</Eyebrow>
                    <ul className={s.tasks}>
                      {inBucket.map((t) => <TaskItem key={t.key} wid={wid} task={view(t)} today={today} timeZone={tz} />)}
                    </ul>
                  </Stack>
                );
              }) : (
                <EmptyState icon="check" title={filtered ? 'Aucune tâche pour ces filtres' : 'Rien à faire pour l’instant'}>
                  {filtered ? 'Change ou efface les filtres.' : 'Tes élèves sont à jour.'}
                </EmptyState>
              )}
              <Text size="sm" muted>Ordre : échéance (en retard d’abord), puis priorité, puis date. Les suivis automatiques se ferment seuls quand la situation est réglée (retour traité, séance publiée, profil rempli…).</Text>
            </Stack>
          </Card>
        </Stack>

        <Agenda base={base} week={data.week} monday={monday} today={today} timeZone={tz} href={(w) => keep({ week: w })} />
      </div>
    </Stack>
  );
}
