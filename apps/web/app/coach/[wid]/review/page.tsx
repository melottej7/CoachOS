import Link from 'next/link';
import { notFound } from 'next/navigation';
import { formatShortDate, isRoutineReview, matchesReviewFilter, parseReviewFilter, READINESS_COACH, readinessAlert, RESULT_STATE_LABELS, reviewFilterQuery, utcToLocal, WEEKDAY_SHORT } from '@coachos/domain';
import { requireActor } from '@/server/auth/session';
import { coachContext } from '@/server/repo/context';
import { openReviews } from '@/server/repo/coach';
import { portfolio } from '@/server/repo/portfolio';
import { Avatar, Badge, Banner, Button, Cluster, Disclosure, EmptyState, Heading, Icon, LinkButton, Select, Stack, Text } from '@/design';
import { RequeueReview, ReviewKeys } from '@/views/coach/review-actions';
import { RoutineBatch } from '@/views/coach/review/routine-batch';
import s from '@/views/coach/review/review.module.css';

export const metadata = { title: 'Retours' };

/**
 * X10, refonte Chrono (D-145) : retours sans revue, triés par rang, date puis id ; au clavier (J, K, Entrée).
 * D-082 : filtre gardé dans l’adresse et au retour du détail ; retours reportés à part, qui reviennent seuls à leur date.
 */
export default async function ReviewQueue({ params, searchParams }: { params: Promise<{ wid: string }>; searchParams: Promise<{ notice?: string; eleve?: string; groupe?: string; seulement?: string }> }) {
  const { wid } = await params;
  const sp = await searchParams;
  const actor = await requireActor();
  const ctx = await coachContext(actor.userId, wid);
  if (!ctx) notFound();
  const tz = ctx.workspace.timeZone;
  const filter = parseReviewFilter(sp);
  const q = reviewFilterQuery(filter);
  const [all, snoozed, p] = await Promise.all([openReviews(actor.userId, wid), openReviews(actor.userId, wid, undefined, 'snoozed'), portfolio(actor.userId, wid, tz)]);
  const items = all.filter((r) => matchesReviewFilter(r, filter));
  const filtered = Boolean(filter.athleteId || filter.teamId || filter.only);
  const athletes = [...new Map(all.concat(snoozed).map((r) => [r.athleteId, r.athleteName])).entries()].sort((a, b) => a[1].localeCompare(b[1], 'fr'));
  const teams = p.teams.filter((t) => !t.archived);
  const when = (iso: string) => { const l = utcToLocal(new Date(iso), tz); const dow = (new Date(`${l.date}T12:00:00Z`).getUTCDay() + 6) % 7; return `${WEEKDAY_SHORT[dow]} ${formatShortDate(l.date)} à ${l.time.replace(':', ' h ')}`; };
  const base = `/coach/${wid}`;
  const only = filter.only === 'comment' ? 'commentaire' : filter.only === 'hard' ? 'effort' : filter.only === 'readiness' ? 'pas-a-100' : '';

  return (
    <Stack gap={6}>
      {sp.notice === 'reviewed' ? <Banner tone="success" title="Retour marqué comme traité" /> : sp.notice === 'snoozed' ? <Banner tone="success" title="Retour reporté">Il reviendra dans la file à la date choisie.</Banner> : null}
      <Stack gap={1}>
        <Heading level={1} size={1}>Retours à traiter</Heading>
        <Text muted>
          {all.length ? `${all.length} retour${all.length > 1 ? 's' : ''}, du plus ancien au plus récent${all.some((r) => readinessAlert(r.readiness)) ? ' (les élèves pas à 100 % d’abord)' : ''}${filtered ? ` · ${items.length} avec ce filtre` : ''}.` : 'Tout est traité.'}
        </Text>
      </Stack>

      {all.length || snoozed.length ? (
        <Disclosure summary={filtered ? 'Filtres actifs' : 'Filtrer par élève, groupe ou type de retour'} open={filtered}>
          <form method="get" aria-label="Filtrer les retours">
            <div className={s.filters}>
              <Select name="eleve" aria-label="Élève" defaultValue={filter.athleteId ?? ''}><option value="">Tous les élèves</option>{athletes.map(([id, n]) => <option key={id} value={id}>{n}</option>)}</Select>
              {teams.length ? <Select name="groupe" aria-label="Groupe" defaultValue={filter.teamId ?? ''}><option value="">Tous les groupes</option>{teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select> : null}
              <Select name="seulement" aria-label="Seulement" defaultValue={only}>
                <option value="">Tous les retours</option><option value="commentaire">Avec commentaire</option><option value="effort">Effort 8/10 ou plus</option><option value="pas-a-100">Pas à 100 %</option>
              </Select>
              <Cluster gap={2}>
                <Button type="submit" size="sm">Filtrer</Button>
                {filtered ? <LinkButton href={`${base}/review`} size="sm" variant="ghost">Tout voir</LinkButton> : null}
              </Cluster>
            </div>
          </form>
        </Disclosure>
      ) : null}

      {/* Bilan produit : les retours sans signal se traitent d’un geste, avec « Annuler ». */}
      <RoutineBatch wid={wid} items={items.filter(isRoutineReview).flatMap((r) => (r.workoutId && r.revision ? [{ athleteId: r.athleteId, workoutId: r.workoutId, revision: r.revision }] : []))} />

      {items.length ? (
        <Stack gap={2}>
          <ul className={s.queue} aria-label="Retours à traiter">
            {items.map((r) => (
              <li key={r.id}>
                <Link className={s.row} href={`${base}/review/${r.id}${q}`} data-review-row>
                  <Avatar name={r.athleteName} size={40} />
                  <span className={s.rowText}>
                    <span className={s.rowTitle}>{r.athleteName} · {r.title ?? 'Séance indisponible'}</span>
                    <span className={s.rowMeta}>
                      {r.localDate ? `${formatShortDate(r.localDate)} · ` : ''}{r.resultState ? RESULT_STATE_LABELS[r.resultState] : 'État inconnu'}
                      {r.rpe !== null ? ` · effort ${r.rpe}/10` : ''}{r.hasComment ? ' · avec commentaire' : ''}
                    </span>
                    {readinessAlert(r.readiness) ? <span><Badge tone="warning" dot>{READINESS_COACH[r.readiness!]}</Badge></span> : null}
                  </span>
                  <Icon name="chevronRight" size={18} className={s.chevron} />
                </Link>
              </li>
            ))}
          </ul>
          <ReviewKeys mode="queue" />
        </Stack>
      ) : (
        <EmptyState icon="check" title={all.length ? 'Aucun retour avec ce filtre' : 'Aucun retour à traiter'}>
          {all.length ? 'Change ou efface le filtre.' : 'Les retours de tes élèves arrivent ici dès qu’ils les envoient.'}
        </EmptyState>
      )}

      {snoozed.length ? (
        <Stack as="section" gap={3} aria-labelledby="reportes">
          <Stack gap={1}>
            <Heading level={2} size={4} id="reportes">Reportés</Heading>
            <Text size="sm" muted>Ils reviennent seuls dans la file à leur date.</Text>
          </Stack>
          <ul className={s.queue}>
            {snoozed.map((r) => (
              <li key={r.id} className={s.row}>
                <Avatar name={r.athleteName} size={40} />
                <span className={s.rowText}>
                  <span className={s.rowTitle}>{r.athleteName} · {r.title ?? 'Séance indisponible'}</span>
                  <span className={s.rowMeta}>Revient {when(r.snoozedUntil!)}</span>
                </span>
                <RequeueReview wid={wid} rid={r.id} />
              </li>
            ))}
          </ul>
        </Stack>
      ) : null}
    </Stack>
  );
}
