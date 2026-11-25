import type { CSSProperties, ReactNode } from 'react';
import { Card, Cluster, Eyebrow, Heading, Icon, LinkButton, PublicShell, Stack, Text } from '@/design';
import { billingEnabled, offers, trialDays } from '@/server/offers';
import { OfferCards } from './offer-cards';
import s from './public.module.css';

/**
 * D-174 · Page publique de CoachOS : ce que le coach y gagne dans sa semaine, ce que vit l’élève, les offres, les
 * questions fréquentes. Rien n’y est promis que le produit ne fasse déjà ; aucun chiffre de temps gagné tant qu’il
 * n’est pas mesuré (D-120).
 */
export function Landing() {
  const billing = billingEnabled();
  return (
    <PublicShell page aside={<LinkButton href="/login" variant="ghost" size="sm">Se connecter</LinkButton>}>
      <section className={s.hero} aria-labelledby="titre">
        <Stack gap={5}>
          <Eyebrow tone="coach">Pour les coachs de course, vélo, natation, trail et musculation</Eyebrow>
          <h1 id="titre" className={s.title}>Tes élèves trouvent leur séance. Tu lis leurs retours.</h1>
          <p className={s.lead}>
            CoachOS réunit la préparation des séances, leur suivi sur téléphone et les retours de tes élèves.
            Moins de tableurs et de messages éparpillés, plus de temps pour coacher.
          </p>
          <Cluster gap={3}>
            <LinkButton href="/signup" variant="primary" size="lg" icon="plus">Créer un compte coach</LinkButton>
            <LinkButton href="/offres" size="lg">Voir les offres</LinkButton>
          </Cluster>
          <Text size="sm" muted>
            {billing ? `Essai gratuit de ${trialDays()} jours, sans carte bancaire.` : 'Gratuit pendant la phase pilote, sans carte bancaire.'} Tes élèves ne paient rien.
          </Text>
        </Stack>
        <TodayPreview />
      </section>

      <section className={s.section} aria-labelledby="boucle">
        <Stack gap={6}>
          <Stack gap={1}>
            <Eyebrow>Une semaine avec CoachOS</Eyebrow>
            <Heading level={2} size={2} id="boucle">Planifier, faire, revoir</Heading>
          </Stack>
          <ol className={s.steps}>
            <li className={s.step}>
              <Heading level={3} size={4}>Tu planifies</Heading>
              <Text muted>Des séances structurées en zones (VMA, FTP, CSS, charges), pour un élève ou tout un groupe, à partir de tes modèles et programmes. Rien ne part sans ton geste.</Text>
            </li>
            <li className={s.step}>
              <Heading level={3} size={4}>L’élève s’entraîne</Heading>
              <Text muted>Il trouve sa séance sur son téléphone, même hors connexion, la suit pas à pas avec chronomètre, bips et voix, puis dit en quelques gestes ce qu’il a réalisé.</Text>
            </li>
            <li className={s.step}>
              <Heading level={3} size={4}>Tu revois</Heading>
              <Text muted>Les retours arrivent dans une file : ressenti, écarts, messages. Tu réponds, tu ajustes la semaine suivante, tu relances ceux qui décrochent.</Text>
            </li>
          </ol>
        </Stack>
      </section>

      <section className={s.section} aria-labelledby="temps">
        <Stack gap={6}>
          <Stack gap={1}>
            <Eyebrow>Du temps rendu chaque semaine</Eyebrow>
            <Heading level={2} size={2} id="temps">Ce que tu n’as plus à faire à la main</Heading>
          </Stack>
          <ul className={s.gains}>
            {GAINS.map((g) => (
              <li key={g.title} className={s.gain}>
                <Icon name="check" size={20} />
                <span><strong>{g.title}.</strong> <Text as="span" muted>{g.text}</Text></span>
              </li>
            ))}
          </ul>
        </Stack>
      </section>

      <section className={s.section} aria-labelledby="eleve">
        <Grid2>
          <Stack gap={3}>
            <Eyebrow>Pour tes élèves</Eyebrow>
            <Heading level={2} size={2} id="eleve">Rien à télécharger, rien à payer</Heading>
            <Text muted>Ils reçoivent un lien, créent leur compte et ajoutent CoachOS à l’écran d’accueil de leur téléphone, guidés pas à pas. Leur séance du jour s’ouvre en un geste.</Text>
          </Stack>
          <Stack gap={3}>
            <Eyebrow>Confiance</Eyebrow>
            <Heading level={2} size={2}>Des données à leur place</Heading>
            <Text muted>Hébergement en Union européenne. Chaque espace est cloisonné et contrôlé en base. Chacun exporte ses données ou demande leur effacement depuis son profil. Aucune donnée de santé n’est demandée.</Text>
          </Stack>
        </Grid2>
      </section>

      <section className={s.section} aria-labelledby="offres">
        <Stack gap={6}>
          <Stack gap={1}>
            <Eyebrow>Offres</Eyebrow>
            <Heading level={2} size={2} id="offres">Un prix selon le nombre d’élèves suivis</Heading>
          </Stack>
          <OfferCards list={offers()} billing={billing} />
          <div><LinkButton href="/offres" variant="ghost" iconRight="arrowRight">Détail des offres</LinkButton></div>
        </Stack>
      </section>

      <section className={s.section} aria-label="Questions fréquentes">
        <Faq billing={billing} />
      </section>

      <Card pad={6} tinted>
        <Cluster between gap={4}>
          <Stack gap={1}>
            <Heading level={2} size={3}>Prêt en un quart d’heure</Heading>
            <Text muted>Crée ton espace, ajoute tes élèves depuis ta liste, publie ta première semaine.</Text>
          </Stack>
          <LinkButton href="/signup" variant="primary" size="lg" icon="plus">Créer un compte coach</LinkButton>
        </Cluster>
      </Card>
    </PublicShell>
  );
}

const GAINS = [
  { title: 'Reprendre tes élèves', text: 'Colle la liste de ton tableur ou de Google Docs : fiches, groupes et liens d’invitation sont prêts.' },
  { title: 'Réécrire les mêmes séances', text: 'Modèles, programmes sur plusieurs semaines et séances de groupe se publient d’un coup.' },
  { title: 'Calculer les allures', text: 'Les zones de chaque élève traduisent la séance en allures, watts ou temps au 100 m.' },
  { title: 'Chercher qui a fait quoi', text: 'Le brief du jour dit qui attend une réponse, qui n’a rien envoyé, ce qui a changé.' },
  { title: 'Relancer un par un', text: 'Les relances préparées partent en un clic, toujours relues par toi.' },
  { title: 'Faire les comptes', text: 'Régularité, volume et charge par semaine et par sport, élève par élève.' },
];

function Grid2({ children }: { children: ReactNode }) {
  return <div className={s.duo}>{children}</div>;
}

/** Aperçu de la séance du jour : les mêmes couleurs de zones que dans le produit. */
function TodayPreview() {
  const blocks: { label: string; detail: string; z: string }[] = [
    { label: 'Échauffement', detail: '15 min · Z1', z: 'var(--ds-z1)' },
    { label: '6 × 3 min seuil', detail: '4:05/km · Z4', z: 'var(--ds-z4)' },
    { label: 'Récupération', detail: '2 min · Z1', z: 'var(--ds-z1)' },
    { label: 'Retour au calme', detail: '10 min · Z2', z: 'var(--ds-z2)' },
  ];
  return (
    <figure className={s.phone} aria-label="Exemple : la séance du jour sur le téléphone d’un élève">
      <div className={s.phoneBar} aria-hidden="true"><span>Aujourd’hui</span><span>Course à pied</span></div>
      <Stack gap={3}>
        <Heading level={3} size={3}>Seuil en côte douce</Heading>
        <ul className={s.blocks}>
          {blocks.map((b) => (
            <li key={b.label} className={s.block} style={{ '--z': b.z } as CSSProperties}><span>{b.label}</span><span>{b.detail}</span></li>
          ))}
        </ul>
        <Text size="sm" muted>« Garde de la réserve sur les deux dernières. » · ton coach</Text>
      </Stack>
    </figure>
  );
}

/** Questions fréquentes, partagées par la page publique et les offres. */
export function Faq({ billing }: { billing: boolean }) {
  const items = [
    {
      q: 'Combien ça coûte ?',
      a: billing
        ? `Un abonnement mensuel selon le nombre d’élèves actifs, après un essai gratuit de ${trialDays()} jours. Les prix sont sur la page Offres.`
        : 'Rien pendant la phase pilote. Les offres payantes seront annoncées à l’avance, et rien ne sera facturé sans ton accord.',
    },
    { q: 'Mes élèves doivent-ils payer ou installer une application ?', a: 'Non. Ils ouvrent un lien, créent leur compte et peuvent ajouter CoachOS à l’écran d’accueil de leur téléphone. Leurs séances restent lisibles hors connexion.' },
    { q: 'J’ai déjà mes élèves dans un tableur. Je recommence tout ?', a: 'Non : colle ta liste (nom, adresse, groupe) et CoachOS crée les fiches, les groupes et les liens d’invitation.' },
    { q: 'Quels sports ?', a: 'Course à pied, trail, vélo, natation et musculation, avec les zones propres à chacun : VMA, FTP, CSS, séries et charges.' },
    { q: 'Et si j’arrête ?', a: 'Tu exportes tes données depuis ton profil et tu peux demander l’effacement de ton compte. Rien n’est retenu contre toi.' },
  ];
  return (
    <Stack gap={4}>
      <Heading level={2} size={2}>Questions fréquentes</Heading>
      <div className={s.faq}>
        {items.map((it) => (
          <details key={it.q}>
            <summary>{it.q}</summary>
            <p>{it.a}</p>
          </details>
        ))}
      </div>
    </Stack>
  );
}
