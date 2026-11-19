import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  addDays, APPOINTMENT_KIND_LABELS, BUCKET_LABELS, BUCKETS, bucketOf, dayOfMonth, formatLongDate, formatShortDate, formatWeekRange, formatWeekday,
  isLocalDate, PRIORITY_LABELS, TASK_KIND_LABELS, TASK_KINDS, todayIn, weekStart, type Priority, type TaskKind,
} from '@coachos/domain';
import { requireActor } from '@/server/auth/session';
import { coachContext } from '@/server/repo/context';
import { home, type HomeTask } from '@/server/repo/portfolio';
import { AppointmentForm, TaskActions, TaskForm } from '@/components/portfolio-forms';
import { Pill } from '@/components/ui';

export const metadata = { title: 'Planning' };

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

/** CE-H-01 et CE-H-05 : ce qui demande mon attention, ma prochaine action et pour quand ; agenda de la semaine. */
export default async function CoachPlanning({ params, searchParams }: { params: Promise<{ wid: string }>; searchParams: Promise<Search> }) {
  const { wid } = await params;
  const sp = await searchParams;
  const actor = await requireActor();
  const ctx = await coachContext(actor.userId, wid);
  if (!ctx) notFound();
  const tz = ctx.workspace.timeZone;
  const monday = weekStart(sp.week && isLocalDate(sp.week) ? sp.week : todayIn(tz));
  const data = await home(actor.userId, wid, tz, monday);
  const today = data.today;
  const base = `/coach/${wid}`;

  // Filtres (élève, groupe, type, priorité), conservés dans l’adresse.
  const inTeam = (t: HomeTask) => !sp.team || t.team?.id === sp.team || (t.athlete && data.roster.find((a) => a.id === t.athlete!.id)?.teams.some((m) => m.id === sp.team));
  const tasks = data.tasks.filter((t) =>
    (!sp.athlete || t.athlete?.id === sp.athlete) && inTeam(t) && (!sp.kind || t.kind === sp.kind) && (!sp.priority || t.priority >= Number(sp.priority)),
  );
  const filtered = Boolean(sp.athlete || sp.team || sp.kind || sp.priority);
  const todayAppts = data.week.find((d) => d.date === today)?.appointments ?? [];
  const athletes = data.roster.map((a) => ({ id: a.id, name: a.name, timeZone: a.timeZone }));
  const keep = (extra: Record<string, string>) => {
    const q = new URLSearchParams(Object.entries({ ...sp, ...extra }).filter(([, v]) => v) as [string, string][]);
    return `${base}/planning${q.size ? `?${q}` : ''}`;
  };

  return (
    <>
      <div className="head">
        <div>
          <div className="kicker">{formatLongDate(today)}</div>
          <h1>Planning</h1>
          <p className="sub">{tasks.filter((t) => bucketOf(t.dueOn, today) === 'overdue').length} en retard · {tasks.filter((t) => bucketOf(t.dueOn, today) === 'today').length} pour aujourd’hui · {todayAppts.length} rendez-vous aujourd’hui</p>
        </div>
        <div className="actions" data-tour="planning-add">
          <TaskForm wid={wid} athletes={athletes} teams={data.teams} today={today} />
          <AppointmentForm wid={wid} athletes={athletes} timeZone={tz} today={today} />
        </div>
      </div>

      {!data.roster.length ? (
        <section className="card empty-start">
          <div className="card-body stack">
            <h2>Commence par ton premier élève</h2>
            <p>Ajoute-le et envoie-lui son invitation : ton Planning te dira ensuite quoi faire chaque jour.</p>
            {ctx.role === 'owner' ? <p><Link className="btn primary" href={`${base}/athletes/new`} data-tour="add-athlete">+ Ajouter un élève</Link></p> : null}
          </div>
        </section>
      ) : null}

      <div className="planning">
        <section className="card" aria-labelledby="todo-title" data-tour="planning-todo">
          <div className="card-head">
            <h2 id="todo-title">À faire</h2>
            <span className="muted">{tasks.length} au total</span>
          </div>
          <form className="filters" method="get" action={`${base}/planning`}>
            {sp.week ? <input type="hidden" name="week" value={sp.week} /> : null}
            <label className="visually-hidden" htmlFor="f-athlete">Élève</label>
            <select id="f-athlete" name="athlete" className="select small" defaultValue={sp.athlete ?? ''}>
              <option value="">Tous les élèves</option>{data.roster.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            {data.teams.length ? (
              <>
                <label className="visually-hidden" htmlFor="f-team">Groupe</label>
                <select id="f-team" name="team" className="select small" defaultValue={sp.team ?? ''}>
                  <option value="">Tous les groupes</option>{data.teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </>
            ) : null}
            <label className="visually-hidden" htmlFor="f-kind">Type</label>
            <select id="f-kind" name="kind" className="select small" defaultValue={sp.kind ?? ''}>
              <option value="">Tous les types</option>{TASK_KINDS.map((k) => <option key={k} value={k}>{TASK_KIND_LABELS[k]}</option>)}
            </select>
            <label className="visually-hidden" htmlFor="f-priority">Priorité minimale</label>
            <select id="f-priority" name="priority" className="select small" defaultValue={sp.priority ?? ''}>
              <option value="">Toutes priorités</option><option value="2">Haute et urgente</option><option value="3">Urgente</option>
            </select>
            <button className="btn small" type="submit">Filtrer</button>
            {filtered ? <Link className="link-btn" href={keep({ athlete: '', team: '', kind: '', priority: '' })}>Effacer</Link> : null}
          </form>

          {tasks.length ? BUCKETS.map((b) => {
            const list = tasks.filter((t) => bucketOf(t.dueOn, today) === b);
            if (!list.length) return null;
            return (
              <div key={b} className={`bucket bucket-${b}`}>
                <h3 className="bucket-title">{BUCKET_LABELS[b]} <span className="muted">· {list.length}</span></h3>
                <ul className="task-list">
                  {list.map((t) => (
                    <li key={t.key} className={`task prio-${t.priority}`}>
                      <div className="task-main">
                        <p className="task-title">{t.title}{t.athlete ? <> · <Link href={`${base}/athletes/${t.athlete.id}?from=${encodeURIComponent(keep({}))}`}>{t.athlete.name}</Link></> : null}{t.team ? ` · ${t.team.name}` : ''}</p>
                        <p className="task-meta">
                          <span className="task-why">{t.reason}</span>
                          {' · '}<span>{dueText(t, today)}</span>
                          {' · '}<span>Priorité {PRIORITY_LABELS[t.priority as Priority].toLowerCase()}</span>
                          {' · '}<span>{TASK_KIND_LABELS[t.kind as TaskKind]}</span>
                          {t.source === 'auto' ? <> {' '}<Pill tone="neutral">Suivi automatique</Pill></> : null}
                        </p>
                        {t.notes ? <p className="task-notes">{t.notes}</p> : null}
                      </div>
                      <TaskActions wid={wid} source={t.source} id={t.id} rule={t.rule} sourceRef={t.ref} revision={t.revision} today={today} link={t.link} athlete={t.athlete} />
                    </li>
                  ))}
                </ul>
              </div>
            );
          }) : <p className="empty">{filtered ? 'Aucune tâche pour ces filtres.' : 'Rien à faire pour l’instant. Tes élèves sont à jour.'}</p>}
          <p className="muted foot-note">Ordre : échéance (en retard d’abord), puis priorité, puis date. Les suivis automatiques se ferment seuls quand la situation est réglée (retour traité, séance publiée, profil rempli…).</p>
        </section>

        <section className="card agenda" aria-labelledby="agenda-title" data-tour="planning-agenda">
          <div className="card-head">
            <h2 id="agenda-title">Semaine du {formatWeekRange(monday)}</h2>
            <span className="actions">
              <Link className="btn small" href={keep({ week: addDays(monday, -7) })} aria-label="Semaine précédente">←</Link>
              <Link className="btn small" href={keep({ week: '' })}>Cette semaine</Link>
              <Link className="btn small" href={keep({ week: addDays(monday, 7) })} aria-label="Semaine suivante">→</Link>
            </span>
          </div>
          <ol className="agenda-days">
            {data.week.map((d) => (
              <li key={d.date} className={`agenda-day${d.date === today ? ' today' : ''}${d.date < today ? ' past' : ''}`}>
                <div className="agenda-date"><strong>{dayOfMonth(d.date)}</strong>{formatWeekday(d.date)}</div>
                <div className="agenda-body">
                  {d.appointments.map((a) => (
                    <p key={a.id} className="agenda-appt">
                      <strong>{a.localTime}</strong> · {a.title} · <Link href={`${base}/athletes/${a.athleteId}#rdv`}>{a.athleteName}</Link>
                      {' · '}{APPOINTMENT_KIND_LABELS[a.kind]}, {a.durationMin} min
                      {a.videoUrl ? <> · <a href={a.videoUrl} target="_blank" rel="noopener noreferrer">Rejoindre</a></> : null}
                      {a.status === 'done' ? ' · fait' : ''}
                    </p>
                  ))}
                  <p className="agenda-counts">
                    {d.tasksDue ? <span>{d.tasksDue} tâche{d.tasksDue > 1 ? 's' : ''} à échéance</span> : null}
                    {d.sessions ? <span>{d.sessions} séance{d.sessions > 1 ? 's' : ''} publiée{d.sessions > 1 ? 's' : ''} pour tes élèves</span> : null}
                    {!d.appointments.length && !d.tasksDue && !d.sessions ? <span className="muted">Libre</span> : null}
                  </p>
                </div>
              </li>
            ))}
          </ol>
          <p className="muted foot-note">Heures affichées dans le fuseau de ton espace ({tz.replace(/_/g, ' ')}). Pour préparer les séances d’un élève, ouvre <Link href={`${base}/calendar`}>Séances</Link>.</p>
        </section>
      </div>
    </>
  );
}
