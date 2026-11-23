import { notFound } from 'next/navigation';
import { requireActor } from '@/server/auth/session';
import { coachContext } from '@/server/repo/context';
import { listNotifications, readNotificationSettings } from '@/server/commands/notifications';
import { countMyPushDevices, publicVapidKey } from '@/server/commands/push';
import { Heading, Stack, Text } from '@/design';
import { NotificationList, NotificationSettings, PushSettings } from '@/views/notifications';

export const metadata = { title: 'Notifications' };

/** D-067 (X36, C25-08), refonte Chrono (D-145) : notifications du coach dans cet espace, rappels et e-mails. */
export default async function CoachNotifications({ params }: { params: Promise<{ wid: string }> }) {
  const { wid } = await params;
  const actor = await requireActor();
  const ctx = await coachContext(actor.userId, wid);
  if (!ctx) notFound();
  const [items, settings, devices] = await Promise.all([listNotifications(actor.userId, wid), readNotificationSettings(actor.userId, wid), countMyPushDevices(actor.userId, wid)]);
  return (
    <Stack gap={8} className="ds-narrow">
      <Stack gap={1}>
        <Heading level={1} size={1}>Notifications</Heading>
        <Text muted>Retours reçus, messages et bilans de tes élèves. Une notification ouvre l’écran où agir.</Text>
      </Stack>
      <NotificationList wid={wid} items={items} timeZone={ctx.workspace.timeZone} role="coach" />
      <Stack as="section" gap={3} aria-labelledby="rappels">
        <Heading level={2} size={4} id="rappels">Rappels sur cet appareil</Heading>
        <PushSettings wid={wid} publicKey={publicVapidKey()} devices={devices} role="coach" />
      </Stack>
      <Stack as="section" gap={3} aria-labelledby="emails">
        <Heading level={2} size={4} id="emails">E-mails</Heading>
        <NotificationSettings wid={wid} email={settings.email} />
      </Stack>
    </Stack>
  );
}
