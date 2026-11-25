import { Heading, LinkButton, PublicShell, Stack, Text } from '@/design';
import { billingEnabled, offers, trialDays } from '@/server/offers';
import { OfferCards } from '@/views/public/offer-cards';
import { Faq } from '@/views/public/landing';

export const metadata = { title: 'Offres' };
export const dynamic = 'force-dynamic';

/** D-174 · Offres par nombre d’élèves actifs (docs/13), réglables sans toucher au code (server/offers.ts). */
export default function Offers() {
  const billing = billingEnabled();
  const list = offers();
  return (
    <PublicShell page aside={<LinkButton href="/login" variant="ghost" size="sm">Se connecter</LinkButton>}>
      <Stack gap={8}>
        <Stack gap={2}>
          <Heading level={1} size={1}>Offres</Heading>
          <Text size="lg" muted>
            {billing
              ? `Un prix selon le nombre d’élèves que tu suis. Essai gratuit de ${trialDays()} jours, sans carte bancaire.`
              : 'Un prix selon le nombre d’élèves que tu suis. Pendant la phase pilote, CoachOS est gratuit : rien ne sera facturé sans ton accord.'}
          </Text>
        </Stack>
        <OfferCards list={list} billing={billing} headingLevel={2} />
        <Stack gap={2}>
          <Text muted>Élève actif : invitation acceptée et dossier non archivé. Les invitations en attente et les dossiers archivés ne comptent pas. Tes élèves ne paient rien.</Text>
          {billing ? <Text muted>Prix hors taxes, par mois, résiliable à tout moment.</Text> : null}
        </Stack>
        <div><LinkButton href="/signup" variant="primary" size="lg" icon="plus">Créer un compte coach</LinkButton></div>
        <Faq billing={billing} />
      </Stack>
    </PublicShell>
  );
}
