import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireActor } from '@/server/auth/session';
import {
  APPOINTMENT_KIND_LABELS, APPOINTMENT_STATUS_LABELS, DAY_LABELS, EXPERIENCE_LABELS, formatLongDate, formatShortDate, formatWeekday, GOAL_STATE_LABELS,
  addDays, LEVEL_LABELS, RESULT_STATE_LABELS, SPORT_LABELS, todayIn, weekStart, urgencyLabel, utcToLocal, WEEKLY_HOURS_LABELS, WEEKLY_SESSIONS_LABELS,
  BILAN_STATUS_LABELS, BREAK_LENGTH_LABELS, bilanCompletion, deriveBilan, LONGEST_RECENT_LABELS, PRACTICE_STATUS_LABELS, RESUMED_SINCE_LABELS,
  type ResultState, type Sport,
} from '@coachos/domain';
import { readAthleteProfile, readBilanDraft } from '@/server/commands/athlete-profile';
import { readAthleteReferences } from '@/server/commands/athlete-references';
import { latestInvitation } from '@/server/commands/invitations';
import { coachContext } from '@/server/repo/context';
import { athleteFile } from '@/server/repo/portfolio';
import { athleteStats } from '@/server/repo/stats';
import { StatsPanel } from '@/components/stats-panel';
import { HistoryTable } from '@/components/history-table';
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

  return (
    <>
      <Link className="back" href={back}>← {back.includes('/planning') ? 'Planning' : 'Élèves'}</Link>
      <Notice message={notice ? NOTICES[notice] ?? null : null} />
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
            <StatsPanel s={stats.summary} delta={stats.delta} weeks={weeks} periodHref={periodHref} you={false} />
            <HistoryTable rows={stats.history} weeks={weeks} href={(sid) => `${base}/athletes/${aid}/workouts/${sid}`} />
          </div>
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
        <div className="card-body"><ReferencesForm wid={wid} aid={aid} first={first} vmaKmh={refs.vmaKmh} /></div>
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
