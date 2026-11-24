import { redirect } from 'next/navigation';
import { PASSWORD_MIN } from '@coachos/domain';
import { getActor } from '@/server/auth/session';
import { Banner, Button, Card, Field, Heading, PasswordInput, PublicShell, Stack, Text } from '@/design';
import { waitSentence } from '@/server/rate-limit';

export const metadata = { title: 'Nouveau mot de passe' };
export const dynamic = 'force-dynamic';

const ERRORS: Record<string, string> = {
  weak: `Le mot de passe doit contenir au moins ${PASSWORD_MIN} caractères.`,
  same: 'Choisis un mot de passe différent de l’ancien.',
  rate: 'Trop de tentatives rapprochées. Patiente un moment avant de réessayer.',
};
/** D-162 : la limite atteinte donne le temps d’attente réel ; sans lui (limite de Supabase), la phrase générale. */
const errorText = (sp: { error?: string; wait?: string }) =>
  sp.error === 'rate' ? (waitSentence(sp.wait) ?? ERRORS.rate) : sp.error ? ERRORS[sp.error] : undefined;

/** Arrivée depuis le lien de réinitialisation, refonte Chrono (D-156) : la session de récupération est active. */
export default async function ResetPassword({ searchParams }: { searchParams: Promise<{ error?: string; wait?: string }> }) {
  const actor = await getActor();
  if (actor?.source !== 'supabase') redirect('/forgot-password?error=expired');
  const sp = await searchParams;
  return (
    <PublicShell home="/login">
      <Stack gap={6}>
        <Stack gap={1}>
          <Heading level={1} size={1}>Nouveau mot de passe</Heading>
          <Text muted>Choisis le mot de passe que tu utiliseras désormais pour te connecter.</Text>
        </Stack>
        {errorText(sp) ? <Banner tone="danger">{errorText(sp)}</Banner> : null}
        <Card pad={5}>
          <form action="/auth/reset" method="post">
            <Stack gap={4}>
              <Field id="password" label="Nouveau mot de passe" hint={`${PASSWORD_MIN} caractères minimum`}>
                <PasswordInput id="password" autoComplete="new-password" minLength={PASSWORD_MIN} hasHint />
              </Field>
              <Button type="submit" variant="primary" size="lg" block>Enregistrer</Button>
            </Stack>
          </form>
        </Card>
      </Stack>
    </PublicShell>
  );
}
