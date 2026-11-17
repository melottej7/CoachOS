# 13 · Business Model

Ce document conserve des hypothèses pour la phase postérieure à la validation du produit. Les scénarios, tarifs, quotas et modalités ci-dessous n’engagent aucune réalisation avant le jalon G2. Le modèle envisagé est un abonnement Web acheté par le coach ou le club. Un athlète invité bénéficie gratuitement de la boucle principale. Le chiffre d’affaires initial est exclusivement l’abonnement logiciel. Les ventes de coaching, commissions et paiements aux coachs ne figurent pas dans la projection.

## Offres à tester

| Offre | Prix par mois HT | Athlètes actifs | Quota initial de générations réussies/mois | Positionnement à vérifier |
|---|---:|---:|---:|---|
| Starter | 29 € | 20 | 40 | Portefeuille recentré, reprise manuelle et revue simple. |
| Pro | 59 € | 100 | 160 | Économie de temps sur des semaines et groupes répétés. |
| Elite | 99 € | 300 | 400 | File priorisée, cohorte lourde, support cadré. |
 
Les invitations pendantes et dossiers archivés ne comptent pas. Actifs = liens acceptés et non archivés. Le quota IA n’empêche aucun feedback ou workflow manuel. Aucun dépassement facturé au lancement. Les retours d’échec ne diminuent pas le compteur de succès mais leur coût entre dans le budget. Par offre, seuils mensuels de dépense €2 / €5 / €12 à étalonner. Un coach voit l’usage et l’échéance. Un essai pilote est gratuit et borné dans le temps. L’option annuelle attend les retours de churn et d’activation.

Lors d’un changement descendant, conserver lectures et accompagnement existants, bloquer les nouvelles activations au-dessus de la limite. Sur retard de paiement, grâce de 14 jours proposée, puis coach en lecture et export et athlètes en accès à leur historique selon la politique. Un impayé ne supprime rien. Définir le traitement des brouillons et des données contractuelles avant la vente, en cohérence avec les conditions de souscription.

## Hypothèses des scénarios

Mix 70 % Starter, 26 % Pro, 4 % Elite. ARPA moyen 39,60 €. Chiffres HT avec un paiement carte standard EEE par mois. Frais estimés 1,5 % + 0,25 € par paiement, plus 0,7 % du volume Billing sous tarification à l’usage. L’assiette réelle peut inclure la TVA et dépend du moyen de paiement. Aucun churn, remise ou impayé dans l’ARR instantané.

IA, 60 appels de génération par coach et par mois, 2 500 jetons en entrée, 350 en sortie, taux de calcul $2/$10 le million sur base du tarif standard Sonnet 5.5 relevé au 17 novembre 2026, hypothèse de conversion 0,90 € par $ et majoration de 25 % pour reprises. Hypothèse de budget plus prudente que l’emploi systématique d’un modèle léger. Recalculer au modèle retenu. Hors coûts de l’outil de développement.

Infrastructure cible allouée 75 €, 250 € et 850 € par mois aux paliers, scénario d’estimation, comprenant lieu d’hébergement, données, jobs, emails, analytics et surveillance. Prix publics indicatifs en USD lors du relevé, Supabase Pro à partir de $25, Vercel Pro $20, Resend Pro $20 pour 50 000 e-mails. Déduire consommation incluse avant de projeter un dépassement. Support variable séparé, 8 h, 22 h et 60 h/mois au coût imputé de 35 €/h. Un fondateur unique doit suivre la disponibilité réelle à 60 heures de support.

| Coachs payants | 50 | 250 | 1 000 |
|---|---:|---:|---:|
| Starter / Pro / Elite | 35 / 13 / 2 | 175 / 65 / 10 | 700 / 260 / 40 |
| MRR HT | 1 980 € | 9 900 € | 39 600 € |
| ARR annualisé | 23 760 € | 118 800 € | 475 200 € |
| Stripe estimé | 56,06 € | 280,30 € | 1 121,20 € |
| IA estimée | 28,69 € | 143,44 € | 573,75 € |
| Infrastructure estimée | 75 € | 250 € | 850 € |
| Support imputé | 280 € | 770 € | 2 100 € |
| Contribution mensuelle | 1 540,25 € | 8 456,26 € | 34 955,05 € |
| Marge sur coûts de service | 77,8 % | 85,4 % | 88,3 % |

Marge = (MRR − Stripe − IA − infrastructure − support) / MRR. Elle exclut rémunération de développement, marketing, formation, fiscalité, déploiements ponctuels et charges fixes. À 1 000 coachs, doubler IA et support ramène la marge estimée à 81,5 %. Pour atteindre 1 M€ ARR sur ce mix, l’ordre de grandeur est 2 105 coachs payants. Pour y arriver avec 1 000 coachs, l’ARPA requis est 83,33 €/mois.

## Décisions de prix et suivi

Tester 29/59/99 dans des cohortes segmentées. Prix stable par cohorte et promesses identiques documentées. Mesurer conversion à 30 jours, rétention payante à 90 jours, support et coût IA par espace, ainsi que gain avant/après. Un changement de seuil se fonde sur ces mesures, sans changer rétroactivement les offres activées. Budget et usage des modèles limités par espace et par mois. Suivre fraude, remboursements et taxes séparément. Seuils pilotes, marge contributive ≥75 %, retour sur CAC <6 mois et moins de 45 minutes d’aide initiale par coach. Les seuils sont proposés et dépendent du canal.

[Stripe Payments Belgique](https://stripe.com/en-be/pricing) · [Stripe Billing](https://stripe.com/en-be/billing/pricing) · [Anthropic](https://platform.claude.com/docs/en/about-claude/pricing) · [OpenAI](https://openai.com/api/pricing/) · [Supabase](https://supabase.com/pricing) · [Vercel](https://vercel.com/pricing) · [Resend](https://resend.com/pricing) · [PostHog](https://posthog.com/pricing) · [Sentry](https://sentry.io/pricing/)
