import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { RECOVERY_EMAIL_COOKIE } from '@/server/auth/recovery';
import { supabaseConfigured } from '@/server/supabase/server';
import { Banner, Button, Card, Cluster, Field, Heading, Input, LinkButton, PublicShell, Stack, Text } from '@/design';
import { waitSentence } from '@/server/rate-limit';

export const metadata = { title: 'Mot de passe oublié' };
export const dynamic = 'force-dynamic';

const ERRORS: Record<string, string> = {
  email: 'Saisis une adresse e-mail valide.',
  rate: 'Trop de demandes rapprochées. Patiente une minute avant de redemander.',
  expired: 'Le lien de réinitialisation n’est plus valable. Fais une nouvelle demande.',
  code: 'Ce code ne correspond pas ou n’est plus valable. Vérifie les 6 chiffres du dernier e-mail reçu, ou fais une nouvelle demande.',
};
/** D-162 : la limite atteinte donne le temps d’attente réel ; sans lui (limite de Supabase), la phrase générale. */
const errorText = (sp: { error?: string; wait?: string }) =>
  sp.error === 'rate' ? (waitSentence(sp.wait) ?? ERRORS.rate) : sp.error ? ERRORS[sp.error] : undefined;

/** C02-06, refonte Chrono (D-156) : réponse identique pour une adresse connue ou inconnue. */
export default async function Forgot({ searchParams }: { searchParams: Promise<{ sent?: string; error?: string; wait?: string }> }) {
  if (!supabaseConfigured()) redirect('/demo');
  const sp = await searchParams;
  const mailpit = process.env.NODE_ENV !== 'production' ? process.env.MAILPIT_URL : undefined;
  const remembered = (await cookies()).get(RECOVERY_EMAIL_COOKIE)?.value ?? '';
  return (
    <PublicShell home="/login">
      <Stack gap={6}>
        <Cluster><LinkButton href="/login" variant="ghost" size="sm" icon="chevronLeft">Connexion</LinkButton></Cluster>
        <Stack gap={1}>
          <Heading level={1} size={1}>Mot de passe oublié</Heading>
          <Text muted>Indique ton adresse : tu recevras un code et un lien pour choisir un nouveau mot de passe.</Text>
        </Stack>
        {sp.sent ? (
          <Banner tone="success" title="Vérifie ta boîte e-mail">
            Si un compte existe avec cette adresse, un e-mail vient d’être envoyé, valable une heure. Recopie son code ci-dessous, ou touche son lien.
            Sur iPhone, avec CoachOS installée sur l’écran d’accueil, le code est le plus sûr : le lien s’ouvre dans Safari.
            {mailpit ? <> En local, les e-mails arrivent dans <a href={mailpit} target="_blank" rel="noreferrer">la boîte de test Mailpit</a>.</> : null}
          </Banner>
        ) : null}
        {errorText(sp) ? <Banner tone="danger">{errorText(sp)}</Banner> : null}
        {sp.sent ? (
          <Card pad={5}>
            <form action="/auth/code" method="post" aria-label="Saisir le code reçu">
              <Stack gap={4}>
                {remembered ? <input type="hidden" name="email" value={remembered} /> : (
                  <Field id="code-email" label="Adresse e-mail">
                    <Input id="code-email" name="email" type="email" autoComplete="email" inputMode="email" required />
                  </Field>
                )}
                <Field id="code" label="Code à 6 chiffres reçu par e-mail">
                  <Input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,7}" maxLength={7} required autoFocus />
                </Field>
                <Button type="submit" variant="primary" size="lg" block>Valider le code</Button>
              </Stack>
            </form>
          </Card>
        ) : null}
        <Card pad={5}>
          <form action="/auth/forgot" method="post">
            <Stack gap={4}>
              <Field id="email" label="Adresse e-mail">
                <Input id="email" name="email" type="email" autoComplete="email" inputMode="email" required autoFocus={!sp.sent} />
              </Field>
              <Button type="submit" variant={sp.sent ? 'secondary' : 'primary'} size="lg" block>{sp.sent ? 'Renvoyer un e-mail' : 'Recevoir un code'}</Button>
            </Stack>
          </form>
        </Card>
      </Stack>
    </PublicShell>
  );
}
