# Foulée vers CoachOS · Protocole d’audit et de migration

## Quand envisager une reprise

Foulée est une première application du fondateur et une source éventuelle d’idées ou de composants. L’UX cible part des tâches du coach et de l’athlète. Claude peut avancer avec une base neuve et des données fictives. Effectuer l’audit uniquement si l’accès est fourni et si une reprise présente un intérêt. Chercher dans cet ordre les données réellement utiles, les fonctions isolées qui font gagner du temps et les composants de présentation compatibles avec le nouveau parcours. La migration réelle exige un audit et une répétition de retour arrière.

## Preuves à réunir

Le dépôt Foulée, l’export du schéma et un échantillon de données anonymisées sont nécessaires pour décider quoi réutiliser et produire les scripts de transformation. Ce protocole ne suppose ni technologie source ni structure existante. Identifier la révision du dépôt et le point de cohérence de l’export. Ne transférer aucun secret ou identifiant de production dans le dossier d’audit.

| Périmètre | Éléments à examiner | Résultat attendu |
| --- | --- | --- |
| Application | Arborescence, manifestes, lockfiles, écrans, flux Auth, services tiers, historique des migrations. | Inventaire avec chemin, propriétaire, licence, dépendances, état des tests et recommandation par composant. |
| Base | DDL, index, clés, vues, fonctions, policies, rôles, triggers et volumes par table. | Matrice des sources, de leur cardinalité et de leurs liens. Décompte des orphelins et des doublons. |
| Données métier | Personnes, droits coach, séances, plans, retours, calendriers, historiques, médias, statuts. | Dictionnaire des champs, unités, fuseaux, valeurs nulles et états inconnus, avec exemples anonymisés. |
| Exploitation | Tâches différées, notifications, sauvegardes, limitations connues, ventilation des coûts. | Liste des comportements à préserver et incidents reproductibles. Tester une restauration avant de planifier la bascule. |
| Confidentialité | Base d’usage documentée, périmètre d’export, pièces jointes, dates de rétention, destinataires. | Liste de données autorisées à migrer et procédure pour les droits des personnes. Valider avec le responsable du traitement. |

## Décision de réutilisation

Pour chaque composant, mesurer le temps de récupération et d’adaptation avec les tests de régression, puis comparer à une réécriture du même périmètre. Réutiliser si le composant est indépendant des vues ou de la base existantes, si ses droits et dépendances sont vérifiés, et si la variante intégrée satisfait les critères CoachOS. Les parseurs, conversions d’unités, tokens visuels et composants de présentation sont des candidats à inspecter. Toute logique d’autorisation doit être éprouvée dans le modèle cible avant d’être conservée.

| Issue | Condition | Traitement |
| --- | --- | --- |
| Conserver | Comportement valide et API compatible. | Isoler en module, ajouter une fixture de référence, tracer licence et commit. |
| Adapter | Valeur réelle et dépendance limitée au schéma ou au design. | Créer un adaptateur temporaire avec date de retrait et test de caractérisation. |
| Réécrire | Contrat incompatible ou adaptation plus coûteuse. | Repartir des critères d’acceptation, comparer avec des cas historiques. |
| Retirer | Absence d’usage démontré ou données sans finalité cible. | Obtenir décision métier et préparer l’archivage ou l’effacement selon la rétention applicable. |

## Matrice de transformation à remplir après inventaire

| Entité | Clé de correspondance | Transformation et contrôle |
| --- | --- | --- |
| Coach et droits | Identité legacy stable et appartenance déclarée. | Correspondance explicite contrôlée par un responsable. À email égal et rôle ambigu, placer en revue. |
| Athlète | Identifiant source et rattachement. | Conserver un lien par coach autorisé. Valider les personnes rattachées à plusieurs portefeuilles. |
| Plan et séance | Identifiant source, parent et révision. | Convertir la date locale avec le bon fuseau. Vérifier heures d’été/hiver, unités et séances passées. |
| Feedback | Identifiant source, auteur et séance. | Vérifier l’appartenance au même portefeuille. Demander un arbitrage pour toute donnée sans séance ou auteur fiable. |
| Documents et médias | Chemin relatif et empreinte cryptographique. | Vérifier le droit de copier, le MIME, la taille et le contrôle d’accès. Limiter l’export aux objets associés. |
| Abonnement éventuel | Identifiant client fournisseur et preuve du mandat. | Rapprocher les statuts depuis le fournisseur. Traiter les cas sans correspondance manuellement. |

## Exécution

1. Fixer le snapshot, le contrat d’export, la période de gel et la rétention du staging. Extraire en lecture seule et produire empreintes, décomptes par portefeuille et liste des versions.
2. Charger vers un environnement isolé. Pour chaque objet, garder `(source_system, source_id, target_id)` avec contrainte d’unicité et empreinte du contenu. Le second passage doit retrouver les mêmes identifiants et ne créer aucun doublon. Sortir les lignes ambiguës en quarantaine dédiée.
3. Comparer la couverture et les valeurs. Exiger zéro violation de clé ou accès croisé, zéro écart inexpliqué sur les comptes et séances publiées, et contrôler à la main les calendriers, décalages, multiappartenances et imports contenant des commentaires.
4. Tester une cohorte volontaire. Maintenir Foulée comme source de lecture de référence pendant le pilote. Désactiver les envois sortants pendant les répétitions et réactiver séparément après validation.
5. Lors de la bascule, geler les écritures source, refaire l’export différentiel, passer les mêmes contrôles et ouvrir les écritures cible d’abord pour la cohorte retenue. Assigner clairement le système autorisé à envoyer les notifications à chaque instant.
6. Si un périmètre critique diverge, couper les nouvelles écritures cibles et rouvrir Foulée après rapprochement des écritures CoachOS postérieures au gel. Prévoir un script de reprise ou une restitution manuelle vérifiée pour chacune. Exécuter ce scénario sur staging avant la bascule.
7. Archiver le journal d’exécution et le rapport de rapprochement sans répliquer les données sensibles. Supprimer les fichiers de transition à échéance. Fermer l’ancien environnement uniquement après validation métier et vérification des demandes en cours.

## Rapport de l’étape 1

Livrer cinq pièces liées au commit source. Un inventaire du dépôt, un tableau de dette par sévérité, une revue UX de six parcours, une matrice sécurité et un plan de réutilisation estimé en jours. Pour chaque constat, joindre un fichier, une règle ou une capture pertinente, une preuve reproductible et une correction. Priorité critique pour les accès croisés, secrets actifs, chemins sans restauration et pertes possibles à la bascule. Priorité importante pour les divergences de calendrier et les dépendances à risque. Mineure pour la cohérence et les libellés.

Score /100 sur données et migration (25), sécurité (25), architecture et maintenabilité (20), UX (15), exploitation et tests (15). Attribuer pour chaque catégorie la proportion de critères observés satisfaits et conserver « non évalué » sans extrapolation. L’estimation de réutilisation indique les jours par composant, le coût d’adaptation et l’incertitude. Cette note et le rapport sont requis avant de reprendre une partie de Foulée dans CoachOS ou d’importer ses données.
