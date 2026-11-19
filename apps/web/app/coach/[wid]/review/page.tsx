import Link from 'next/link';
import { formatShortDate, matchesReviewFilter, parseReviewFilter, RESULT_STATE_LABELS, reviewFilterQuery, utcToLocal, WEEKDAY_SHORT } from '@coachos/domain';
import { requireActor } from '@/server/auth/session';
import { coachContext } from '@/server/repo/context';
import { openReviews } from '@/server/repo/coach';
import { portfolio } from '@/server/repo/portfolio';
import { ActionButton } from '@/components/portfolio-forms';
import { Notice, initials } from '@/components/ui';
import { notFound } from 'next/navigation';

export const metadata = { title: 'Retours' };

/**
 * X10 : retours sans revue, triés par rang, date puis id. D-082 : filtre gardé dans l’adresse et au retour du détail
 * (C09-08) ; retours reportés à part, qui reviennent seuls dans la file à leur date.
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
  const [all, snoozed, p] = [await openReviews(actor.userId, wid), await openReviews(actor.userId, wid, undefined, 'snoozed'), await portfolio(actor.userId, wid, tz)];
  const items = all.filter((r) => matchesReviewFilter(r, filter));
  const filtered = items.length !== all.length || Boolean(filter.athleteId || filter.teamId || filter.only);
  const athletes = [...new Map(all.concat(snoozed).map((r) => [r.athleteId, r.athleteName])).entries()].sort((a, b) => a[1].localeCompare(b[1], 'fr'));
  const teams = p.teams.filter((t) => !t.archived);
  const when = (iso: string) => { const l = utcToLocal(new Date(iso), tz); const dow = (new Date(`${l.date}T12:00:00Z`).getUTCDay() + 6) % 7; return `${WEEKDAY_SHORT[dow]} ${formatShortDate(l.date)} à ${l.time.replace(':', ' h ')}`; };
  const notice = sp.notice === 'reviewed' ? 'Retour marqué comme traité.' : sp.notice === 'snoozed' ? 'Retour reporté : il reviendra dans la file à la date choisie.' : null;
  return (
    <>
      <Notice message={notice} />
      <div className="head">
        <div>
          <div className="kicker">Suivi des athlètes</div>
          <h1>Retours</h1>
          <p className="sub">{all.length ? `${all.length} retour${all.length > 1 ? 's' : ''} à traiter, du plus ancien au plus récent${filtered ? ` · ${items.length} avec ce filtre` : ''}.` : 'Tout est traité.'}</p>
        </div>
      </div>
      {all.length || snoozed.length ? (
        <form className="card review-filter" method="get" aria-label="Filtrer les retours">
          <div className="card-body form-row">
            <label className="field"><span>Élève</span>
              <select name="eleve" defaultValue={filter.athleteId ?? ''}><option value="">Tous</option>{athletes.map(([id, n]) => <option key={id} value={id}>{n}</option>)}</select></label>
            {teams.length ? (
              <label className="field"><span>Groupe</span>
                <select name="groupe" defaultValue={filter.teamId ?? ''}><option value="">Tous</option>{teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
            ) : null}
            <label className="field"><span>Seulement</span>
              <select name="seulement" defaultValue={filter.only === 'comment' ? 'commentaire' : filter.only === 'hard' ? 'effort' : ''}>
                <option value="">Tous les retours</option><option value="commentaire">Avec commentaire</option><option value="effort">Effort 8/10 ou plus</option>
              </select></label>
            <div className="actions"><button className="btn" type="submit">Filtrer</button>{filtered ? <Link className="btn ghost" href={`/coach/${wid}/review`}>Tout voir</Link> : null}</div>
          </div>
        </form>
      ) : null}
      <section className="card" aria-label="Retours à traiter">
        {items.length ? items.map((r) => (
          <div className="row" key={r.id}>
            <span className="avatar" aria-hidden="true">{initials(r.athleteName)}</span>
            <div className="row-text">
              <h3>{r.athleteName} · {r.title ?? 'Séance indisponible'}</h3>
              <p>
                {r.localDate ? formatShortDate(r.localDate) + ' · ' : ''}
                Nouveau retour : {r.resultState ? RESULT_STATE_LABELS[r.resultState] : 'état inconnu'}
                {r.rpe !== null ? ` · Effort ${r.rpe}/10` : ''}{r.hasComment ? ' · avec commentaire' : ''}
              </p>
            </div>
            <Link className="btn" href={`/coach/${wid}/review/${r.id}${q}`}>Ouvrir le retour</Link>
          </div>
        )) : <p className="empty">{all.length ? 'Aucun retour avec ce filtre.' : 'Aucun retour à traiter.'}</p>}
      </section>
      {snoozed.length ? (
        <section className="card" aria-labelledby="reportes">
          <div className="card-head"><h2 id="reportes">Reportés</h2><span className="muted">Ils reviennent seuls dans la file à leur date</span></div>
          {snoozed.map((r) => (
            <div className="row" key={r.id}>
              <span className="avatar" aria-hidden="true">{initials(r.athleteName)}</span>
              <div className="row-text">
                <h3>{r.athleteName} · {r.title ?? 'Séance indisponible'}</h3>
                <p>Revient {when(r.snoozedUntil!)}</p>
              </div>
              <ActionButton method="PATCH" url={`/api/v1/workspaces/${wid}/reviews/${r.id}`} body={{ state: 'open' }} className="btn small ghost">Remettre maintenant</ActionButton>
            </div>
          ))}
        </section>
      ) : null}
    </>
  );
}
