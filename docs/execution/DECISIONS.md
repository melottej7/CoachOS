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
- **À faire.** Corriger `contracts/openapi.json` (bornes des entiers et chaînes) et ajouter un test de contrat qui valide les réponses réelles contre le schéma.

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

- **Décision.** `/login` (X02) envoie un lien via `signInWithOtp` (flux PKCE de `@supabase/ssr`), `/auth/callback` (X03) échange le code puis redirige vers `next` filtré par `safeNext` (C02-09). Message de succès neutre (C02-06). `proxy.ts` rafraîchit la session et transmet le chemin demandé ; `requireActor()` renvoie vers `/login?next=…`. Première connexion : profil `public.users` créé sans doublon (`on conflict do nothing`). Déconnexion par POST same-origin.
- **Configuration locale.** `site_url` et redirections autorisées sur `localhost:3000`, limite d’e-mails relevée à 60/h, modèle d’e-mail en français (`supabase/templates/magic_link.html`). Comptes fictifs créés par l’API d’administration avec des UUID fixes (`npm run supabase:seed`).
- **Identité de démo.** Conservée en développement comme raccourci (D-003). Une session Supabase est toujours prioritaire.
- **Réexamen.** Avant tout environnement partagé : désactiver `COACHOS_DEMO_AUTH`, décider `shouldCreateUser` (inscription libre ou sur invitation) et choisir le fournisseur d’e-mails (Resend).
