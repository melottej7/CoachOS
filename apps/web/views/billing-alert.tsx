import { Banner, LinkButton } from '@/design';
import type { Standing } from '@/server/offers';

const day = (d: Date, timeZone: string) => d.toLocaleDateString('fr-BE', { day: 'numeric', month: 'long', timeZone });

/**
 * D-188 · Bandeau de l’espace quand le paiement l’exige : lecture seule (essai ou abonnement terminé, impayé après
 * la grâce) ou paiement refusé à régulariser. Le propriétaire est mené à l’abonnement ; un coach associé, prévenu ;
 * l’élève sait qu’il garde son historique. Rien tant que le paiement n’est pas ouvert.
 */
export function BillingAlert({ s, role, wid, timeZone }: { s: Standing; role: 'owner' | 'coach' | 'athlete'; wid: string; timeZone: string }) {
  const go = role === 'owner' ? <LinkButton href={`/coach/${wid}/settings?onglet=abonnement`} size="sm" variant="primary">{s.kind === 'grace' ? 'Mettre à jour ma carte' : 'Choisir une offre'}</LinkButton> : null;
  if (s.kind === 'grace') {
    if (role === 'athlete') return null;
    return (
      <Banner tone="warning" title={`Paiement refusé : à régulariser avant le ${day(s.until, timeZone)}`} action={go}>
        {role === 'owner' ? 'Jusque-là, tout fonctionne. Ensuite, l’espace passera en lecture seule, sans rien perdre.' : 'Préviens le propriétaire de l’espace : jusque-là, tout fonctionne.'}
      </Banner>
    );
  }
  if (role === 'athlete') {
    return <Banner tone="info" title="L’espace de ton coach est en pause">Tu gardes l’accès à tes séances et à ton historique. Ton coach a été prévenu.</Banner>;
  }
  return (
    <Banner tone="warning" title="Espace en lecture seule" action={go}>
      {role === 'owner' ? 'Ton essai ou ton abonnement est terminé. Tout reste consultable et exportable ; choisis une offre pour tout retrouver.' : 'L’essai ou l’abonnement est terminé. Tout reste consultable ; préviens le propriétaire de l’espace.'}
    </Banner>
  );
}
