# Couverture de la cible coach et élève

Référence : [16_COMPLEMENT_COACH_ELEVE.md](../16_COMPLEMENT_COACH_ELEVE.md). État constaté le 17 novembre 2026 sur le code (commits 59d2d76, 1781d95, 36c2337 et arbre de travail), Supabase local et données fictives. À tenir à jour à chaque lot.

Légende : **Fait** (action complète, persistance et effet côté autre rôle vérifiés) · **Partiel** · **Prévu** (spécifié, rien de construit) · **À ajouter** (absent des spécifications d’origine). Type : **I** fonction interne réalisable, **D** dépend d’un fournisseur ou d’un accès, **F** décision du fondateur.

## Matrice

| § | Exigence | État constaté | Écrans, routes, données | Lot | Type |
|---|---|---|---|---|---|
| 2 | Groupes : créer, renommer, réordonner, archiver | Prévu | Tables `teams`, `team_athletes` (SQL de référence, RLS lecture coach) sans écran ni commande | G | I |
| 2 | Appartenance à plusieurs groupes | Prévu | `team_athletes` (clé groupe + athlète) le permet | G | I |
| 2 | Niveau par sport confirmé par le coach, distinct du groupe et de l’objectif | Partiel | Niveau unique déclaré par l’athlète dans `athlete_profiles` (D-021) ; aucune confirmation coach | G | I |
| 2 | Vue d’ensemble des groupes : effectif, retours à traiter, couverture des programmes | À ajouter | — | G | I |
| 2 | Groupe ouvert : recherche, filtres sport / niveau / objectif / statut, contexte conservé au retour | À ajouter | Liste Athlètes X12 minimale sans filtres | G | I |
| 2 | Planning par groupe, base commune puis adaptations, destinataires et exceptions avant publication | À ajouter | Publication par séance et par athlète seulement (`publishBatch`) | G2 | I |
| 3 | Fiche élève : profil sportif, groupes, niveaux, objectifs, échéances | Partiel | X14 `/coach/[wid]/athletes/[aid]` : profil déclaré, invitation ; `goals` sans écran | G | I |
| 3 | Disponibilités, contraintes, matériel, préférences, questionnaire, synthèse d’entretien | Partiel | Disponibilités et objectif texte dans `athlete_profiles` ; reste à ajouter (bilan, lot B) | B | I |
| 3 | Programme actuel, prochaines séances, historique prévu / réalisé, retours | Partiel | Planning semaine X18, retours X10/X11 ; pas d’historique consolidé dans la fiche | G | I |
| 3 | Statistiques sur période, rendez-vous, messages, tâches liés au dossier | Prévu | Messagerie (`conversations`, `messages`) sans écran ; reste à ajouter | H, S | I |
| 3 | Notes privées du coach distinctes | Prévu | Table `coach_notes` (RLS auteur affecté) sans écran | G | I |
| 3 | Source, période, fraîcheur des mesures | À ajouter | Aucune mesure importée à ce jour | X | I/D |
| 4 | Accueil coach priorisé (attention, prochaine action, échéance) | À ajouter | Arrivée actuelle sur Planning | H | I |
| 4 | Tâches humaines : types, statuts, priorité, échéance, créneau, récurrence, lien direct | À ajouter | `review_items` couvre seulement les retours | H | I |
| 4 | Tâches automatiques dédoublonnées, réévaluées, closes à la résolution, règles configurables | Partiel | `review_items` : un cas par retour, rouvert à la correction (D-009) | H | I |
| 4 | Rendez-vous : fuseau, début, durée, lien visio, préparation, compte rendu | À ajouter | — | H | I |
| 5 | Bibliothèque : séances, semaines types, blocs, programmes ; versions, classement, recherche | Prévu | Table `templates` (workout / week) sans écran | B | I |
| 5 | Séance structurée : échauffement, étapes, répétitions, récupération, cibles | **Fait** | Constructeur (D-023) `components/workout-builder.tsx`, `packages/domain/src/structure.ts`, `intervals` jsonb, contrat `workoutBlock` ; lecture coach, revue, athlète | — | I |
| 5 | Cibles relatives au profil de l’élève | Partiel | Zones Z1–Z5, % FTP, % FC max ; seuils propres à l’élève (allure seuil, FTP, FC max) à ajouter | B | I |
| 5 | Import de l’historique du coach avec prévisualisation, unités, doublons | Prévu | Tables `imports`, `import_rows` (SQL) ; formats réels du fondateur à obtenir | B | F |
| 5 | Copie vers brouillon indépendant, versions retraçables | Partiel | Révisions immuables des séances ; copie depuis la bibliothèque à faire | B | I |
| 6 | Bilan structuré : questionnaire en ligne (sauvegarde, reprise, complétude) et entretien | Partiel | Questionnaire d’arrivée (D-021) sans renvoi, reprise ni confirmation coach | B | I |
| 6 | Génération supervisée d’un programme depuis bilan et bibliothèque | Prévu | `coach_dna`, `ai_suggestions`, `jobs` (SQL), docs 08 et 09 ; aucun appel IA | P | I/D |
| 6 | Modifier et régénérer une partie, différences, séances passées protégées | À ajouter | — | P | I |
| 6 | Règles candidates depuis les corrections, essais de qualité, coûts suivis | Prévu | `dna_candidates`, `ai_budget` (SQL) | P | I |
| 7 | Téléphone : séance du jour, consignes, prochaine action | **Fait** | X40, X42 avec déroulé structuré | — | I |
| 7 | Calendrier, historique, objectifs, progression, échanges | Partiel | Programme par semaine X41 ; objectifs, progression, échanges à ajouter | E, S | I |
| 7 | Retour : réalisé, partiel, reporté, non réalisé, ressenti général, difficulté | Partiel | Réalisé / partiel / non réalisé, durée, RPE, commentaire, version observée (C06) ; « reporté », ressenti général et difficulté à ajouter | E | I |
| 7 | Plusieurs activités associées à une séance, correction du rapprochement | À ajouter | `workout_results` unique par séance | X | I |
| 7 | Statistiques élève et coach, provenance, « données insuffisantes » | À ajouter | — | S | I |
| 8 | Activités entrantes Garmin et Strava | Prévu | Strava retiré du chemin critique (D04) ; aucun accès Garmin obtenu | X | D |
| 8 | Import manuel FIT / TCX | À ajouter | — | X | I |
| 8 | Séances sortantes : modèle structuré compatible Garmin | Partiel | Modèle D-023 conçu pour se traduire en étapes FIT (voir correspondance ci-dessous) | X | I |
| 8 | Export FIT de séance, procédure vérifiée | À ajouter | — | X | I, puis essai sur montre (F) |
| 8 | Publication vers Garmin Connect (Training API), mise à jour, annulation | À ajouter | Accès Garmin Connect Developer Program non obtenu | X | D |
| 9 | Navigation : accueil, groupes / élèves, calendrier, bibliothèque, échanges, méthode | Partiel | Planning, Retours, Athlètes, Paramètres, Guide | H | I |
| 9 | Élève : Aujourd’hui, Programme, Progression, Échanges | Partiel | Aujourd’hui, Programme, Profil | E, S | I |
| — | Visite interactive d’Allure sur les vrais écrans (retour du fondateur) | À ajouter | Guide en diapositives actuel (D-021) | C | I |

## Ce qui est déjà acquis et sert la cible

Boucle créer → publier → lire → retour → revue ; versions immuables et version observée ; connexion par mot de passe ; espace, invitation, profil de l’espace ; profil sportif de l’athlète ; séance structurée ; RLS du SQL de référence sur Supabase local ; idempotence ; tests de droits, de contrat et de concurrence.

## Changements de données et d’API à poser dès maintenant

Pour éviter les incompatibilités ultérieures, chaque lot ajoute ses tables par migration additive (aucune suppression), avec RLS lecture coach affecté ou élève concerné et écriture par commandes serveur.

1. **Format de séance (fait, D-023).** `intervals` contient des étapes et des répétitions sur deux niveaux. Correspondance FIT prévue : étape → `workout_step` (`duration_type` time / distance / open, `target_type` heart_rate / power / speed / cadence / open), répétition → étape `repeat_until_steps_cmplt`, zone → `target_*_zone`, allure → vitesse (m/s, conversion explicite), RPE → note de l’étape (pas de cible FIT équivalente).
2. **Groupes (lot G).** Étendre `teams` : `sort_order`, `archived_at`, `description`, `kind` facultatif ; ne jamais réécrire les séances publiées lors d’un changement de groupe.
3. **Niveaux par sport (lot G).** Nouvelle table `athlete_sport_levels` (espace, élève, sport, niveau, source déclarée ou coach, confirmé par, confirmé le). Le niveau déclaré dans `athlete_profiles` devient une proposition.
4. **Tâches et rendez-vous (lot H).** Tables `tasks` (type, élève ou groupe, responsable, échéance, créneau, priorité, statut, estimation, lien d’action, origine manuelle ou règle, clé de dédoublonnage unique tant qu’ouverte, récurrence) et `appointments` (début UTC, fuseau, durée, lien visio, préparation, compte rendu). `review_items` reste la source des retours et alimente une tâche.
5. **Bilans (lot B).** Tables `assessments` (élève, source questionnaire et/ou entretien, statut brouillon / envoyé / en cours / complété / confirmé) et `assessment_answers` versionnées ; `athlete_profiles` devient une projection confirmée.
6. **Programmes (lot P).** Réutiliser `plans` et `plan_blocks` comme programmes et semaines, ajouter `plan_versions` et le lien séance → version de programme ; séances passées ou réalisées verrouillées à la régénération.
7. **Activités et synchronisation (lot X).** Tables `activities` (source manuelle / fichier / garmin / strava, identifiant externe, provenance, droits d’usage), `activity_metrics`, `workout_activity_links` (plusieurs activités par séance, statut proposé / confirmé / rejeté), `sync_states`, `workout_exports` (statut fichier généré / envoyé à Garmin Connect / confirmé sur appareil). Résultat déclaré, mesure importée et prescription restent distincts.
8. **Retours (lot E).** Ajouter l’état `postponed` et les champs ressenti général et difficulté à `workout_results` / `feedbacks` par migration additive.

## Dépendances ouvertes

| Dépendance | Bloque | Action |
|---|---|---|
| Accès Garmin Connect Developer Program (Training et Activity API) | Publication vers Garmin Connect, activités entrantes Garmin | Fondateur : demande d’accès business ; en attendant, export FIT et import de fichiers |
| Montre Garmin disponible pour l’essai | Déclarer le transfert opérationnel | Fondateur : préciser le modèle disponible |
| Formats réels des anciens programmes | Import historique (lot B) | Fondateur : fournir des exemples anonymisés |
| Conditions Strava (affichage tiers, IA) | Toute donnée Strava | Revue juridique avant tout développement (D04) |
| Fournisseur IA et budget | Génération supervisée (lot P) | Décision après bibliothèque et bilan |
| Code Foulée | Visite interactive et composants réutilisables | Fondateur : accès au dépôt ou captures |
