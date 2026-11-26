import { Badge, Banner, Card, Cluster, Grid, LinkButton, Meter, Stack, Text } from '@/design';
import { formatPrice, offerFor } from '@/server/offers';
import type { WorkspaceOfferView } from '@/server/commands/workspace-offer';
import { BillingButton } from './billing-button';

const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? 's' : ''}`;

/**
 * D-175 · Paramètres › Abonnement (propriétaire) : où en est l’espace (phase pilote, essai, essai terminé, offre),
 * ses élèves actifs face à la limite, et ce qui se passe à la limite.
 * D-188 · Paiement (mode test, derrière l’interrupteur) : choisir son offre, « Gérer mon abonnement » (portail Stripe),
 * paiement refusé (14 jours de grâce), lecture seule ; retour de la page de paiement (`abonnement=merci|annule|portail`).
 */
export function OfferPanel({ view, timeZone, wid, notice }: { view: WorkspaceOfferView; timeZone: string; wid: string; notice?: string }) {
  const { standing: s, active, limit, offers, canPay, hasCustomer, readOnly } = view;
  const paying = s.kind === 'plan' || s.kind === 'grace';
  const suggested = offerFor(active, offers);
  const date = (d: Date) => d.toLocaleDateString('fr-BE', { day: 'numeric', month: 'long', year: 'numeric', timeZone });
  const pct = limit ? Math.min(100, Math.round((active / limit) * 100)) : 0;
  const full = limit !== null && active >= limit;

  const portal = (label: string, variant: 'primary' | 'secondary' | 'ghost' = 'secondary') =>
    canPay && hasCustomer ? <BillingButton wid={wid} kind="portal" variant={variant} icon="arrowUpRight">{label}</BillingButton> : null;

  return (
    <Stack gap={4}>
      {notice === 'merci' ? (
        <Banner tone="success" title={paying ? `Merci ! Ton offre ${s.offer.name} est active.` : 'Merci ! Ton paiement est en cours de confirmation.'}>
          {paying ? 'Tu retrouves tout ton espace. La facture t’arrive par e-mail.' : 'Stripe nous confirme le paiement dans un instant : recharge la page d’ici une minute.'}
        </Banner>
      ) : null}
      {notice === 'annule' ? <Banner tone="info" title="Paiement annulé">Rien n’a été prélevé. Tu peux choisir une offre quand tu veux.</Banner> : null}
      {s.kind === 'trial_over' ? (
        readOnly ? (
          <Banner tone="warning" title={`Ton essai s’est terminé le ${date(s.endedAt)} : ton espace est en lecture seule`}>
            Toi et tes élèves gardez l’accès à tout, et tu peux exporter tes données. Choisis une offre ci-dessous pour tout retrouver.
          </Banner>
        ) : (
          <Banner tone="warning" title={`Ton essai s’est terminé le ${date(s.endedAt)}`}>
            Les abonnements ouvrent bientôt : d’ici là, rien ne change pour toi ni pour tes élèves.
          </Banner>
        )
      ) : null}
      {s.kind === 'grace' ? (
        <Banner tone="warning" title={`Paiement refusé : mets à jour ta carte avant le ${date(s.until)}`} action={portal('Mettre à jour ma carte', 'primary')}>
          {`Jusque-là, tout fonctionne (encore ${plural(s.daysLeft, 'jour')}). Ensuite, ton espace passera en lecture seule, sans rien perdre.`}
        </Banner>
      ) : null}
      {s.kind === 'unpaid' ? (
        <Banner tone="danger" title="Paiement non régularisé : ton espace est en lecture seule" action={portal('Régler ma facture', 'primary')}>
          {`Depuis le ${date(s.since)}. Rien n’est supprimé : dès le paiement, tu retrouves tout.`}
        </Banner>
      ) : null}
      {s.kind === 'canceled' ? (
        <Banner tone="warning" title="Ton abonnement est arrêté : ton espace est en lecture seule">
          Tes données et celles de tes élèves restent consultables et exportables. Reprends une offre pour continuer.
        </Banner>
      ) : null}
      {full ? (
        <Banner tone="warning" title="Limite d’élèves atteinte">
          Tes élèves actifs ne sont pas touchés. Un nouvel élève ne pourra rejoindre l’espace qu’après un passage à une offre plus grande ; son lien reste valable.
        </Banner>
      ) : null}
      <Card pad={5}>
        <Stack gap={3}>
          <Cluster gap={2}>
            <Text strong>
              {s.kind === 'pilot' ? 'Phase pilote' : s.kind === 'trial' || s.kind === 'trial_over' ? 'Essai gratuit' : `Offre ${s.offer.name}`}
            </Text>
            {s.kind === 'grace' ? <Badge tone="signal">Paiement refusé</Badge> : null}
            {s.kind === 'unpaid' || s.kind === 'canceled' ? <Badge tone="signal">Lecture seule</Badge> : null}
            {s.kind === 'pilot' ? <Badge tone="coach">Gratuit</Badge> : null}
            {s.kind === 'trial' ? <Badge tone={s.daysLeft <= 7 ? 'signal' : 'coach'}>{`Encore ${plural(s.daysLeft, 'jour')}`}</Badge> : null}
            {s.kind === 'trial_over' ? <Badge tone="signal">Terminé</Badge> : null}
          </Cluster>
          {s.kind === 'pilot' ? (
            <Text muted>CoachOS est gratuit pendant la phase pilote, sans limite d’élèves. Tu seras prévenu avant toute facturation, et rien ne sera facturé sans ton accord.</Text>
          ) : null}
          {s.kind === 'trial' ? (
            <Text muted>{`Jusqu’au ${date(s.endsAt)}, sans carte bancaire, avec les limites de l’offre ${s.offer.name}. Avant la fin de l’essai, tu choisiras ton offre ici.`}</Text>
          ) : null}
          {s.kind === 'plan' ? <Text muted>{`${formatPrice(s.offer.price)} HT par mois${s.renewsAt ? `, prochain prélèvement le ${date(s.renewsAt)}` : ''}.`}</Text> : null}

          {limit !== null ? (
            <Stack gap={2}>
              <Text><strong>{active}</strong> {`élève${active > 1 ? 's' : ''} actif${active > 1 ? 's' : ''} sur ${limit}`}</Text>
              <div role="meter" aria-valuemin={0} aria-valuemax={limit} aria-valuenow={active} aria-label="Élèves actifs par rapport à la limite de l’offre">
                <Meter value={pct} tone={pct >= 90 ? 'signal' : 'coach'} />
              </div>
            </Stack>
          ) : (
            <Text><strong>{active}</strong> {`élève${active > 1 ? 's' : ''} actif${active > 1 ? 's' : ''}`}</Text>
          )}
          <Text size="sm" muted>Élève actif : invitation acceptée et dossier non archivé. Les invitations en attente ne comptent pas. Tes élèves ne paient rien.</Text>
        </Stack>
      </Card>
      {canPay && !paying && s.kind !== 'pilot' ? (
        // D-188 : choisir son offre ; la page de paiement est celle de Stripe (mode test tant que la clé est de test).
        <Stack gap={3} as="section" aria-labelledby="choisir-offre">
          <Text as="h3" id="choisir-offre" strong>Choisir mon offre</Text>
          <Grid min={220} gap={3}>
            {offers.map((o) => (
              <Card key={o.id} pad={4}>
                <Stack gap={2}>
                  <Cluster gap={2}>
                    <Text strong>{o.name}</Text>
                    {o.id === suggested.id ? <Badge tone="coach">{active ? `Conseillée pour ${plural(active, 'élève')}` : 'Pour commencer'}</Badge> : null}
                  </Cluster>
                  <Text><strong>{formatPrice(o.price)}</strong> HT par mois</Text>
                  <Text size="sm" muted>{`Jusqu’à ${o.athletes} élèves actifs. ${o.pitch}`}</Text>
                  {active > o.athletes ? <Text size="sm">{`Tu as ${active} élèves actifs : ils restent, mais un nouveau ne pourra pas rejoindre l’espace.`}</Text> : null}
                  <BillingButton wid={wid} kind="checkout" offer={o.id} variant={o.id === suggested.id ? 'coach' : 'secondary'}>{`Choisir ${o.name}`}</BillingButton>
                </Stack>
              </Card>
            ))}
          </Grid>
          <Text size="sm" muted>Paiement mensuel par carte, sur la page sécurisée de Stripe ; sans engagement, arrêt à tout moment. Tes élèves ne paient rien.</Text>
        </Stack>
      ) : null}
      <Cluster gap={2}>
        {portal('Gérer mon abonnement')}
        <LinkButton href="/offres" variant="ghost" iconRight="arrowUpRight" target="_blank">Voir les offres</LinkButton>
      </Cluster>
    </Stack>
  );
}
