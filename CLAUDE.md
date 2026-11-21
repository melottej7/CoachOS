# CoachOS · Instructions permanentes pour Claude Code

**Langue : réponds toujours en français au fondateur, dans chaque message, y compris les guides pas à pas et les réponses courtes. Les libellés d’interface en anglais (boutons Supabase, GitHub, Vercel) sont cités tels quels dans des phrases françaises.**

Construire une application d’endurance fluide pour deux personnes. Le coach planifie et traite les retours. L’athlète trouve sa séance sur téléphone et dit ce qu’il a réalisé. Leur boucle manuelle est prioritaire. L’IA, les intégrations et le paiement suivent les preuves d’usage.

## Lecture et ordre de travail

1. Lire README.md et DEMARRER_AVEC_CLAUDE_CODE.md. Reprendre depuis docs/execution/ETAT.md si le fichier existe.
1 bis. Relire docs/16_COMPLEMENT_COACH_ELEVE.md (instruction du fondateur du 17 novembre 2026) et docs/execution/COUVERTURE.md à chaque reprise. Ce complément définit la cible produit (groupes et niveaux, dossier élève, accueil et tâches, bibliothèque, bilan, programmes supervisés, statistiques, activités et Garmin). En cas de divergence avec les priorités antérieures, il prévaut ; la décision est consignée (D-024).
2. Lire docs/03_UX.md et essayer prototype/index.html, puis lire les seules fiches du PRD et stories nécessaires à la prochaine tranche.
3. Suivre les tranches de docs/11_ROADMAP.md, section « Lots de la cible coach et élève » après la tranche C. Commencer par créer une séance → publier → lire sur téléphone → envoyer un retour → traiter. Contextualiser les dépendances du CSV au lieu de terminer un module entier avant de tester la boucle.
4. Utiliser les contrats SQL et OpenAPI pour l’implémentation. Consigner les décisions et écarts de contrat. Appliquer docs/12_CLAUDE_CODE.md pour le flux Git, les validations, la sécurité et la reprise.
5. À chaque fin de session, écrire l’état, les preuves réellement obtenues et la prochaine action. Les décisions documentées restent en vigueur sauf nouvelle preuve ou instruction du fondateur.

## Limites du développement

- Commencer sur données fictives. Foulée est une source facultative. Reprendre ses composants seulement si leur usage apporte un gain mesurable et s’ils conviennent à la cible. Auditer avant reprise de ses données.
- Toute donnée réelle est limitée à son espace et à son affectation. Les droits sont contrôlés au serveur et en base. Toute publication de prescription et tout envoi de message restent explicites.
- Ne pas envoyer à l’IA les données Strava ou dérivées. Garder la voie manuelle utilisable.
- Attendre la validation du parcours des deux rôles pour ouvrir le chantier commercial, les offres et Stripe. Avancer localement sur les décisions réversibles et signaler les vrais blocages.
