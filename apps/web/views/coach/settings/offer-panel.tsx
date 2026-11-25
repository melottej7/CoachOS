import { Badge, Banner, Card, Cluster, LinkButton, Meter, Stack, Text } from '@/design';
import { formatPrice } from '@/server/offers';
import type { WorkspaceOfferView } from '@/server/commands/workspace-offer';

const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? 's' : ''}`;

/**
 * D-175 · Paramètres › Abonnement (propriétaire) : où en est l’espace (phase pilote, essai, essai terminé, offre),
 * ses élèves actifs face à la limite, et ce qui se passe à la limite. Le paiement arrive avec la tranche suivante.
 */
export function OfferPanel({ view, timeZone }: { view: WorkspaceOfferView; timeZone: string }) {
  const { standing: s, active, limit } = view;
  const date = (d: Date) => d.toLocaleDateString('fr-BE', { day: 'numeric', month: 'long', year: 'numeric', timeZone });
  const pct = limit ? Math.min(100, Math.round((active / limit) * 100)) : 0;
  const full = limit !== null && active >= limit;

  return (
    <Stack gap={4}>
      {s.kind === 'trial_over' ? (
        <Banner tone="warning" title={`Ton essai s’est terminé le ${date(s.endedAt)}`}>
          Les abonnements ouvrent bientôt : d’ici là, rien ne change pour toi ni pour tes élèves.
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
              {s.kind === 'pilot' ? 'Phase pilote' : s.kind === 'plan' ? `Offre ${s.offer.name}` : 'Essai gratuit'}
            </Text>
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
          {s.kind === 'plan' ? <Text muted>{`${formatPrice(s.offer.price)} HT par mois.`}</Text> : null}

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
      <div><LinkButton href="/offres" variant="ghost" iconRight="arrowUpRight" target="_blank">Voir les offres</LinkButton></div>
    </Stack>
  );
}
