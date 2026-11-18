# Décisions d’exécution

Décisions réversibles prises pendant l’implémentation. Les arbitrages D01 à D12 du README restent la référence. Chaque entrée : date, problème, options, décision, raison, condition de réexamen.

## D-001 · Monorepo npm workspaces · 2026-11-17

- **Problème.** C01-01 demande un monorepo TypeScript. pnpm n’est pas installé sur le poste.
- **Options.** pnpm via corepack, npm workspaces, Turborepo.
- **Décision.** npm workspaces : `apps/web` (Next.js 16, App Router) et `packages/domain` (règles pures, schémas zod). `packages/contracts` n’est pas encore créé : les schémas d’entrée vivent dans `packages/domain` tant que seul le Web les consomme.
- **Raison.** Zéro outil supplémentaire, lockfile unique, suffisant pour deux paquets.
- **Réexamen.** Arrivée d’Expo (S16) : extraire `packages/contracts` et envisager pnpm/Turborepo si les temps de build l’exigent.

## D-002 · Base locale PGlite au lieu de Supabase local · 2026-11-17

- **Problème.** C01-03 prévoit Supabase local. Ni Docker ni Supabase CLI ni psql ne sont installés.
- **Options.** Installer Docker + Supabase CLI (action système, hors dépôt), Postgres Homebrew, PGlite (Postgres 17 en WASM via npm).
- **Décision.** PGlite. `database/001_coachos.sql` est appliqué **sans modification** depuis `supabase/migrations/20261117000000_coachos.sql`. Un shim local (`apps/web/server/db/local-auth-shim.sql`) fournit ce que Supabase apporte avant nos migrations : rôles `anon`, `authenticated`, `service_role`, `auth.users`, `auth.uid()` (même réglage `request.jwt.claim.sub`) et la table `supabase_migrations.schema_migrations`.
- **Raison.** `npm install` suffit, les politiques RLS réelles s’exécutent (vérifié : coach A, athlète affecté et tiers obtiennent des lignes différentes), et le passage à Supabase ne touche que `server/db/client.ts`.
- **Limites.** Une seule connexion par processus (les transactions sont sérialisées) ; un seul processus peut ouvrir `.data/pglite`. Pas de vraie concurrence testée.
- **Réexamen.** Tranche C (Supabase Auth) : installer Supabase CLI, garder PGlite pour les tests unitaires de RLS si utile.

## D-003 · Identité de démonstration jusqu’à la tranche C · 2026-11-17

- **Problème.** Les tranches A et B doivent montrer deux rôles avant l’authentification réelle (tranche C).
- **Décision.** Page `/demo` qui pose un cookie httpOnly avec l’UUID d’une identité fictive. Active seulement si `COACHOS_DEMO_AUTH=1` **et** `NODE_ENV !== 'production'`. Toutes les vérifications de droits passent malgré tout par la base (`private.*`, RLS).
- **Réexamen.** Remplacée par `/login` + Supabase Auth en tranche C ; la route `/api/dev/*` disparaît alors.

## D-004 · Lectures sous RLS, écritures par commandes serveur · 2026-11-17

- **Problème.** Le SQL ne donne aux utilisateurs que `select` ; les écritures sont réservées à `service_role`.
- **Décision.** Les pages lisent dans une transaction `set local role authenticated` avec l’identité posée : la RLS décide. Les commandes écrivent comme propriétaire de la base après vérification explicite `private.assigned` / `private.own_athlete` dans la même transaction (droits réévalués au commit), avec `for update` sur les lignes ciblées.
- **Raison.** Conforme à 07_ARCHITECTURE (« lectures user scoped avec RLS, écriture par commandes atomiques »).

## D-005 · Mutations par `/api/v1`, pas par Server Actions · 2026-11-17

- **Décision.** Les formulaires appellent les routes du contrat OpenAPI (`createWorkout`, `updateWorkout`, `publishBatch`, `saveFeedback`, `markFeedbackReviewed`) avec `Idempotency-Key`. Contrôle d’`Origin` obligatoire sur toute mutation à cookie. Clés stockées 24 h dans `operation_keys`, insérées avant l’effet dans la même transaction.
- **Raison.** Même commande pour le Web et le futur Expo ; idempotence testable.

## D-006 · Version publiée lue par l’athlète · 2026-11-17

- **Problème.** La politique RLS de `workouts` est réservée au coach affecté : l’athlète ne lit pas le pointeur `published_revision`. Il voit les révisions publiées **ou** observées dans un retour (`private.is_published_revision`).
- **Options.** Ajouter une politique athlète sur `workouts` (expose aussi `working_revision`, donc l’existence d’un brouillon), lire par commande serveur, ou dériver.
- **Décision.** Version courante = plus haute révision visible. Le pointeur de publication n’avance jamais vers une version plus ancienne et une révision observée est toujours une ancienne publiée.
- **Réexamen.** Si l’annulation ou un retour en arrière de publication est introduit, remplacer par une vue ou fonction `security definer` dédiée à la projection athlète.

## D-007 · Écarts du contrat OpenAPI · 2026-11-17

- **Constat.** `contracts/openapi.json` borne de nombreux entiers à `maximum: 10` (durationSeconds, distanceM, revisions, sortOrder) et `rpe.minimum: 1`, `title.maxLength: 2000`, `sortOrder.minimum: 1`. Cela contredit le PRD (RPE 0 à 10, C06-04) et le SQL (durée ≤ 86400, titre ≤ 120, sort_order ≥ 0, commentaire ≤ 1000). Il s’agit visiblement d’un défaut de génération.
- **Décision.** L’implémentation suit le PRD pour le comportement et le SQL pour les bornes (`packages/domain/src/workout.ts`, `feedback.ts`). Le corps d’erreur respecte `errorBody` (pas de propriété supplémentaire).
- **Résolu le 2026-11-17.** 51 bornes corrigées dans `contracts/openapi.json` : versions et révisions ≥ 1 sans maximum, durée 1–86400 s, distance 1–1 000 000 m, RPE 0–10, ordre 0–10, rang 0–3, répétitions 1–100, décalage de modèle 0–365 j, pourcentage 1–100, compteurs ≥ 0, quota d’athlètes ≥ 1 ; titre de séance 120, consignes 5000, commentaire de retour 1000. Les chaînes génériques 1–2000 restent permissives. `apps/web/server/contract.test.ts` valide les réponses réelles et les erreurs contre le contrat.

## D-008 · Ouverture du retour · 2026-11-17

- **Décision.** Retour possible sur une séance publiée, non annulée, dont la date locale est ≤ aujourd’hui dans le fuseau de l’athlète (comme le prototype). Retour sur un brouillon : 404. Séance future : 403 avec message.
- **Réexamen.** Si les athlètes veulent déclarer la veille au soir une séance faite en avance.

## D-009 · Correction d’un retour · 2026-11-17

- **Décision.** Un retour par séance (contrainte SQL). Une correction exige `expectedRevision` (sinon 409, cas des deux appareils), incrémente la révision, enregistre comme version observée la version publiée **au moment de la correction**, remet `reviewed_at` à null et rouvre le cas. `markFeedbackReviewed` exige la révision du retour : le coach ne peut pas clore une version qu’il n’a pas vue.
- **Raison.** Une correction est une nouvelle déclaration que le coach doit relire. C06-08 reste vrai : une republication seule ne touche pas la version observée.

## D-010 · Acteur de la revue · 2026-11-17

- **Décision.** `feedbacks` ne porte que `reviewed_at` ; l’acteur est dans `audit_logs` (`feedback.reviewed`, sans texte libre). Une seconde demande renvoie la date initiale sans nouvel audit.

## D-011 · Pages plutôt que boîtes de dialogue · 2026-11-17

- **Problème.** Le prototype ouvre création, détail et retour en modales.
- **Décision.** Pages dédiées (`…/workouts/new`, `…/workouts/[sid]`, `…/review/[rid]`, `…/workouts/[sid]/feedback`). Le lien retour reconstruit le contexte (athlète + semaine) depuis la donnée, la file propose « Retour suivant ».
- **Raison.** Liens profonds (notifications futures), meilleur comportement sur téléphone, focus simple, pas de perte d’état au rechargement.
- **Réexamen.** Après observation : si l’aller-retour pèse sur les 90 s de publication, ouvrir la création en panneau latéral sur desktop.

## D-012 · Données fictives et environnement · 2026-11-17

- **Décision.** Jeu de données relatif à la date du jour (Europe/Brussels) : deux espaces, coach A (Marine) avec Camille, Noah et Inès (invitée), coach B (Hugo) avec Léa. Rang 1 pour les cas de retour. Durée saisie en minutes, stockée en secondes.
- **Dépendances.** Versions épinglées. zod relevé en 4.6.7 (avis de sécurité élevé sur la validation). Avis esbuild faible restant (serveur de dev sous Windows, via tsx/vite) accepté.
- **Git.** Dépôt initialisé localement (`main`), aucun commit ni remote à ce stade.

## D-013 · Supabase local installé à côté de PGlite · 2026-11-17

- **Contexte.** Docker Desktop 29.9.3 installé par le fondateur ; Supabase CLI 3.2.0 ajouté en dépendance de développement (`npx supabase`, sans Homebrew).
- **Décision.** `supabase/config.toml` initialisé (project_id `coachos`, seed SQL désactivé : le jeu fictif reste en TypeScript). `npm run supabase:start` lance seulement base, Auth, API et Mailpit (e-mails locaux) ; studio, storage, realtime, edge et analytics sont exclus pour l’instant. Les scripts ajoutent `~/.docker/bin` au PATH car le CLI Docker n’est pas dans le PATH par défaut.
- **Preuve.** La migration `20261117000000_coachos.sql` s’applique sans erreur sur PostgreSQL 17 Supabase : 44 tables publiques, 0 sans RLS, 27 politiques, 7 fonctions `private`.
- **Suite.** L’application tourne encore sur PGlite. La bascule vers Supabase se fait avec l’authentification réelle (tranche C) ; PGlite reste pour les tests rapides.

## D-014 · Deux moteurs derrière une interface unique · 2026-11-17

- **Problème.** Garder les tests rapides sans Docker tout en faisant tourner l’application sur le vrai PostgreSQL de Supabase.
- **Décision.** `server/db/driver.ts` définit `Db`/`Tx` (query, exec, transaction). PGlite la satisfait directement ; `postgresDb()` l’implémente avec `pg` (une transaction = une connexion du pool, `set local role authenticated` et `request.jwt.claim.sub` comme sur Supabase). `DATABASE_URL` défini → PostgreSQL ; sinon PGlite. `npm run test:pg` rejoue la suite boucle/droits sur Supabase et recharge ensuite le jeu fictif.
- **Réexamen.** Passage à un hébergement Supabase distant (staging) : vérifier le pooler (mode transaction) et les réglages locaux de session.

## D-015 · Connexion par lien magique Supabase · 2026-11-17

> **Remplacée par D-020** (instruction du fondateur, 2026-11-17). Le rappel `/auth/callback`, le proxy de session, `safeNext` et la création de profil à la première connexion restent en vigueur.

- **Décision.** `/login` (X02) envoie un lien via `signInWithOtp` (flux PKCE de `@supabase/ssr`), `/auth/callback` (X03) échange le code puis redirige vers `next` filtré par `safeNext` (C02-09). Message de succès neutre (C02-06). `proxy.ts` rafraîchit la session et transmet le chemin demandé ; `requireActor()` renvoie vers `/login?next=…`. Première connexion : profil `public.users` créé sans doublon (`on conflict do nothing`). Déconnexion par POST same-origin.
- **Configuration locale.** `site_url` et redirections autorisées sur `localhost:3000`, limite d’e-mails relevée à 60/h, modèle d’e-mail en français (`supabase/templates/magic_link.html`). Comptes fictifs créés par l’API d’administration avec des UUID fixes (`npm run supabase:seed`).
- **Identité de démo.** Conservée en développement comme raccourci (D-003). Une session Supabase est toujours prioritaire.
- **Réexamen.** Avant tout environnement partagé : désactiver `COACHOS_DEMO_AUTH`, décider `shouldCreateUser` (inscription libre ou sur invitation) et choisir le fournisseur d’e-mails (Resend).

## D-016 · Invitation par lien à usage unique · 2026-11-17

- **Décision.** Jeton aléatoire de 32 octets ; seule son empreinte SHA-256 est stockée (`secret_hash`). L’adresse n’est stockée que sous forme d’HMAC-SHA256 (`email_hmac`, clé `COACHOS_INVITE_HMAC_KEY`, valeur de développement par défaut hors production). Le lien porte le jeton **après `#`** : il n’atteint ni le serveur ni ses journaux dans l’URL ; la page `/invite` le garde dans le navigateur le temps de la connexion par lien puis l’efface. Réémettre révoque le lien actif. Validité 7 jours (PRD).
- **Acceptation.** L’adresse vérifiée du compte connecté doit correspondre à l’HMAC ; un compte déjà relié à un dossier de l’espace est refusé ; rechargement après acceptation renvoyé comme succès sans doublon. Messages neutres : jamais l’adresse attendue.
- **Envoi.** E-mail envoyé dans la transaction : un échec d’envoi annule l’invitation et la même clé peut être rejouée. En local, API d’envoi de Mailpit ; en production, refus explicite tant que Resend n’est pas branché. `invitation_delivery` (enveloppe chiffrée pour un envoi différé) n’est pas utilisée.
- **Non fait.** Aperçu du nom d’espace avant connexion (pas de route au contrat), quota d’activation (facturation après G2).
- **Réexamen.** Arrivée d’un worker d’envoi (S23) : passer par `invitation_delivery` et sortir l’appel fournisseur de la transaction.

## D-017 · Inscription coach libre en local · 2026-11-17

- **Décision.** `shouldCreateUser: true` : toute adresse qui reçoit un lien crée un compte ; sans espace ni invitation, le compte arrive sur « Aucun espace » avec « Créer un espace coach » (X04). Le propriétaire seul crée des fiches athlètes.
- **Réexamen.** Avant le pilote : inscription libre ou sur liste d’accès, limite de création d’espaces par compte.

## D-018 · Nom de compte et nom de dossier · 2026-11-17

- **Problème.** Deux noms coexistent : `users.display_name` (le compte, réglé par la personne) et `athletes.display_name` (le dossier, choisi par le coach). Le premier libellé laissait croire que le coach voyait le nom réglé par l’athlète.
- **Décision.** Le coach voit et garde le nom de dossier ; l’athlète règle son nom de compte, affiché dans sa barre du haut. Les libellés le disent. Le fuseau de la relation se règle par `PATCH /athlete-settings` sans redater les séances existantes. Le choix du sport prévu par C03-09 attend une colonne dédiée (écart de schéma noté).
- **Réexamen.** Arrivée de la messagerie (S08) : choisir quel nom s’affiche dans le fil de chaque côté.

## D-019 · Tests sur PostgreSQL séquentiels · 2026-11-17

- **Décision.** `npm run test:pg` exécute boucle/droits et concurrence l’un après l’autre (`--no-file-parallelism`) : les deux rechargent le même jeu fictif.
- **Incident du 2026-11-17.** Un lancement de `test:pg` a effacé les données de recette du fondateur (espace « Paul Endurance », dossier d’Emma, séance et retour ; les comptes Paul et Emma ont survécu). Cause : le premier garde-fou bloquait la préparation, mais le nettoyage final (`afterAll`) s’exécutait quand même.
- **Correction.** `assertOnlyFixtureUsers` refuse toute base contenant un utilisateur hors jeu fictif (sauf `COACHOS_TEST_PG_FORCE=1`) et le nettoyage final ne s’exécute que si la préparation a été acceptée. Preuve : avec un utilisateur témoin présent, les deux fichiers refusent et le témoin reste en base.
- **Réexamen.** Isoler les tests PostgreSQL dans une base dédiée (second projet Supabase local ou base clonée) pour ne plus jamais partager la base de démonstration.

## D-020 · ADR · Connexion par adresse et mot de passe · 2026-11-17

- **Contexte.** Instruction du fondateur : coach et athlète se connectent avec un compte et un mot de passe, sans lien de connexion. Changement de portée d’authentification (docs/12 : ADR obligatoire).
- **Options étudiées.** (1) Garder le lien magique ; (2) mot de passe seul ; (3) mot de passe avec confirmation d’adresse par e-mail à l’inscription. 
- **Décision.** Option 2, avec deux garde-fous :
  - **Coach** : `/signup` (nom, adresse, mot de passe) → session immédiate → création d’espace. L’adresse n’est pas confirmée en local (`enable_confirmations = false`).
  - **Athlète** : le compte se crée sur `/invite` (« Créer mon compte et rejoindre »). Le serveur vérifie d’abord, sans effet de bord, que le lien est valable **et** que l’adresse saisie correspond à l’HMAC de l’invitation ; il crée alors le compte avec l’adresse marquée vérifiée (le lien a été reçu à cette adresse), ouvre la session puis accepte l’invitation. Mauvaise adresse, lien expiré, révoqué ou consommé : aucun compte créé. Adresse déjà inscrite : « J’ai déjà un compte » (connexion puis acceptation).
  - **Mot de passe oublié** : seul e-mail restant (`resetPasswordForEmail`, modèle français), réponse identique pour une adresse connue ou inconnue (C02-06), nouveau mot de passe sur `/reset-password`.
  - Politique : 8 à 72 caractères, sans règle de composition ; message d’échec de connexion unique ; limites de tentatives de Supabase Auth (30 / 5 min / IP).
- **Coûts et risques.** Mots de passe faibles ou réutilisés ; adresse coach non vérifiée (faute de frappe, adresse d’autrui) ; l’inscription révèle qu’une adresse a déjà un compte (« Un compte existe déjà ») ; route `/auth/invite-register` hors contrat OpenAPI (l’inscription relève de Supabase Auth, la réponse reprend `acceptInvitation`).
- **Preuve d’acceptation.** `register.test.ts` (4 cas sans création de compte sur refus) ; parcours navigateur sur Supabase local : inscription coach → espace → invitation → mauvaise adresse refusée (0 compte créé, vérifié en base) → compte athlète créé et espace rejoint → mauvais mot de passe refusé → connexion → mot de passe oublié → nouveau mot de passe.
- **Réexamen.** Avant toute donnée réelle : confirmation d’adresse coach (option 3) ou vérification au premier envoi d’invitation, protection contre les mots de passe divulgués (Supabase hébergé), MFA éventuelle pour les coachs, fournisseur d’e-mails pour la réinitialisation.

## D-021 · Guide d’introduction et profil sportif de l’athlète · 2026-11-17

- **Contexte.** Retour du fondateur après recette : parcours jugé fluide, mais il manque une présentation avec un petit avatar, et l’athlète arrive directement sur sa séance sans présentation ni questionnaire de profil.
- **Décision.**
  - Avatar original « Allure » (SVG, couleurs du design system, clair et sombre) et guide en cinq étapes, sous forme de page (pas de surcouche) : fonctionne au clavier, sur téléphone, avec aperçus des vrais écrans. Athlète : après l’invitation (`/athlete/[wid]/welcome?first=1`), puis depuis Profil. Coach : après la création d’espace (`/coach/[wid]/welcome?first=1`), puis depuis le menu « Guide ».
  - Questionnaire athlète en trois étapes (Toi, Ta pratique, Tes objectifs) : sport, niveau, ancienneté, séances et volume hebdomadaires, objectif, prochaine course, jours disponibles. Puis une page unique dans l’onglet Profil. Visible par le coach affecté dans le dossier.
  - Nouvelle table `athlete_profiles` (migration `20261118000000`), une ligne par relation, RLS lecture coach affecté ou athlète ; écriture par commande serveur `PUT /workspaces/{wid}/athlete-profile` (ajoutée au contrat OpenAPI avec le schéma `athleteProfile`).
- **Limite assumée.** Aucune donnée de santé (blessure, antécédent, poids) : règle D11 et architecture. Le schéma refuse toute propriété inconnue.
- **Bugs trouvés en vérification et corrigés.** Le bouton « Suivant » de l’étape 2 envoyait le formulaire (bouton réutilisé en bouton d’envoi pendant le clic) ; la touche Entrée envoyait aussi avant la fin. Message de réponse manquante affiché trop haut sur téléphone ; espacements et espaces insécables.
- **Réexamen.** Après observation : longueur du questionnaire, nom et style de l’avatar (choix réversibles), passage éventuel des objectifs déclarés vers la table `goals` gérée par le coach.

## D-022 · Personnalisation de l’espace coach · 2026-11-17

- **Contexte.** Demande du fondateur : pouvoir personnaliser l’espace coach avec plus de détails dès sa création. Choix du fondateur : présentation, spécialités, identité visuelle et infos pratiques.
- **Décision.**
  - Création en deux temps : l’essentiel (nom du coach, nom de l’espace, fuseau), puis un assistant de quatre étapes facultatives (`/coach/[wid]/settings?first=1`), puis le guide coach. Tout reste modifiable dans le nouveau menu **Paramètres** (X32), y compris le nom de l’espace.
  - Données : table `workspace_profiles` (migration `20261118010000`) avec listes fermées (sports, publics, objectifs, langues), liens https uniquement, e-mail de contact facultatif ; RLS lecture par les coachs et athlètes de l’espace ; écriture `PUT /workspaces/{wid}/profile` réservée au propriétaire.
  - Logo ou photo : PNG, JPEG ou WebP, 512 Kio au plus, type vérifié par signature binaire (SVG refusé : risque de script), stocké en base (`workspace_logos`) et servi par `/media/workspaces/{wid}/logo` avec `nosniff` et une CSP stricte. Lien public par identifiant d’espace : l’image est destinée à être montrée.
  - Couleur d’espace : six palettes fixes (pas de couleur libre), contraste calculé ≥ 5,68:1 en clair et en sombre ; appliquée aux écrans du coach et de ses athlètes.
  - Visible par les athlètes : écran « Ton coach », logo et nom en haut de leurs écrans, première étape du guide ; par une personne invitée : aperçu sur `/invite` via `POST /invitations/preview` (jeton valable requis, aucune donnée d’athlète) ; e-mail d’invitation au nom du coach avec l’accroche.
- **Contrat.** Ajout de `saveWorkspaceProfile`, `setWorkspaceLogo`, `deleteWorkspaceLogo`, `previewInvitation` et des schémas `workspaceProfile`, `workspacePublic`.
- **Limites.** Pas de limitation de débit sur l’aperçu d’invitation (à couvrir avec la limitation générale de l’API) ; logo en base plutôt que dans Supabase Storage.
- **Réexamen.** Avant hébergement : logo vers Supabase Storage ou un CDN avec redimensionnement ; limitation de débit ; page publique du coach (X52, V3) seulement sur décision.

## D-023 · Séance structurée par blocs · 2026-11-17

- **Contexte.** Retour du fondateur : la création de séance (titre, durée, consignes) est trop limitée ; il faut pouvoir écrire chaque bloc avec durée ou distance, zone, répétitions, pour tous les types de séances.
- **Décision.** `workout_revisions.intervals` (jsonb, sans migration) porte une suite de blocs : étape (phase échauffement / effort / récupération / retour au calme / repos / autre ; mesure durée, distance ou libre ; intensité sans cible, zone Z1–Z5, allure /km ou /100 m, puissance W ou % FTP, FC bpm ou % FC max, effort 1–10 ; cadence et note facultatives ; sport par étape pour les enchaînements) ou répétition (2 à 50 fois), imbricable sur un niveau pour les séries ; 30 blocs et 80 étapes au plus. Modèles rapides par sport, totaux calculés (« ≈ » si estimé par l’allure, « au moins » si une partie dépend de l’athlète) ; le serveur déduit durée et distance des blocs si elles ne sont pas saisies. Contrat : `workoutBlock`, `workoutStep`, `measure`, `intensity` remplacent `interval`.
- **Pourquoi ce format.** Il se traduit en étapes de séance FIT (voir COUVERTURE.md) pour l’export et la Training API Garmin (lot X), sans réécriture.
- **Limites.** Cibles relatives aux seuils de l’élève (allure seuil, FTP, FC max) à ajouter (CE-B-03) ; le cadre « Durée » de la fiche athlète affiche la durée sans préciser « au moins ».
- **Réexamen.** Premier export FIT décodé et essai sur montre (CE-X-01, CE-X-06).

## D-024 · Complément produit coach et élève prioritaire · 2026-11-17

- **Contexte.** Instruction du fondateur ([16_COMPLEMENT_COACH_ELEVE.md](../16_COMPLEMENT_COACH_ELEVE.md)) : cible d’une application complète pour le coach et ses élèves (groupes et niveaux, dossier, accueil et tâches, bibliothèque, bilan, programmes supervisés, statistiques, activités et Garmin).
- **Décision.** Le complément prévaut sur l’ordre des sprints 07 à 30 lorsqu’ils divergent. Ordre des lots : C (fin), G, H, S, B, E, G2, P, X ; l’export FIT (X1) peut avancer en parallèle. Stories `CE-*`, matrice de couverture tenue à jour, CLAUDE.md impose sa relecture. Les contraintes de sécurité (RLS, droits contrôlés au serveur, publication explicite), l’exclusion des données Strava de l’IA et le report du chantier commercial restent en vigueur.
- **Réexamen.** À chaque recette du fondateur ou réponse d’un fournisseur (Garmin, Strava).

## D-025 · Retour enrichi sans donnée de santé · 2026-11-17

- **Contexte.** Le complément (§7) demande les états réalisé, partiel, reporté, non réalisé, un ressenti général et une difficulté particulière.
- **Décision.** Migration additive `20261118020000` : état `postponed`, `feedbacks.overall_feeling` (1 à 5) et `feedbacks.difficulties` (catégories fermées : fatigue, météo, terrain, matériel, temps, motivation, autre). Pas de champ libre « difficulté » : une saisie libre attirerait des informations de santé (D11). Un report, comme une séance manquée, ne porte ni durée ni distance. Contrat `feedback` mis à jour.
- **Réexamen.** Décision de traitement des données de santé (jalon propre) ; rapprochement avec les activités importées (lot X).

## D-026 · Garmin différé, essai sur Fenix 8, base de chaque coach · 2026-11-17

- **Contexte.** Réponses du fondateur : pas encore d’entreprise constituée pour demander l’accès professionnel Garmin ; montre disponible Garmin Fenix 8 ; les anciens programmes ne sont pas seulement les siens : chaque coach qui s’inscrit doit pouvoir apporter sa base de coaching pour que l’assistant crée des programmes « comme lui », en plus d’une base proposée par l’application.
- **Décision.**
  - Accès Garmin Connect Developer Program (Training et Activity API) reporté jusqu’à la constitution de l’entreprise (CE-X-04, CE-X-05 en attente). L’export de séance en fichier FIT (CE-X-01) n’en dépend pas et reste prioritaire du lot X ; l’essai réel (CE-X-06) se fera sur la Fenix 8 du fondateur, procédure de transfert à vérifier sur l’appareil avant toute promesse.
  - L’import de l’historique devient une fonction pour tout coach (CE-B-06 élargie, CE-B-07) : formats courants, prévisualisation, correction des unités, doublons, retrait des données personnelles d’élèves avant usage, contenu rattaché à l’espace du coach et jamais partagé avec un autre coach.
  - « Entraîner l’IA comme le coach » se fait d’abord sans réentraîner de modèle : recherche dans la bibliothèque du coach des exemples pertinents, règles Coach DNA versionnées qu’il valide, et comparaison avec ses corrections (D07, docs 08 et 09). Un modèle propre à chaque coach ne sera étudié que si les essais de qualité montrent un gain mesurable pour un coût acceptable.
  - Une bibliothèque CoachOS commune (CE-B-08) complète celle du coach, avec une provenance distincte ; l’usage éventuel des programmes du fondateur pour l’alimenter demande son accord explicite.
- **Réexamen.** Constitution de l’entreprise (demande Garmin) ; premiers imports réels (formats à prendre en charge) ; essais de qualité de la génération (lot P).

## D-027 · Reprise de Foulée par les idées, pas par le code · 2026-11-17

- **Contexte.** Le fondateur transmet le dossier de Foulée et dix captures : garder ce qui fonctionne et l’améliorer, sans copier, vers une suite complète de gestion du coaching.
- **Décision.** Audit dans [AUDIT_FOULEE.md](AUDIT_FOULEE.md). Reprise des comportements éprouvés (visite guidée par la mascotte, notation texte, graphique de séance, retour rapide comparé à l’intention, séance faite autrement, propositions de semaine avec différences, suivi en petites cases, faisabilité, questionnaire une question par écran) sous forme de stories CE ; aucun code ni donnée de Foulée importé (code non transmis ; données de production d’élèves réels exclues). Les choix d’architecture de CoachOS (espaces, affectations, révisions immuables, contrat d’API, invitations à usage unique) priment sur ceux de Foulée.
- **En attente du fondateur.** Données de santé (écart principal avec Foulée), droit d’usage de la bibliothèque et de la méthodologie Foulée, accès au dépôt pour porter les modules purs avec leurs tests.
- **Réexamen.** Accès au dépôt `foul-e` ; décision santé.

## D-028 · Visite interactive d’Allure sur les vrais écrans · 2026-11-18

- **Contexte.** Retour du fondateur : l’avatar doit « montrer » clairement chaque fonctionnalité, comme un bonhomme interactif (modèle Foulée, D-027). Le guide en diapositives de D-021 décrivait les écrans sans les montrer.
- **Décision.** Visites déclaratives (`apps/web/components/tours.ts`) jouées par `tour-host.tsx` sur les vrais écrans : voile et projecteur sur l’élément marqué `data-tour`, bulle d’Allure avec texte tapé, barre « Passer · Voix · points · Précédent / Suivant ». Trois visites : élève, coach avec élèves, coach sans élève (choisie si « + Ajouter un athlète » est présent). Étapes « action » qui avancent quand on touche l’élément (ouvrir la séance, « + Ajouter », « + Ajouter un athlète ») et suivent la navigation ; étapes facultatives sautées dans le sens du déplacement quand l’élément manque (jour de repos, séance sans blocs, texte adapté) ; panneau masqué pendant l’attente d’une page. Démarrage par `?tour=start` après l’accueil (élève) ou l’assistant (coach), relance par le bouton flottant d’Allure ou « Visite guidée ». État de progression gardé dans le navigateur (`localStorage`, commodité sans donnée métier). Voix française facultative (synthèse du navigateur), mouvement réduit respecté, Échap pour quitter. Diapositives `intro-tour.tsx` supprimées.
- **Non retenu.** Aperçu de la visite élève côté coach (Foulée) : utile plus tard, quand le coach personnalisera le message d’accueil (lot S).
- **Réexamen.** Recette du fondateur sur téléphone réel ; ajout d’étapes à chaque nouvel écran des lots G et H.

## D-029 · Sept zones, VMA de l’élève et kilomètres estimés · 2026-11-18

- **Contexte.** Le fondateur demande 7 zones et non 5, et le nombre de kilomètres estimé « selon les zones ou les allures données » en plus du temps. Son échelle à 7 zones existe dans Foulée (choix du 11 novembre, plages cibles du 13 novembre).
- **Décision.** Échelle de référence à 7 zones : Z1 récupération, Z2 endurance fondamentale, Z3 tempo, Z4 seuil, Z5 VMA longue, Z6 VMA moyenne, Z7 VMA courte ; plages cibles en % de VMA 60-65, 65-70, 72-78, 85-90, 90-95, 95-100, 100-110 (`ZONE_TARGET_PCT`). Schéma et contrat : zone de 1 à 7 ; les séances existantes en Z1-Z5 restent valides et gardent leur sens (Z1 à Z4 identiques, ancienne « Z5 VMA » = VMA longue). Modèles rapides ajustés (400 m en Z6, 300 m en Z7, 1000 m en Z5).
- **Repères de l’élève (première brique de CE-B-03).** Table `athlete_references` (migration `20261118030000`, additive) : VMA en km/h, fixée par le coach affecté (`PUT /workspaces/{wid}/athletes/{aid}/references`, idempotent, audité), lue par l’athlète et le coach sous RLS. Saisie dans la fiche élève avec le tableau des 7 allures.
- **Estimation.** Vitesse d’une étape = allure donnée, ou milieu de la plage de la zone × VMA (course et trail seulement). Durée estimée des blocs en distance, distance estimée des blocs en durée, repos sans cible compté à 0 m ; « environ » ou « au moins » selon ce qui reste inconnu. L’estimation sert à l’affichage (constructeur, lecture coach et athlète, revue) ; la durée et la distance enregistrées avec la révision restent celles de la prescription.
- **Non retenu pour l’instant.** Affichage simplifié en 5 zones pour les débutants (Foulée) ; seuils vélo (FTP), natation (CSS), FC : même table, par migration additive (CE-B-03).
- **Réexamen.** Retour du fondateur sur les noms de zones et les plages ; besoin d’autres sports.

## D-030 · Constructeur par glisser-déposer et guide « CoachOS » en personnage · 2026-11-18

- **Contexte.** Retours du fondateur : flèches inutiles, préférer glisser ; blocs et répétitions peu séparés ; numéro écrit deux fois ; avatar « moche et pas compréhensible », à rapprocher de Foulée ; « pas Allure mais CoachOS ».
- **Décision.**
  - Constructeur : poignée par bloc (glisser à la souris ou au doigt, y compris entrer dans une répétition ou en sortir ; flèches haut et bas au clavier, annonce pour lecteur d’écran) ; menu « ⋯ » avec Monter, Descendre, Sortir de la répétition (alternative sans glisser, WCAG 2.5.7) ; déplacements refusés s’ils cassent le schéma (série dans une série, répétition vide). Étapes en cartes bordées de la couleur de zone, répétitions dans un cadre teinté avec en-tête « ↻ Répéter n fois » et contenu en retrait, séries imbriquées en pointillé ; un seul numéro (1, 2.1, 2.1.1). Sous chaque étape : zone en clair, allure cible et estimation.
  - Lecture de séance : une carte par étape, séparateurs écrits dans le texte (lisible même sans feuille de style), allure et estimation en seconde ligne ; durée et distance prescrites masquées quand le déroulé les donne.
  - Guide : il s’appelle « guide CoachOS » (plus « Allure »). Personnage original en pied, aux couleurs de l’espace, qui fait signe, montre l’élément éclairé vers le haut ou vers le bas, cligne et parle pendant l’écriture ; animations coupées si le mouvement est réduit. Quand l’étape est sur une autre page : « La suite de la visite se passe sur la page « Planning ». Je t’y emmène ? » avec « Y aller » ou « Passer cette étape ».
- **Constat.** Les captures du fondateur montraient des pages sans leur feuille de style (onglet ouvert avant les changements) : un rechargement complet (Cmd + R) suffit ; la feuille servie est valide (analyse lightningcss, 0 avertissement).

## D-031 · Retour « séance faite autrement », vue mensuelle, retours de recette du 18 novembre · 2026-11-18

- **Contexte.** Recette du fondateur : « 20 min 01 » inexpliqué ; allure de l’élève attendue derrière la zone ; plus de détail quand la séance n’est pas exacte, et synchronisation Strava et Garmin ; vue mensuelle, données d’entraînement, état de l’objectif, avancement du programme, messagerie ; planning du coach avec ses tâches par élève ; élèves classés par groupe, niveau ou urgence.
- **Fait.**
  - « 20 min 01 » : un champ minutes vidé réinjectait 1 seconde ; la saisie garde désormais le texte tapé. Les secondes s’écrivent « 1 min 30 s ». Les séances déjà enregistrées avec 1 s parasite gardent leur valeur (à corriger en modifiant la séance).
  - Allure propre à l’élève juste derrière la zone (« Z2 (endurance fondamentale) · 6:09 à 5:43 /km »), dès que sa VMA est renseignée (D-029).
  - CE-E-05 (première version) : pour une séance partielle ou réalisée autrement, ce qui a changé (catégories fermées, non médicales), sport réellement pratiqué, répétitions faites par série principale, distance réalisée ; allure moyenne calculée dans la revue coach. Migration additive `20261118040000` appliquée à Supabase local. Non réalisée ou reportée : rien à décrire (refusé).
  - CE-E-01 (part) : Programme élève par semaine ou par mois (grille du lundi au dimanche, ✓ retour envoyé, total et retours par semaine).
- **Rattaché à la roadmap, non commencé.** Synchronisation : import manuel FIT/TCX (CE-X-02) et rapprochement (CE-X-03) faisables sans accès externe ; Strava après l’examen écrit D04 (CE-X-07) et l’inscription d’une application Strava par le fondateur ; Garmin différé (D-026, CE-X-04/05). Messagerie : CE-H-07 et CE-E-02. Objectif et avancement : CE-G-08, CE-E-01, CE-E-03, lot P. Données d’entraînement : lot S (CE-S-01 à 04). Planning du coach et tâches par élève : lot H (CE-H-01 à 03, 05). Élèves par groupe, niveau ou urgence : lot G (CE-G-01 à 06) et CE-H-01.
- **Ordre proposé.** G puis H (ce que demande l’écran 4, et l’ordre de la roadmap), puis messagerie (H-07, E-02), S, puis X sans accès externe.

## D-032 · Lots G et H : groupes, fiche élève, Planning du coach, tâches et rendez-vous · 2026-11-19

- **Contexte.** Recette du fondateur : « dans l’onglet planning il faut que ça soit le planning du coach, qu’il puisse gérer son calendrier, ses tâches en attente pour chaque élève ; dans l’onglet athlètes, chaque élève classé en groupe, par niveau ou par urgence ». Accord pour lancer les lots G et H.
- **Navigation.** « Planning » devient le planning du coach et sa page d’arrivée (tâches classées et agenda de la semaine). L’ancien planning par élève devient « Séances ». « Athlètes » devient « Élèves ». Sur téléphone, la barre défile horizontalement.
- **Lot G.** Groupes ordonnés et archivables (`teams.sort_order`, `archived_at`, nom unique sans tenir compte des majuscules), gérés par le propriétaire (contrat : rôle O ; `createTeam` passe de V2 au MVP). Appartenances multiples gérées par le coach affecté. Niveau par sport confirmé par le coach (`athlete_sport_levels`, auteur et date) ; le niveau déclaré reste une proposition. Objectifs (`goals`, visibles par l’élève) et notes privées (`coach_notes`, RLS auteur affecté) avec les opérations déjà prévues au contrat. Page Élèves : vue d’ensemble des groupes (effectif, retours à traiter, élèves sans séance sur 7 jours), regroupement par groupe, niveau, urgence ou liste, recherche et filtres conservés au retour depuis la fiche (paramètre `from` limité à l’espace). Fiche élève centrale.
- **Lot H.** Tâches humaines (`coach_tasks`) : 7 types, 6 statuts avec transitions vérifiées, priorité 0 à 3, échéance, lien interne, notes, révision attendue (409). Suivis automatiques **calculés depuis l’état réel** plutôt que stockés : retour à examiner, aucune séance publiée sur 7 jours, invitation en attente, profil à remplir, niveau à confirmer, VMA à renseigner. Ils sont uniques par règle et objet et se ferment seuls quand la situation est réglée ; seul le report est stocké (`auto_task_states`). Rendez-vous (`appointments`) : visio, appel ou rencontre, saisis à l’heure locale du fuseau de l’élève (`localToUtc`, heure d’été prise en compte), préparation et compte rendu réservés au coach (RLS coach affecté). Classement explicable : échéance (en retard d’abord), priorité, date, titre. Urgence d’un élève : priorité + 1 par suivi ouvert, + 2 par élément en retard ; « Urgent » à 6 points.
- **Non fait (suite).** Créneau de travail, estimation et récurrence des tâches (CE-H-06) ; délais de relance réglables (CE-H-04) ; messagerie et tâche de réponse (CE-H-07, CE-E-02) ; planning par groupe et base commune (lot G2) ; filtre par objectif ; rendez-vous visibles par l’élève.
- **Réexamen.** Retour du fondateur sur le seuil d’urgence et l’ordre du Planning ; arrivée de la messagerie.

## D-033 · Messagerie coach élève, fils de groupe et vocaux · 2026-11-19

- **Contexte.** Suite de la roadmap (CE-H-07, CE-E-02, CE-H-08, CE-H-09) et demandes du fondateur : « une zone de message avec le coach », « possibilité d’envoyer des vocaux », « faire des groupes d’élèves » (compris comme des discussions de groupe ; les groupes eux-mêmes existent depuis D-032).
- **Décision.**
  - Fil privé unique par élève (tables du schéma de référence `conversations`, `messages`, `read_receipts`) : coach affecté ou élève lui-même, contrôlé en base et dans chaque commande. Opérations déjà prévues au contrat (`openConversation`, `sendMessage`, `saveReceipt`).
  - Fil par groupe (`team_messages`, `team_reads`, migration additive `20261119000000`) : coach de l’espace et élèves membres actifs (`private.team_member`) ; un élève voit le nom des groupes dont il est membre, jamais la liste des membres ; les messages portent le nom de l’auteur au moment de l’envoi. Un élève retiré du groupe perd l’accès au fil et à ses vocaux. Avertissement affiché : ce fil est lu par tout le groupe.
  - Vocaux de 3 minutes et 3 Mio au plus, enregistrés dans le navigateur (WebM/Opus, MP4 sur Safari, Ogg), format vérifié sur les premiers octets ; octets dans `voice_clips` (aucune lecture directe par le client) ; écoute par `/media/workspaces/{wid}/voice/{vid}` après session et contrôle du message porteur, sans cache partagé. Réécoute avant envoi.
  - Suivi automatique « Répondre au message » (règle `message_reply`) quand le dernier message d’un fil vient de l’élève (ou d’un membre pour un groupe) ; il se ferme à la réponse du coach.
  - Réponses rapides sous un retour (« Bravo ! 👏 »…), envoyées seulement sur le geste du coach (CLAUDE.md : tout envoi reste explicite).
  - Navigation : « Messages » chez le coach, « Échanges » chez l’élève (terme du complément), pastilles de non-lus ; relecture du fil toutes les 15 s quand l’onglet est visible.
- **Affichage façon messagerie instantanée** (demande du fondateur : « un peu plus similaire à Messenger ») : bulles arrondies, les siennes pleines à droite, celles des autres en gris à gauche ; bulles successives d’un même auteur regroupées (moins de 5 min) avec coins resserrés et avatar sous la dernière ; heure au-dessus après 30 min de silence ; lecteur vocal dans la bulle (lecture, barre, temps restant) ; barre d’écriture en pastille entre micro et envoi, Entrée envoie et Maj + Entrée passe à la ligne ; enregistrement dans une barre colorée avec minuteur, arrêt, réécoute, jeter ou envoyer ; fil sur la hauteur de l’écran.
- **Correctif.** Accusé de lecture : l’instant lu est désormais pris par la base (microseconde) et non arrondi à la milliseconde par le serveur ; sinon le dernier message lu restait compté comme non lu (test de non-régression).
- **Non fait.** Notifications (e-mail, push) ; transcription des vocaux ; pièces jointes ; recherche dans les messages ; suppression ou modification d’un message.
- **Réexamen.** Retour du fondateur sur la confidentialité des fils de groupe (prénoms visibles) ; besoin de notifications.
