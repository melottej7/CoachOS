# 12 · Manuel d’exécution Claude Code

## Avant la première PR

S0 mesure la compréhension du parcours à deux rôles sur le prototype et choisit la première tranche. S1 ouvre un environnement local avec données fictives. Examiner Foulée en parallèle s’il est accessible. Un projet Supabase de production ne sert jamais à développer ou tester. Les étapes de déploiement et de migration gardent leur processus de validation.

## Boucle de travail

1. Sélectionner une tranche utilisable par les deux rôles. Lire seulement les spécifications, contrats et prérequis nécessaires. Écrire un plan en cinq lignes avec périmètre, chemins, état initial, transition et démonstration.
2. Identifier rôles, exposition, données et concurrence. Si le contrat change, faire évoluer migration, validation, client et documentation dans une tranche cohérente, migration avant UI.
3. Écrire des cas de caractérisation avant refonte ou migration. Écrire des cas d’autorisation avec coach A, autre coach B, athlète affecté et athlète tiers. Inclure les reprises spécifiques du ticket.
4. Implémenter en TypeScript strict et SQL explicite, sans masquer les échecs. Valider les entrées et sorties aux frontières. Utiliser les composants serveur Next.js compatibles avec la page et les composants clients pour interactions locales.
5. Présenter le résultat avec commandes exécutées, échecs, risque résiduel, procédure de retrait et étapes de démonstration. Faire évoluer le document concerné et le statut story.

## Conventions

| Objet | Convention |
| --- | --- |
| Code | `camelCase` fonctions et champs JSON, `PascalCase` composants et types, dossiers et segments de route en kebab case. |
| SQL | Tables au pluriel en snake case, PK `id`, FK `workspace_id` et `athlete_id`, UTC pour les instants, date locale et zone IANA pour planification. |
| Types | DTO validés explicitement. Générer les types SQL depuis les migrations. Aucun `any` au bord du réseau. |
| Logs | reqId, module, code, durée, état. Aucun retour athlète, secret, prompt, corps HTTP ou URL signée. |
| Tests | Unitaire pour règles, contrat pour API, PostgreSQL pour RLS et contraintes, E2E pour boucle coach/athlète. Clock, fournisseurs et seed synthétiques. |
| Git | Branche `feat/ID-objet` ou `fix/ID-objet`, commits petits, PR reliée à story. Branches protégées, CI verte, merge squash après revue. |

## Vérifications avant merge

Build monorepo, lint, typecheck, migration à zéro puis depuis le snapshot précédent, régénération des types, suite PostgreSQL, contrats et parcours impactés. Vérifier clavier, lecteur d’écran, lecteurs mobiles et états d’erreur sur les écrans concernés. Contrôler les versions de fournisseurs et le scan de secrets dans la CI. Contrôler absence de politiques permissives et accès en lecture seule à la prod. Ajouter une liste des variables modifiées dans la PR.

## Migration de schéma et release

Suivre expand, backfill, contract. Ajouter colonnes et index compatibles, déployer les lecteurs tolérants, compléter en lots idempotents avec curseur, contrôler invariant et charge, basculer sous drapeau puis retirer l’ancien contrat quand les deux clients actifs ont migré. Pour index volumineux, planifier l’opération concurrente hors transaction avec une vérification dédiée. Un rollback applicatif garde la compatibilité de schéma. Une restauration de base est une décision d’incident après mesure de la perte possible, avec réconciliation. Aucune migration destructive sans sauvegarde vérifiée et plan de récupération.

Release Web par tag, environnement preview sans accès prod, puis staging et production après critères du sprint. Vérifier parcours invitation → feedback, erreurs, saturation et latence. Les anciennes versions Expo restent compatibles avec le contrat v1. Pour changement de code natif, produire un nouveau binaire et passer validation stores. Pour OTA compatible, fixer runtimeVersion, déployer par cohorte et désactiver la fonctionnalité si les erreurs montent. Préciser version SQL, version Web et version mobile dans le journal.

## Quand ouvrir un ADR

Changer observabilité, portée d’authentification, modèle de droits, traitement de données sensibles, fournisseur IA, statut ou définition de facturation, import ou compatibilité externe. Enregistrer contexte, options, coût, risques, décision, preuve d’acceptation et condition de réexamen. Les décisions initiales D01 à D12 sont dans README.

## Continuer sur plusieurs sessions

Créer `docs/execution/ETAT.md` et `docs/execution/DECISIONS.md` dans le dépôt d’implémentation. Les tenir à jour à chaque tranche terminée. Les données employées dans les preuves locales sont fictives.

| À maintenir | Ce que Claude écrit |
|---|---|
| État | Tranche active, stories terminées ou bloquées, base Git, chemins modifiés, instructions de lancement. |
| Preuves | Parcours déroulés pour chaque rôle, largeur ou appareil, reprise après erreur, commandes réellement exécutées et leur résultat. |
| Décisions | Date, problème pratique, options étudiées, décision, raison, condition de réexamen. |
| Reprise | Prochaine action concrète, prérequis stricts, options de secours, blocages qui exigent le fondateur. |

Au début d’une nouvelle session, relire `CLAUDE.md`, l’état, le dernier diff et les décisions pertinentes. Reprendre un travail interrompu avant d’ouvrir une nouvelle tranche. Continuer sur les choix réversibles et noter l’hypothèse. Solliciter le fondateur lorsqu’une décision irréversible, un véritable accès de production, une publication ou une migration de données l’exige. En attendant, avancer sur la variante locale, la recette et les contrats non dépendants. À la fin, fournir un point d’étape bref, les écarts observés et une seule prochaine tranche recommandée.
