import { Badge, Card, Heading, Icon, Stack, Text } from '@/design';
import { cx } from '@/design';
import { formatPrice, type Offer } from '@/server/offers';
import s from './public.module.css';

/**
 * D-174 · Les trois offres côte à côte. Interrupteur commercial éteint : la phase pilote est gratuite et aucun prix
 * n’est publié (le prix final appartient au fondateur, D-120) ; allumé : prix hors taxes par mois.
 */
export function OfferCards({ list, billing, headingLevel = 3 }: { list: Offer[]; billing: boolean; headingLevel?: 2 | 3 }) {
  return (
    <div className={s.offers}>
      {list.map((o) => (
        <Card key={o.id} pad={5} className={cx(s.offer, o.id === 'pro' && s.offerFeatured)} aria-labelledby={`offre-${o.id}`}>
          <Stack gap={1}>
            <Heading level={headingLevel} size={3} id={`offre-${o.id}`}>{o.name}</Heading>
            {o.id === 'pro' ? <div><Badge tone="coach">Conseillé pour un coach à plein temps</Badge></div> : null}
          </Stack>
          {billing
            ? <p className={s.price}>{formatPrice(o.price)}<small>HT par mois</small></p>
            : <p className={s.price}>0&nbsp;€<small>pendant la phase pilote</small></p>}
          <Text strong>Jusqu’à {o.athletes} élèves actifs</Text>
          <Text muted>{o.pitch}</Text>
          <Text size="sm" muted><Icon name="check" size={16} /> Toutes les fonctions incluses</Text>
        </Card>
      ))}
    </div>
  );
}
