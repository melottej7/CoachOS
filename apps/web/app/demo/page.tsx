import { notFound } from 'next/navigation';
import { demoAuthEnabled, getActor } from '@/server/auth/session';
import { DEMO_IDENTITIES } from '@/server/db/fixtures';
import { supabaseConfigured } from '@/server/supabase/server';
import { Avatar, Badge, Banner, Button, Card, Eyebrow, Heading, PublicShell, Stack, Text } from '@/design';
import s from '@/views/account/account.module.css';

export const metadata = { title: 'Démonstration' };
export const dynamic = 'force-dynamic';

/**
 * Entrée de démonstration (développement seulement, absente en production) : choisir une identité fictive.
 * Refonte Chrono (D-156). Les tests de bout en bout s’en servent pour ouvrir le coach et l’élève.
 */
export default async function Demo({ searchParams }: { searchParams: Promise<{ reset?: string }> }) {
  if (!demoAuthEnabled()) notFound();
  const actor = await getActor();
  const { reset } = await searchParams;
  const real = supabaseConfigured();
  return (
    <PublicShell wide home="/demo" aside={<Badge tone="warning">Données fictives</Badge>}>
      <Stack gap={6}>
        <Stack gap={1}>
          <Eyebrow>Environnement local</Eyebrow>
          <Heading level={1} size={1}>Choisir une identité</Heading>
          <Text muted>Ouvre le coach sur ordinateur et l’élève sur téléphone (ou dans une fenêtre étroite) pour dérouler créer → publier → lire → envoyer un retour → traiter.</Text>
        </Stack>
        {reset ? <Banner tone="success">Données de démonstration réinitialisées.</Banner> : null}
        {actor ? <Text size="sm" muted>Identité actuelle : {actor.displayName}{actor.source === 'supabase' ? ' (connexion réelle)' : ' (démo)'}.</Text> : null}
        {real ? (
          <Banner tone="info">
            Connexion réelle disponible : <a href="/login">se connecter</a> avec l’une des adresses ci-dessous et le mot de passe de démonstration
            (constante <code>DEMO_PASSWORD</code> de <code>apps/web/server/db/fixtures.ts</code>). Une carte ouvre l’identité directement (raccourci de développement).
          </Banner>
        ) : null}
        <ul className={s.identities}>
          {DEMO_IDENTITIES.map((i) => (
            <li key={i.userId}>
              <form action="/api/dev/identity" method="post" style={{ height: '100%' }}>
                <input type="hidden" name="userId" value={i.userId} />
                <button className={s.identity} type="submit">
                  <span className={s.who}><Avatar name={i.name} coach={i.role === 'coach'} size={32} />{i.name}</span>
                  <span className={s.small}>{i.role === 'coach' ? 'Coach' : 'Élève'} · {i.workspace}</span>
                  <span className={s.small}>{i.description}</span>
                  {real ? <span className={s.small}>{i.email}</span> : null}
                </button>
              </form>
            </li>
          ))}
        </ul>
        <Card pad={5}>
          <Stack gap={3}>
            <Heading level={2} size={4}>Réinitialiser</Heading>
            <Text size="sm" muted>Remplace les séances et retours saisis par le jeu de départ, daté autour d’aujourd’hui.</Text>
            <form action="/api/dev/reset" method="post"><Button type="submit" icon="repeat">Réinitialiser la démo</Button></form>
          </Stack>
        </Card>
      </Stack>
    </PublicShell>
  );
}
