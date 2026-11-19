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
