import Link from 'next/link';
import { requireActor } from '@/server/auth/session';
import { listAssignedAthletes } from '@/server/repo/coach';
import { coachContext } from '@/server/repo/context';
import { Pill, initials } from '@/components/ui';

export const metadata = { title: 'Athlètes' };

/** X12 (version minimale) : dossiers affectés et retours à traiter. Invitation : tranche C. */
export default async function Roster({ params }: { params: Promise<{ wid: string }> }) {
  const { wid } = await params;
  const actor = await requireActor();
  const athletes = await listAssignedAthletes(actor.userId, wid);
  const owner = (await coachContext(actor.userId, wid))?.role === 'owner';
  return (
    <>
      <div className="head">
        <div><div className="kicker">Portefeuille</div><h1>Athlètes</h1></div>
        {owner ? <Link className="btn primary" href={`/coach/${wid}/athletes/new`}>+ Ajouter un athlète</Link> : null}
      </div>
      <section className="card" aria-label="Athlètes">
        {athletes.length ? athletes.map((a) => (
          <div className="row" key={a.id}>
            <span className="avatar" aria-hidden="true">{initials(a.displayName)}</span>
            <div className="row-text">
              <h3><Link href={`/coach/${wid}/athletes/${a.id}`}>{a.displayName}</Link> {a.state === 'invited' ? <Pill tone="neutral">Invité·e</Pill> : null}</h3>
              <p>{a.openReviews} retour{a.openReviews > 1 ? 's' : ''} à traiter · {a.timeZone}</p>
            </div>
            <Link className="btn" href={`/coach/${wid}/calendar?athlete=${a.id}`}>Ouvrir le planning</Link>
          </div>
        )) : <p className="empty">Aucun athlète pour l’instant.{owner ? ' Ajoute ton premier athlète pour lui envoyer une invitation.' : ''}</p>}
      </section>
    </>
  );
}
