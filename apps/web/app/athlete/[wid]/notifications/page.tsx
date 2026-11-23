import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireActor } from '@/server/auth/session';
import { athleteContext } from '@/server/repo/context';
import { listNotifications, readNotificationSettings } from '@/server/commands/notifications';
import { NotificationList, NotificationSettings } from '@/components/notifications';
import { PushSettings } from '@/components/push-settings';
import { countMyPushDevices, publicVapidKey } from '@/server/commands/push';

export const metadata = { title: 'Notifications' };

/** D-067 (X36, C25-08) : notifications de l’élève dans cet espace. */
export default async function AthleteNotifications({ params }: { params: Promise<{ wid: string }> }) {
  const { wid } = await params;
  const actor = await requireActor();
  const ctx = await athleteContext(actor.userId, wid);
  if (!ctx) notFound();
  const [items, settings, devices] = await Promise.all([listNotifications(actor.userId, wid), readNotificationSettings(actor.userId, wid), countMyPushDevices(actor.userId, wid)]);
  return (
    <>
      <Link className="back" href={`/athlete/${wid}/today`}>← Aujourd’hui</Link>
      <h1>Notifications</h1>
      <p className="sub">Séances publiées et messages de ton coach.</p>
      <section className="card"><div className="card-body"><NotificationList wid={wid} items={items} timeZone={ctx.athlete.timeZone} /></div></section>
      <section className="card"><div className="card-body"><PushSettings wid={wid} role="athlete" publicKey={publicVapidKey()} devices={devices} /></div></section>
      <section className="card"><div className="card-body"><NotificationSettings wid={wid} email={settings.email} /></div></section>
    </>
  );
}
