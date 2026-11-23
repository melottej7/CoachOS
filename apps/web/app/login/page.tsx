import Link from 'next/link';
import { redirect } from 'next/navigation';
import { demoAuthEnabled, getActor } from '@/server/auth/session';
import { safeNext, supabaseConfigured } from '@/server/supabase/server';
import { Banner, Button, Card, Field, Heading, Input, LinkButton, PasswordInput, PublicShell, Stack, Text } from '@/design';

export const metadata = { title: 'Connexion' };
export const dynamic = 'force-dynamic';

const ERRORS: Record<string, string> = {
  credentials: 'Adresse e-mail ou mot de passe incorrect.',
  rate: 'Trop de tentatives rapprochées. Patiente une minute avant de réessayer.',
  link: 'Ce lien n’est plus valable (déjà utilisé ou expiré). Recommence la demande.',
};
const NOTICES: Record<string, string> = {
  confirm: 'Compte créé. Confirme ton adresse depuis l’e-mail reçu, puis connecte-toi.',
};

/** X02, refonte Chrono (D-156) : connexion par adresse et mot de passe (D-020). Formulaire classique : marche sans JavaScript. */
export default async function Login({ searchParams }: { searchParams: Promise<{ next?: string; error?: string; notice?: string }> }) {
  if (!supabaseConfigured()) redirect('/demo');
  const sp = await searchParams;
  const next = safeNext(sp.next);
  const actor = await getActor();
  if (actor?.source === 'supabase') redirect(next === '/' ? '/choose-workspace' : next);
  const q = next !== '/' ? `?next=${encodeURIComponent(next)}` : '';
  return (
    <PublicShell home="/login">
      <Stack gap={6}>
        <Stack gap={1}>
          <Heading level={1} size={1}>Connexion</Heading>
          <Text muted>Connecte-toi avec ton adresse e-mail et ton mot de passe.</Text>
        </Stack>
        {sp.error && ERRORS[sp.error] ? <Banner tone="danger">{ERRORS[sp.error]}</Banner> : null}
        {sp.notice && NOTICES[sp.notice] ? <Banner tone="success">{NOTICES[sp.notice]}</Banner> : null}
        <Card pad={5}>
          <form action="/auth/login" method="post">
            <Stack gap={4}>
              <input type="hidden" name="next" value={next} />
              <Field id="email" label="Adresse e-mail">
                <Input id="email" name="email" type="email" autoComplete="email" inputMode="email" required autoFocus />
              </Field>
              <Field id="password" label="Mot de passe">
                <PasswordInput id="password" autoComplete="current-password" />
              </Field>
              <Button type="submit" variant="primary" size="lg" block>Se connecter</Button>
              <Text size="sm"><Link href="/forgot-password">Mot de passe oublié ?</Link></Text>
            </Stack>
          </form>
        </Card>
        <Card pad={5} tinted>
          <Stack gap={3}>
            <Text strong>Coach, pas encore de compte ?</Text>
            <div><LinkButton href={`/signup${q}`} icon="plus">Créer un compte coach</LinkButton></div>
            <Text size="sm" muted>Élève : ton compte se crée depuis le lien d’invitation de ton coach (reçu par e-mail, SMS ou WhatsApp).</Text>
          </Stack>
        </Card>
        <Text size="sm" muted><Link href="/confidentialite">Comment CoachOS protège tes données</Link></Text>
        {demoAuthEnabled() ? <Text size="sm" muted>Développement : <Link href="/demo">identités de démonstration</Link>.</Text> : null}
      </Stack>
    </PublicShell>
  );
}
