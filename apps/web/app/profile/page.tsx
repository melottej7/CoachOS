import Link from 'next/link';
import { cookies } from 'next/headers';
import { requireActor } from '@/server/auth/session';
import { readMe } from '@/server/commands/profile';
import { Banner, Button, Card, Cluster, Heading, LinkButton, PublicShell, Stack, Text, ThemeChoiceGroup } from '@/design';
import { AccountForm } from '@/views/account/account-form';
import { InstallGuide } from '@/views/athlete/install-guide';

export const metadata = { title: 'Mon compte' };

/** Profil d’identité (C02-07), refonte Chrono (D-155) : nom, langue, apparence de cet appareil, données, déconnexion. */
export default async function Profile({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const actor = await requireActor();
  const { notice } = await searchParams;
  const me = (await readMe(actor.userId)) ?? { displayName: actor.displayName, locale: 'fr' as const };
  const theme = (await cookies()).get('coachos_theme')?.value;
  return (
    <PublicShell>
      <Stack gap={6}>
        <Cluster><LinkButton href="/choose-workspace" variant="ghost" size="sm" icon="chevronLeft">Mes espaces</LinkButton></Cluster>
        {notice === 'saved' ? <Banner tone="success" title="Compte enregistré" />
          : notice === 'password' ? <Banner tone="success" title="Mot de passe modifié">Utilise-le à ta prochaine connexion.</Banner> : null}
        <Stack gap={1}>
          <Heading level={1} size={1}>Mon compte</Heading>
          <Text muted>{me.displayName}</Text>
        </Stack>
        <Card pad={5}><AccountForm initialName={me.displayName} initialLocale={me.locale} after="/profile?notice=saved" /></Card>
        <Stack as="section" gap={3} aria-labelledby="apparence">
          <Heading level={2} size={4} id="apparence">Apparence</Heading>
          <Text size="sm" muted>Réglage de cet appareil seulement.</Text>
          <ThemeChoiceGroup initial={theme === 'light' || theme === 'dark' ? theme : 'system'} hideLegend />
        </Stack>
        {/* Bilan produit : le coach aussi peut installer CoachOS sur son téléphone, guidé selon son appareil. */}
        <InstallGuide variant="profile" audience="coach" />
        <Stack as="section" gap={2} aria-labelledby="mes-donnees">
          <Heading level={2} size={4} id="mes-donnees">Mes données</Heading>
          <Text size="sm" muted>Télécharger tes données ou demander leur effacement se fait dans chaque espace : onglet Profil pour un élève, Paramètres › Mes données pour un coach. <Link href="/confidentialite">Politique de confidentialité</Link>.</Text>
        </Stack>
        <form action="/auth/signout" method="post"><Button type="submit" icon="logout">Se déconnecter</Button></form>
      </Stack>
    </PublicShell>
  );
}
