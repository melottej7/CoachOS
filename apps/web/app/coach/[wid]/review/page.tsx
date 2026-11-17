import Link from 'next/link';
import { formatShortDate, RESULT_STATE_LABELS } from '@coachos/domain';
import { requireActor } from '@/server/auth/session';
import { openReviews } from '@/server/repo/coach';
import { Notice, initials } from '@/components/ui';

export const metadata = { title: 'Retours' };

/** X10 : retours sans revue, triés par rang, date puis id. */
export default async function ReviewQueue({ params, searchParams }: { params: Promise<{ wid: string }>; searchParams: Promise<{ notice?: string }> }) {
  const { wid } = await params;
  const { notice } = await searchParams;
  const actor = await requireActor();
  const items = await openReviews(actor.userId, wid);
  return (
    <>
      <Notice message={notice === 'reviewed' ? 'Retour marqué comme traité.' : null} />
      <div className="head">
        <div>
          <div className="kicker">Suivi des athlètes</div>
          <h1>Retours</h1>
          <p className="sub">{items.length ? `${items.length} retour${items.length > 1 ? 's' : ''} à traiter, du plus ancien au plus récent.` : 'Tout est traité.'}</p>
        </div>
      </div>
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
            <Link className="btn" href={`/coach/${wid}/review/${r.id}`}>Ouvrir le retour</Link>
          </div>
        )) : <p className="empty">Aucun retour à traiter.</p>}
      </section>
    </>
  );
}
