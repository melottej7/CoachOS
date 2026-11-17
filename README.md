# CoachOS · Package de spécifications

Version 1.1, 17 novembre 2026. Package de référence pour construire CoachOS au fil de plusieurs sessions Claude Code. La priorité est la qualité de la boucle entre le coach et l’athlète. Les hypothèses commerciales sont conservées pour la phase qui suit la validation du produit.

## Avant de démarrer

1. Ouvrir [le prototype cliquable](prototype/index.html) dans un navigateur et passer de l’espace coach à l’espace athlète. Les données sont fictives. Essayer une séance datée du 17 novembre dans le dossier Camille Laurent. Dans l’espace coach, enregistrer puis publier depuis la carte. Dans l’espace athlète, ouvrir Aujourd’hui, envoyer le retour, puis revenir dans Retours côté coach.
2. Copier ce dossier à la racine du dépôt de développement ou placer `CLAUDE.md` à la racine et adapter les chemins indiqués.
3. Donner à Claude le texte de [DÉMARRER AVEC CLAUDE CODE](DEMARRER_AVEC_CLAUDE_CODE.md). Il commence par la première tranche utile, puis reprend depuis son journal à chaque session.
4. Prioriser l’enchaînement créer → publier → lire → envoyer un retour → traiter. Le prototype montre une proposition d’interface que les séances d’observation pourront faire évoluer.

## Documents et ordre de lecture

| Nº | Document | Usage |
|---|---|---|
| 01 | [Synthèse](docs/01_EXECUTIVE_SUMMARY.md) | Vision, deux expériences et critères de réussite |
| 02 | [PRD](docs/02_PRD.md) | Règles produit, versions, critères |
| 03 | [UX](docs/03_UX.md) | Écrans, navigation, scénarios |
| 04 | [Design system](docs/04_DESIGN_SYSTEM.md) | Composants et états |
| 05 | [Base de données](docs/05_DATABASE.md) | Modèle et migration cible |
| 06 | [API](docs/06_API.md) | Contrats Web et Expo |
| 07 | [Architecture](docs/07_ARCHITECTURE.md) | Décisions, infrastructure et exploitation |
| 08 | [Assistant IA](docs/08_AI_ASSISTANT.md) | Évidence, prompts, limites et évaluation |
| 09 | [Coach DNA](docs/09_COACH_DNA.md) | Profil versionné, règles, supervision |
| 10 | [Backlog](docs/10_BACKLOG.md) | Stories et critères vérifiables |
| 11 | [Roadmap](docs/11_ROADMAP.md) | Sprints 0 à 30 |
| 12 | [Manuel Claude Code](docs/12_CLAUDE_CODE.md) | Règles d’exécution et jalons |
| 13 | [Modèle économique](docs/13_BUSINESS_MODEL.md) | Hypothèses de prix et de coûts, à reprendre après validation |
| 14 | [Go to market](docs/14_GO_TO_MARKET.md) | Cohortes produit et commercialisation différée |
| 15 | [Migration Foulée](docs/15_MIGRATION_FOULEE.md) | Réutilisation et migration si elles sont utiles |
 
Contrats dans [contracts](contracts/), SQL cible dans [database](database/) et backlog importable dans [backlog](backlog/). Les versions imprimables de 01 et 02 se trouvent dans [lecture](lecture/).

## Arbitrages entre les fichiers reçus

| Décision | Héritage et résolution |
|---|---|
| D01. Cible | Vision et prompt maître donnent les cohortes et le paiement par le coach. Les 50 à 300 athlètes sont une cible de capacité par portefeuille. 1 000 coachs / 20 000 athlètes est une hypothèse de charge globale, pas un plafond par coach. |
| D02. Périmètre | Le backlog préliminaire place l’IA en P1 et Coach DNA en P2, le prompt maître élargit le MVP. Alpha = boucle manuelle. Bêta = parcours manuel validé des deux côtés. Résumé et fiche DNA déclarative sous drapeau après preuve de fluidité et de gain. |
| D03. Stripe | Pilote d’usage gratuit. Stratégie de vente détaillée et Stripe après validation de l’usage des deux côtés. |
| D04. Strava | Retiré du chemin critique malgré son P0 historique. La politique 2026 restreint l’affichage tiers et interdit l’usage IA, y compris indirect. Aucun transfert vers le coach, l’IA, l’analyse produit ou les apprentissages. Développement conditionné à une autorisation compatible et à un besoin mesuré. |
| D05. Sécurité | Tables de l’audit affinées avec espace, rôles, affectations et provenance. Blessures réservées à une éventuelle décision de traitement. Prototype sur données fictives en premier. Auth, RLS et contrôle des transitions avant toute ouverture à de vraies données. |
| D06. Prix | 29 €/20 et 59 €/100 conservés comme hypothèses HT. 99 € illimité devient 99 €/300 pour maîtriser les coûts et éprouver le support. |
| D07. Apprentissage | « Réentraîner » devient proposer et valider des règles versionnées. Automatisation supervisée limitée à la préparation interne. Toute publication ou modification d’une prescription appartient au coach. |
| D08. Marketplace | Le prompt maître évoque V2 et le backlog P2. V3 sur preuve de demandes, opérations de paiement et coûts. Aucun développement anticipé. |
| D09. Plateformes | Web coach sur ordinateur et espace athlète conçu pour le téléphone dès le MVP. Expo après validation de la boucle. FR au pilote, EN en V1 avec prise en compte de la traduction dès le début. |
| D10. Foulée | Foulée est une première application du fondateur. Choisir l’interface à partir des tâches réelles du coach et de l’athlète. Si le dépôt devient accessible, comparer ses composants au nouveau parcours avant toute décision de reprise. |
| D11. Blessures | La spécification DNA traduit ces cas en arrêt d’automatisation et revue humaine. Le traitement d’informations de santé et toute reprise guidée ont un jalon propre. |
| D12. Ordre d’exécution | Commencer par le parcours à deux rôles sur données fictives. L’audit Foulée est une piste parallèle, préalable seulement à la reprise d’un composant ou à une migration. Les décisions de production se fondent sur la recette des parcours et l’isolation des données. |

En cas d’écart entre les documents, ouvrir un ADR et corriger le contrat concerné dans la même PR. Le PRD définit le comportement. Le SQL et OpenAPI définissent les contrats machine. Le backlog précise la séquence de réalisation. Les références de concurrence et de coûts sont datées.
