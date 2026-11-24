import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PASSWORD_MIN } from '@coachos/domain';
import { getActor } from '@/server/auth/session';
import { safeNext, supabaseConfigured } from '@/server/supabase/server';
import { Banner, Button, Card, Cluster, Field, Grid, Heading, Input, LinkButton, PasswordInput, PublicShell, Stack, Text } from '@/design';

export const metadata = { title: 'Créer un compte coach' };
export const dynamic = 'force-dynamic';

const ERRORS: Record<string, string> = {
  weak: `Le mot de passe doit contenir au moins ${PASSWORD_MIN} caractères.`,
  fields: 'Vérifie ton prénom, ton nom et ton adresse e-mail.',
  exists: 'Un compte existe déjà avec cette adresse. Connecte-toi, ou utilise « Mot de passe oublié ».',
  rate: 'Trop de tentatives rapprochées. Patiente une minute avant de réessayer.',
  failed: 'La création du compte a échoué. Réessaie dans un instant.',
};

/** Inscription coach (C02-01), refonte Chrono (D-156) : prénom, nom (D-153), adresse, mot de passe ; puis la création d’espace (X04). */
export default async function SignUp({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  if (!supabaseConfigured()) redirect('/demo');
  const sp = await searchParams;
  const next = safeNext(sp.next);
  const actor = await getActor();
  if (actor?.source === 'supabase') redirect('/choose-workspace');
  return (
    <PublicShell home="/login">
      <Stack gap={6}>
        <Cluster><LinkButton href="/login" variant="ghost" size="sm" icon="chevronLeft">Connexion</LinkButton></Cluster>
        <Stack gap={1}>
          <Heading level={1} size={1}>Créer un compte coach</Heading>
          <Text muted>Ensuite, tu crées ton espace et tu invites tes élèves.</Text>
        </Stack>
        {sp.error && ERRORS[sp.error] ? <Banner tone="danger">{ERRORS[sp.error]}</Banner> : null}
        <Card pad={5}>
          <form action="/auth/signup" method="post">
            <Stack gap={4}>
              <input type="hidden" name="next" value={next} />
              <Grid min={160} gap={4}>
                <Field id="firstName" label="Prénom">
                  <Input id="firstName" name="firstName" autoComplete="given-name" required maxLength={50} autoFocus />
                </Field>
                <Field id="lastName" label="Nom">
                  <Input id="lastName" name="lastName" autoComplete="family-name" required maxLength={50} />
                </Field>
              </Grid>
              <Field id="email" label="Adresse e-mail">
                <Input id="email" name="email" type="email" autoComplete="email" inputMode="email" required maxLength={254} />
              </Field>
              <Field id="password" label="Mot de passe" hint={`${PASSWORD_MIN} caractères minimum`}>
                <PasswordInput id="password" autoComplete="new-password" minLength={PASSWORD_MIN} hasHint />
              </Field>
              <Button type="submit" variant="primary" size="lg" block>Créer mon compte</Button>
            </Stack>
          </form>
        </Card>
        <Text size="sm" muted>En créant ton compte, tu acceptes que CoachOS traite tes données comme décrit dans la <Link href="/confidentialite">politique de confidentialité</Link>.</Text>
      </Stack>
    </PublicShell>
  );
}
