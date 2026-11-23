import { notFound } from 'next/navigation';
import { requireActor } from '@/server/auth/session';
import { athleteContext } from '@/server/repo/context';
import { listNotifications, readNotificationSettings } from '@/server/commands/notifications';
import { countMyPushDevices, publicVapidKey } from '@/server/commands/push';
import { Cluster, Eyebrow, Heading, LinkButton, Stack, Text } from '@/design';
import { NotificationList, NotificationSettings, PushSettings } from '@/views/notifications';

export const metadata = { title: 'Notifications' };

/** D-067 (X36, C25-08), refonte Chrono (D-137) : notifications de l’élève dans cet espace, rappels et e-mails. */
export default async function AthleteNotifications({ params }: { params: Promise<{ wid: string }> }) {
  const { wid } = await params;
  const actor = await requireActor();
  const ctx = await athleteContext(actor.userId, wid);
  if (!ctx) notFound();
  const [items, settings, devices] = await Promise.all([listNotifications(actor.userId, wid), readNotificationSettings(actor.userId, wid), countMyPushDevices(actor.userId, wid)]);
  return (
    <Stack gap={8}>
      <Stack gap={4}>
        <Cluster><LinkButton href={`/athlete/${wid}/today`} variant="ghost" size="sm" icon="chevronLeft">Aujourd’hui</LinkButton></Cluster>
        <Stack gap={1}>
          <Eyebrow tone="coach">{ctx.workspace.name}</Eyebrow>
          <Heading level={1} size={1}>Notifications</Heading>
          <Text muted>Séances publiées et messages de ton coach.</Text>
        </Stack>
      </Stack>
      <NotificationList wid={wid} items={items} timeZone={ctx.athlete.timeZone} />
      <Stack as="section" gap={3} aria-labelledby="rappels">
        <Heading level={2} size={4} id="rappels">Rappels sur cet appareil</Heading>
        <PushSettings wid={wid} publicKey={publicVapidKey()} devices={devices} />
      </Stack>
      <Stack as="section" gap={3} aria-labelledby="emails">
        <Heading level={2} size={4} id="emails">E-mails</Heading>
        <NotificationSettings wid={wid} email={settings.email} />
      </Stack>
    </Stack>
  );
}
