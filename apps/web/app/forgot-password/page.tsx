import { redirect } from 'next/navigation';
import { supabaseConfigured } from '@/server/supabase/server';
import { Banner, Button, Card, Cluster, Field, Heading, Input, LinkButton, PublicShell, Stack, Text } from '@/design';
import { waitSentence } from '@/server/rate-limit';

export const metadata = { title: 'Mot de passe oublié' };
export const dynamic = 'force-dynamic';

const ERRORS: Record<string, string> = {
  email: 'Saisis une adresse e-mail valide.',
  rate: 'Trop de demandes rapprochées. Patiente une minute avant de redemander.',
  expired: 'Le lien de réinitialisation n’est plus valable. Fais une nouvelle demande.',
};
/** D-162 : la limite atteinte donne le temps d’attente réel ; sans lui (limite de Supabase), la phrase générale. */
const errorText = (sp: { error?: string; wait?: string }) =>
  sp.error === 'rate' ? (waitSentence(sp.wait) ?? ERRORS.rate) : sp.error ? ERRORS[sp.error] : undefined;

/** C02-06, refonte Chrono (D-156) : réponse identique pour une adresse connue ou inconnue. */
export default async function Forgot({ searchParams }: { searchParams: Promise<{ sent?: string; error?: string; wait?: string }> }) {
  if (!supabaseConfigured()) redirect('/demo');
  const sp = await searchParams;
  const mailpit = process.env.NODE_ENV !== 'production' ? process.env.MAILPIT_URL : undefined;
  return (
    <PublicShell home="/login">
      <Stack gap={6}>
        <Cluster><LinkButton href="/login" variant="ghost" size="sm" icon="chevronLeft">Connexion</LinkButton></Cluster>
        <Stack gap={1}>
          <Heading level={1} size={1}>Mot de passe oublié</Heading>
          <Text muted>Indique ton adresse : tu recevras un lien pour choisir un nouveau mot de passe.</Text>
        </Stack>
        {sp.sent ? (
          <Banner tone="success" title="Vérifie ta boîte e-mail">
            Si un compte existe avec cette adresse, un lien vient d’être envoyé. Il est valable une heure.
            {mailpit ? <> En local, les e-mails arrivent dans <a href={mailpit} target="_blank" rel="noreferrer">la boîte de test Mailpit</a>.</> : null}
          </Banner>
        ) : null}
        {errorText(sp) ? <Banner tone="danger">{errorText(sp)}</Banner> : null}
        <Card pad={5}>
          <form action="/auth/forgot" method="post">
            <Stack gap={4}>
              <Field id="email" label="Adresse e-mail">
                <Input id="email" name="email" type="email" autoComplete="email" inputMode="email" required autoFocus={!sp.sent} />
              </Field>
              <Button type="submit" variant="primary" size="lg" block>Recevoir un lien</Button>
            </Stack>
          </form>
        </Card>
      </Stack>
    </PublicShell>
  );
}
