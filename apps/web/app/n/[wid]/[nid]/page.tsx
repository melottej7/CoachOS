import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { requireActor } from '@/server/auth/session';
import { isUuid } from '@/server/repo/context';
import { resolveNotification } from '@/server/commands/notifications';

export const metadata = { title: 'Notification' };

/**
 * D-067 (C25-09) : lien d’une notification ou d’un e-mail. Les droits sont revérifiés maintenant ; la notification
 * est marquée lue ; si l’accès a été retiré, on le dit au lieu d’ouvrir un écran vide.
 */
export default async function OpenNotification({ params }: { params: Promise<{ wid: string; nid: string }> }) {
  const { wid, nid } = await params;
  if (!isUuid(wid) || !isUuid(nid)) notFound();
  const actor = await requireActor();
  const r = await resolveNotification(actor.userId, wid, nid);
  if (!r) notFound();
  if (r.href) redirect(r.href);
  return (
    <main id="contenu" className="main narrow">
      <h1>Accès retiré</h1>
      <p className="sub">Ce que signalait cette notification n’est plus accessible depuis ton compte (suivi terminé, élève archivé ou séance retirée).</p>
      <p><Link className="btn" href="/">Retour à l’accueil</Link></p>
    </main>
  );
}
