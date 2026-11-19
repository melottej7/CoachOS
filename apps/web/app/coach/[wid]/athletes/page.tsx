import Link from 'next/link';
import { notFound } from 'next/navigation';
import { addDays, daysUntil, formatShortDate, formatWeekday, LEVEL_LABELS, LEVELS, SPORT_LABELS, SPORTS, urgencyLabel, type Level } from '@coachos/domain';
import { requireActor } from '@/server/auth/session';
import { coachContext } from '@/server/repo/context';
import { portfolio, type RosterEntry } from '@/server/repo/portfolio';
import { ActionButton, CreateTeamForm, RenameTeam } from '@/components/portfolio-forms';
import { Pill, initials } from '@/components/ui';

export const metadata = { title: 'Élèves' };

type Search = { by?: string; q?: string; sport?: string; status?: string; team?: string; level?: string; goal?: string };
const BY = [
  { k: 'team', label: 'Groupe' },
  { k: 'level', label: 'Niveau' },
  { k: 'urgency', label: 'Urgence' },
  { k: 'none', label: 'Liste' },
] as const;

const levelOf = (a: RosterEntry): { level: Level | null; confirmed: boolean } => {
  const c = a.sport ? a.levels.find((l) => l.sport === a.sport) : a.levels[0];
  if (c) return { level: c.level, confirmed: true };
  return { level: a.declaredLevel, confirmed: false };
};

/** Lot G : groupes et élèves, regroupés par groupe, niveau ou urgence, avec recherche et filtres (CE-G-03, CE-G-04). */
/** Régularité des 4 dernières semaines (D-043) : jauge + chiffres, jamais la couleur seule. */
function Regularity({ r }: { r: { due: number; done: number; pct: number | null; avgRpe: number | null } }) {
  if (r.pct === null) return <p className="reg muted">Régularité : pas encore de séance passée sur 4 semaines</p>;
  return (
    <p className={`reg${r.pct < 50 ? ' low' : ''}`}>
      <span className="reg-meter" aria-hidden="true"><span style={{ width: `${r.pct}%` }} /></span>
      Régularité {r.pct} % · {r.done} séance{r.done > 1 ? 's' : ''} faite{r.done > 1 ? 's' : ''} sur {r.due} en 4 semaines
      {r.avgRpe !== null ? ` · effort moyen ${String(r.avgRpe).replace('.', ',')}/10` : ''}
    </p>
  );
}

export default async function Roster({ params, searchParams }: { params: Promise<{ wid: string }>; searchParams: Promise<Search> }) {
  const { wid } = await params;
  const sp = await searchParams;
  const actor = await requireActor();
  const ctx = await coachContext(actor.userId, wid);
  if (!ctx) notFound();
  const owner = ctx.role === 'owner';
  const { roster, teams, today } = await portfolio(actor.userId, wid, ctx.workspace.timeZone);
  const base = `/coach/${wid}`;
  const by = BY.some((b) => b.k === sp.by) ? (sp.by as (typeof BY)[number]['k']) : 'urgency';
  const href = (extra: Record<string, string>) => {
    const q = new URLSearchParams(Object.entries({ ...sp, ...extra }).filter(([, v]) => v) as [string, string][]);
    return `${base}/athletes${q.size ? `?${q}` : ''}`;
  };
  const here = href({});

  const q = (sp.q ?? '').trim().toLocaleLowerCase('fr');
  const list = roster.filter((a) =>
    (!q || a.name.toLocaleLowerCase('fr').includes(q)) &&
    (!sp.sport || a.sport === sp.sport) &&
    (!sp.team || a.teams.some((t) => t.id === sp.team)) &&
    (!sp.level || levelOf(a).level === sp.level) &&
    (!sp.goal || (sp.goal === 'none' ? !a.nextGoal : sp.goal === 'soon'
      ? Boolean(a.nextGoal?.targetDate && a.nextGoal.targetDate <= addDays(today, 56)) : Boolean(a.nextGoal))) &&
    (!sp.status || (sp.status === 'invited' ? a.state === 'invited' : sp.status === 'active' ? a.state === 'active'
      : sp.status === 'irregular' ? a.regularity.pct !== null && a.regularity.due >= 2 && a.regularity.pct < 50 : a.urgency > 0)),
  );
  const filtered = Boolean(q || sp.sport || sp.team || sp.level || sp.status || sp.goal);
  const activeTeams = teams.filter((t) => !t.archived);

  // Regroupement : un élève dans deux groupes apparaît dans les deux.
  let groups: { key: string; title: string; hint?: string; items: RosterEntry[] }[];
  if (by === 'team') {
    groups = [
      ...activeTeams.map((t) => ({ key: t.id, title: t.name, items: list.filter((a) => a.teams.some((m) => m.id === t.id)) })),
      { key: 'none', title: 'Sans groupe', items: list.filter((a) => !a.teams.length) },
    ];
  } else if (by === 'level') {
    groups = [
      ...LEVELS.map((l) => ({ key: l, title: LEVEL_LABELS[l].label, items: list.filter((a) => levelOf(a).level === l) })),
      { key: 'unknown', title: 'Niveau inconnu', hint: 'Profil sportif pas encore rempli', items: list.filter((a) => !levelOf(a).level) },
    ];
  } else if (by === 'urgency') {
    const sorted = [...list].sort((a, b) => b.urgency - a.urgency || a.name.localeCompare(b.name, 'fr'));
    groups = (['Urgent', 'À suivre', 'À jour'] as const).map((u) => ({ key: u, title: u, items: sorted.filter((a) => urgencyLabel(a.urgency) === u) }));
  } else {
    groups = [{ key: 'all', title: 'Tous les élèves', items: list }];
  }

  return (
    <>
      <div className="head">
        <div><div className="kicker">Portefeuille</div><h1>Élèves</h1><p className="sub">{roster.length} élève{roster.length > 1 ? 's' : ''} · {activeTeams.length} groupe{activeTeams.length > 1 ? 's' : ''}</p></div>
        {owner ? <Link className="btn primary" href={`${base}/athletes/new`} data-tour="add-athlete-list">+ Ajouter un élève</Link> : null}
      </div>

      <section className="card" aria-labelledby="teams-title" data-tour="teams">
        <div className="card-head"><h2 id="teams-title">Groupes</h2>{sp.team ? <Link className="link-btn" href={href({ team: '' })}>Voir tous les élèves</Link> : null}</div>
        <div className="card-body stack">
          {activeTeams.length ? (
            <ul className="team-grid">
              {activeTeams.map((t, i) => (
                <li key={t.id} className={`team-card${sp.team === t.id ? ' on' : ''}`}>
                  <Link className="team-open" href={href({ team: sp.team === t.id ? '' : t.id, by: by === 'team' ? 'none' : by })} aria-current={sp.team === t.id ? 'true' : undefined}>
                    <strong>{t.name}</strong>
                    <span>{t.members} élève{t.members > 1 ? 's' : ''}</span>
                    <span className={t.openReviews ? 'attn' : ''}>{t.openReviews} retour{t.openReviews > 1 ? 's' : ''} à traiter</span>
                    <span className={t.withoutUpcoming ? 'attn' : ''}>{t.withoutUpcoming} sans séance sur 7 jours</span>
                    <span className={t.regularity !== null && t.regularity < 50 ? 'attn' : ''}>{t.regularity === null ? 'Régularité : pas encore de données' : `Régularité ${t.regularity} % sur 4 semaines`}</span>
                  </Link>
                  {owner ? (
                    <div className="team-tools">
                      <RenameTeam wid={wid} id={t.id} name={t.name} />
                      {i > 0 ? <ActionButton method="PATCH" url={`/api/v1/workspaces/${wid}/teams/${t.id}`} body={{ sortOrder: activeTeams[i - 1]!.sortOrder }} className="link-btn" label={`Placer ${t.name} plus haut`}>Plus haut</ActionButton> : null}
                      <ActionButton method="PATCH" url={`/api/v1/workspaces/${wid}/teams/${t.id}`} body={{ archived: true }} className="link-btn" confirm={`Archiver le groupe « ${t.name} » ? Les élèves et leurs séances ne changent pas.`}>Archiver</ActionButton>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : <p className="muted">Crée des groupes pour organiser ton travail : débutants, préparation marathon, groupe du mardi… Un élève peut appartenir à plusieurs groupes.</p>}
          {owner ? <CreateTeamForm wid={wid} /> : null}
          {owner && teams.some((t) => t.archived) ? (
            <details className="archived">
              <summary>Groupes archivés</summary>
              <ul className="plain">
                {teams.filter((t) => t.archived).map((t) => (
                  <li key={t.id}>{t.name} · <ActionButton method="PATCH" url={`/api/v1/workspaces/${wid}/teams/${t.id}`} body={{ archived: false }} className="link-btn">Désarchiver</ActionButton></li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      </section>

      <section className="card" aria-labelledby="list-title">
        <div className="card-head">
          <h2 id="list-title">{sp.team ? `Groupe « ${teams.find((t) => t.id === sp.team)?.name ?? ''} »` : 'Élèves'}</h2>
          <nav className="seg-tabs small" aria-label="Regrouper par" data-tour="roster-group">
            {BY.map((b) => <Link key={b.k} href={href({ by: b.k })} aria-current={by === b.k ? 'page' : undefined}>{b.label}</Link>)}
          </nav>
        </div>
        <form className="filters" method="get" action={`${base}/athletes`}>
          <input type="hidden" name="by" value={by} />
          {sp.team ? <input type="hidden" name="team" value={sp.team} /> : null}
          <label className="visually-hidden" htmlFor="q">Rechercher un élève</label>
          <input id="q" name="q" className="input" type="search" placeholder="Rechercher un élève" defaultValue={sp.q ?? ''} />
          <label className="visually-hidden" htmlFor="sport">Sport</label>
          <select id="sport" name="sport" className="select small" defaultValue={sp.sport ?? ''}>
            <option value="">Tous les sports</option>{SPORTS.map((s) => <option key={s} value={s}>{SPORT_LABELS[s]}</option>)}
          </select>
          <label className="visually-hidden" htmlFor="level">Niveau</label>
          <select id="level" name="level" className="select small" defaultValue={sp.level ?? ''}>
            <option value="">Tous les niveaux</option>{LEVELS.map((l) => <option key={l} value={l}>{LEVEL_LABELS[l].label}</option>)}
          </select>
          <label className="visually-hidden" htmlFor="status">Statut</label>
          <select id="status" name="status" className="select small" defaultValue={sp.status ?? ''}>
            <option value="">Tous les statuts</option><option value="attention">Demande une action</option><option value="active">Actif</option><option value="invited">Invité·e</option><option value="irregular">Régularité sous 50 %</option>
          </select>
          <label className="visually-hidden" htmlFor="goal">Objectif</label>
          <select id="goal" name="goal" className="select small" defaultValue={sp.goal ?? ''}>
            <option value="">Tous les objectifs</option><option value="with">Avec un objectif</option><option value="soon">Objectif dans les 8 semaines</option><option value="none">Sans objectif</option>
          </select>
          <button className="btn small" type="submit">Filtrer</button>
          {filtered ? <Link className="link-btn" href={href({ q: '', sport: '', level: '', status: '', goal: '' })}>Effacer</Link> : null}
        </form>

        {list.length ? groups.filter((g) => g.items.length).map((g) => (
          <div key={g.key} className="roster-group">
            {groups.length > 1 ? <h3 className="bucket-title">{g.title} <span className="muted">· {g.items.length}</span>{g.hint ? <span className="muted"> · {g.hint}</span> : null}</h3> : null}
            {g.items.map((a) => {
              const lv = levelOf(a);
              const u = urgencyLabel(a.urgency);
              return (
                <div className="row roster-row" key={`${g.key}-${a.id}`}>
                  <span className="avatar" aria-hidden="true">{initials(a.name)}</span>
                  <div className="row-text">
                    <h3>
                      <Link href={`${base}/athletes/${a.id}?from=${encodeURIComponent(here)}`}>{a.name}</Link>{' '}
                      {a.state === 'invited' ? <Pill tone="neutral">Invité·e</Pill> : null}{' '}
                      <Pill tone={u === 'Urgent' ? 'attn' : u === 'À suivre' ? '' : 'neutral'}>{u}</Pill>
                    </h3>
                    <p>
                      {a.sport ? SPORT_LABELS[a.sport] : 'Sport non renseigné'}
                      {lv.level ? ` · ${LEVEL_LABELS[lv.level].label}${lv.confirmed ? '' : ' (déclaré, à confirmer)'}` : ''}
                      {a.teams.length ? ` · ${a.teams.map((t) => t.name).join(', ')}` : ''}
                      {' · '}{a.nextWorkout ? `Prochaine séance ${formatWeekday(a.nextWorkout).toLowerCase()} ${formatShortDate(a.nextWorkout)}` : 'Aucune séance publiée à venir'}
                    </p>
                    {a.nextGoal ? <p className="row-goal">🎯 {a.nextGoal.title}{a.nextGoal.targetDate ? ` · ${formatShortDate(a.nextGoal.targetDate)} (J-${daysUntil(today, a.nextGoal.targetDate)})` : ''}</p> : null}
                    {a.state === 'active' ? <Regularity r={a.regularity} /> : null}
                    {a.todo.length ? (
                      <p className="row-todo">{a.todo.slice(0, 3).map((t) => t.title + (t.source === 'auto' ? '' : ' (tâche)')).join(' · ')}{a.todo.length > 3 ? ` · +${a.todo.length - 3}` : ''}</p>
                    ) : null}
                  </div>
                  <Link className="btn" href={`${base}/calendar?athlete=${a.id}`}>Séances</Link>
                </div>
              );
            })}
          </div>
        )) : <p className="empty">{filtered ? 'Aucun élève ne correspond à ces filtres.' : `Aucun élève pour l’instant.${owner ? ' Ajoute ton premier élève pour lui envoyer une invitation.' : ''}`}</p>}
        <p className="muted foot-note">Urgence calculée à partir des suivis ouverts : retours à traiter, semaine sans séance publiée, invitation en attente, profil ou niveau à confirmer, tâches en retard. Aujourd’hui : {formatShortDate(today).replace(/\.$/, "")}.</p>
      </section>
    </>
  );
}
