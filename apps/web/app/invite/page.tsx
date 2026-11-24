import Link from 'next/link';
import { getActor } from '@/server/auth/session';
import { supabaseConfigured } from '@/server/supabase/server';
import { Heading, PublicShell, Stack, Text } from '@/design';
import s from '@/views/athlete/install-guide.module.css';
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
        {/* D-171 : ce qui va se passer, avant de commencer. */}
        <Stack as="section" gap={3} aria-labelledby="invite-steps">
          <Heading level={2} size={4} id="invite-steps">Comment ça se passe</Heading>
          <ol className={s.steps}>
            <li><span className={s.num} aria-hidden="true">1</span><span><strong>Crée ton compte</strong> avec l’adresse e-mail qui a reçu l’invitation et un mot de passe. 1 minute.</span></li>
            <li><span className={s.num} aria-hidden="true">2</span><span><strong>Fais connaissance</strong> : quelques questions pour que ton coach prépare un programme qui te ressemble. Aucune question sur ta santé.</span></li>
            <li><span className={s.num} aria-hidden="true">3</span><span><strong>Installe CoachOS sur ton téléphone</strong> : on te montre où toucher, étape par étape, puis un guide te fait faire le tour.</span></li>
          </ol>
        </Stack>
        <Text size="sm" muted>Tes données ne sont vues que par ton coach : <Link href="/confidentialite">comment CoachOS les protège</Link>.</Text>
      </Stack>
    </PublicShell>
  );
}
