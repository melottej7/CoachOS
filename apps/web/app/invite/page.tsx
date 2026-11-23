import Link from 'next/link';
import { getActor } from '@/server/auth/session';
import { supabaseConfigured } from '@/server/supabase/server';
import { Heading, PublicShell, Stack, Text } from '@/design';
import { AcceptInvitation } from '@/views/invite/accept-invitation';

export const metadata = { title: 'Invitation' };
export const dynamic = 'force-dynamic';

/** X06 : activer une relation avec une identité vérifiée (refonte Chrono, D-140). */
export default async function Invite() {
  const actor = await getActor();
  return (
    <PublicShell>
      <Stack gap={6}>
        <Stack gap={2}>
          <Heading level={1} size={1}>Rejoindre ton coach</Heading>
          <Text size="md" muted>Ton coach t’a invité·e sur CoachOS pour retrouver tes séances et lui envoyer tes retours.</Text>
        </Stack>
        <AcceptInvitation signedInAs={actor?.displayName ?? null} loginEnabled={supabaseConfigured()} />
        <Text size="sm" muted>Tes données ne sont vues que par ton coach : <Link href="/confidentialite">comment CoachOS les protège</Link>.</Text>
      </Stack>
    </PublicShell>
  );
}
