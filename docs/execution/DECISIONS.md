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
- **Disposition façon Messenger** (« on dirait un vieux site web ») : sur ordinateur, discussions à gauche (recherche, avatars ronds, aperçu, heure, point de non-lu, triées par activité) et conversation ouverte à droite sous un en-tête avec avatar ; sur téléphone, la liste puis la conversation plein écran avec retour « ‹ ». Côté élève, la liste n’apparaît que s’il fait partie de groupes.
- **Styles périmés dans Safari.** La feuille de styles de développement garde la même adresse quand son contenu change, et Safari réutilisait sa copie en mémoire (pages « sans style » vues par le fondateur à plusieurs reprises). En développement seulement, `next.config.ts` envoie `Cache-Control: no-store` pour `/_next/static`. Cela ne suffisait pas : en navigation interne, Next garde la feuille chargée au premier affichage de l’onglet. `DevStyleRefresh` (développement seulement) relit la feuille courante à chaque changement de page et à chaque retour sur l’onglet, et applique sa dernière version si elle a changé (vérifié : feuille désactivée puis restaurée par une navigation ; règle ajoutée reçue au retour sur l’onglet).
- **Compte de recette.** Les fiches « Emma » des espaces Pauletta et Paupiette du fondateur sont liées à son propre compte Paul : il est à la fois coach et élève, et chaque espace a sa propre conversation. Pour une recette fidèle, utiliser un second compte pour l’élève.
- **Correctif.** Accusé de lecture : l’instant lu est désormais pris par la base (microseconde) et non arrondi à la milliseconde par le serveur ; sinon le dernier message lu restait compté comme non lu (test de non-régression).
- **Non fait.** Notifications (e-mail, push) ; transcription des vocaux ; pièces jointes ; recherche dans les messages ; suppression ou modification d’un message.
- **Réexamen.** Retour du fondateur sur la confidentialité des fils de groupe (prénoms visibles) ; besoin de notifications.

## D-034 · Rendez-vous planifiés depuis la conversation et la fiche · 2026-11-19

- **Contexte.** Demande du fondateur : « pouvoir créer et organiser un rendez-vous ou un appel vidéo facilement à partir de la conversation et/ou de la fiche client ».
- **Décision.**
  - Planification rapide, ouverte par « 📅 Planifier » dans l’en-tête de la conversation, dans la fiche élève et depuis le Planning : visio, appel ou rencontre ; jour (Aujourd’hui, Demain, Après-demain ou date) et heure (08:00, 12:00, 18:00, 19:00 ou autre) en un toucher, à l’heure de l’élève ; durée 15 à 60 min ; préparation facultative réservée au coach.
  - Lien de visio créé d’office (Jitsi Meet, salle au nom aléatoire, sans compte ni donnée personnelle), remplaçable par un lien Zoom, Meet ou Teams.
  - Case « Prévenir [prénom] dans la conversation » cochée par défaut et visible : l’annonce est un message explicite du coach (CLAUDE.md). Le message porte une carte (`messages.appointment_id`, migration `20261119010000`) : type, objet, date et heures dans le fuseau du lecteur, « Rejoindre l’appel », « Ajouter à mon agenda » (fichier .ics généré dans le navigateur). L’élève lit la carte par son message ; préparation et compte rendu restent invisibles pour lui (prouvé). L’annulation depuis la fiche annonce « ❌ … annulé » et barre la carte.
- **Non fait.** Proposer plusieurs créneaux à l’élève et le laisser choisir ; rappel avant l’appel ; rendez-vous de groupe.

## D-035 · Bibliothèque de séances et programmes à préparer · 2026-11-19

- **Contexte.** Demande du fondateur : « dans Séances, une bibliothèque de séances, la possibilité d’en créer de nouvelles, et la liste des personnes avec des programmes en attente de création » (CE-B-01, début de CE-B-08).
- **Décision.**
  - « Séances » a trois sous-onglets : Semaine (planning d’un élève), Bibliothèque, À préparer (pastille du nombre d’élèves).
  - Bibliothèque sur la table de référence `templates` (kind = `workout`, visible par son auteur) ; charge utile `{ category, workout }`, la séance n’ayant ni date, ni élève, ni fuseau. **Écart de contrat** : `createTemplate` et `updateTemplate` prennent ce format au lieu des « entrées datées », réservées aux semaines types (CE-B-02) ; ajout de `addStarterLibrary` et `templateFromWorkout`.
  - Créer et modifier avec le même constructeur par blocs ; dupliquer, archiver ; recherche, filtre par sport et par catégorie (11 catégories). « Utiliser pour un élève » ouvre une nouvelle séance pré-remplie pour l’élève et la date choisis ; la séance de la bibliothèque ne change jamais. « 📚 Ajouter à la bibliothèque » depuis une séance existante. Séances de départ : les modèles rapides complets, ajoutés une seule fois.
  - À préparer : élèves actifs sans séance publiée sur les 7 prochains jours, avec « Préparer » et « Depuis la bibliothèque » ; puis les programmes en place.
- **Non fait.** Bibliothèque CoachOS commune distincte (CE-B-08), semaines types (CE-B-02), import d’une base de coaching (CE-B-06), saisie rapide en notation texte (CE-B-09).

## D-036 · Messages à propos d’une séance et retours dans la conversation · 2026-11-19

- **Contexte.** Le fondateur ne retrouvait pas l’échange sur le retour d’Emma : la réponse ne disait pas de quelle séance il s’agissait, et l’échange était dans l’espace Paupiette alors qu’il regardait Pauletta (compte de recette à la fois coach et élève dans deux espaces).
- **Décision.** Un message peut citer la séance dont il parle (`messages.workout_id`, migration `20261119020000`, même élève par clé étrangère ; l’élève ne cite qu’une séance publiée). « 💬 En parler à … » sur la page d’une séance (coach et élève) ouvre la conversation avec la séance citée (retirable) ; la réponse rapide sous un retour cite la séance. Le fil affiche « ↪ À propos de : titre · date » avec lien vers la séance (page coach ou élève), et intercale les retours de séance de l’élève en cartes (état, effort, commentaire). L’en-tête des conversations indique l’espace.
- **Correctif lié.** Un message écrit par un coach de l’espace ne crée plus « Répondre au message », même si la même personne est l’élève de la fiche ; « Relancer le questionnaire » a un bouton « Relancer [prénom] » (message explicite avec lien, suivi mis de côté 3 jours).

## D-037 · Suivi de l’entraînement et onglet Progression · 2026-11-19

- **Contexte.** Demandes du fondateur : « plus de données venant des entraînements, un état des lieux de l’objectif, de l’avancement du programme » (CE-E-03, CE-G-08, lot S, CE-S-01 à 04).
- **Décision.**
  - Un seul calcul (`summarize`, domaine) et un seul panneau (`StatsPanel`) pour l’élève et pour le coach, sur 4, 8 ou 12 semaines (8 par défaut), semaines du lundi au dimanche dans le fuseau de l’élève.
  - Sources : séances **publiées** (jamais les brouillons, prouvé) et retours déclarés par l’élève. Aucune donnée Strava ni dérivée ; rien n’est envoyé à l’IA.
  - Indicateurs : régularité (séances faites ÷ séances passées, avec « sans retour »), volume réalisé sur prévu, distance réalisée (déclarée) sur prévue, effort ressenti moyen, série de semaines avec au moins une séance faite. Donnée absente : « — », jamais un zéro inventé. Définitions affichées sous le graphique.
  - Graphique : une colonne par semaine, type jauge (fond clair = prévu, plein = réalisé, une seule teinte, légende), bulle au survol et au clavier gardée dans le cadre, tableau équivalent. Sur téléphone, le graphique défile et s’ouvre sur les semaines récentes.
  - Droits : `athleteStats` vérifie coach affecté ou élève lui-même (`private.assigned` ou `private.own_athlete`) ; coach d’un autre espace, autre élève : rien (prouvé).
  - Élève : 5 onglets à icône (Aujourd’hui, Programme, Progression, Échanges, Profil) ; Progression montre l’objectif suivi (compte à rebours J-x) puis le panneau. Coach : section « Suivi de l’entraînement » dans la fiche élève, la période gardée avec le contexte de retour.
- **Non fait.** Allure moyenne et charge (CE-S-03) ; comparaison entre élèves et statistiques du portefeuille ; historique séance par séance ; données de montre (import FIT/TCX).

## D-038 · « Planifier l’appel de bienvenue » une fois le questionnaire reçu · 2026-11-19

- **Contexte.** Demande du fondateur : « lorsqu’un élève est ajouté, planification d’un appel ou d’un rendez-vous côté coach une fois que le questionnaire est reçu ».
- **Décision.** Nouveau suivi automatique `onboarding_call` (migration `20261119030000`, contrat `snoozeAutoTask`) : élève actif, questionnaire rempli, aucun rendez-vous prévu ou fait. Échéance : 2 jours après le questionnaire, priorité haute. Le suivi porte « 📅 Planifier l’appel », qui ouvre la planification rapide de D-034 dans la tâche, objet « Appel de bienvenue avec [prénom] », à l’heure de l’élève. Il se ferme dès qu’un rendez-vous est créé et revient si ce rendez-vous est annulé (prouvé). « Plus tard » propose aussi « Pas besoin d’appel » (mise en attente de 10 ans, réversible en base).
- **Non fait.** Proposer des créneaux à l’élève ; rappel automatique.

## D-039 · Retour rapide depuis Aujourd’hui (CE-C-03) · 2026-11-19

- **Contexte.** Idée éprouvée dans Foulée (audit, D-027) : plus de retours avec moins d’effort ; ressenti comparé à l’intention de la séance.
- **Décision.**
  - Sur Aujourd’hui, sous la séance du jour : « Ta séance d’aujourd’hui ? » Faite / En partie / Pas faite. « Pas faite » envoie aussitôt ; sinon, second geste : ressenti en 5 choix (Très facile à Très dur, enregistré sur l’échelle d’effort 2, 4, 6, 8, 10) ou « Envoyer sans ressenti ». La séance d’hier sans retour reste proposée de la même façon.
  - Intention portée par la séance, sans nouveau champ : déduite de l’intensité la plus haute des blocs de travail (zones 1–2 facile, 3–4 modérée, 5–7 difficile ; ou effort prescrit). Affichée « Visé par ton coach : séance difficile » et les choix conformes sont soulignés. Après l’envoi : « Ressenti conforme à l’objectif », « Plus facile que prévu » ou « Plus dur que prévu : ton coach le verra ».
  - Le retour rapide est un retour ordinaire (même commande, même clé d’idempotence, même revue côté coach) ; « Compléter ou modifier » ouvre le formulaire complet pré-rempli.
- **Preuve.** Test du domaine (intention, écart, corps valide pour le schéma ; ressenti retiré pour une séance pas faite). Navigateur à 375 px : Camille, « Faite » puis « Dur » sur « Séries courtes » (visé : difficile) → « Retour envoyé · Réalisée · Ressenti conforme à l’objectif ».
- **Non fait.** Intention choisie explicitement par le coach (champ dédié) ; rappel du retour non envoyé (notification).

## D-040 · Graphique de la séance (CE-E-04) · 2026-11-19

- **Contexte.** Idée éprouvée dans Foulée (capture 04) : voir d’un coup d’œil la forme d’une séance.
- **Décision.**
  - Une barre par étape, dans l’ordre réel, répétitions dépliées (`sessionProfile`, domaine) : largeur = durée (estimée avec l’allure ou la zone et la VMA ; sinon supposée pour le dessin seulement et signalée), hauteur = intensité de 1 à 7 (zone ; effort ; % FC max ; % FTP ; allure rapportée à la VMA ; à défaut, supposée d’après la phase et dessinée plus pâle).
  - Une seule teinte, plus soutenue quand c’est plus intense (la hauteur porte déjà l’information) ; récupération en gris ; repères Z3 et Z5 en pointillés ; axe en minutes. Jamais la couleur seule : détail écrit de chaque étape (« Effort · 300 m · Z5 », « série 1 sur 3 · répétition 2 sur 5 ») au toucher, au survol ou aux flèches du clavier, boutons précédent / suivant, et tableau équivalent.
  - Affiché pour l’élève et le coach (page de séance, revue) et en direct dans le constructeur.
- **Correctif lié.** Le constructeur créait des clés de blocs différentes au rendu serveur et dans le navigateur (avertissement d’hydratation) : clés stables par position au premier affichage.
- **Preuve.** Tests du domaine (dépliage, durée estimée avec VMA, durée supposée sans VMA, niveaux depuis effort, FC, puissance et allure). Navigateur : Camille à 375 px (35 barres, détail au toucher, flèches du clavier) ; Marine sur ordinateur (page de séance et constructeur).
- **Non fait.** Superposer le réalisé (données de montre) ; graphique par sport en multisport.

## D-041 · Saisie rapide en notation texte (CE-B-09) · 2026-11-19

- **Contexte.** Idée éprouvée dans Foulée : le coach écrit une séance en quelques secondes, comme sur papier.
- **Décision.**
  - « ✍️ Saisie rapide en texte » dans le constructeur (séance et bibliothèque). Le champ s’ouvre avec la séance en cours écrite en texte ; on modifie ou on écrit, l’aperçu (« ✓ 3 blocs · environ 1 h 09 ») ou les erreurs s’affichent au fil de la saisie ; « Remplacer le déroulé » ou « Ajouter à la fin ». Rien n’est enregistré avant « Enregistrer » ; le constructeur par blocs reste la voie principale.
  - Notation (`parseNotation` / `toNotation`, domaine) : durées `15'` `1'30` `45"` `1h30`, distances `400m` `1,5km`, bloc libre `libre` ; intensités `Z1`…`Z7`, `@4'30-4'15/km`, `@1'45/100m`, `RPE7`, `95%FTP`, `250W`, `150bpm`, `85%FC` ; répétitions `8×(…)` sur deux niveaux au plus ; `R200m` = récupération, mots « échauffement », « calme », « repos » ; sport en multisport (`vélo 1h Z2 + course 20' Z3`) ; note entre « ».
  - Phases déduites quand elles ne sont pas écrites : en tête, l’étape moins intense que la suite est l’échauffement ; en fin, le retour au calme ; dans une répétition, l’effort. Le texte produit n’écrit une phase que si elle ne se déduit pas (aller-retour exact, prouvé).
  - Aucune devinette : tout mot non compris est signalé (« « vite » non compris… une note s’écrit entre « » ») et bloque l’application.
- **Limites.** La cadence ne s’écrit pas en texte (conservée seulement par le constructeur) ; pas de zones de puissance ou de FC nommées (Z s’applique aux zones CoachOS).
- **Preuve.** 4 tests du domaine (séance type, toutes les intensités et le multisport, erreurs, aller-retour de 6 séances). Navigateur (Marine) : « Séries courtes » s’ouvre en texte ; « tranquille » signalé ; « 20' Z2 + 6×(1000m Z4 + R2') + 10' Z1 » remplace le déroulé (3 blocs, graphique à 14 barres), quitté sans enregistrer.

## D-042 · Séance de groupe : base commune, adaptations, exceptions, publication (lot G2) · 2026-11-19

- **Contexte.** Complément du 17 novembre (planning par groupe, base commune puis adaptations, destinataires et exceptions avant publication), stories CE-G2-01 et CE-G2-02.
- **Décision.**
  - Nouvel onglet « Groupes » dans Séances : pour chaque groupe, « 📅 Nouvelle séance pour le groupe » ; liste des séances de groupe récentes et à venir avec « x sur n publiées ». Depuis la bibliothèque : ⋯ → « Pour le groupe … ».
  - Création : titre, sport, date, déroulé (constructeur ou saisie rapide), consignes, puis **liste exacte des destinataires** (membres du groupe que le coach suit, cochés par défaut, invités signalés) et résumé « 2 brouillons le vendredi 20 novembre : Camille, Noah ». Un brouillon **indépendant** par élève, à la date locale et au fuseau de chacun (`group_sessions` + `workouts.group_session_id`, migration `20261119040000`). Rien n’est publié.
  - Page de la séance de groupe : chaque élève et l’état de sa séance (Brouillon, Adaptée, Publiée, Modifiée depuis la publication). « Adapter » ouvre la séance de cet élève seul et revient à la séance de groupe après l’enregistrement ; la base des autres ne change pas.
  - Publication explicite : cases par élève, puis rappel avant l’envoi (« Publier pour 1 élève : Noah · dont 1 adaptée · Exceptions : Camille (non cochée) », membres du groupe sans séance compris). Atomique : si une séance a changé depuis l’aperçu, rien n’est publié (409). La publication réutilise celle d’une séance (`publishInTx`, même historique de publications).
  - Droits : coach actif de l’espace ; chaque élève doit être suivi par lui, membre du groupe et non archivé ; la base commune n’est lisible que par les coachs de l’espace, jamais par les élèves. Contrat : `createGroupSession`, `publishGroupSession`.
- **Preuve.** `group-sessions.test.ts` (4 cas : destinataires exacts et rien de visible avant publication ; élève hors groupe, autre espace et élève refusés ; adaptation conservée, révision périmée → rien publié, exception non publiée ; séance étrangère refusée) et contrat des 2 opérations. Navigateur (Marine, démonstration) : séance « Piste du mardi » pour Camille et Noah saisie en texte ; Noah adapté puis retour automatique ; Camille décochée → « Exceptions : Camille » ; publication de Noah seul.
- **Semaine du groupe (CE-G2-03).** Depuis Séances → Groupes → « Semaine du groupe » : une ligne par élève, une colonne par jour, chaque séance avec son état (Brouillon, Publiée, Modifiée non republiée, Réalisée, Manquée, Annulée), 👥 pour les séances de groupe ; résumé « 6 publiées · 2 à publier · sans séance : … » ; semaines précédente et suivante ; « 📅 Séance pour le groupe ». Test : contenu et refus pour un autre espace.
- **Non fait.** Modifier la base et répercuter sur les brouillons non adaptés ; annoncer la séance de groupe dans le fil du groupe.

## D-043 · Régularité dans la liste des élèves et par groupe · 2026-11-19

- **Contexte.** Lot S (statistiques du coach sur le portefeuille) : repérer d’un coup d’œil qui décroche.
- **Décision.** Chaque élève actif de la liste Élèves affiche sa régularité des 4 dernières semaines (jauge + « 67 % · 2 séances faites sur 3 · effort moyen 6/10 », jamais la couleur seule) ; chaque carte de groupe affiche la régularité du groupe (séances faites ÷ prévues, tous membres) ; nouveau filtre « Régularité sous 50 % » (au moins 2 séances passées). Mêmes règles que le suivi de l’entraînement (D-037) : séances publiées, non annulées, passées ; faite = réalisée ou en partie.
- **Preuve.** Test : pour chaque élève actif, la régularité de la liste est identique au suivi calculé sur 28 jours. Navigateur (Marine) : Camille 67 %, Noah 0 %, groupes 67 % et 50 %.
- **Non fait.** Classement par régularité ; évolution d’une période à l’autre.

## D-044 · Export FIT d’une séance pour la montre (CE-X-01) · 2026-11-19

- **Contexte.** Accès Garmin Connect reporté (D-026) ; en attendant, l’export de fichier est la voie prévue vers la montre (COUVERTURE, lot X).
- **Décision.**
  - Bouton « ⌚ Télécharger pour ma montre » sur la page d’une séance côté élève (version publiée), et « ⌚ Fichier FIT » côté coach (version en cours). Absent pour une séance annulée. Aide repliée « Comment la mettre sur ma montre ? » (copie dans GARMIN › NewFiles, puis Entraînement › Séances), marquée « procédure en cours de vérification ».
  - Encodeur sans dépendance (`packages/domain/src/fit.ts`) : fichier FIT « workout » (en-tête de 14 octets, protocole 1.0, contrôle CRC FIT). Correspondance D-023 : étape → `workout_step` ; répétition → étape « répéter jusqu’à » placée après ses étapes et renvoyant à la première (séries imbriquées comprises) ; durée en ms, distance en cm ; phase → intensité (échauffement, actif, récupération, retour au calme, repos).
  - Cibles : zone de course + VMA de l’élève → fourchette de vitesse ; allure → vitesse (± 5 s/km si une seule valeur) ; puissance en W ou % FTP, FC en bpm ou % FC max → cibles personnalisées ; cadence seule → cible de cadence. **Une zone sans VMA, ou hors course, reste une cible libre** avec « Z3 » dans le nom et « Zone 3 (tempo) » en note : les zones de la montre (5 en FC) ne sont pas les 7 zones du coach. RPE et cadence secondaire vont en note.
  - Sport : course, trail, vélo, natation en bassin (25 m par défaut). Une séance qui enchaîne plusieurs sports est exportée en « générique », chaque étape préfixée du sport (« Vélo · Effort »).
  - Lien `/media/…/workouts/{sid}/fit` (comme les vocaux, hors API JSON) : session requise, lecture sous RLS, aucun cache partagé, rien envoyé à un tiers.
- **Preuve.**
  - 7 tests du domaine, relus par un lecteur FIT écrit à part d’après la spécification : en-tête, CRC, ordre des messages, répétitions simples et imbriquées, conversions, toutes les cibles, troncature UTF-8, séance sans blocs.
  - Contrôle CRC vérifié sur un vrai fichier Garmin présent sur le poste (contrôle seulement, contenu non lu).
  - Navigateur (démonstration) :
    - Marine télécharge « Séries courtes » de Camille : 922 octets, CRC valide, 3 × (5 × (300 m Z5 + 1' Z1) + 3' repos), allures tirées de la VMA 15 km/h.
    - Camille le télécharge à 375 px.
    - Refus : séance d’un autre élève 404, sans session 401, brouillon non publié 404.
- **Non prouvé.** Import réel sur montre (essai sur la Fenix 8 du fondateur, D-026) et lecture par l’outil officiel de Garmin (installation refusée par la politique du poste).

## D-045 · Réglage des suivis automatiques (CE-H-04) · 2026-11-19

- **Décision.**
  - Paramètres → « Suivis automatiques » : pour chaque coach (propriétaire ou non) et chaque espace, on coche les suivis voulus et on règle leur délai :
    - réponse à un message : 1 jour par défaut ;
    - retour à examiner : 2 jours ;
    - appel de bienvenue : 2 jours après le questionnaire ;
    - relance d’invitation : 3 jours ;
    - séances à préparer : horizon de 7 jours, de 1 à 21.
  - Les informations absentes (questionnaire, niveau, VMA) n’ont pas de délai : on les active ou non.
  - Lien « Régler les suivis » en tête de la liste « À faire » du Planning.
  - Table `auto_rule_settings` (migration `20261119050000`). Elle n’est lisible que par le coach concerné et n’est écrite que par la commande `saveAutoRuleSettings` (droits vérifiés, idempotence, journal).
  - Les suivis restent calculés depuis l’état réel. « Plus tard » reste le report pour un seul élève.
- **Preuve.**
  - Test : délai porté de 3 à 10 jours → échéance décalée de 7 jours ; horizon de 21 jours repris dans le motif ; règle désactivée puis réactivée.
  - Test des refus : bornes, délai sur une règle sans délai, doublon, élève et autre espace ; réglage invisible pour l’élève.
  - Contrat de l’opération vérifié.
  - Navigateur (Marine, 375 px) : « Relancer l’invitation » décoché → Planning de 6 à 4 tâches ; réglage remis par défaut ensuite.
- **Incident.** Pendant environ une minute, le Planning du fondateur a répondu en erreur : le nouveau code lisait la table avant que la migration ne soit appliquée. Règle retenue : appliquer la migration avant de brancher le code qui la lit.

## D-046 · Modifier la base d’une séance de groupe et la répercuter · 2026-11-19

- **Décision.**
  - « ✏️ Modifier la base commune » sur la page de la séance de groupe. Avant d’enregistrer, le volet annonce :
    - qui sera mis à jour ;
    - qui l’a déjà publiée et garde l’ancienne version jusqu’à la republication ;
    - qui reste inchangé parce que sa séance est adaptée.
  - Une séance « suit la base » tant que son sport, son titre, ses consignes, ses blocs et sa date sont identiques à la base (`followsBase`). Toute adaptation la sort de la base, définitivement : une modification de la base n’écrase jamais une adaptation. Une base renvoyée sans changement ne crée aucune version.
  - Répercussion = nouvelle révision de chaque séance qui suit la base. **Rien n’est publié** : la publication reste le geste explicite plus bas.
  - Révision de la base (migration `20261119060000`) : une modification concurrente est refusée (409).
  - L’état « Adaptée » se calcule désormais sur le contenu et non plus sur le numéro de version.
- **Preuve.**
  - Test : Camille (publiée, suit la base) mise à jour et marquée « Modifiée depuis la publication », sans qu’elle voie le changement ; Noah (adapté) inchangé.
  - Test : base identique sans nouvelle version ; révision périmée, élève et autre espace refusés.
  - Contrat de l’opération vérifié.
  - Navigateur (Marine) : sur « Piste du mardi », l’aperçu annonce « Mise à jour pour 1 élève : Camille · Inchangées (adaptées) : Noah » ; la consigne ajoutée apparaît dans la séance de Camille (version 3) ; un second enregistrement identique affiche « Aucun changement à enregistrer ».

## D-047 · Accusé de lecture et retours intercalés dans la conversation · 2026-11-19

- **Constat.** Le journal du serveur montrait des refus (422) sur l’accusé de lecture côté élève. Depuis D-036, la conversation intercale les retours de séance, dont l’identifiant (« fb-… ») n’est pas celui d’un message. Quand un retour terminait le fil, l’accusé lui était adressé et refusé, et le dernier vrai message restait « non lu ».
- **Correction.** L’accusé porte sur le dernier vrai message reçu.
- **Preuve.** Conversation de Camille terminée par un retour : accusé 200 (au lieu de 422).

## D-048 · Importer l’activité de la montre pour préremplir le retour (CE-X-02) · 2026-11-19

- **Contexte.** Import manuel FIT et TCX (COUVERTURE, lot X). La décision sur les données de santé est en attente (D11) : la fréquence cardiaque ne doit pas entrer.
- **Décision.**
  - Dans « Mon retour », séance faite en entier ou en partie : « ⌚ Importer depuis ma montre ». Formats acceptés : .fit, .tcx, .gpx, reconnus par leur contenu.
  - **Le fichier est lu dans le navigateur de l’élève ; il n’est ni envoyé ni conservé.** Seuls le sport, l’heure de début, la durée (temps en mouvement) et la distance sont lus. Fréquence cardiaque, puissance, positions et autres mesures sont ignorées.
  - La durée et la distance préremplissent le formulaire, puis l’élève corrige et envoie : l’envoi reste explicite.
  - L’écran signale une activité d’un autre jour que la séance, ou d’un autre sport.
  - Refus expliqués : séance à faire (programme), parcours, fichier abîmé (contrôle d’intégrité) ou incomplet, format inconnu, plus de 25 Mo.
  - Provenance conservée (migration `20261119070000`, `workout_results.measure_file`) :
    - le coach lit « Provenance : Lue dans un fichier FIT de sa montre » ou « Saisie à la main » ;
    - si l’élève modifie une valeur importée, la mesure redevient « saisie à la main » ;
    - un fichier sans aucune mesure est refusé.
  - Lecteur FIT : les cas courants sont pris en charge.
    - Lus : définitions petit- et grand-boutistes, champs de développeur, horodatages compressés, sessions multiples.
    - Si le fichier n’a pas de session : tours, puis points.
- **Preuve.**
  - 6 tests du lecteur (dont fréquence cardiaque absente du résultat) et test de contrat de la provenance.
  - Vrai fichier Garmin du poste (un parcours) : parcouru en entier sans erreur, puis reconnu comme parcours.
  - Navigateur (Camille, 375 px) :
    - le FIT est lu sans aucune requête réseau ; « 45 min · 8,12 km · jeudi 19 novembre à 07:30 » prérempli ;
    - le retour est envoyé, et Marine lit « Lue dans un fichier FIT de sa montre » avec l’allure de 5:33 /km.
- **Non fait.** Rapprochement de plusieurs activités par séance (CE-X-03) ; stockage de l’activité elle-même ; essai avec un vrai fichier d’activité de la Fenix 8.

## D-049 · Annoncer une séance de groupe dans le fil du groupe · 2026-11-19

- **Décision.**
  - Au moment de publier une séance de groupe, la case « Annoncer dans le fil « Groupe… » » est **décochée par défaut**. Une fois cochée, elle affiche le message proposé, modifiable avant l’envoi :
    - « 📅 Nouvelle séance de groupe : « titre », date. Elle t’attend dans ton Programme. » ;
    - aucune adaptation individuelle n’y apparaît ;
    - il est rappelé que tout le groupe lit le fil, y compris ceux qui n’ont pas cette séance.
  - Publication et annonce se font dans une même transaction : si la publication échoue, rien n’est annoncé.
  - Seul un coach peut annoncer. Champ `announce` de `publishGroupSession`, réponse `announcementId`.
- **Preuve.**
  - Test : révision périmée → ni publication ni message ; avec annonce, un seul message, lu par Noah ; sans annonce, aucun message ; message vide refusé.
  - Navigateur (Marine, 375 px) : publication de Camille avec annonce → « Annonce envoyée dans le fil du groupe », message présent dans le fil « Groupe du mardi ».

## D-050 · Comparaison avec la période précédente dans le suivi · 2026-11-19

- **Décision.**
  - Sous chaque chiffre du suivi (élève et fiche du coach), on compare à la période de même durée juste avant.
  - La comparaison s’écrit en toutes lettres, par exemple « ↑ En hausse de 12 points par rapport aux 4 semaines d’avant », « stable » ou « en baisse de 8 % » :
    - régularité en points ;
    - volume et distance en % ;
    - effort sur 10.
  - Le sens est écrit et la flèche n’est qu’un décor : jamais la couleur seule. Sous 3 % (ou 0,3 d’effort), la comparaison indique « stable ».
  - Rien n’est affiché sans séance passée dans la période précédente.
  - La définition est ajoutée sous les statistiques : la semaine en cours, pas terminée, compte dans la période actuelle.
- **Preuve.** Test du domaine (points, %, effort, absence de base, textes). Navigateur : la démonstration n’a pas de séance avant la période, donc aucune comparaison affichée, comme prévu.

## D-051 · Semaines types et publication de la semaine (CE-B-02) · 2026-11-19

- **Contexte.** Le complément du 17 novembre prévoit une bibliothèque de séances, semaines types, blocs et programmes. Les séances existent (D-035) ; les semaines types manquaient.
- **Décision.**
  - Dans Séances → Semaine, sous la semaine d’un élève :
    - « 💾 Enregistrer comme semaine type » : nom au choix. Les séances non annulées de la semaine (version de travail) deviennent les jours de la semaine type, sans élève ni date.
    - « 📋 Appliquer une semaine type » : choix de la semaine type, aperçu jour par jour, puis « Ajouter n brouillons ». Un brouillon par séance aux mêmes jours, dans le fuseau de l’élève. Les séances déjà prévues restent en place et **rien n’est publié**.
    - « Publier la semaine (n) » : liste chaque brouillon ou modification à publier, puis publication explicite, par la même opération qu’une séance.
  - Bibliothèque : section « Semaines types » qui montre, pour chacune, les jours, le nombre de séances et la durée prévue. On peut la renommer ou l’archiver.
  - Stockage dans `templates` (kind = 'week', charge `{ days: [{ offset, workout }] }`), sans migration ; visible seulement par son auteur.
  - Contrat : `createWeekTemplate`, `applyWeekTemplate`, `updateWeekTemplate`.
- **Preuve.**
  - Test : semaine de Camille enregistrée puis appliquée à Noah deux semaines plus tard, aux mêmes jours, en brouillons invisibles pour lui.
  - Test des refus : jour autre qu’un lundi, semaine vide, autre espace, élève, élève non suivi, semaine type archivée, révision périmée.
  - Test : les semaines types ne se mêlent pas aux séances. Contrat des 3 opérations vérifié.
  - Navigateur (Marine) :
    - « Semaine VMA (reprise) » enregistrée depuis Camille (6 séances) ;
    - appliquée à Noah pour la semaine du 23 novembre : 6 brouillons aux bons jours ;
    - « Publier la semaine (6) » liste les 6 séances (non publiées pour la vérification) ;
    - la Bibliothèque affiche la semaine type, 4 h 24 prévues.

## D-052 · Historique séance par séance dans la fiche élève · 2026-11-19

- **Décision.** Sous « Suivi de l’entraînement », « Séance par séance » liste les séances publiées passées de la période, la plus récente d’abord. Pour chacune :
  - la date et le lien vers la séance ;
  - le prévu (durée, distance) ;
  - le réalisé (état, durée, distance) ou « Pas de retour » ;
  - l’effort.

  Le tableau défile horizontalement sur téléphone et se déplie de lui-même jusqu’à 8 lignes.
- **Preuve.** Test : seulement des séances publiées passées, ordre décroissant, cohérent avec le nombre de séances faites du suivi. Navigateur : fiche de Camille, 3 lignes dont « Réalisée · 45 min · 8,1 km » (mesure lue dans la montre).

## D-053 · Filtre par objectif dans la liste des élèves · 2026-11-19

- **Décision.**
  - Nouveau filtre « Objectif », avec les choix : tous, avec un objectif, objectif dans les 8 semaines, sans objectif.
  - Sous chaque élève, son prochain objectif prévu : « 🎯 Gran fondo · 29 déc. (J-40) ».
  - Le prochain objectif est le premier objectif prévu à venir ; à défaut, un objectif sans date. Les objectifs passés, atteints ou annulés ne comptent pas.
- **Preuve.** Test : objectif passé et objectif sans date écartés au profit de l’objectif daté à venir. Navigateur : sans objectif en démonstration, « Sans objectif » liste les 4 élèves et « Avec un objectif » aucun.

## D-054 · Bilan d’arrivée inspiré de Foulée : questionnaire, reprise, confirmation, entretien (CE-B-04, CE-B-05) · 2026-11-19

- **Contexte.** CE-B-04 et CE-B-05 (P0) étaient partiels : questionnaire en trois blocs, sans reprise ni confirmation, et sans entretien. Le fondateur a demandé de s’inspirer de Foulée. La capture 01 de Foulée montre une question par écran, une barre de progression, des questions qui s’adaptent (régulier, reprise, arrêt, débutant) et la pratique réelle des 4 dernières semaines.
- **Décision.**
  - **Ergonomie reprise de Foulée.**
    - Une question par écran, avec barre de progression et retour ; un toucher sur une réponse fait avancer.
    - Questions conditionnelles :
      - « Où en es-tu avec la course à pied / le vélo / la natation… ? » : régulier, reprise après un arrêt, arrêt en cours, débutant ;
      - en cas d’arrêt : sa durée ; en cas de reprise : depuis quand ;
      - séances par semaine sur les 4 dernières semaines (« ce que tu as vraiment fait ») ;
      - plus longue sortie récente (« d’une traite, pas ton record d’avant »).
    - Réponses déduites : un débutant n’a ni ancienneté ni niveau à donner ; pendant un arrêt, la pratique est de 0 ou 1 séance par semaine.
    - Récapitulatif avant l’envoi : chaque ligne se modifie d’un toucher. Une réponse qui ouvre une question obligatoire y conduit d’abord.
    - Formulations adaptées à chaque sport. Aucune question de santé (pas de PAR-Q ni de douleur, contrairement à Foulée, D11).
  - **CoachOS en plus.**
    - Brouillon enregistré **sur le serveur** à chaque écran (table `athlete_profile_drafts`), avec l’indication « Enregistré », pour reprendre sur un autre appareil.
    - Rappel sur Aujourd’hui : « Ton bilan · 2 réponses sur 5 » et le bouton « Continuer ».
    - Le motif de la tâche « Relancer le questionnaire » du Planning donne l’avancement du brouillon.
    - Statut : pas commencé, en cours, envoyé (à confirmer), confirmé.
    - « ✓ Confirmer le bilan » dans la fiche. Une modification de l’élève le remet « à confirmer », mais un envoi identique ne retire pas la confirmation (par exemple si seul le nom a changé).
    - **Entretien (CE-B-05).** « 📞 Compléter en entretien » ouvre le même parcours, avec les questions à la troisième personne. Il part du bilan envoyé, sinon du brouillon de l’élève, sinon de rien. Les réponses changées sont marquées « Entretien » dans la fiche, les autres restent « déclarées », et le bilan est confirmé. Révision attendue : 409 si l’élève a changé son bilan entre-temps.
  - Migration additive `20261119080000` : nouvelles colonnes de `athlete_profiles` (questions, statut, confirmation, provenance) et table des brouillons. Lecture par l’élève et le coach affecté seulement. Les profils existants restent valides.
  - Contrat : `saveBilanDraft`, `saveBilanByCoach`, `confirmBilan` ; schéma `athleteProfile` étendu.
- **Preuve.**
  - Tests du domaine (5) : écrans selon les réponses, réponses déduites, complétude, reprise, cohérence, provenance (dont profil antérieur).
  - Tests serveur (6) :
    - brouillon repris et lisible par le coach seul ; champ inconnu refusé ;
    - envoi ; confirmation, puis retrait par une modification ; refus pour une révision périmée, l’élève ou un autre espace ;
    - entretien avec provenance ; bilan créé par le coach ; envoi identique sans perte de la confirmation.
  - Contrat des 3 opérations vérifié.
  - Navigateur, 375 px :
    - Camille commence (« Où en es-tu avec la course à pied ? », « Enregistré »), quitte, puis Aujourd’hui affiche « 2 réponses sur 5 » ;
    - elle reprend à la bonne question, termine (récapitulatif complet) et envoie ;
    - Marine confirme le bilan ;
    - Marine complète en entretien le bilan de Noah : « Situation » manquante, « J’ai repris » conduit à la durée de l’arrêt puis à la reprise ; résultat « Confirmé » avec repères « Entretien ».
- **Défaut trouvé et corrigé.** Un profil antérieur aux provenances voyait toutes ses réponses marquées « Entretien ». Une réponse inchangée reste désormais « déclarée ». La ligne de démonstration de Noah a été corrigée en base locale (une seule ligne, données de démonstration).
- **Non fait.** Versions successives du bilan (Foulée garde l’historique) ; écran « Toi » (nom, fuseau) dans le premier parcours, toujours modifiables dans Profil ; tâche « Confirmer le bilan » dans le Planning (« Confirmer le niveau » existe).

## D-055 · FTP et CSS : zones traduites pour le vélo et la natation (CE-B-03) · 2026-11-19

- **Contexte.** CE-B-03 : les seuils de l’élève convertissent les zones à l’affichage. Seule la VMA existait (course, D-029). L’audit de Foulée recommande des seuils par élève et par sport.
- **Décision.**
  - Dans la fiche élève, « Repères d’entraînement » accueille trois champs : **VMA** (km/h, course), **FTP** (W, vélo), **CSS** (allure seuil de nage pour 100 m, saisie « 1:45 »). Un tableau traduit les 7 zones pour chaque repère renseigné.
  - Plages (réversibles, à valider par le fondateur) :
    - vélo, en % de FTP, alignées sur les 7 zones : 45-55, 56-75, 76-90, 91-105, 106-120, 121-150, 151-180, arrondies à 5 W ;
    - natation, en % de la vitesse CSS : 70-78, 78-88, 88-94, 95-100, 100-105, 105-110, 110-118.
  - Partout, derrière une zone, la cible propre à l’élève : « Z4 · seuil · 230 à 265 W », « 1:51 à 1:45 /100 m », « 6:09 à 5:43 /km » (`personalTarget`). C’est le cas dans le constructeur, la lecture coach et élève et la revue. Un % FTP s’affiche aussi en watts.
  - En multisport, le sport de l’étape décide.
  - La CSS estime aussi la durée et la distance des blocs de nage. Le graphique de séance situe les watts et les allures de nage dans les 7 niveaux.
  - Le fichier FIT (D-044) reprend ces cibles : zone de vélo en watts, zone de nage en vitesse.
  - Le constructeur signale le repère manquant selon le sport (VMA, FTP ou CSS), avec un lien vers la fiche.
  - Migration additive `20261119090000` (`ftp_w`, `css_sec_per_100`). Un champ absent de la requête reste inchangé ; `null` l’efface. Contrat `saveAthleteReferences` étendu.
  - **Pas de FC max ni de FC seuil** : la question des données de santé n’est pas tranchée (D11). Le schéma refuse `fcMax`.
- **Preuve.**
  - 6 tests du domaine : watts et allures par zone, cible personnelle par sport et en multisport, estimation de nage, niveaux du graphique, bornes FIT, saisie de la CSS.
  - Test serveur : enregistrement, champ absent conservé, effacement, bornes, élève et autre espace refusés.
  - Navigateur (Marine) : FTP 250 W et CSS 1:45 pour Noah, tableau des 7 zones en watts et en allures de nage. Dans le constructeur en Cyclisme, « 20' Z2 + 3×(8' Z4 + R3') + 10' Z1 » affiche 140 à 190 W, 230 à 265 W et 115 à 140 W (séance non enregistrée).
- **À valider par le fondateur.** Les noms d’usage des zones viennent de la course (« VMA longue » pour Z5) ; pour le vélo et la natation, peut-être « PMA », « anaérobie » et « sprint ».

## D-056 · Adapter la semaine : quatre propositions inspirées de Foulée (CE-P-05) · 2026-11-19

- **Contexte.** L’éditeur de semaine de Foulée (capture 09) propose « Semaine de récupération », « Alléger », « Endurance seule » et « Semaine de reprise ». Chaque proposition montre le volume avant → après, chaque séance barrée et remplacée, et la conséquence probable. Les séances verrouillées ou réalisées ne changent pas. Foulée descend d’un palier dans sa bibliothèque ; CoachOS n’a pas de paliers et raisonne sur la structure des séances.
- **Décision.**
  - Sous la semaine d’un élève (Séances → Semaine), « Adapter la semaine » présente les quatre propositions, de la plus prudente à la plus exigeante. Le coach en coche une, puis « Appliquer … en brouillons ».
  - Règles (`proposeWeek`, domaine) ; une séance de qualité atteint le niveau 4 ou plus (seuil, VMA, effort élevé) :
    - **Récupération** : la qualité devient une séance facile à 70 % de la durée ; les autres perdent un quart ; la séance la plus exigeante est retirée s’il en reste au moins quatre.
    - **Alléger** : environ −25 % sur chaque séance, en retirant des répétitions (minimum 2) ou en raccourcissant les blocs, intensité inchangée.
    - **Endurance seule** : la qualité devient facile à 80 % ; une sortie longue reste une sortie longue (90 %).
    - **Reprise** : tout devient facile, 40 minutes au plus.
  - Les séances faciles générées sont nommées selon le sport : « Footing 35′ », « Sortie vélo facile 1 h 10 », « Nage facile ».
  - Les séances faites, passées ou annulées ne changent jamais, mais comptent dans le volume affiché.
  - Application côté serveur (`applyWeekProposal`) : la proposition est recalculée depuis les séances en base, jamais reprise du navigateur. Chaque séance reçoit une nouvelle révision ; une séance retirée devient une révision annulée, avec un motif.
  - **Rien n’est publié** : l’élève garde les versions publiées jusqu’à « Publier la semaine » (D-051).
  - Si une séance a changé depuis l’aperçu, rien n’est appliqué (409).
  - Contrat : `applyWeekProposal`.
- **Preuve.**
  - 7 tests du domaine, sur la semaine type de Foulée (fractionné, seuil, footing, sortie longue) : qualité reconnue, effet de chaque proposition, séances bloquées, outils.
  - 2 tests serveur : 4 propositions pour le coach affecté seulement ; « récupération » appliquée (fractionné retiré, seuil devenu « Footing », sortie longue publiée restée visible telle quelle par l’élève) ; aperçu périmé refusé ; élève refusé ; jour autre qu’un lundi refusé.
  - Contrat vérifié.
  - Navigateur (Marine) : semaine de Noah du 23 novembre, 4 h 24 → 2 h 55 / 3 h 18 / 3 h 50 / 3 h 20 selon la proposition, avec le détail séance par séance. « Endurance seule » appliquée : 6 brouillons (données de démonstration).
- **Limites.** Une séance sans déroulé (durée seule) est vue comme facile, faute d’intensité connue : elle est raccourcie, jamais transformée. La cohérence avec le profil (Foulée : « rien à signaler ») viendra avec le lot P (programmes).

## D-057 · Faisabilité de l’objectif, inspirée de Foulée (CE-P-07) · 2026-11-19

- **Contexte.** La capture 10 de Foulée montre un statut, des critères expliqués (chrono, endurance, délai, temps disponible, séances), « à proposer à ton élève » et des solutions qui indiquent chacune le statut qu’elles donneraient. Des paramètres modifiables recalculent tout sans rien enregistrer, et un « nouveau calcul » compare avant et après. Story CE-P-07 : quatre statuts, critères et solutions chiffrées ; message proposé à l’élève, jamais envoyé seul.
- **Décision.**
  - Dans la fiche élève, la section repliée « Faisabilité · {objectif} » affiche son statut en titre. Elle porte sur le prochain objectif daté, sinon sur la prochaine course déclarée dans le bilan. Elle n’apparaît que si le bilan existe.
  - **Quatre statuts** : réalisable, ambitieux mais possible, risqué (à sécuriser), irréaliste en l’état. Le statut est le pire des critères. Les critères sont classés du plus bloquant au moins bloquant, chacun avec son explication chiffrée.
  - **Calcul, pour tous les sports** (`assessGoal`, domaine) :
    - durée d’épreuve à l’allure du niveau déclaré (vitesses typiques par sport et par niveau) ;
    - séance longue à tenir : 65 % de l’épreuve en course, 80 % en vélo, 100 % en natation, avec un plafond ;
    - endurance actuelle tirée du bilan (« plus longue sortie de ces 4 dernières semaines ») ; semaines pour l’atteindre à +10 % par semaine, plus 2 de marge ;
    - semaines conseillées et séances par semaine selon la durée et le niveau ;
    - temps disponible tiré du bilan.
  - Le **chrono** n’allonge jamais l’épreuve : il ajoute son critère, une séance et deux semaines. Retirer le chrono ne rend donc jamais l’objectif plus difficile (testé sur 30 cas). Distance et chrono sont lus dans le titre de l’objectif (« Semi de Bruxelles en moins de 2 h ») et restent modifiables.
  - **Solutions** : repousser la date (date calculée), libérer du temps, finir sans chrono, objectif intermédiaire (marathon → semi → 10 km → 5 km), ajouter des séances, maintenir l’objectif. Chacune affiche son statut ; « Essayer cette solution » change les paramètres. **Rien n’est enregistré.**
  - **Message proposé** : le statut de départ, les points qui comptent, puis, si une solution a été essayée, ce qui change et le statut obtenu. Il est modifiable. « Ouvrir la conversation avec ce message » le dépose dans le champ de saisie de la conversation (une seule fois, stockage de session du navigateur) : **le coach l’envoie lui-même**.
  - Aucune donnée de santé ; c’est une aide à la décision, pas une garantie (mention affichée).
- **Preuve.**
  - 6 tests du domaine :
    - cas exact de la capture de Foulée, jugé irréaliste ;
    - solutions et leurs statuts ; cas réalisable ;
    - chrono retiré jamais plus difficile ;
    - vélo et natation ;
    - message sans et avec ajustement ;
    - lecture de la distance et du chrono dans le titre.
  - Navigateur (Marine), avec Camille et l’objectif « Semi de Bruxelles en moins de 2 h » au 17 janvier (ajouté par le formulaire, démonstration) :
    - statut « Risqué » ; « objectif intermédiaire » donne « Ambitieux » ;
    - « Nouveau calcul : Risqué → Ambitieux » ;
    - message proposé : « préparer d’abord 10 km, puis 21,1 km… et viser de finir, sans chrono. Ainsi, il est ambitieux mais possible » ;
    - la conversation s’ouvre avec le message dans le champ de saisie, non envoyé.
- **Défaut trouvé et corrigé.** Le formulaire « + Ajouter un objectif » (et les autres fenêtres « + … » des en-têtes de carte) était coupé par la carte : le bouton d’envoi tombait sous la carte voisine et ne recevait pas le clic. Une carte dont une telle fenêtre est ouverte ne la coupe plus.
- **À valider par le fondateur.** Les vitesses par niveau, les parts de séance longue et les délais conseillés. Plus tard : un test de référence (chrono) enregistré dans les repères.

## D-058 · Le passif de l’élève compte, et c’est le coach qui décide · 2026-11-19

- **Instruction du fondateur.**
  - Il y a ce qui est conseillé en théorie, mais il faut prendre en compte la situation globale de l’athlète et son passif pour voir si un objectif est réalisable dans les temps.
  - Au final, c’est toujours au coach de décider. Si le coach dit oui, le programme généré doit permettre d’atteindre l’objectif.
- **Décision.**
  - **Passif dans le calcul (D-057 révisé).** La faisabilité tient compte de :
    - **les années de pratique** (bilan) : elles accélèrent la progression de la séance longue (de 8 % par semaine pour un débutant à 15 % pour plus de 3 ans de pratique) et raccourcissent la préparation conseillée (−10 à −20 %) ;
    - **une distance déjà atteinte** (objectif « atteint » du même sport, d’au moins 95 % de la distance) : −25 % sur la préparation conseillée ;
    - **ce qui a vraiment été fait** : la plus longue séance réalisée ces 6 dernières semaines (retours) remplace la case du bilan si elle est plus longue ;
    - **la régularité réelle** sur 4 semaines (critère « Régularité réelle », à partir de 3 séances suivies) ;
    - **une reprise très récente après un long arrêt** : critère « risqué », progression prudente.

    Deux nouveaux critères : « Passif » et « Régularité réelle ».
  - **Statut = indication.** Le panneau l’indique (« indication ») et rappelle : « C’est toi qui décides, plus bas ».
  - **Décision du coach.** « Ta décision » propose : « ✓ Je valide cet objectif » (ou « … ajusté » après une solution essayée), une justification facultative (privée) et, si la date a changé, la reprise de la nouvelle date sur l’objectif (visible par l’élève). La validation est possible quelle que soit l’indication. L’objectif validé porte « ✓ Validé par toi » ; la décision rappelle les paramètres, l’indication au moment de la décision et la justification. Une validation malgré une indication risquée conseille un suivi rapproché.
  - **Contrainte du futur programme (lot P).** Table `goal_decisions` (migration `20261119100000`) : paramètres validés (distance, date, chrono, séances, temps), indication au moment de la décision, justification, révision. Le générateur de programme devra prendre ces paramètres comme **objectif à atteindre** : planifier la progression pour y arriver à la date validée, en signalant les risques au coach, sans refuser ni revoir l’objectif à la baisse de lui-même.
  - La décision est lisible par les coachs affectés seulement, jamais par l’élève (RLS). Écriture par `decideGoal` (droits, idempotence, journal). Contrat : `decideGoal`.
- **Preuve.**
  - Tests du domaine :
    - un coureur de plus de 5 ans de pratique qui a déjà couru la distance est jugé plus favorablement (préparation conseillée plus courte, endurance réelle, statut meilleur) ;
    - une reprise récente après un long arrêt et une régularité réelle faible rendent prudent ;
    - pas de critère de régularité avec moins de 3 séances suivies.
  - Tests serveur :
    - validation d’un objectif « risqué » avec justification, invisible pour l’élève ;
    - date reportée sur l’objectif, nouvelle révision ;
    - refus pour l’élève, un autre espace, un autre élève, un objectif terminé et des paramètres invalides.
  - Contrat vérifié. `npm test` : 197 passés.
  - Navigateur (Marine, Camille) :
    - critères « Passif » (1 à 3 ans, séance la plus longue faite ces 6 dernières semaines : 45 min) et « Régularité réelle » (2 sur 3) ;
    - objectif validé malgré « risqué », puis justification ajoutée (« A déjà couru deux semis en 2 h 05… ») ;
    - « ✓ Validé par toi » dans la liste des objectifs.
- **Corrigé en route.** Le champ de justification n’avait pas de nom accessible : il est maintenant annoncé par les lecteurs d’écran.
- **À venir.** Chronos de référence (tests, courses passées) dans les repères, pour juger un chrono visé ; historique des courses dans le bilan.

## D-059 · « Confirmer le bilan », tâches récurrentes et historique du bilan · 2026-11-19

- **Décision.**
  - **Suivi « Confirmer le bilan ».**
    - Un bilan envoyé (ou modifié par l’élève) crée une tâche dans le Planning, 2 jours après l’envoi par défaut, délai réglable avec les autres suivis (D-045). Elle se ferme dès la confirmation.
    - Confirmer le bilan (ou le remplir en entretien) confirme aussi le niveau déclaré pour ce sport, sauf si le coach a déjà fixé un autre niveau.
    - « Confirmer le niveau » n’apparaît plus en double tant qu’un bilan attend sa confirmation.
    - Migration `20261119110000` (contrôles des règles).
  - **Tâches récurrentes (CE-H-06).**
    - « Répéter » dans le formulaire de tâche : chaque semaine, toutes les 2 semaines, chaque mois. Une tâche récurrente demande une échéance.
    - Marquer une tâche récurrente « faite » crée l’occurrence suivante, une seule fois, au même jour du mois (ramené au dernier jour si besoin, par exemple du 31 janvier au 28 février). « 🔁 chaque semaine » s’affiche dans le Planning.
    - Migration `20261119120000` ; contrat : `recurrence` sur la tâche, `next` dans la réponse de mise à jour.
  - **Historique du bilan.**
    - Chaque enregistrement, par l’élève ou en entretien, garde une version immuable des réponses (`athlete_profile_versions`, migration `20261119130000`). Lecture par l’élève et les coachs affectés.
    - Dans la fiche, « Historique · n versions » donne pour chaque version la date, la source (envoyé par l’élève ou entretien) et les réponses modifiées.
    - Les bilans antérieurs à cette version commencent leur historique au prochain enregistrement.
- **Preuve.**
  - Tests :
    - bilan envoyé → « Confirmer le bilan » sans « Confirmer le niveau » ; confirmation → plus de tâche, niveau intermédiaire en vélo confirmé ;
    - tâche mensuelle du 31 janvier → suivante le 28 février, une seule ; tâche simple sans suivante ;
    - échéance obligatoire et non effaçable sur une tâche récurrente ;
    - historique : ordre, réponses changées en entretien, première version, accès refusé à un autre élève.
  - `npm test` : 199 passés.
  - Navigateur (Marine) : tâche « Point hebdo avec Camille » créée chaque semaine (« 🔁 chaque semaine »), « Terminé » crée l’occurrence du jeudi 26 novembre (démonstration).

## D-060 · Résultats de référence : chrono jugé sur des faits, équivalences, VMA d’un test · 2026-11-19

- **Contexte.** D-058 demandait de juger un chrono visé sur le passif réel. Le fondateur fournira plus tard ses données (« continue sans, au pire on changera après ») : le modèle est volontairement simple et réversible.
- **Décision.**
  - Dans la fiche élève, la section « Résultats de référence » permet au coach affecté de saisir des courses, des tests et des séances de référence. Pour chacun : type, sport, nom facultatif, distance (« 10 », « 1500 m »), temps (« 52:30 », « 1h45 »), date passée.
  - Affichage : l’allure, et pour la course à pied les équivalences 5 km, 10 km, semi et marathon (formule de Riegel, exposant 1,06). Un test de 5 à 7 minutes donne une VMA estimée, avec « Utiliser comme VMA ».
  - L’élève les voit dans Progression (« Tes résultats de référence »).
  - Faisabilité :
    - le temps prévu sur la distance de l’objectif est calculé d’après le résultat de moins de 12 mois, du même sport, le plus proche en distance (entre un cinquième et cinq fois). Il donne la durée d’épreuve et juge le chrono visé : à portée, ou x % plus rapide que le prévu (au-delà de 3 %, 7 % puis plus) ;
    - la prédiction est recalculée pour chaque distance, solutions comprises ;
    - les courses comptent dans « a déjà réalisé » du passif ;
    - pas de prédiction en vélo, faute de modèle fiable ; en trail et en natation, l’exposant est différent.
  - Table `athlete_performances` (migration `20261119140000`) : écrite par le coach affecté, lue par lui et par l’élève. Contrat : `addPerformance`, `deletePerformance`. Aucune donnée de santé.
- **Preuve.**
  - Tests du domaine :
    - saisie des temps ;
    - prédiction (résultat récent et proche, trop ancien ignoré, vélo exclu) ;
    - équivalences ; VMA d’un test de 6 minutes ;
    - chrono jugé à portée, à surveiller, risqué ou bloquant selon l’écart ;
    - durée d’épreuve suivant la distance d’une solution.
  - Tests serveur : ajout, lecture par l’élève, refus (élève, autre espace, date future, bornes), suppression.
  - Contrat vérifié. `npm test` : 205 passés.
  - Navigateur :
    - Marine ajoute pour Camille « 10 km de Bruxelles » en 52:30 (5:15 /km, semi prévu en 1:55:50) ; la faisabilité indique « Chrono visé 2:00:00, à sa portée » ;
    - Camille voit le résultat et les équivalences dans Progression, sans la justification privée du coach.
- **Corrigé en route.** Plusieurs champs de saisie (résultats, paramètres de faisabilité) n’avaient pas de nom accessible : un libellé explicite a été ajouté.
- **À revoir avec les données du fondateur.** Formats d’import (Garmin, Foulée, tableaux), autres sports, saisie des courses par l’élève dans le bilan.

## D-061 · Générateur de programme : à la hauteur de l’objectif, 4 semaines de tremplin, risques au coach · 2026-11-19

- **Instruction du fondateur.**
  - Le programme généré doit être à la hauteur de l’objectif visé, tout en prévenant des risques.
  - Les 4 premières semaines servent de tremplin vers le volume nécessaire ensuite.
  - Les risques sont signalés au coach, et c’est à lui de décider.
- **Décision (première version, règles écrites, sans IA).**
  - **Entrée** : un objectif validé par le coach (D-058) : distance, date et chrono décidés. Le générateur part de ces paramètres et ne les revoit jamais à la baisse. Il utilise aussi :
    - le bilan (situation, endurance déclarée, jours disponibles) ;
    - ce que l’élève a réellement fait (séance la plus longue réalisée ces 6 dernières semaines, volume moyen des 4 dernières) ;
    - ses résultats de référence (prédiction, D-060) et ses repères (VMA).
  - **Phases** :
    - **Tremplin**, les 4 premières semaines : départ au volume actuel, endurance d’abord, une séance de qualité légère à partir de la 3e semaine, dimensionnée pour tenir dans le volume visé. Les footings descendent à 20 minutes pour partir vraiment de l’existant.
    - **Développement** : hausse progressive jusqu’au pic (séance longue nécessaire et volume de course) à la dernière semaine avant l’affûtage ; une semaine allégée (−25 %) toutes les quatre ; qualité alternée seuil, allure de course (si chrono), VMA.
    - **Affûtage** : 2 semaines dès 10 semaines de préparation, 1 dès 5 ; course le jour J.
  - La séance longue est placée le week-end si possible, les séances de qualité jamais la veille de la séance longue. Les séances suivent le sport : footing, sortie vélo, nage ; VMA en 400 m en course, PMA en 3 minutes ailleurs.
  - **Risques signalés** à partir des semaines réellement planifiées :
    - départ au-dessus de ce que l’élève fait (+x %) ;
    - plus forte hausse d’une semaine à l’autre (au-delà de 10 %) ;
    - pas de développement ni d’affûtage si la préparation est trop courte ;
    - points de la faisabilité.

    Le programme reste construit pour l’objectif : le coach lit les risques, coche « J’ai lu les risques signalés et je décide de créer ce programme », puis crée.
  - **Création en brouillons**, rien de publié :
    - `plans` relié à l’objectif, avec les paramètres, les risques et l’acceptation ;
    - `plan_blocks` par phase ;
    - séances reliées au programme (`workouts.plan_id`).

    Le coach relit, ajuste, puis publie semaine par semaine (« Publier la semaine », D-051). Migration `20261119150000` ; contrat `createProgram`.
  - **Écran** : « 📅 Générer le programme » sous la décision du coach et à côté des objectifs validés. La page affiche les paramètres (premier lundi, jours), le résumé (départ → pic, séance longue), les risques, puis chaque semaine avec sa phase, son volume (barre) et ses séances.
- **Preuve.**
  - 5 tests du domaine :
    - phases et tremplin depuis le volume actuel ;
    - séance longue nécessaire atteinte avant l’affûtage, course le jour J, allure de course si chrono ;
    - jours choisis, séance longue le week-end ;
    - préparation courte toujours à la hauteur, avec risques ;
    - vélo.
  - 2 tests serveur :
    - objectif non validé : aperçu possible, création refusée ;
    - risques à accepter ; lundi obligatoire ; élève refusé ;
    - brouillons invisibles pour l’élève, phases du tremplin à l’affûtage, programme invisible pour l’élève ;
    - **création identique à l’aperçu**, semaine par semaine.
  - Contrat vérifié. `npm test` : 212 passés.
  - Navigateur (Marine, Camille, semi au 17 janvier, mardi, jeudi et samedi) :
    - 8 semaines : 1 h 35, 1 h 35, 1 h 45, 1 h 55 (tremplin), 2 h 15, 2 h 20, 2 h 40 (pic, séance longue d’1 h 15), affûtage, course ;
    - risques : semaine 1 +27 % par rapport à ce qu’elle fait, semaine 5 +17 %, délai ;
    - risques acceptés, programme créé en brouillons, « Publier la semaine (3) ».
- **Écarts et réglages en route.**
  - Les premiers risques étaient calculés sur des volumes théoriques. Ils le sont désormais sur les semaines planifiées.
  - Le nombre de séances suit les jours choisis.
  - Les séances de qualité sont dimensionnées pour lisser les hausses.
  - Le programme de démonstration de Camille a été créé avant un redémarrage du serveur, avec une version précédente du module : ses footings du tremplin font 30 minutes au lieu de 20. Un test garantit désormais que la création reproduit l’aperçu.
- **À venir.** Zones et paliers par niveau validés par le fondateur. (Bibliothèque et « Pourquoi cette séance ? » : D-062 ; régénération partielle : D-063.)

## D-062 · Générateur : séances de la bibliothèque du coach d’abord, « Pourquoi cette séance ? » · 2026-11-19

- **Inspiration.** Le moteur de Foulée compose ses programmes à partir de la bibliothèque du coach et explique chaque séance (AUDIT_FOULEE).
- **Décision.**
  - Pour chaque séance de qualité (tempo, seuil, VMA) et chaque séance longue, le générateur cherche d’abord dans la bibliothèque du coach une séance :
    - du même sport ;
    - de la même catégorie (tempo → « tempo », seuil → « threshold », VMA → « intervals », longue → « long ») ;
    - d’une durée proche de ce qui est prévu : ±30 % pour la qualité, ±15 % pour la séance longue, pour ne pas fausser la progression.
  - Parmi celles qui conviennent, la moins utilisée dans le programme passe d’abord (alternance), puis la plus proche en durée. Sinon, le générateur construit la séance comme avant. La séance à allure de course n’est jamais prise dans la bibliothèque, car elle dépend du chrono validé.
  - Une séance reprise garde son titre, ses blocs et ses consignes. Les risques restent calculés sur les durées réellement retenues.
  - Chaque séance porte sa raison (phase et rôle), par exemple « Tremplin : première intensité, légère, pour habituer le corps, environ 25′. Choisie dans ta bibliothèque (20 min pour 25 visées). »
  - **Aperçu** : 📚 sur les séances reprises, nombre de séances venant de la bibliothèque. Un toucher sur une séance ouvre « Pourquoi cette séance ? ».
  - **Brouillons** : les consignes contiennent la semaine et la phase, « Pourquoi cette séance ? … », puis les consignes de la bibliothèque. L’élève les lira une fois la semaine publiée ; le coach peut les modifier avant.
  - Pas de migration.
- **Preuve.**
  - Test du domaine : séances de bibliothèque choisies en alternance ; séance d’un autre sport ignorée ; séance longue prise seulement si la durée est proche ; toute séance a sa raison.
  - Test serveur : la bibliothèque de Marine est lue ; la séance « Seuil maison » est reprise avec ses consignes ; chaque brouillon contient « Pourquoi cette séance ? ».
  - `npm test` : 213 passés (+3 PostgreSQL), typecheck OK.
  - Navigateur (Marine, Camille, semi) : 2 séances viennent de la bibliothèque démo (Tempo 20 min, Séries 3 × (5 × 300 m)). Leur explication s’ouvre au toucher.
- **Limite.** Les séances de la bibliothèque de démonstration sont souvent sans échauffement, donc plus courtes. Une séance de 55 minutes n’est retenue que si le programme prévoit environ 45 à 75 minutes à cet endroit. À régler avec les vraies séances du fondateur.

## D-063 · Régénération partielle d’un programme, différences avant d’appliquer, séances protégées · 2026-11-19

- **Source.** Complément du fondateur, § 6 : « régénérer uniquement la partie demandée. Présenter les différences et protéger les séances passées et déjà réalisées » (CE-P-06). Inspiré de l’éditeur de Foulée (verrous, différences).
- **Décision.**
  - Depuis la page Programme d’un objectif, « Programme déjà créé » → **Régénérer une partie**. Le coach choisit :
    - les semaines, de … à … (par défaut, de la semaine en cours à la fin) ;
    - les jours d’entraînement.
  - Le programme est recalculé depuis **le même lundi de départ et le même volume de départ** qu’à la création, pour garder les phases alignées. Il utilise la décision actuelle du coach sur l’objectif, la bibliothèque du jour et les jours choisis.
  - **Séances protégées**, jamais touchées (🔒) :
    - passées ;
    - réalisées, c’est-à-dire avec un retour de l’élève ;
    - **retouchées par le coach** : la révision de travail diffère de celle écrite par le générateur. La nouvelle colonne `workouts.generated_revision` le note (migration `20261119160000`). Les programmes déjà créés sont marqués à la révision 1.

    La séance recalculée pour le jour d’une séance protégée n’est pas ajoutée, et l’écran le dit.
  - Les autres séances, dans les semaines demandées, sont comparées jour par jour (titre et blocs, sans tenir compte de l’ordre des clés JSON) :
    - inchangées (=) ;
    - modifiées (✎, avec la durée quand le titre reste le même) ;
    - ajoutées (+) ;
    - retirées (−, révision d’annulation « Retirée : programme régénéré »).
  - **Différences avant d’appliquer**, semaine par semaine, avec les risques du programme recalculé. Si un risque n’est pas une simple vigilance, le coach coche son accord. L’application est refusée (409) si une séance a changé depuis l’aperçu (séances et révisions vues).
  - **Publication explicite.** Tout reste en brouillons. Une séance déjà publiée reçoit une nouvelle version de travail : l’élève garde la version publiée jusqu’à « Publier la semaine ».
  - Le programme garde la trace de chaque régénération (`generator.regenerations` : semaines, jours, nombres de changements, acceptation des risques). Ses phases (`plan_blocks`) sont recalculées.
  - Contrat `regenerateProgram` (POST `/workspaces/{wid}/athletes/{aid}/plans/{pid}/regenerate`).
  - **Écran Séances.** Une séance annulée jamais publiée n’est plus affichée. Une séance annulée après publication est barrée, « Annulée · à republier ». Avant cela, les séances retirées par « Adapter la semaine » restaient affichées comme des brouillons.
- **Preuve.**
  - 3 tests du domaine :
    - mêmes paramètres, aucune différence ;
    - nouveaux jours à partir de la semaine 6, avec séances passées, réalisées et retouchées protégées, et rien avant la semaine 6 ;
    - une seule semaine, séance annulée ignorée, consignes avec la raison.
  - 1 test serveur :
    - semaines 2 à 3 avec nouveaux jours ; retouche du coach gardée ; semaines 1 et 4 intactes ;
    - aperçu périmé refusé ; élève et autre coach refusés ;
    - l’élève voit toujours la semaine publiée telle quelle ;
    - recalcul identique ensuite ; trace de la régénération.
  - Contrat vérifié. `npm test` : 217 passés (+3 PostgreSQL), typecheck OK.
  - Navigateur (Marine, programme de démonstration de Camille) :
    - semaines 2 à 3 passées de mardi, jeudi et samedi à lundi, mercredi et samedi ;
    - 4 ajoutées, 4 retirées, 2 inchangées, dont « Tempo 20 min » 📚 de la bibliothèque ;
    - risques acceptés, appliqué ; Séances affiche lundi, mercredi et samedi, « Publier la semaine (3) ».
- **Limite.** Une séance isolée se régénère en choisissant sa semaine, ce qui recalcule aussi les autres séances non protégées de cette semaine. Il n’y a pas encore de choix séance par séance.

## D-064 · Plusieurs activités de la montre par séance, correction possible, aucun double comptage · 2026-11-19

- **Source.** Complément du fondateur, § 7 : « l’association d’une ou plusieurs activités réalisées à la séance prescrite, leur ajout ou retrait et la correction d’un rapprochement erroné ». Story CE-X-03 : « plusieurs activités par séance, correction possible, aucun double comptage ».
- **Décision.**
  - Dans « Mon retour », l’élève peut importer **un ou plusieurs fichiers** (.fit, .tcx, .gpx), par exemple un échauffement et une course enregistrés à part, ou une montre coupée en route.
    - Chaque activité est listée (sport, durée, distance, jour et heure) avec **Retirer**.
    - Durée et distance sont **additionnées**. Elles suivent les ajouts et retraits tant que l’élève ne les corrige pas à la main.
    - Les alertes « autre jour » et « autre sport » restent données pour chaque activité.
  - **Comme D-048, le fichier ne quitte pas l’appareil.** Seul son résumé est envoyé et conservé, dans la table `workout_activities` (migration `20261119170000`) : format, sport, début, durée, distance. Pas de fréquence cardiaque, de puissance ni de positions.
  - **Aucun double comptage.**
    - Chaque activité a une empreinte (format, sport, début, durée, distance), unique par élève.
    - Le même fichier ajouté deux fois au même retour est refusé dans le formulaire et par le serveur.
    - Une activité déjà rattachée à une autre séance est refusée : « Cette activité est déjà rattachée à « titre » du date. Retire-la d’abord de cette séance pour la déplacer ici. »
  - **Correction.**
    - L’élève retire l’activité de la mauvaise séance (en corrigeant ce retour), puis l’ajoute à la bonne.
    - Les activités envoyées remplacent celles de la séance.
    - Une séance déclarée non réalisée ou reportée perd ses activités.
  - **Coach.** Le retour affiche « Provenance : Additionnée de N activités de sa montre » et la liste des activités. Les statistiques gardent la durée et la distance déclarées du retour : elles ne comptent donc les activités qu’une fois.
  - Lecture sous RLS : l’élève et le coach affecté seulement. Écriture par la commande du retour uniquement. Contrat `saveFeedback` complété (`activities`, `FeedbackActivity`).
- **Preuve.**
  - 2 tests :
    - domaine : empreinte stable, totaux, doublons et séance non faite refusés, activité vide refusée ;
    - serveur : deux activités sur une séance, renvoi sans duplication, la même refusée sur une autre séance avec le message, retirée puis rattachée ailleurs, séance non faite sans activité, autre élève sans accès.
  - Contrat vérifié. `npm test` : 219 passés (+3 PostgreSQL), typecheck OK.
  - Navigateur, Camille, « Footing facile » du 17 novembre, avec deux fichiers TCX fabriqués :
    - échauffement de 10 min et 1,6 km, course de 25 min et 4,7 km : « 2 activités rattachées », 35 min et 6,3 km additionnés ;
    - « Retirer » donne 25 min et 4,7 km ; ré-import refusé, « cette activité est déjà ajoutée » ;
    - envoi enregistré. Marine lit « Additionnée de 2 activités de sa montre » et les deux activités, allure 5:33 /km.
- **Non fait.** Déplacer une activité en un geste depuis l’autre séance. Rapprochement automatique (plus tard, avec Strava ou Garmin).

## D-065 · Créneau de travail et durée estimée des tâches · 2026-11-19

- **Source.** Complément du fondateur, § 4. Une tâche a une « estimation de durée facultative ». Le planning « distingue l’échéance d’une tâche, son éventuel créneau de travail et l’horaire fixe d’un rendez-vous ».
- **Décision.**
  - Une tâche humaine peut porter :
    - un **créneau de travail** : jour, et heure facultative ;
    - une **durée estimée** : 5 min à 8 h.

    Ces informations s’ajoutent à l’échéance sans la remplacer. L’échéance dit « pour quand », le créneau dit « quand je m’y mets ». Migration `20261119180000` : `slot_on`, `slot_time`, `estimate_min`. Une heure sans jour est refusée en base et au serveur. Retirer le jour retire l’heure.
  - **Planning.**
    - Une tâche se range au jour de son créneau s’il précède l’échéance (`workDate`). Un créneau passé n’est plus un plan : la tâche retrouve son échéance et n’est « en retard » que si l’échéance l’est.
    - La ligne de la tâche montre « Échéance : … · 🕘 aujourd’hui à 17:00 · ≈ 45 min ».
    - L’agenda de la semaine montre les créneaux (« 🕘 14:30 · titre · élève · 45 min · créneau de travail ») à part des rendez-vous, qui gardent leur horaire fixe.
    - **Charge estimée aujourd’hui** : créneaux du jour, tâches sans créneau dues ou en retard, et durée des rendez-vous. Le nombre de tâches sans estimation est signalé.
  - **Formulaires.** « + Tâche » contient « Quand je m’y mets » (jour, heure, durée estimée). Sur une tâche existante, « 🕘 Planifier » ou « 🕘 Créneau » permet de modifier ou de retirer le créneau.
  - **Récurrence (D-059).** L’occurrence suivante garde le même écart entre créneau et échéance, la même heure et la même estimation.
  - Contrat `createTask`, `updateTask` et `task` complétés.
- **Preuve.**
  - Test serveur :
    - format des durées ; écart conservé par la récurrence ; jour de travail, y compris créneau après l’échéance et créneau passé ; charge du jour ;
    - heure sans jour et estimation hors bornes refusées ;
    - créneau visible dans l’agenda et dans les tâches ;
    - retrait du jour, puis heure seule refusée ;
    - clôture : occurrence suivante à +7 jours, même heure, même estimation.
  - Contrat vérifié. `npm test` : 220 passés (+3 PostgreSQL), typecheck OK.
  - Navigateur (Marine) :
    - tâche « Préparer le bloc de décembre de Noah », échéance samedi, créneau demain à 14:30, 45 min : visible dans la liste et dans l’agenda de vendredi ;
    - créneau déplacé à aujourd’hui 17:00 : la tâche passe dans « Aujourd’hui » et l’agenda de jeudi la montre ;
    - « Charge estimée aujourd’hui : 45 min (45 min de tâches, 1 tâche sans estimation) ».

## D-066 · Bilan : temps disponible, préférences, matériel et contraintes · 2026-11-19

- **Source.** Complément du fondateur, § 6 : « Le bilan rassemble […] jours et temps disponibles, matériel, préférences et contraintes utiles. Les informations sensibles éventuelles suivent un traitement défini. » COUVERTURE : « Matériel et préférences à ajouter ».
- **Décision.**
  - Deux écrans facultatifs dans le bilan, après les jours disponibles. Ils ne bloquent jamais l’envoi. Ce sont les mêmes pour l’élève et pour le coach en entretien (questions à la troisième personne).
    - **Temps et habitudes** :
      - temps pour une séance un jour de semaine : moins de 45 min, 45 min à 1 h, 1 h à 1 h 30, plus d’1 h 30 ;
      - moment préféré : matin, midi, soir, ça dépend ;
      - jour préféré pour la séance longue, choisi parmi les jours disponibles.
    - **Matériel et contraintes** :
      - matériel proposé selon le sport : montre GPS, capteur de puissance, home trainer, vélo de route, VTT ou gravel, tapis, piste, piscine, eau libre, salle de renforcement ;
      - une phrase de contraintes pratiques (300 caractères), avec le rappel « Pas d’information médicale ici ».
    - Aucun capteur de fréquence cardiaque n’est proposé, en attendant la décision sur les données de santé.
  - Migration `20261119190000` : `weekday_minutes`, `preferred_time`, `long_day`, `equipment` (liste fermée), `practical_constraints`.
  - Comme le reste du bilan, ces réponses ont une provenance (élève ou entretien), un historique de versions, et le coach les confirme. Elles s’affichent dans la fiche (section Bilan) et dans le récapitulatif.
  - La page Réglages de l’élève renvoie ces réponses telles quelles quand il enregistre son profil, pour ne rien effacer.
  - **Générateur (D-061)** :
    - la séance longue tombe le jour préféré s’il fait partie des jours choisis ;
    - si une séance du lundi au vendredi dépasse le temps disponible, le coach est prévenu (vigilance, sans blocage) : nombre de séances, la plus longue, « Déplace-la au week-end ou raccourcis-la ».
  - Contrat : profil, bilan de l’élève, entretien, brouillon (écrans `time` et `equipment`).
- **Preuve.**
  - Tests du domaine :
    - écrans ajoutés au parcours ; valeurs bornées, matériel inconnu refusé (dont un capteur cardiaque) ; matériel selon le sport ; complétude inchangée ;
    - générateur : jour préféré respecté, ou ignoré s’il n’est pas choisi ; vigilance « Temps en semaine » seulement au-delà du plafond.
  - Test serveur : réponses d’entretien enregistrées et marquées « entretien », versionnées, gardées quand l’élève renvoie son profil inchangé.
  - Contrat vérifié. `npm test` : 223 passés (+3 PostgreSQL), typecheck OK.
  - Navigateur (Marine, entretien de Camille) :
    - seuls les jours disponibles (mar., jeu., sam.) sont proposés pour la séance longue ;
    - matériel de course proposé (montre, tapis, piste, renforcement) ;
    - retour au récapitulatif, enregistrement ; la fiche montre les 5 réponses marquées « Entretien » ;
    - programme de Camille : aucune séance de semaine au-delà de 45 min, donc pas de vigilance.
- **Incident.** Pendant quelques instants, le serveur de dev a utilisé le nouveau code avant que la migration soit appliquée. Une fiche élève de l’espace du fondateur a alors affiché une erreur (« column weekday_minutes does not exist »). Désormais, la migration est appliquée avant le code qui la lit.

## D-067 · Notifications : centre dans l’application, e-mails courts sans contenu, réglage par personne · 2026-11-19

- **Source.** Backlog C25-01, C25-07, C25-08, C25-09 et CE-E-06 (en partie) ; docs/06_API.md (`notifications`, lecture idempotente) ; COUVERTURE : « Notifications par e-mail ou push à ajouter ». La table `notifications` existait sans être utilisée.
- **Décision.**
  - **Événements**, créés dans la transaction de la commande qui les cause. La personne qui agit n’est jamais notifiée.
    - Séances publiées → l’élève.
    - Message privé → l’autre partie : l’élève, ou ses coachs affectés. Les annonces de rendez-vous passent par ce même fil.
    - Retour de séance (premier envoi) → ses coachs.
    - Bilan envoyé par l’élève → ses coachs.
    - Les fils de groupe ne notifient pas encore.
  - **Regroupement (C25-07).** Tant qu’une notification du même type pour le même élève n’est pas lue, elle est remontée (« Ton coach a publié 3 séances », « 2 messages ») au lieu d’en créer une autre.
  - **Sans contenu.** Seuls le type, l’élève concerné, un nombre et l’objet sont gardés. L’e-mail dit ce qui s’est passé et donne un lien, jamais le texte d’un message ni une donnée de séance.
  - **E-mails.**
    - Envoyés après la validation de la commande, sans la retarder ni la faire échouer.
    - Réglage par personne et par espace : « l’essentiel » (par défaut) ou « aucun ».
    - L’essentiel = séances publiées et messages pour l’élève, messages et retours pour le coach.
    - Au plus un e-mail par type toutes les 3 heures ; les suivants restent dans l’application (`email_state` : pending, sent, skipped, failed, none).
    - En développement, ils partent vers Mailpit (boîte de test locale). En production, l’envoi reste refusé tant que le fournisseur n’est pas branché.
  - **Lien revérifié (C25-09).** `/n/{espace}/{notification}` marque la notification lue, revérifie les droits actuels et ouvre l’écran utile (séance, fil, retour à traiter, bilan). Si l’accès a été retiré, la page « Accès retiré » le dit.
  - **Centre (C25-08).**
    - Coach : entrée « Notifications » dans le menu, avec le nombre de non lues.
    - Élève : cloche 🔔 en haut, hors des quatre onglets.
    - Liste, « Tout marquer lu », réglage des e-mails.
    - Lecture sous RLS : destinataire et appartenance actuelle.
  - Migration `20261119200000` (colonnes de `notifications`, table `notification_settings`). Contrat : `markNotificationRead`, `markAllNotificationsRead`, `saveNotificationSettings`.
- **Preuve.**
  - Test serveur :
    - publication notifiée à l’élève, jamais à l’auteur, e-mail avec lien ; republication sans nouvelle notification ;
    - deux messages regroupés (« 2 »), texte absent des e-mails ; après lecture, nouvelle notification sans nouvel e-mail dans la fenêtre ;
    - réglage « aucun » ; lien ouvrant le fil et marquant lu ; autre utilisateur refusé ;
    - retour notifié au coach, lien vers le retour à traiter.
  - Navigateur, démo :
    - Marine écrit à Camille. Mailpit reçoit « Nouveau message de ton coach · Atelier Endurance », sans le texte ;
    - Camille voit « 🔔 1 non lue » ; sur téléphone, sa notification ouvre le fil « Ton coach » et le compteur retombe.
- **Non fait.** Push sur téléphone : il demande des clés d’envoi et l’installation d’une bibliothèque, refusée dans cet environnement. Résumé quotidien (C25-02). (Fils de groupe : D-076.)

## D-068 · Bibliothèque Foulée importée, niveaux et phases respectés par le générateur · 2026-11-19

- **Instruction du fondateur.** « Tu peux importer la bibliothèque de séances de foulée » (19 novembre 2026). Cela vaut accord écrit pour reprendre le contenu de la bibliothèque, comme le demandait AUDIT_FOULEE (CE-B-08).
- **Source disponible.** Le code de Foulée (`src/data/library.ts`) n’est ni sur le poste ni accessible (dépôt `foul-e`). Le dossier de transmission en donne :
  - annexe F : 79 familles, 324 séances, et pour chaque famille son type, le nombre de paliers, le premier et le dernier palier, les niveaux (D, I, C) et les phases ;
  - annexe H : les 7 zones et la notation, identiques aux nôtres.
- **Décision.**
  - Module `foulee-library` : les 324 séances, famille par famille.
    - Premier et dernier palier : titres de Foulée.
    - Paliers intermédiaires : recalculés par progression régulière, comme Foulée les avait interpolés depuis les programmes du coach. Chacun le dit dans ses consignes (« Palier recalculé … à vérifier »).
    - Structure écrite en zones : échauffement de 15′ en Z2 et retour au calme de 10′ en Z1 pour la qualité ; récupérations et notes (« allure course », « en côte ») selon le type.
  - Les consignes donnent la famille, le palier, les niveaux et les phases. Les mêmes informations sont gardées dans `payload.meta`, qui est conservé quand le coach modifie la séance.
  - Catégories :
    - footing → endurance (récupération, technique) ; sortie longue → sortie longue ;
    - VMA et fartlek → fractionné ; tempo et seuil → tempo et seuil ; côtes → côtes ;
    - allure spécifique et tests → « course / test » (jamais prise pour l’allure de course du générateur) ;
    - renforcement, mobilité et pliométrie → renforcement ou technique.
  - **Import.** Bouton « 🏃 Importer la bibliothèque Foulée » dans Bibliothèque, avec confirmation. Rien n’est doublé (même titre). Rejouer complète seulement les niveaux et phases manquants. Contrat `addFouleeLibrary`.
  - **Générateur (D-062).** Une séance qui déclare des niveaux n’est choisie que pour un élève de ce niveau : débutant → D, intermédiaire → I, avancé et compétiteur → C. Une séance qui déclare des phases n’est choisie que dans une phase compatible :
    - tremplin → reprise, base ;
    - développement → base, développement, spécifique ;
    - semaine allégée → base, développement ;
    - affûtage → affûtage, spécifique.
  - **Espace du fondateur.** Import fait par la même commande, au nom de « Coach Paul » (audité) : 324 séances ajoutées aux 11 existantes, aucune modifiée. Le programme d’Emma (débutante, semi) en reprend 23 sur 56, dont les sorties longues en blocs réservées aux débutants.
- **Preuve.**
  - Tests du domaine :
    - 324 séances en 79 familles, toutes lisibles, titres uniques ; paliers intermédiaires signalés ;
    - premiers et derniers paliers identiques à l’annexe ; progression croissante ; catégories ;
    - générateur : niveau intermédiaire, jamais une séance réservée aux débutants ; en tremplin, seulement reprise ou base.
  - Test serveur : 324 ajoutées, rejouer n’ajoute rien, élève refusé.
  - Navigateur (démo) : import par le bouton, le bouton disparaît une fois tout importé.
- **Paliers calculés validés par le fondateur (D-077)** : le fichier d’origine n’est plus attendu.

## D-069 · Objectif validé : la génération du programme devient la suite logique · 2026-11-19

- **Retour du fondateur.** « Je ne vois pas où générer le programme pour Emma maintenant que son objectif est rempli, ça doit être la suite logique une fois que je valide son objectif malgré les points d’attention. »
- **Décision.**
  - La première validation d’un objectif (Faisabilité → Ta décision) ouvre directement le générateur, où les points d’attention sont rappelés.
  - Tant qu’un objectif validé et encore prévu n’a pas de programme généré, un bandeau « Prochaine étape : … 📅 Générer le programme » s’affiche en haut de la fiche de l’élève et de Séances.
- **Preuve.**
  - Test serveur : bandeau absent avant validation, présent après, absent une fois le programme créé, invisible pour l’élève.
  - Emma (espace du fondateur) : son objectif « Semi marathon en moins de 2h » est détecté.
  - Navigateur (démo, Noah) : la validation ouvre le générateur ; Séances montre le bandeau.

## D-070 · CoachOS installable sur l’écran d’accueil du téléphone · 2026-11-19

- **Source.** Story CE-E-06 : « Installation sur téléphone, rappels du matin et du soir, préférences par niveau ». Le journal du serveur montrait que l’iPhone demandait `/apple-touch-icon.png`, absente.
- **Décision.**
  - Manifeste `/manifest.webmanifest` : nom CoachOS, ouverture en plein écran (`standalone`), départ sur `/` (chacun retrouve son espace après connexion), langue fr-BE, couleurs de la marque.
  - Icônes dessinées par Next.js à la demande (`next/og`), sans image ni bibliothèque ajoutée :
    - 192 et 512 px, coins arrondis ;
    - 512 px « maskable » avec marge de sécurité pour Android ;
    - 180 px carrée pour l’iPhone, qui arrondit lui-même.
  - Métadonnées : nom sur l’écran d’accueil, barre d’état standard (rien ne passe sous l’encoche), couleur de thème claire et sombre.
- **Preuve.** Navigateur :
  - manifeste servi (standalone, 3 icônes), icônes en PNG (200), adresse inconnue en 404 ;
  - balises présentes : manifest, apple-touch-icon, theme-color, apple-mobile-web-app ;
  - icône vérifiée visuellement.
  - `npm test` : 231 passés.
- **Non fait.** Fonctionnement hors ligne et rappels du matin et du soir : ils demandent un service d’arrière-plan et l’envoi de notifications push, soit des clés d’envoi et une bibliothèque à installer. Essai d’installation sur un vrai téléphone (par le fondateur).

## D-071 · « Ajuster avec l’IA » : l’IA propose des réglages, le moteur construit, le coach décide · 2026-11-19

- **Instruction du fondateur.** « et le générateur ia ? », puis « Oui, sur la démo » : construire la couche IA, d’abord sur les données fictives.
- **Cadre.** docs/08_AI_ASSISTANT.md (module « adaptation » : le moteur calcule, l’IA explique ou propose ; brouillons internes ; décision humaine), D-026 (« entraîner l’IA comme le coach » sans réentraîner de modèle), CLAUDE.md (pas de données Strava, voie manuelle utilisable).
- **Décision.**
  - **Réglages bornés du générateur** (`programTweaksSchema`) :
    - séances de qualité par semaine au plus (0 à 2) ;
    - types de qualité à éviter (VMA, seuil, tempo) ;
    - volume des séances autres que la longue (70 à 110 %) ;
    - sorties longues progressives ;
    - jour de la sortie longue ; jours d’entraînement.

    Ils changent la façon d’atteindre l’objectif, jamais l’objectif : la séance longue nécessaire est gardée. Un volume réduit ou l’absence de qualité est signalé comme risque. Sans réglage, le programme est identique au précédent.
  - **L’IA traduit la demande du coach en réglages, rien d’autre.**
    - Sortie structurée validée par schéma.
    - Abstention quand rien n’est reconnu, avec ce qu’il faut préciser.
    - Elle ne crée aucune séance et ne publie rien. Le moteur recalcule, montre les différences et les risques ; le coach crée ou applique en brouillons.
  - **Données envoyées** : faits structurés (sport, distance, semaines, niveau, jours, réglages actuels) et la demande du coach, prénom et nom de l’élève remplacés par « l’élève ». Jamais de message, santé, note privée ni donnée Strava.
  - **Trace.** Chaque proposition est enregistrée dans `ai_suggestions` (module `adaptation`, modèle, version du prompt `tweaks-v1`, empreinte des faits, demande expurgée, réponse). Elle passe à « acceptée » quand le coach crée ou régénère avec elle. Les réglages sont gardés dans le programme et repris à la régénération.
  - **Écran.**
    - Carte « ✨ Ajuster avec l’IA » sur la page Programme et sur Régénérer, avec exemples cliquables.
    - Le bandeau rappelle les réglages et l’explication de l’IA ; « Sans réglage » revient au calcul de base.
    - Les réglages vivent dans l’adresse de la page (rien n’est enregistré avant « Créer » ou « Appliquer »).
  - **Fournisseur.**
    - Claude, avec le SDK officiel `@anthropic-ai/sdk` 1.10.0, version épinglée, installé avec l’accord du fondateur (« Oui, installe-le »), dès que `ANTHROPIC_API_KEY` est défini dans `apps/web/.env.local`. Ce fichier est ignoré par Git.
    - Sinon, ou avec `COACHOS_AI=simulation`, l’IA simulée : règles de mots-clés en français, même format de réponse, même validation.
    - La carte affiche « Claude » ou « IA simulée ».
  - **Appel (`askModel`, seul point d’appel).**
    - Modèle `claude-opus-5-5`, effort `low`, sortie structurée au schéma JSON des réglages (les bornes, non prises en charge par les sorties structurées, sont revérifiées par `aiProposalSchema`).
    - Relance serveur sur un modèle de secours si le modèle décline (`fallbacks: "default"`).
    - Délai de 20 s, une seule nouvelle tentative. `max_tokens` à 4000 parce que la réflexion de ce modèle ne se désactive pas ; docs/08 prévoyait 350 en sortie, la réponse utile reste courte.
    - Refus : abstention. Réponse illisible ou hors bornes, clé refusée, saturation ou panne : erreur claire qui rappelle la voie manuelle. Journal sans contenu.
  - Contrat : `proposeProgramTweaks` (POST `…/goals/{gid}/ai-tweaks`), `ProgramTweaks`, `tweaks` et `suggestionId` sur `createProgram` et `regenerateProgram`.
- **Preuve.**
  - 3 tests du domaine :
    - sans réglage, programme identique ; réglages respectés (qualité, VMA écartée, jour et progressivité de la longue) ;
    - volume réduit sans toucher la séance longue nécessaire, risque signalé ;
    - simulation des demandes courantes, abstention, retrait du nom.
  - 1 test serveur : proposition tracée sans le nom, élève refusé, demande trop courte refusée, abstention ; création avec réglages conforme à l’aperçu, réglages gardés, proposition « acceptée ».
  - `npm test` : 235 passés (+3 PostgreSQL), typecheck OK.
  - Navigateur (démo, Marine, objectif de Noah) : « Noah est fatigué : moins de fractionné et sortie longue le samedi » a donné :
    - une séance de qualité par semaine au plus, volume à 85 %, longue le samedi ;
    - séances de qualité passées de 29 à 18 ; explication affichée ;
    - nom retiré dans la trace.
- **Preuve du branchement (sans appel réel ni coût).** Test serveur avec un client remplacé :
  - réponse validée et appliquée ; modèle `claude-opus-5-5`, secours activé, nom de l’élève absent du message envoyé ;
  - refus traduit en abstention ;
  - volume de 200 %, JSON tronqué et clé refusée rejetés avec un message clair.
  - `npm test` : 236 passés.
- **Reste au fondateur.**
  1. Créer une clé sur console.anthropic.com et l’ajouter à `apps/web/.env.local` (`ANTHROPIC_API_KEY=…`), jamais dans le chat ; relancer le serveur.
  2. Prévenir les élèves que des données d’entraînement anonymisées passent par ce service avant l’usage réel.
- **Ensuite.** Apprendre la méthode du coach à partir de ses corrections (règles candidates à confirmer, Coach DNA) ; brouillons de messages.

## D-072 · « Ma méthode » (Coach DNA) : règles du coach appliquées par le générateur, apprises de ses corrections · 2026-11-19

- **Source.** docs/09_COACH_DNA.md (profil versionné, règles typées, candidates apprises des corrections confirmées) ; D-026 (« entraîner l’IA comme le coach » sans réentraîner de modèle) ; COUVERTURE § 9 (« méthode » absente de la navigation). Choisi par le fondateur (« vasy ») parmi les chantiers faisables sans argent ni accès.
- **Décision.**
  - **Profil** dans `coach_dna`, table du schéma initial jusqu’ici inutilisée. Une version active par coach et par espace (index unique existant). Chaque enregistrement crée une version immuable ; la précédente passe « retired ». Migration `20261119210000` : raison et auteur de la version.
    - Contenu : philosophie (500 caractères), style (direct, encourageant ou pédagogique, sans effet sur les séances pour l’instant), règles typées, propositions écartées.
    - Version attendue contrôlée (409 si modifiée ailleurs) ; coach seulement ; visible de lui seul.
  - **Règles** : les cinq réglages bornés du générateur (D-071), avec une portée facultative (niveau ou sport) :
    - éviter un type de qualité ;
    - limiter la qualité par semaine ;
    - volume par défaut ;
    - jour de la sortie longue ;
    - sorties longues progressives.

    Aucun texte exécutable.
  - **Application.** Le générateur part des règles qui s’appliquent à l’élève : la plus précise l’emporte, les types évités s’additionnent. Les réglages d’un programme précis (à la main ou par l’IA) restent prioritaires. La page Programme affiche « Ta méthode s’applique : … » ; la version de la méthode est notée dans le programme créé. Les programmes déjà créés ne changent pas.
  - **Apprentissage (docs/09).**
    - Observations : séances générées puis retouchées par le coach (sortie longue déplacée, qualité retirée ou adoucie, séance facile raccourcie d’au moins 10 %, longue rendue progressive) et réglages appliqués à un programme.
    - Contre-exemples : séances générées publiées sans changement.
    - Une observation par élève et par semaine ; 90 jours ; seulement les programmes créés par ce coach, élèves qui lui sont affectés.
    - Proposition à partir de 5 observations, sur 2 semaines au moins, avec 80 % de concordance. Portée : le niveau ou le sport commun. Volume : médiane des réductions arrondie à 5 %.
    - « Ajouter à ma méthode » crée une nouvelle version, règle marquée « apprise » avec son nombre d’observations. « Pas une règle » l’écarte pour de bon.
    - Écart avec docs/09 : une seule action d’acceptation (pas brouillon puis activation) ; la simulation est la page Programme, qui montre l’effet aussitôt.
  - **Écran** : entrée « Méthode » dans la navigation du coach (Mes règles, Appris de tes corrections, Ma philosophie, Historique).
  - Contrat `saveCoachMethod` (PUT `/workspaces/{wid}/method`), `MethodRule`.
- **Corrigé en route.**
  - **Allure de course sans allure chiffrée** (vélo, natation, chrono inconnu) : le générateur retombait sur de la VMA ou de la PMA, même quand le coach l’écartait. La séance devient « Allure objectif n × 8′ » en Z4.
  - **Téléphone en http** (adresse réseau du Mac, D-070) : `crypto.randomUUID` n’existe pas hors https, donc chaque action aurait échoué. `newKey` construit l’identifiant avec `getRandomValues`.
- **Preuve.**
  - 4 tests du domaine :
    - règles appliquées, la plus précise l’emporte, le programme prime, bornes refusées, générateur conforme ;
    - observations et contre-exemples ;
    - candidates : seuils, doublons, concordance, portée, écartées ou déjà règles, médiane du volume ;
    - VMA écartée en vélo avec chrono (allure objectif, ni VMA ni PMA).
  - 3 tests serveur :
    - versions, conflit, coach seulement, validation ;
    - 6 retouches (longue déplacée au samedi, 2 élèves × 3 semaines) donnent une proposition « samedi, pour les intermédiaires en course à pied ». Acceptée, le générateur l’applique ; un réglage de programme reste prioritaire ;
    - proposition écartée qui ne revient pas.
  - `npm test` : 243 passés (+3 PostgreSQL), typecheck OK.
  - Navigateur (démo, Marine) :
    - règle « pas de séance de VMA / fractionné » ajoutée, version 1 dans l’historique ;
    - page Programme de Noah : « Ta méthode s’applique : … », plus de PMA, « Allure objectif » à la place.
    - La règle reste dans la démo comme exemple.

## D-073 · Résumé de la semaine de chaque élève, sans IA · 2026-11-19

- **Source.** docs/08_AI_ASSISTANT.md, module « summary », première version : « résumé et scores déterministes ». Sa consigne : « Décris prévu, déclaré et manquant, en trois faits au maximum. Termine par une seule question utile. » ; « Une absence de retour ne vaut ni séance manquée ni problème de santé. » Choisi par le fondateur parmi les chantiers faisables sans argent.
- **Décision.**
  - Fonction pure `weekReview`, appliquée aux séances publiées non annulées de la semaine, jusqu’à la veille (le retour du jour peut encore venir).
  - **Trois faits au plus :**
    - séances faites sur prévues, dont en partie ; minutes déclarées pour minutes prévues ;
    - non faites, reportées, sans retour. Une séance sans retour est dite « on ne sait pas si elle a été faite », jamais « manquée » ;
    - effort moyen déclaré (dès 2 valeurs) et séances à 8 ou plus, ressenti « fatigué » ou moins, difficulté la plus fréquente (catégories fermées, non médicales).
  - **Une seule question**, la plus utile, dans cet ordre :
    1. une séance non faite (« Qu’est-ce qui t’a empêché de faire … ? ») ;
    2. au moins deux séances sans retour ;
    3. un effort ou un ressenti élevés ;
    4. une difficulté ;
    5. une semaine complète (« Belle régularité… ») ;
    6. sinon une question ouverte.
  - Moins de deux séances : « Données insuffisantes », sans question.
  - **Fiche de l’élève**, en tête : « Semaine dernière ». Si elle est trop mince, la semaine en cours (séances déjà passées) prend le relais.
  - **« ✉️ Poser la question »** met la question dans la conversation, pour que le coach la relise et l’envoie lui-même : rien n’est envoyé seul.
  - Lecture sous RLS, coach affecté seulement. L’élève lit ses séances par un autre chemin, filtré ; un résumé côté élève viendra avec la progression.
  - Aucun commentaire ni message de l’élève n’est repris.
- **Preuve.**
  - 3 tests du domaine :
    - semaine régulière : faits chiffrés, question de suite ;
    - séance manquée, sans retour, effort élevé : priorité des questions, absence de retour non assimilée à une séance manquée ;
    - données insuffisantes, annulées ignorées, jour même exclu.
  - 1 test serveur : coach affecté seulement.
  - `npm test` : 247 passés (+3 PostgreSQL), typecheck OK.
  - Navigateur (démo, fiche de Camille) :
    - semaine dernière vide, la semaine en cours prend le relais : « 2 séances faites sur 2 · 1 h 15 déclarées pour 1 h 15 prévues », question de régularité ;
    - « Poser la question » ouvre la conversation, question dans la zone de saisie, non envoyée.

## D-074 · Blocs réutilisables dans la bibliothèque · 2026-11-19

- **Source.** Complément du fondateur, § 5 : bibliothèque de « séances, semaines types, blocs de préparation » ; COUVERTURE : « Blocs réutilisables à faire ».
- **Décision.**
  - Un bloc est une partie de séance (échauffement type, série type, retour au calme…), gardé dans `templates` avec `kind = 'block'` et payload `{ sport, blocks }`. Migration `20261119220000` (contrainte de type élargie, migration appliquée avant le code). Sport précis, ou tous les sports.
  - Dans l’éditeur de séance (séance d’un élève et séance de bibliothèque) :
    - **« 💾 Garder des blocs dans ma bibliothèque »** : choisir des blocs de la séance en cours, les nommer, les garder ;
    - **« + Mon bloc… »** à côté des modèles rapides : les ajouter à n’importe quelle séance du même sport.
  - Bibliothèque : section **« Mes blocs »** (contenu lisible, « Retirer » archive le bloc ; les séances qui l’ont utilisé ne changent pas).
  - Un bloc n’est visible que de son auteur. Tri alphabétique français (« Échauffement » avant « Retour »). Cases à cocher nommées pour les lecteurs d’écran.
  - Contrat : `createBlockTemplate`, `archiveBlockTemplate`.
- **Preuve.**
  - Test serveur :
    - création pour un sport ou pour tous ;
    - structure vide et nom vide refusés ; élève refusé ;
    - liste à soi dans l’ordre français ;
    - retrait, réservé à l’auteur ; second retrait refusé.
  - Navigateur (démo, nouvelle séance de Camille) : échauffement ajouté par modèle rapide, gardé comme « Échauffement progressif », proposé dans « + Mon bloc… » et inséré ; visible dans Bibliothèque › Mes blocs.

## D-075 · Source et fraîcheur des mesures dans la fiche · 2026-11-19

- **Source.** COUVERTURE § 3 : « Source, période, fraîcheur des mesures » (à ajouter).
- **Décision.**
  - En tête de « Suivi de l’entraînement », sur 30 jours :
    - montre : dernière activité importée (jour, format), nombre d’activités ;
    - retours : combien, dont mesurés par la montre et saisis à la main.
  - Signal « Rien de nouveau depuis N jours : les chiffres de la fiche datent » au-delà de 14 jours sans activité ni retour, ou « Aucune mesure pour l’instant ».
  - Coach affecté seulement. Aucune donnée de santé.
- **Preuve.**
  - 2 tests du domaine : montre récente et retours mêlés ; saisie à la main seulement, rien depuis 18 jours, rien du tout.
  - 1 test serveur : retours comptés, élève refusé.
  - `npm test` : 251 passés (+3 PostgreSQL), typecheck OK.
  - Navigateur (fiche de Camille) : « Montre : dernière activité importée il y a 2 jours (TCX) · 2 activités sur 30 jours. Retours : 3 sur 30 jours, dont 2 mesurés par la montre et 1 saisi à la main. »

## D-076 · Notifications des fils de groupe · 2026-11-19

- **Source.** Reste de D-067 (« Fils de groupe » non faits).
- **Décision.**
  - Un message dans un fil de groupe (texte, vocal ou annonce de séance de groupe) prévient, sauf l’auteur :
    - les élèves membres qui ont un compte ;
    - les coachs de l’espace (tous peuvent lire les fils de groupe).
  - Type `group_message`, groupe noté (`notifications.team_id`, migration `20261119230000`). Regroupé tant que non lu : « 3 nouveaux messages dans le groupe « … » ».
  - **Dans l’application seulement, sans e-mail** : un groupe animé enverrait trop de courriels.
  - Le lien ouvre le fil de groupe côté élève ou côté coach, après contrôle des droits au clic ; un ancien membre n’y accède plus.
- **Preuve.**
  - Test serveur :
    - deux messages du coach donnent « 2 nouveaux messages dans le groupe « Sortie du dimanche » », sans e-mail ;
    - ni l’auteur ni un non-membre ne sont notifiés ;
    - le lien de l’élève mène au fil côté élève ; quand l’élève répond, le coach est prévenu et son lien mène au fil côté coach.
  - `npm test` : 252 passés (+3 PostgreSQL), typecheck OK.

## D-077 · Paliers Foulée calculés validés ; repères du coach hors des consignes de l’élève · 2026-11-19

- **Instruction du fondateur.** « oui tu peux extrapoler toi même les séances » : les paliers intermédiaires calculés par CoachOS (D-068) deviennent la bibliothèque de référence. Le fichier d’origine `src/data/library.ts` n’est plus attendu.
- **Défaut corrigé.** La note interne de chaque séance Foulée (« Bibliothèque Foulée · famille… palier… Palier recalculé… à vérifier ») était dans ses consignes. Le générateur reprend les consignes de la bibliothèque dans les brouillons (D-062), donc **un élève l’aurait lue** une fois la séance publiée. Vérification faite : aucune séance, brouillon ou publiée, ne la contenait encore.
- **Décision.**
  - Les séances Foulée n’ont plus de consignes. Les repères (famille, palier, niveaux, phases, « calculé ») restent dans `payload.meta`, que seul le coach voit.
  - Dans la bibliothèque, chaque carte porte « Foulée · palier 3/10 · calculé », avec l’infobulle « jamais montré à l’élève ».
  - Rejouer l’import corrige les séances déjà importées : repères complétés, note retirée des consignes. Les séances retouchées par le coach gardent leurs propres consignes.
  - Appliqué par la même commande, audité : espace du fondateur et démo, 324 séances chacun, 0 note restante, 168 paliers marqués « calculé ».
  - Corrigé en route : la section « Mes blocs » (D-074) réutilisait la classe CSS des contenus de cartes de la bibliothèque et changeait leur mise en forme ; classe renommée.
- **Preuve.**
  - Test du domaine : aucune consigne, 168 paliers calculés marqués.
  - Test serveur : import sans note ; une séance à l’ancienne (note, sans repères) est corrigée en rejouant l’import.
  - `npm test` : 252 passés (+3 PostgreSQL), typecheck OK.
  - Navigateur (bibliothèque de la démo) : 324 cartes Foulée, dont 168 « calculé », mise en forme des cartes rétablie.


## D-078 · Régénération : choix séance par séance · 2026-11-19

- **Contexte.** Reste de CE-P-06 (COUVERTURE § 6) : le coach voyait les différences avant d’appliquer (D-063), mais devait tout prendre ou tout laisser.
- **Décision.**
  - Chaque changement proposé (✎ modifiée, + ajoutée, − retirée) a sa case, cochée d’office ; « Tout cocher » et « Tout décocher ».
  - Un changement décoché n’est pas appliqué : la séance actuelle reste telle quelle, ou rien n’est ajouté ce jour-là.
  - La commande reçoit la liste des changements décochés (`skip` : identifiant de séance, ou `add:AAAA-MM-JJ`). Elle refuse si rien n’est coché. La trace de la régénération note le nombre de changements écartés.
  - Le contrôle de l’aperçu (mêmes séances, mêmes révisions) reste inchangé.
  - Corrigé en route : la classe CSS des révisions (`.changed`) encadrait les séances modifiées dans la liste.
- **Preuve.**
  - Test serveur : tout décoché est refusé ; un changement décoché est le seul qui reste à faire au calcul suivant.
  - Navigateur (programme de Camille, démo) : semaines 3 et 4 sur lundi, mercredi, samedi ; deux changements décochés, le bouton devient « Appliquer 4 sur 6 changements en brouillons ». Non appliqué, pour ne pas modifier la démo.

## D-079 · Import de la base d’un coach · 2026-11-19

- **Contexte.** COUVERTURE § 5 « Import de la base de chaque coach » était seulement prévu (D-026 : une fonction pour tout coach). Les exemples anonymisés du fondateur ne sont pas encore arrivés : l’import accepte donc les formats les plus courants plutôt qu’un format précis.
- **Décision.**
  - Bibliothèque → **Importer mes séances**. Trois entrées sont acceptées :
    - un fichier CSV (UTF-8, ou Windows-1252 comme Excel en français) ;
    - des cellules copiées d’un tableur (tabulations) ;
    - une séance par ligne « Titre : séance ».
  - Un classeur (.xlsx, .numbers) est refusé avec la marche à suivre (exporter en CSV ou copier les cellules). Aucune bibliothèque de lecture n’a été ajoutée.
  - Les colonnes sont reconnues par leur nom, en français ou en anglais : titre, sport, catégorie, séance (notation texte D-041), consignes, durée, distance.
  - Une séance écrite librement est gardée dans les consignes, sans structure. Une catégorie absente est devinée d’après le titre (marquée « devinée ») et modifiable ligne par ligne.
  - Tout est lu et vérifié dans le navigateur. Rien n’est envoyé avant **Importer**, et seulement les lignes cochées. Chaque erreur est montrée à sa ligne (L3…), sans perte silencieuse.
  - Doublons : un titre déjà dans la bibliothèque n’est jamais écrasé. Un même titre plus bas dans le fichier est ignoré.
  - Provenance « import » et date dans les repères (`payload.meta`), invisibles de l’élève. Limites : 500 séances, 300 000 caractères et 1 Mo par import.
  - Commande `importLibrary` (coach seulement, idempotente, auditée) ; route `POST …/templates/import` ajoutée au contrat.
- **Preuve.**
  - Domaine : 5 tests (CSV point-virgule, tableur collé, lignes, guillemets RFC 4180, durées et distances en français).
  - Serveur : 4 séances ajoutées puis 0 en rejouant ; élève refusé ; corps invalide refusé ; contrat vérifié.
  - Navigateur, démo, à 375 px sans débordement : exemple lu en tableau, quatre lignes dont deux erreurs expliquées. Une séance importée (« Côtes 8x200m (import) », restée dans la bibliothèque de la démo), puis reconnue comme déjà présente.

## D-080 · Lecture hors ligne de l’espace élève · 2026-11-19

- **Contexte.** COUVERTURE § 7 « hors ligne à venir ». L’élève ouvre sa séance sur le terrain, parfois sans réseau.
- **Décision.**
  - Un service worker (`public/sw.js`) va toujours d’abord sur le réseau. Il garde la dernière version des pages de l’élève (Aujourd’hui, Programme, séances, Progression, Profil, Ton coach ; 40 pages au plus) et les fichiers de l’application.
  - Sans réseau, la page gardée s’affiche avec le bandeau « Hors ligne · page enregistrée le … ». Pour envoyer un retour, il faut attendre le réseau (pas d’envoi différé).
  - Une page jamais ouverte affiche « Pas de réseau ».
  - Jamais gardés : l’API, l’espace coach.
  - Tout est effacé à la déconnexion, au changement d’identité de démonstration et quand la session a expiré (renvoi vers la connexion) : rien ne reste sur un téléphone prêté.
  - Le service worker n’est enregistré qu’en contexte sûr. Il fonctionne donc sur la version publiée en https, pas sur l’adresse http du réseau local utilisée pour la recette sur téléphone (les navigateurs le refusent) ; l’application marche alors comme avant.
- **Preuve.**
  - 3 tests exécutent le vrai fichier avec un réseau et un cache simulés : réseau d’abord, page gardée avec bandeau, écran « Pas de réseau », coach et API jamais gardés, effacement à la déconnexion, au changement d’identité et à l’expiration.
  - Non prouvé : le navigateur intégré à l’application Claude refuse l’enregistrement d’un service worker, alors que le fichier est bien servi (200, JavaScript). L’essai réel se fera sur la version https.

## D-081 · Coûts de l’IA suivis et budget mensuel · 2026-11-19

- **Contexte.** COUVERTURE § 6 « coûts suivis » (table `ai_budget` du SQL de référence). Le fondateur paie le compte Anthropic et n’a pas encore de crédit.
- **Décision.**
  - Chaque appel à Claude enregistre ses jetons facturés et son coût réel dans la proposition (`ai_suggestions.output.usage`). Prix publics : Opus 5.5 à 4 $ (entrée) et 20 $ (sortie) par million de jetons. Un modèle de secours inconnu est compté au prix d’Opus 5.5, marqué comme estimation.
  - Budget mensuel par espace : 10 $ par défaut, réglable sur le serveur (`COACHOS_AI_MONTHLY_BUDGET_USD`).
  - Le pire cas est réservé avant l’appel dans `ai_budget`, puis remplacé par le coût réel. Un appel en échec rend sa réserve.
  - Budget atteint : aucun appel n’est fait, et un message renvoie à la voie manuelle.
  - La simulation ne coûte rien et ne réserve rien.
  - Paramètres (propriétaire) : carte **IA ce mois-ci**, avec le nombre de propositions, le coût réel, le budget et une jauge.
- **Preuve.**
  - Domaine : prix, réserve, budget, affichage.
  - Serveur (client Claude simulé, aucun appel réel) : 1 500 + 300 jetons comptent 0,012 $ ; la réserve revient à 0 ; avec un budget de 0,01 $, la demande est refusée sans appel.
  - Navigateur (démo) : carte affichée dans Paramètres.
  - `npm test` : **264 passés** (+3 PostgreSQL), typecheck OK.

## D-082 · File des retours : reporter un cas, filtre gardé (C09-08) · 2026-11-19

- **Contexte.** Le § 24 du PRD dit : « le coach ouvre la source, lit le résultat et peut reporter ou clore. Reporter exige une date future. » La critère C09-08 dit : « le filtre reste actif lors du retour du détail ». Les deux figuraient dans les manques d’ETAT. L’opération `PATCH /reviews/{rid}` du contrat n’était pas encore implémentée.
- **Décision.**
  - Dans le détail d’un retour, **Reporter à** : Demain, Dans 3 jours ou Lundi prochain, à 7 h dans le fuseau du coach. La date doit être future, à 30 jours au plus.
  - Le cas quitte la file et le compteur, puis revient seul à sa date (rien à planifier côté serveur). Section « Reportés » sur la page Retours, avec « Remettre maintenant ».
  - Une correction du retour par l’élève remet le cas dans la file tout de suite.
  - Clore reste « Marquer comme traité » (la version lue est vérifiée). La commande refuse donc `state: done` (écart de contrat consigné : l’énumération l’accepte, la règle le renvoie au bouton).
  - Filtre de la file : élève, groupe, « avec commentaire » ou « effort 8/10 ou plus ». Il vit dans l’adresse et suit le détail, le retour à la file, « Retour suivant » (pris dans le filtre) et le report.
  - Commande `updateReview` : coach affecté seulement, idempotente, auditée (`review.snooze`, `review.reopen`). Aucune migration : `review_items.state` et `due_at` existaient.
- **Preuve.**
  - Test du domaine et du serveur : date passée refusée ; élève refusé ; cas hors de la file puis de retour à sa date ; remis ; rouvert par une correction de l’élève. Contrat vérifié.
  - Navigateur (démo, Marine) : filtre « Effort 8/10 ou plus », détail, lien de retour avec le filtre ; « Demain » → « Revient ven. 20 nov. à 07 h 00 » ; « Remettre maintenant » rétablit la démo.
  - `npm test` : **266 passés** (+3 PostgreSQL), typecheck OK.

## D-083 · Blocs de plusieurs semaines (programmes types) dans la bibliothèque · 2026-11-19

- **Contexte.** COUVERTURE § 5 demande une bibliothèque de « séances, semaines types, blocs, programmes ». Les semaines types (D-051) ne gardaient qu’une semaine.
- **Décision.**
  - « 💾 Enregistrer comme semaine type » propose **Semaines à garder** : cette semaine seulement, ou 2 à 12 semaines depuis ce lundi.
  - Un bloc garde chaque séance avec son décalage depuis le premier lundi (jour 0 à 83). L’appliquer crée un brouillon par séance sur le même nombre de semaines, à partir de la semaine choisie, dans le fuseau de l’élève. Rien n’est publié ; les séances déjà prévues restent.
  - Bibliothèque › Semaines types : « 3 semaines · 9 séances », jours notés « S2 · Mar ».
  - Les semaines types d’avant restent valables (une semaine). Même table et même `kind`, donc aucune migration. Le contrat accepte `weeks` (1 à 12).
- **Preuve.**
  - Test serveur : bloc de 3 semaines enregistré depuis Camille, appliqué à Noah 4 semaines plus tard, chaque séance au bon jour ; 13 semaines refusées.
  - Navigateur : le choix « Semaines à garder » s’affiche dans Séances › Semaine (non enregistré, pour ne pas encombrer la démo).
  - `npm test` : **267 passés** (+3 PostgreSQL), typecheck OK.

## D-084 · Données de santé : l’exclusion est maintenue · 2026-11-20

- **Contexte.** La décision sur les données de santé (D11) était en attente depuis le début. La nuit du 19 novembre, le fondateur a proposé de faire signer un « cookie » (une case) disant que les données servent seulement à un usage professionnel. Réponse donnée : une telle case ne suffit pas pour des données de santé (RGPD, art. 9). Il faudrait un consentement explicite, propre à chaque usage et retirable, plus des garanties (accès limité au coach, durée de conservation, effacement) et un avis juridique.
- **Décision (fondateur, 20 novembre).** « Gardons l’exclusion pour l’instant. »
  - CoachOS ne recueille aucune donnée de santé : ni douleur, ni blessure, ni antécédent, ni poids, ni aptitude (PAR-Q), ni fréquence cardiaque, ni FC max ou FC seuil.
  - Les garde-fous restent en place : schémas qui refusent les propriétés inconnues, retour sans champ libre « difficulté » (D-025), import FIT et TCX sans fréquence cardiaque, aucun capteur cardiaque proposé.
  - Les écarts avec Foulée (douleur, aptitude, bilan de semaine) restent volontaires.
- **Réexamen.** Sur une nouvelle instruction du fondateur. Ouvrir le jalon santé demandera un écran de consentement dans l’application, avec un consentement par élève et par usage, retirable, ainsi qu’un avis juridique.

## D-085 · Lecture de l’écriture du coach et import d’un ancien programme entier · 2026-11-20

- **Source.**
  - Le fondateur a partagé 7 programmes réels (Google Docs). Ils sont lus en entier ; l’analyse anonymisée est dans [METHODE_FONDATEUR.md](METHODE_FONDATEUR.md).
  - Complément § « import progressif de mes anciens programmes […] avec prévisualisation […] et validation avant insertion ».
- **Constat.** Le lecteur de notation (D-041) ne comprenait presque aucune séance écrite par le fondateur (10 lignes sur 385), par exemple « Footing 45' Z1-2 », « 3*(2km 4’40 + 400m Z1) », « 6x800m à 4:30/km (récup 1’30) » ou « 10’ marche + 8×(1' course + R1'30) ».
- **Décision.**
  - **Lecture tolérante** (`parseNotation(…, { lenient: true })`, réservée à l’import ; l’éditeur reste strict). Ce qu’elle comprend :
    - zones en fourchette ; EF = Z2 ;
    - allures sans « @ » ; temps de passage d’une fraction courte convertis en allure ;
    - « (récup x) », « séparés par R2' », « R1 » = 1 minute ;
    - pyramides « 1' – 2' – 3' … avec R1' entre chaque » ; course/marche, la marche devenant échauffement ou récupération ;
    - « puis » ; durées en fourchette ; coquilles fréquentes (« 15'' Z1 » pour 15 minutes).

    Les mots non compris deviennent des notes de l’étape : rien n’est perdu ni refusé. Un plafond « < 160 bpm » reste une consigne écrite, pas une intensité (D-084).
  - **Import de séances (D-079)** : une écriture libre est désormais structurée, et le texte d’origine reste dans les consignes.
  - **Import d’un programme entier** : Bibliothèque › « Importer un programme ». Le coach colle le texte.
    - **Lecture :**
      - semaines repérées par « S1 », « Semaine 2 », « Semaine 28/09 » ou « 1 semaine de diminution » ;
      - plan, repères et tableaux de vue d’ensemble ignorés ;
      - plusieurs programmes dans un même document : le coach choisit lequel importer.
    - **Séances :**
      - jour écrit gardé (« Mar · », « Dimanche ») ; « Séance 3 (week-end) » = dimanche ; sinon, ordre du document, la dernière séance le dimanche ;
      - « repos » n’est pas une séance ; « bonus » ou « optionnel » = séance optionnelle ; vélo et natation reconnus ;
      - le texte qui suit une séance devient ses consignes.
    - **Aperçu** semaine par semaine : séances à cocher, jour modifiable, nom du programme.
    - **Enregistrement** : programme type (semaine type de plusieurs semaines, D-083, 12 semaines au plus), provenance « import ». Il s’applique ensuite à un élève en brouillons, comme les autres semaines types ; rien n’est publié.
  - Contrat `importProgram` (POST `/workspaces/{wid}/templates/import-program`), coach seulement. Aucune migration.
- **Preuve.**
  - Corpus de 71 séances réelles du fondateur : toutes lues sans erreur.
  - Les 7 documents donnent 14 programmes, avec des semaines et des séances cohérentes (vérifié hors dépôt ; les documents ne sont pas copiés).
  - Tests du domaine (programme fictif écrit dans son style) et test serveur : aperçu → programme type → brouillons aux bons jours pour Noah ; élève refusé, corps invalides refusés. Contrat vérifié.
  - Navigateur (démo, Marine) : exemple importé, visible dans Semaines types (« S2 · Jeu Fractionné »), puis archivé ; aperçu lisible à 375 px.
  - `npm test` : **276 passés** (+3 PostgreSQL), typecheck OK.
- **Limites.**
  - Les zones sont gardées telles qu’écrites ; l’échelle des documents ne suit pas toujours les 7 zones de CoachOS (à trancher).
  - La durée affichée d’une séance en distance sans allure ne compte que ses parties en temps.
  - Les consignes générales du programme (objectif, règles) ne sont pas encore enregistrées avec le programme type.
- **Suite proposée.** Aligner le générateur sur la méthode du fondateur (course/marche, lignes droites, ordre de la qualité, test 5 km, seuils de risque en minutes) : voir METHODE_FONDATEUR.md, après son accord.

## D-086 · Générateur aligné sur la méthode du fondateur · 2026-11-20

- **Instruction du fondateur.** « Oui, aligne-le », en réponse aux écarts relevés dans [METHODE_FONDATEUR.md](METHODE_FONDATEUR.md) (D-085).
- **Décision (course à pied et trail ; vélo et natation inchangés).**
  - **Course/marche** tant que l’élève ne court pas 20′ d’une traite.
    - Départ : 1′ de course pour un débutant ou après une longue coupure.
    - Progression : 8 × (1′ + 1′30 marche) après 10′ de marche active, puis 1′30, 2′, 3′, 4′, 5′, 7′, 10′ et 15′.
    - La sortie du week-end reste la plus longue de la semaine.
    - Aucune séance de qualité pendant la course/marche.
  - **Lignes droites** (4 à 6 × 20″ en fin de footing, sans zone) les semaines du tremplin sans qualité, avant le premier fractionné.
  - **Qualité du court au long** :
    - ordre : 200 m → côtes 30″ → pyramide 1-2-3-2-1′ → 400 m → 1 km ;
    - ensuite, rotation allure de course (2 km au chrono visé, ou 10′ sans chrono), 1 km, 400 m ; 2 km longs à partir du semi ;
    - avec deux qualités par semaine : la vitesse d’abord, puis l’allure, jamais deux fois l’allure ;
    - les types écartés par le coach (D-071, D-072) restent respectés.
  - **Test 5 km en semaine 3**, à la place de la séance longue, pour caler les allures. Conditions : course jusqu’au semi, au moins 8 semaines, élève qui court déjà 30′.
  - **Placement** : jamais de qualité la veille ni le lendemain de la séance longue.
  - **Dernière semaine** : rappel d’allure 4 × 3′ tôt dans la semaine ; veille en footing 15′ et 4 lignes droites.
  - **Risques en minutes aussi** :
    - volume signalé au-delà de +10 % **et** de +30′ (bloquant au-delà de +30 % et de +45′) ;
    - séance longue au-delà de +12 % et de +10′ ;
    - semaine 1 au-delà de +10 % et de +20′.

    Les hausses de 15 à 30′ des petits volumes, courantes chez le fondateur, ne sont plus signalées.
  - **Consignes types** dans chaque séance générée, dans son style :
    - facile = parler ; « Tortue mood » ; la marche n’est pas un échec ;
    - la première répétition pas plus rapide que les suivantes ; côtes ; test ; veille ;
    - consigne d’arrêt en cas de douleur qui augmente.
- **Inchangé.** Le programme reste à la hauteur de l’objectif validé ; tremplin, développement avec une semaine allégée sur quatre, affûtage ; bibliothèque du coach d’abord ; « Ma méthode » prioritaire ; tout est créé en brouillons.
- **Preuve.**
  - 4 tests du domaine :
    - reprise lourde en course/marche ;
    - débutante (lignes droites, test 5 km, ordre de la qualité) ;
    - dernière semaine et placement ;
    - types écartés, vélo inchangé, seuils en minutes.

    Les tests antérieurs passent sans changement.
  - Programmes types vérifiés pour 4 profils (reprise lourde, débutante active, régulière 12 km, semi).
  - Navigateur (démo, Camille, semi) : lignes droites en S1 et S2, test 5 km en S3, pyramide d’abord (la méthode de Marine écarte la VMA), rappel d’allure, puis veille.
  - `npm test` : **280 passés** (+3 PostgreSQL), typecheck OK.
- **Limites.**
  - La durée d’une séance en distance sans VMA connue est estimée à la durée visée.
  - Le passage de la course/marche à la course continue peut être brusque sur une préparation courte : le risque d’endurance est alors signalé au coach.

## D-087 · Échelle des zones : les 7 zones de CoachOS, avec les repères du fondateur · 2026-11-20

- **Instruction du fondateur.** « Mixer les deux, extrapoler la mienne avec CoachOS. »
- **Constat.**
  - Ses documents utilisent une échelle plus courte : Z1-2 endurance, Z3 seuil ou allure 10 km, Z4 allure 5 km (fractionné 1 km), Z5 VMA (200 à 400 m), Z6 vitesse.
  - CoachOS utilisait 7 zones reprises de Foulée : récupération, endurance fondamentale, tempo, seuil, VMA longue, moyenne et courte.
- **Décision.**
  - **Les 7 zones gardent leur finesse et prennent ses repères** (nom, usage, sensation) :

    | Zone | Nom | % de VMA | Usage | Ses documents |
    |---|---|---|---|---|
    | Z1 | récupération | 55 à 65 | trot entre deux efforts | « récup » |
    | Z2 | endurance fondamentale | 65 à 75 | footing, sortie longue | Z1-2, EF |
    | Z3 | endurance active | 75 à 85 | allure marathon | Z2 |
    | Z4 | seuil | 85 à 92 | tempo, allure semi à 10 km | Z3 |
    | Z5 | allure 5 km | 92 à 97 | fractionné 1 km, pyramide | Z4 |
    | Z6 | VMA | 97 à 105 | 200 à 400 m | Z5 |
    | Z7 | vitesse | 105 à 120 | lignes droites, côtes courtes | Z6 |

    Les plages sont recalées sur les allures de course : marathon ≈ 80 %, semi ≈ 85 %, 10 km ≈ 90 %, 5 km ≈ 95 %. Les zones vélo et natation sont inchangées.
  - **Import** (séances et programmes) : choix « Zones du texte », détecté automatiquement (« Z1-2 » ou « Z1-Z2 » = ses documents).
    - Ses zones sont traduites un cran plus haut : Z1 et Z1-2 → Z2, Z3 → Z4, Z4 → Z5, Z5 → Z6.
    - EF reste en Z2.
  - **Générateur (D-086)** :
    - 200 m, 400 m et côtes en Z6 ;
    - 1 km et pyramide en Z5 (comptés comme fractionné, « VMA / fractionné ») ;
    - 2 km en Z4 ;
    - allure sans chrono en Z4 jusqu’au semi, Z3 au-delà.
  - **Fiche élève** : le tableau des zones montre l’usage et la sensation de chaque zone, avec les allures calculées depuis la VMA.
- **Effet sur l’existant.** Les numéros de zone des séances déjà écrites ne changent pas. Leurs allures estimées bougent un peu : la Z2 va maintenant jusqu’à 75 % de VMA, au lieu de 70 %.
- **Preuve.**
  - Tests du domaine : traduction de ses zones, détection, EF ; tests d’allures et de niveaux mis à jour sur les nouvelles plages.
  - Navigateur : tableau des zones de Camille (VMA 15) : Z2 6:09 à 5:20 /km, Z4 4:42 à 4:21, Z6 4:07 à 3:49.
  - `npm test` : **281 passés** (+3 PostgreSQL), typecheck OK.

## D-088 · « Peux-tu faire tes séances à 100 % en ce moment ? » · 2026-11-20

- **Instruction du fondateur.** Il veut pouvoir demander à l’élève s’il a une gêne qui l’empêche de courir ou de s’entraîner à 100 %. Il a choisi la version « sans le corps », pour rester dans l’exclusion des données de santé (D-084).
- **Décision.**
  - **Retour de séance :** question facultative « Peux-tu faire tes séances à 100 % en ce moment ? », avec trois réponses fermées : Oui, Pas tout à fait, Non.
    - Aucune cause n’est demandée ni enregistrée.
    - Après « Pas tout à fait » ou « Non », l’élève lit : « Merci, ton coach est prévenu et en parlera avec toi. Pas besoin d’expliquer pourquoi ici. »
  - **Coach :**
    - le retour passe en tête de la file (rang 0), avec un repère « Pas tout à fait à 100 % » ou « Pas à 100 % » ;
    - filtre « Pas à 100 % » (`?seulement=pas-a-100`), gardé dans l’adresse ;
    - dans le détail du retour : la réponse et « Parles-en avec l’élève (message ou de vive voix) avant d’ajuster la suite ».
    - Une correction en « Oui » remet le retour à son rang normal.
  - **Données :** migration additive `20261120090000` : `feedbacks.readiness` (`full`, `not_quite`, `no`, ou vide). Elle est appliquée au Supabase local, sans toucher aux données existantes. Le contrat (`feedback`) est mis à jour.
- **Preuve.**
  - Test serveur : retour en tête de file avec son repère, filtre, retour au rang normal après « Oui », valeur hors liste refusée.
  - Navigateur (démo) : la question s’affiche dans le retour de Camille, avec le message après « Pas tout à fait » (rien envoyé) ; le filtre apparaît dans la file de Marine.
  - `npm test` : **282 passés** (+3 PostgreSQL), typecheck OK.
- **Réexamen.** Si le fondateur ouvre le jalon santé : précision de la gêne, avec consentement par élève et avis juridique.

## D-089 · Suivi « En parler avec l’élève » quand il n’est pas à 100 % · 2026-11-20

- **Contexte.** Suite de D-088 : le fondateur veut que le coach parle avec l’élève qui n’est pas à 100 %. Le fondateur a dit « continue sans moi ».
- **Décision.**
  - **Nouveau suivi automatique (CE-H-03)** « En parler avec l’élève » : priorité urgente, type appel, avec le motif « A répondu ne pas être à 100 % en ce moment · réponse « Non » ».
    - Il apparaît dans le Planning et dans « À faire » de la fiche, le jour du retour (délai réglable de 0 à 7 jours dans Paramètres › Suivis automatiques).
    - Il se clôt seul dès que le coach écrit à l’élève après sa réponse, ou quand la dernière réponse redevient « Oui ». Le coach peut aussi le reporter.
  - **Élèves** : repère « Pas à 100 % » à côté du nom, d’après la dernière réponse (la séance la plus récente).
  - **Migrations additives**, appliquées en local :
    - `20261120100000` : règle ajoutée aux contrôles ;
    - `20261120110000` : `feedbacks.readiness_at`, le moment de la réponse, pour qu’un message plus ancien ne clôture pas le suivi.
- **Preuve.**
  - Test serveur : un message du coach envoyé avant la réponse ne clôt pas le suivi ; le suivi apparaît en urgent avec « Non » ; le repère s’affiche dans Élèves ; un message après la réponse le clôt.
  - `npm test` : **283 passés** (+3 PostgreSQL), typecheck OK.

## D-090 · Test 5 km : chrono de l’élève, VMA proposée au coach · 2026-11-20

- **Contexte.**
  - La méthode du fondateur (D-086) place un test 5 km en semaine 3 « pour caler les allures ».
  - Jusqu’ici, le résultat restait dans le retour : le coach devait recalculer la VMA à la main.
  - Le fondateur a dit « continue sans moi ».
- **Décision.**
  - **Élève :** dans le retour d’une séance dont le titre commence par « Test » et qui contient une seule étape d’effort en distance (de 1 à 21,1 km), un champ facultatif « Ton chrono sur le 5 km » s’ajoute (le temps du test seul, par exemple 27:45).
  - **Coach :** dans le retour, la carte « Résultat du test » affiche le chrono, l’allure et une VMA estimée. Le calcul tient compte de la durée : on tient environ 95 % de sa VMA sur 15 min, 90 % sur 30 min et 85 % au-delà. La VMA actuelle est affichée à côté.
    - Deux gestes explicites, le coach décide : « Ajouter aux résultats de référence » (faisabilité, équivalences, D-060) et « Mettre la VMA à x km/h » (zones et allures, D-087).
    - Rien n’est changé sans son clic.
  - **Migration additive** `20261120120000` : `feedbacks.test_seconds`, appliquée en local. Le contrat (`feedback`) est mis à jour.
- **Preuve.**
  - Tests du domaine :
    - distance du test reconnue (pas dans une répétition ni hors d’une séance « Test ») ;
    - 25:00 au 5 km → VMA 13,1 ; 20:00 → 16,1 ;
    - la séance « Test 5 km » générée est reconnue.
  - Test serveur : le chrono est enregistré, puis lu par le coach ; il est refusé pour une séance non réalisée.
  - `npm test` : **285 passés** (+3 PostgreSQL), typecheck OK.
- **Non vérifié dans le navigateur.** La démo n’a pas de séance « Test 5 km » publiée, et je n’en ai pas créé pour ne pas modifier la démo.

## D-091 · Consignes générales d’un programme importé · 2026-11-20

- **Contexte.**
  - Limite notée en D-085 : l’objectif, les repères et les règles importantes écrits en tête des documents du fondateur se perdaient à l’import.
  - Ces règles s’adressent à l’élève (« Si une séance saute, c’est le footing », consigne d’arrêt…).
- **Décision.**
  - **Import d’un programme :** le texte écrit entre le titre et la première semaine devient les **consignes générales**. Sont exclus les tableaux (repères, vue d’ensemble) et le plan des semaines (« S1–S2 · … »).
    - Elles sont modifiables dans l’aperçu (4 000 caractères au plus) et enregistrées avec le programme type.
  - **Bibliothèque › Semaines types :** « Consignes du programme » s’ouvre sous le programme.
  - **Appliquer à un élève :** les consignes sont ajoutées en tête de la **première séance seulement** (« Consignes du programme »). Tout reste en brouillon : le coach relit avant de publier.
  - Contrat `importProgram` : champ `notes`. Aucune migration (charge utile du modèle).
- **Preuve.**
  - Test du domaine : l’objectif est gardé, sans les tableaux ni le plan.
  - Test serveur : consignes enregistrées, présentes dans la première séance appliquée et absentes de la deuxième.
  - Navigateur (démo) : aperçu d’un programme avec objectif et règles ; consignes reprises ; zones « tes documents » détectées (1 km Z4 → Z5). Rien n’a été enregistré.
  - `npm test` : **285 passés** (+3 PostgreSQL), typecheck OK.

## D-092 · Résumé de la semaine : « pas à 100 % » en premier · 2026-11-20

- **Décision.**
  - Le résumé de la semaine de chaque élève (D-073) reprend sa dernière réponse de la semaine à « à 100 % en ce moment ? » (D-088). Si c’est « Pas tout à fait » ou « Non », il ajoute le fait « A répondu ne pas être (tout à fait) à 100 % en ce moment. » et pose d’abord la question « Tu m’as dit ne pas être à 100 % en ce moment : on en parle pour adapter la suite ? ».
  - Cela vaut aussi quand les données de la semaine sont insuffisantes.
  - Aucune cause n’est demandée ; une réponse « Oui » plus récente efface l’alerte.
- **Preuve.** Test du domaine : fait et question, cas « données insuffisantes », réponse « Oui » plus récente. `npm test` : **286 passés** (+3 PostgreSQL), typecheck OK.

## D-093 · Base de séances : Foulée fait foi ; fractions courtes en Z6 · 2026-11-20

- **Instruction du fondateur.** « La base de séance tu peux prendre chez foulée, il y a déjà tout. » Le tableur demandé n’est plus attendu. La bibliothèque Foulée (324 séances, D-068 et D-077) est déjà dans la démo et dans l’espace du fondateur.
- **Écart trouvé.** Foulée comptait ses zones à sa façon : Z6 de 95 à 100 % et Z7 de 100 à 110 %. Elle mettait donc en Z7 les 30"/30", 200 m et 300 m. Avec l’échelle fusionnée (D-087), Z7 désigne la vitesse (105 à 120 %). Les programmes du fondateur et le générateur (D-086) font ces fractions en Z6 (VMA).
- **Décision.**
  - 23 séances de six familles passent de Z7 à Z6 : `30-30`, `30-30-series`, `200m`, `200m-series`, `300m` et la partie 200 m de `mixte-200-400`.
  - Z7 reste pour les sprints en côte et les 30" après le seuil.
  - Pour les séances déjà importées, le bouton devient « 🏃 Mettre à jour Foulée (n) ». Il demande confirmation, puis rejoue l’import.
    - Seule change une séance dont la structure est encore exactement celle de l’import. Une séance modifiée par le coach reste intacte.
    - Les programmes déjà donnés aux élèves ne changent pas, car ils sont copiés.
  - Contrat `addFouleeLibrary` : champ `updated`.
- **Preuve.**
  - Test du domaine : aucune Z7 dans les six familles, l’ancienne structure est gardée, les sprints restent en Z7 et l’ordre des clés est sans effet.
  - Test serveur : 22 séances mises à jour, la séance modifiée par le coach reste intacte.
  - Navigateur (démo) : « Mettre à jour Foulée (23) », puis 23 séances en Z6 et le bouton disparaît.
  - Espace du fondateur : non modifié (23 séances en attente de son clic).
  - `npm test` : **288 passés** (+3 PostgreSQL), typecheck OK.

## D-094 · « Ajouter à ma bibliothèque » et écriture en texte expliquée · 2026-11-20

- **Retour du fondateur.**
  - « "ajouter les blocs à ma bibliothèque" pas "garder" ».
  - « je ne comprends le principe de saisie rapide en texte ».
- **Décision.**
  - **Blocs réutilisables (D-074).** Le mot « garder » est remplacé par « ajouter » :
    - « 💾 Ajouter des blocs à ma bibliothèque » et « Blocs à ajouter » ;
    - bouton « Ajouter le bloc à ma bibliothèque » (ou « les blocs » quand plusieurs sont cochés) ;
    - confirmation « Bloc ajouté à ta bibliothèque. » ;
    - le texte de l’onglet Blocs vide est aligné.
  - **Saisie rapide (D-041).** Elle devient « ✍️ Écrire la séance en texte ».
    - Une phrase explique le principe : « Plus rapide que les boutons : écris toute la séance d’un coup, comme dans tes programmes. CoachOS la découpe en blocs et te montre ce qu’il a compris avant que tu l’appliques. » Une seconde phrase dit, s’il y a lieu, que le texte reprend la séance actuelle.
    - L’aperçu « CoachOS a compris n blocs » liste chaque bloc en clair, avec ses consignes « … ».
    - L’aide est repliée sous « Comment l’écrire ? ». C’est un tableau « Tu écris / Ça donne » de 7 exemples, au lieu d’une ligne de codes.
    - Boutons : « Créer ces blocs » (séance vide), ou « Remplacer la séance par ces blocs » et « Ajouter ces blocs à la fin ».
    - La zone de texte s’agrandit avec le texte, jusqu’à 6 lignes.
- **Preuve.**
  - Les 5 exemples d’écriture de l’aide sont lus sans erreur, dont `8x(…)`, `3*(…)` et un enchaînement vélo + course.
  - Navigateur (démo, nouvelle séance de bibliothèque) :
    - la séance du fondateur avec deux consignes est comprise en 3 blocs, consignes affichées ;
    - le tableau d’aide est complet ;
    - « Créer ces blocs » fonctionne, puis « Ajouter les blocs à ma bibliothèque » apparaît avec 2 blocs cochés ;
    - à 375 px, rien ne dépasse (le tableau débordait avant correction) ;
    - rien n’a été enregistré.
  - Typecheck OK.

## D-095 · Ouvrir CoachOS depuis un téléphone du même Wi-Fi · 2026-11-20

- **Question du fondateur.** « Quelle adresse ouvrir avec son téléphone pour installer l’app web ? »
- **Constat.** Next.js 16 bloque en développement les ressources internes demandées depuis une autre adresse que localhost. Le journal du serveur montrait « Blocked cross-origin request … /_next/webpack-hmr from "192.168.65.68" ». Le téléphone aurait affiché les pages, mais sans rechargement en direct et avec un risque de boutons inactifs.
- **Décision.**
  - `allowedDevOrigins` autorise les réseaux privés (192.168.x.x, 10.x.x.x, 172.x.x.x, *.local), **en développement seulement**.
  - L’adresse à ouvrir est celle que le serveur affiche (« Network »), aujourd’hui http://192.168.65.68:3000.
  - La connexion par mot de passe passe par le serveur : elle marche depuis le téléphone.
  - La lecture hors ligne (D-080) attend https, donc la mise en ligne.
- **Preuve.** Navigateur à 375 px sur http://192.168.65.68:3000/demo : page chargée et active, sans erreur, et plus aucun blocage dans le journal du serveur.

## D-096 · CoachOS modulaire : endurance, musculation, ou les deux · 2026-11-21

- **Instruction du fondateur**, en réponse à l’analyse produit ([17_ANALYSE_PRODUIT.md](../17_ANALYSE_PRODUIT.md)) :
  - « Il faut quelque chose de modulaire avec une possibilité musculation et sport d’endurance et les deux. » Il faut donc développer le côté musculation.
  - Le coach choisit des enchaînements d’exercices dans des **programmes vidéo**, que l’élève suit à distance.
  - Raison donnée : le coaching en présentiel coûte cher et freine beaucoup de gens, alors qu’un programme détaillé en vidéo qui montre les mouvements apporte une vraie valeur.
  - La gestion du coach suivra : relances, suivis, liens, paiement.
- **Décision.** La cible « coach de course à pied seulement » proposée par l’analyse est écartée. CoachOS devient modulaire : l’espace d’un coach active l’endurance, la musculation, ou les deux. Une semaine d’élève peut mêler course et renforcement.
- **Lot M · Musculation**, avant tout autre chantier (ordre de la roadmap mis à jour) :
  1. **M1, séance de musculation.** Nouveau sport « Musculation ». Une étape peut porter un exercice (nom et référence), des répétitions, une charge (kg) et un repos. Les séries s’écrivent avec les répétitions existantes : 4 × (10 squats à 40 kg + repos 1′30). Le modèle de séance (D-023) reste le même : constructeur, révisions, publication et lecture sont réutilisés.
  2. **M2, bibliothèque d’exercices avec vidéo.** Nom, consignes, groupe musculaire, matériel, vidéo :
     - soit un lien (YouTube, Vimeo, Drive…) ;
     - soit un court fichier filmé par le coach, gardé en privé et lu seulement par les membres de l’espace.
     - S’y ajoutent des exercices de départ, sans vidéo, que le coach enrichit.
  3. **M3, suivre la séance à distance.** Côté élève : un exercice par écran, avec sa vidéo, les séries à cocher et un minuteur de repos.
  4. **M4, retour de musculation.** Séries et charges réalisées, progression des charges visible par le coach et l’élève.
  5. **M5, modularité.** Les sports de l’espace (profil, D-022) décident de ce qui est montré. Une séance mixte est possible : footing suivi de renforcement.
- **Après le lot M : la gestion du coach.** Relances pré-rédigées et validées, suivi, puis paiement.
  - CLAUDE.md demande d’attendre la validation du parcours des deux rôles avant Stripe. Cette condition est rappelée au fondateur, et le paiement sera ouvert sur sa confirmation.
- **Ce qui reste valable de l’analyse :**
  - la mise en ligne reste nécessaire pour tout usage à distance ;
  - aucun envoi ni publication sans le coach ;
  - les données de santé restent exclues (D-084).
- **Point de vigilance consigné.** Les vidéos d’exercices sont un standard des applications de musculation (Trainerize, TrueCoach, Everfit). La différence crédible de CoachOS est de réunir **endurance et musculation dans le même plan**, avec **les vidéos et la méthode du coach**. À vérifier avec de vrais élèves.

## D-097 · Musculation, lots M1 et M2 : séance, exercices et vidéos · 2026-11-21

- **Modèle de séance (D-023 étendu, sans migration des séances).**
  - Une étape peut porter un `exercise` (référence de la bibliothèque et nom recopié). L’élève garde ainsi le nom, même si l’exercice est retiré ensuite.
  - Elle accepte aussi une mesure `reps` (1 à 500) et une intensité `load` (charge en kg, au demi-kilo ; sans charge = poids du corps).
  - Les séries sont des répétitions de blocs (4 × (10 squats + repos)).
  - Durée estimée : 4 s par répétition. Les totaux estimés sont arrondis à la minute (« environ 23 min »), en endurance aussi.
- **Sport « Musculation ».** Le code est `strength`. La migration `20261121090000_strength.sql` est additive :
  - catalogue des sports, profil de l’espace ;
  - matériel de l’élève : haltères, kettlebell, élastiques, barre de traction, banc, tapis.
- **Bibliothèque d’exercices.** Onglet Séances › **Exercices**.
  - Tables `exercises` et `exercise_clips`, avec RLS : lecture par le coach et les élèves de l’espace, écriture par commandes du coach.
  - Fiche d’un exercice : nom unique, groupe musculaire, matériel, consignes.
  - Vidéo :
    - par **lien** : YouTube (sans cookie publicitaire) et Vimeo intégrés, autres liens ouverts à part, https seulement ;
    - par **fichier filmé au téléphone** : MP4, MOV ou WebM, 25 Mio au plus, reconnu par son contenu.
    - Le fichier est servi par une route privée qui gère les plages d’octets, nécessaires à Safari sur iPhone. Il remplace le précédent et peut être retiré.
  - **34 exercices de départ**, sans vidéo, avec des consignes générales : jambes, poussée, tirage, gainage, corps entier, cardio, mobilité. Ils sont ajoutés en un clic, sans doublon.
  - Contrat : `createExercise`, `updateExercise`, `addStarterExercises`, `uploadExerciseClip`, `removeExerciseClip`.
- **Constructeur.** En Musculation :
  - boutons « + Exercice » et « + Série » ;
  - champ Exercice avec suggestions de la bibliothèque (un nom hors bibliothèque est accepté, mais sans vidéo) ;
  - mesures Répétitions, Durée et Libre ; intensités Poids du corps, Charge et Effort ressenti ;
  - 6 modèles rapides : échauffement, séries, superset, circuit, gainage, étirements.
  - Écriture en texte : « 4×(10 squat goblet 16kg + repos 1′30) ». Le nom suit le nombre de répétitions et se rattache à la bibliothèque. Cette lecture n’existe qu’en musculation : l’endurance garde ses règles.
- **Lecture (élève, coach, revue).** Le nom de l’exercice est en titre. « ▶ Voir comment faire » ouvre ses consignes et sa vidéo. Les répétitions se lisent « 4 séries ».
- **Export montre.** Le sport FIT est « training, strength », l’étape compte les répétitions, le nom de l’exercice est affiché et la charge est mise en note.
- **Au passage.** « 3 séances » n’est plus lu comme 3 secondes (accent après « s »).
- **Preuves.**
  - Tests :
    - domaine : lecture, aller-retour texte, schéma, totaux, FIT, modèles, liens vidéo, type de fichier ;
    - serveur : droits, nom unique, révision, exercices de départ, vidéo lue par l’élève et refusée à un autre espace, fichier non vidéo refusé.
  - `npm test` : **300 passés** (+3 PostgreSQL), typecheck OK. Migration appliquée à Supabase local.
  - Navigateur (démo) :
    - 34 exercices de départ ajoutés ;
    - envoi d’un fichier de test, lecture complète et par plages (206), refus d’un faux fichier, puis retrait ;
    - séance « Renforcement jambes et gainage » écrite en texte pour Camille (3 exercices rattachés), enregistrée et publiée ;
    - lue par Camille à 375 px avec « Comment faire », sans débordement.
- **Non prouvé.** Lecture d’une vraie vidéo filmée sur iPhone ; lien YouTube réel (non ajouté à la démo).

## D-098 · Musculation, lot M3 : suivre la séance pas à pas sur téléphone · 2026-11-21

- **But (D-096).** L’élève suit seul, à distance, la séance de son coach, comme s’il était à côté de lui.
- **Décision.** La page de la séance côté élève a un bouton « ▶ Suivre la séance pas à pas » (séance de musculation, ou séance qui nomme des exercices de la bibliothèque).
  - **Une étape par écran**, répétitions dépliées dans l’ordre réel. On y lit :
    - « Série 2 sur 4 », ou « Tour 1 sur 3 » pour un circuit ou un bloc de séries ;
    - le nom de l’exercice en grand, les répétitions et la charge ;
    - la consigne de l’étape ;
    - la vidéo du coach, avec ses consignes dépliées quand il n’y a pas de vidéo.
  - **« ✓ Fait, suivant »** pour un exercice en répétitions.
  - **Repos chronométré qui démarre seul**, avec « +15 s » et « Passer le repos ». À la fin, une vibration et un bip, puis l’étape suivante s’affiche seule.
  - **Effort chronométré** (planche 30 s) : « ▶ Démarrer le chrono », puis l’élève confirme.
  - Le chrono se fonde sur l’heure de fin, ce qui le garde juste si le téléphone met la page en pause. L’écran reste allumé quand le navigateur le permet (https).
  - Barre d’avancement, « ← Précédent », « Ensuite : … ».
  - **Position gardée sur ce téléphone** (stockage du navigateur) pour reprendre après une coupure. Rien n’est envoyé au coach tant que l’élève ne donne pas son retour.
  - **Fin :** « Séance terminée, bravo ! », puis « Donner mon retour » à partir du jour de la séance (sinon une phrase l’explique), ou « Recommencer ».
- **Preuves.**
  - Tests du domaine : ordre et nombre des étapes, séries, tours, séries imbriquées, plafond de 400 étapes. `npm test` : **302 passés** (+3 PostgreSQL), typecheck OK.
  - Navigateur, Camille à 375 px :
    - échauffement avec chrono à démarrer ;
    - « Squat goblet, Série 1 sur 4, 10 répétitions · 16 kg » avec consignes ;
    - repos lancé seul, « +15 s » ajouté ;
    - reprise à la même étape après rechargement ;
    - écran de fin, sans débordement.
- **Non prouvé.** Vibration, bip et écran allumé sur un vrai iPhone (l’écran allumé demande https, donc la mise en ligne).

## D-099 · Deux options de vidéo : celle du coach, ou une vidéo de base CoachOS · 2026-11-21

- **Instruction du fondateur.** Il faut permettre deux options :
  - soit le coach importe sa vidéo, pour que ce soit lui que l’élève voie et que cela crée du lien dans son coaching ;
  - soit il n’a pas le temps, et une **vidéo de base** est proposée. Elle peut être générée par IA, tournée par le fondateur, ou être un mélange des deux : une extrapolation par IA de quelques vidéos du fondateur faisant des exercices.
- **Décision.**
  - **Priorité d’affichage**, pour chaque exercice : la vidéo du coach (fichier filmé, puis lien), sinon la vidéo de base CoachOS, sinon aucune.
  - Le coach peut refuser la vidéo de base pour un exercice. L’élève voit toujours qui il regarde : « Vidéo de ton coach » ou « Vidéo CoachOS » (avec « générée par IA » le cas échéant).
  - **Catalogue de vidéos de base**, commun à tous les espaces et maintenu par CoachOS :
    - il est rattaché aux exercices de départ par une clé stable, qui tient même si le coach renomme l’exercice ;
    - chaque vidéo indique sa source : fondateur, IA, ou fondateur et IA.
    - Le catalogue démarre vide : les vidéos restent à produire.
  - **Garde-fous pour l’IA** :
    - aucune vidéo générée n’est publiée sans validation du geste par le fondateur ;
    - l’origine IA est toujours indiquée à l’élève ;
    - l’image d’une personne n’est utilisée qu’avec son accord (ici le fondateur) ;
    - les conditions d’usage de l’outil choisi sont à vérifier avant publication.
- **Réalisé.**
  - Domaine : catalogue `BASE_VIDEOS`, vide pour l’instant. Une entrée = lien, source et validation (qui et quand). La règle `shownVideo` fixe la priorité. Un lien vers un fichier vidéo direct (.mp4, .mov, .webm) est lu dans la page.
  - Migration `20261121100000_exercise_base_video.sql` (additive) :
    - `starter_key`, clé stable remplie pour les exercices de départ existants (34 dans la démo) ;
    - `use_base_video`, vrai par défaut.
  - Contrat : `useBaseVideo` dans `createExercise` et `updateExercise`.
  - Écrans :
    - la fiche d’exercice affiche « Vidéo montrée à tes élèves », avec la case « Montrer la vidéo CoachOS tant que je n’ai pas mis la mienne » quand une vidéo de base existe ;
    - la liste distingue « ▶ ta vidéo », « ▶ vidéo CoachOS » et « sans vidéo » ;
    - sous chaque vidéo, l’élève lit son origine.
  - Guide de tournage et de production pour le fondateur : [VIDEOS_DE_BASE.md](VIDEOS_DE_BASE.md) (34 exercices avec leur clé).
- **Preuves.**
  - Tests du domaine : priorité, refus du coach, clé absente ou inconnue, clés sans accent et uniques, catalogue validé.
  - Test serveur : clé gardée après renommage, refus enregistré.
  - `npm test` : **304 passés** (+3 PostgreSQL), typecheck OK.
  - Navigateur : fiche « Pompes », sans vidéo, qui annonce « Pas encore de vidéo CoachOS ».
- **Non prouvé.** L’affichage d’une vraie vidéo de base : aucune n’est encore produite.

