import { notFound } from 'next/navigation';
import { requireActor } from '@/server/auth/session';
import { coachContext } from '@/server/repo/context';
import { listNotifications, readNotificationSettings } from '@/server/commands/notifications';
import { NotificationList, NotificationSettings } from '@/components/notifications';
import { PushSettings } from '@/components/push-settings';
import { countMyPushDevices, publicVapidKey } from '@/server/commands/push';

export const metadata = { title: 'Notifications' };

/** D-067 (X36, C25-08) : notifications du coach dans cet espace. */
export default async function CoachNotifications({ params }: { params: Promise<{ wid: string }> }) {
  const { wid } = await params;
  const actor = await requireActor();
  const ctx = await coachContext(actor.userId, wid);
  if (!ctx) notFound();
  const [items, settings, devices] = await Promise.all([listNotifications(actor.userId, wid), readNotificationSettings(actor.userId, wid), countMyPushDevices(actor.userId, wid)]);
  return (
    <>
      <h1>Notifications</h1>
      <p className="sub">Retours reçus, messages et bilans de tes élèves. Une notification ouvre l’écran où agir.</p>
      <section className="card"><div className="card-body"><NotificationList wid={wid} items={items} timeZone={ctx.workspace.timeZone} /></div></section>
      <section className="card"><div className="card-body"><PushSettings wid={wid} role="coach" publicKey={publicVapidKey()} devices={devices} /></div></section>
      <section className="card"><div className="card-body"><NotificationSettings wid={wid} email={settings.email} /></div></section>
    </>
  );
}
