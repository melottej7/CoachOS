import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ADHERENCE_LABELS, addDays, daysUntil, formatShortDate, formatWeekday, LEVEL_LABELS, LEVELS, READINESS_COACH, readinessAlert, SPORT_LABELS, SPORTS, urgencyLabel, type Level } from '@coachos/domain';
import { requireActor } from '@/server/auth/session';
import { coachContext } from '@/server/repo/context';
import { portfolio, type RosterEntry } from '@/server/repo/portfolio';
import { relances } from '@/server/repo/relances';
import {
  Avatar, Badge, Banner, Button, Cluster, Disclosure, EmptyState, Eyebrow, Heading, Icon, Input, LinkButton, Meter, SegmentedLinks, Select, Stack, Text, type Tone,
} from '@/design';
import { cx } from '@/design/cx';
import { ActionButton } from '@/views/coach/action-button';
import { CreateTeamForm, TeamTools } from '@/views/coach/roster/team-tools';
import s from '@/views/coach/roster/roster.module.css';

export const metadata = { title: 'Élèves' };

type Search = { notice?: string; by?: string; q?: string; sport?: string; status?: string; team?: string; level?: string; goal?: string };
const BY = [
  { k: 'urgency', label: 'Urgence' },
  { k: 'team', label: 'Groupe' },
  { k: 'level', label: 'Niveau' },
  { k: 'none', label: 'Liste' },
] as const;
const URGENCY_TONE: Record<string, Tone> = { Urgent: 'danger', 'À suivre': 'warning', 'À jour': 'neutral' };
const ADHERENCE_TONE: Record<string, Tone> = { silent: 'danger', at_risk: 'warning', watch: 'info' };

const levelOf = (a: RosterEntry): { level: Level | null; confirmed: boolean } => {
  const c = a.sport ? a.levels.find((l) => l.sport === a.sport) : a.levels[0];
  if (c) return { level: c.level, confirmed: true };
  return { level: a.declaredLevel, confirmed: false };
};

/** Régularité des 4 dernières semaines (D-043) : jauge et chiffres, jamais la couleur seule. */
function Regularity({ r }: { r: { due: number; done: number; pct: number | null; avgRpe: number | null } }) {
  if (r.pct === null) return <Text size="sm" muted>Régularité : pas encore de séance passée sur 4 semaines</Text>;
  return (
    <div className={cx(s.reg, r.pct < 50 && s.regLow)}>
      <Meter value={r.pct} tone={r.pct < 50 ? 'signal' : 'coach'} />
      <span>Régularité {r.pct} % · {r.done} faite{r.done > 1 ? 's' : ''} sur {r.due} en 4 semaines{r.avgRpe !== null ? ` · effort moyen ${String(r.avgRpe).replace('.', ',')}/10` : ''}</span>
    </div>
  );
}

/**
 * Lot G, refonte Chrono (D-150) : groupes et élèves, regroupés par urgence, groupe ou niveau, avec recherche et filtres
 * (CE-G-03, CE-G-04) ; régularité, objectif, relance et suivis de chaque élève.
 */
export default async function Roster({ params, searchParams }: { params: Promise<{ wid: string }>; searchParams: Promise<Search> }) {
  const { wid } = await params;
  const sp = await searchParams;
  const actor = await requireActor();
  const ctx = await coachContext(actor.userId, wid);
  if (!ctx) notFound();
  const owner = ctx.role === 'owner';
  const [{ roster, teams, today }, rl] = await Promise.all([portfolio(actor.userId, wid, ctx.workspace.timeZone), relances(actor.userId, wid)]);
  // D-104 : statut d’adhésion et relance de chaque élève suivi (D-103).
  const adherence = new Map(rl.map((r) => [r.athleteId, r]));
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
  const filtered = Boolean(sp.sport || sp.level || sp.status || sp.goal);
  const searched = Boolean(q);
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
      { key: 'unknown', title: 'Niveau inconnu', hint: 'profil sportif pas encore rempli', items: list.filter((a) => !levelOf(a).level) },
    ];
  } else if (by === 'urgency') {
    const sorted = [...list].sort((a, b) => b.urgency - a.urgency || a.name.localeCompare(b.name, 'fr'));
    groups = (['Urgent', 'À suivre', 'À jour'] as const).map((u) => ({ key: u, title: u, items: sorted.filter((a) => urgencyLabel(a.urgency) === u) }));
  } else {
    groups = [{ key: 'all', title: 'Tous les élèves', items: list }];
  }

  return (
    <Stack gap={8}>
      {sp.notice === 'erased' ? <Banner tone="success" title="Dossier effacé" /> : sp.notice === 'erased-account' ? <Banner tone="success" title="Dossier effacé">Et compte supprimé : il n’était lié à aucun autre espace.</Banner> : null}
      <Cluster between gap={3} align="end">
        <Stack gap={1}>
          <Heading level={1} size={1}>Élèves</Heading>
          <Text muted>{roster.length} élève{roster.length > 1 ? 's' : ''} · {activeTeams.length} groupe{activeTeams.length > 1 ? 's' : ''}</Text>
        </Stack>
        {owner ? (
          <Cluster gap={2}>
            <LinkButton href={`${base}/athletes/import`} icon="users">Ajouter plusieurs élèves</LinkButton>
            <LinkButton href={`${base}/athletes/new`} variant="primary" icon="plus" data-tour="add-athlete-list">Ajouter un élève</LinkButton>
          </Cluster>
        ) : null}
      </Cluster>

      <Stack as="section" gap={3} aria-labelledby="teams-title" data-tour="teams">
        <Cluster between gap={2}>
          <Heading level={2} size={4} id="teams-title">Groupes</Heading>
          {sp.team ? <Link href={href({ team: '' })}>Voir tous les élèves</Link> : null}
        </Cluster>
        {activeTeams.length ? (
          <ul className={s.teams}>
            {activeTeams.map((t, i) => (
              <li key={t.id} className={cx(s.team, sp.team === t.id && s.teamOn)}>
                <div className={s.teamHead}>
                  <Link className={s.teamName} href={href({ team: sp.team === t.id ? '' : t.id, by: by === 'team' ? 'none' : by })} aria-current={sp.team === t.id ? 'true' : undefined}>{t.name}</Link>
                  {owner ? <TeamTools wid={wid} id={t.id} name={t.name} prevSortOrder={i > 0 ? activeTeams[i - 1]!.sortOrder : null} /> : null}
                </div>
                <ul className={s.teamFacts}>
                  <li>{t.members} élève{t.members > 1 ? 's' : ''}</li>
                  <li className={t.openReviews ? s.attn : undefined}>{t.openReviews} retour{t.openReviews > 1 ? 's' : ''} à traiter</li>
                  <li className={t.withoutUpcoming ? s.attn : undefined}>{t.withoutUpcoming} sans séance sur 7 jours</li>
                  <li className={t.regularity !== null && t.regularity < 50 ? s.attn : undefined}>{t.regularity === null ? 'Régularité : pas encore de données' : `Régularité ${t.regularity} % sur 4 semaines`}</li>
                </ul>
              </li>
            ))}
          </ul>
        ) : <Text muted>Crée des groupes pour organiser ton travail : débutants, préparation marathon, groupe du mardi… Un élève peut appartenir à plusieurs groupes.</Text>}
        {owner ? <CreateTeamForm wid={wid} /> : null}
        {owner && teams.some((t) => t.archived) ? (
          <Disclosure summary="Groupes archivés">
            <Stack as="ul" gap={2}>
              {teams.filter((t) => t.archived).map((t) => (
                <li key={t.id}><Cluster gap={2}><Text>{t.name}</Text><ActionButton method="PATCH" url={`/api/v1/workspaces/${wid}/teams/${t.id}`} body={{ archived: false }}>Désarchiver</ActionButton></Cluster></li>
              ))}
            </Stack>
          </Disclosure>
        ) : null}
      </Stack>

      <Stack as="section" gap={4} aria-labelledby="list-title">
        <Cluster between gap={3}>
          <Heading level={2} size={4} id="list-title">{sp.team ? `Groupe « ${teams.find((t) => t.id === sp.team)?.name ?? ''} »` : 'Tous les élèves'}</Heading>
          <div data-tour="roster-group"><SegmentedLinks label="Regrouper par" items={BY.map((b) => ({ href: href({ by: b.k }), label: b.label, current: by === b.k }))} /></div>
        </Cluster>
        <form method="get" action={`${base}/athletes`}>
          <input type="hidden" name="by" value={by} />
          {sp.team ? <input type="hidden" name="team" value={sp.team} /> : null}
          <Stack gap={3}>
            <Cluster gap={2} nowrap>
              <label className="ds-visually-hidden" htmlFor="q">Rechercher un élève</label>
              <Input id="q" name="q" type="search" placeholder="Rechercher un élève" defaultValue={sp.q ?? ''} />
              <Button type="submit" icon="search">Chercher</Button>
            </Cluster>
            <Disclosure summary={filtered ? 'Filtres actifs' : 'Filtrer par sport, niveau, statut ou objectif'} open={filtered}>
              <div className={s.filters}>
                <Select name="sport" aria-label="Sport" defaultValue={sp.sport ?? ''}><option value="">Tous les sports</option>{SPORTS.map((x) => <option key={x} value={x}>{SPORT_LABELS[x]}</option>)}</Select>
                <Select name="level" aria-label="Niveau" defaultValue={sp.level ?? ''}><option value="">Tous les niveaux</option>{LEVELS.map((l) => <option key={l} value={l}>{LEVEL_LABELS[l].label}</option>)}</Select>
                <Select name="status" aria-label="Statut" defaultValue={sp.status ?? ''}>
                  <option value="">Tous les statuts</option><option value="attention">Demande une action</option><option value="active">Actif</option><option value="invited">Invité·e</option><option value="irregular">Régularité sous 50 %</option>
                </Select>
                <Select name="goal" aria-label="Objectif" defaultValue={sp.goal ?? ''}>
                  <option value="">Tous les objectifs</option><option value="with">Avec un objectif</option><option value="soon">Objectif dans les 8 semaines</option><option value="none">Sans objectif</option>
                </Select>
                <Cluster gap={2}>
                  <Button type="submit" size="sm">Filtrer</Button>
                  {filtered || searched ? <LinkButton href={href({ q: '', sport: '', level: '', status: '', goal: '' })} size="sm" variant="ghost">Effacer</LinkButton> : null}
                </Cluster>
              </div>
            </Disclosure>
          </Stack>
        </form>

        {list.length ? groups.filter((g) => g.items.length).map((g) => (
          <Stack as="section" key={g.key} gap={2} aria-label={groups.length > 1 ? g.title : undefined}>
            {groups.length > 1 ? <Eyebrow as="h3" tone={g.key === 'Urgent' ? 'signal' : undefined}>{g.title} · {g.items.length}{g.hint ? ` · ${g.hint}` : ''}</Eyebrow> : null}
            <ul className={s.list}>
              {g.items.map((a) => {
                const lv = levelOf(a);
                const u = urgencyLabel(a.urgency);
                const r = adherence.get(a.id);
                const flagged = r && ['silent', 'at_risk', 'watch'].includes(r.status);
                return (
                  <li key={`${g.key}-${a.id}`} className={s.row}>
                    <Avatar name={a.name} size={40} />
                    <div className={s.rowText}>
                      <Cluster gap={2}>
                        <Link className={s.rowName} href={`${base}/athletes/${a.id}?from=${encodeURIComponent(here)}`}>{a.name}</Link>
                        {a.state === 'invited' ? <Badge>Invité·e</Badge> : null}
                        <Badge tone={URGENCY_TONE[u] ?? 'neutral'} dot={u !== 'À jour'}>{u}</Badge>
                        {flagged ? <Badge tone={ADHERENCE_TONE[r!.status] ?? 'neutral'}>{ADHERENCE_LABELS[r!.status]}</Badge>
                          : readinessAlert(a.readiness?.value) ? <Badge tone="warning">{READINESS_COACH[a.readiness!.value]}</Badge> : null}
                      </Cluster>
                      <span className={s.meta}>
                        {a.sport ? SPORT_LABELS[a.sport] : 'Sport non renseigné'}
                        {lv.level ? ` · ${LEVEL_LABELS[lv.level].label}${lv.confirmed ? '' : ' (déclaré, à confirmer)'}` : ''}
                        {a.teams.length ? ` · ${a.teams.map((t) => t.name).join(', ')}` : ''}
                        {' · '}{a.nextWorkout ? `prochaine séance ${formatWeekday(a.nextWorkout).toLowerCase()} ${formatShortDate(a.nextWorkout)}` : 'aucune séance publiée à venir'}
                      </span>
                      {a.nextGoal ? <span className={s.line}><Icon name="flag" size={14} />{a.nextGoal.title}{a.nextGoal.targetDate ? ` · ${formatShortDate(a.nextGoal.targetDate)} (J-${daysUntil(today, a.nextGoal.targetDate)})` : ''}</span> : null}
                      {a.state === 'active' ? <Regularity r={a.regularity} /> : null}
                      {flagged ? (
                        <span className={s.line}><Icon name="alert" size={14} />{r!.reason}{r!.waitingSince ? ' · relancé, en attente de réponse' : r!.relance ? <> · <Link href={`${base}/planning#relances-title`}>Relancer</Link></> : null}</span>
                      ) : null}
                      {a.todo.length ? <span className={s.meta}>{a.todo.slice(0, 3).map((t) => t.title + (t.source === 'auto' ? '' : ' (tâche)')).join(' · ')}{a.todo.length > 3 ? ` · +${a.todo.length - 3}` : ''}</span> : null}
                    </div>
                    <LinkButton href={`${base}/calendar?athlete=${a.id}`} size="sm" icon="calendar">Séances</LinkButton>
                  </li>
                );
              })}
            </ul>
          </Stack>
        )) : (
          <EmptyState icon="users" title={filtered || searched ? 'Aucun élève ne correspond' : 'Aucun élève pour l’instant'}
            action={!filtered && !searched && owner ? <LinkButton href={`${base}/athletes/new`} variant="primary" icon="plus">Ajouter un élève</LinkButton> : null}>
            {filtered || searched ? 'Change ou efface la recherche et les filtres.' : 'Ajoute ton premier élève et envoie-lui son lien d’invitation.'}
          </EmptyState>
        )}
        <Text size="sm" muted>Urgence calculée à partir des suivis ouverts : retours à traiter, semaine sans séance publiée, invitation en attente, profil ou niveau à confirmer, tâches en retard.</Text>
      </Stack>
    </Stack>
  );
}
