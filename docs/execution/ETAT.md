# État d’exécution

Dernière mise à jour : 2026-11-17, session 1.

## Résumé

Tranches **A (publier et lire)** et **B (retour et revue)** démontrables en local sur données fictives. La boucle créer → publier → lire sur téléphone → envoyer un retour → traiter fonctionne de bout en bout pour les deux rôles. Les droits sont vérifiés en base (RLS du SQL de référence) et dans chaque commande. Prochaine tranche : C (invitation, authentification réelle et reprise).

## Lancer en local

Prérequis : Node ≥ 22.12 (testé avec 24.14.1). Aucun Docker ni compte externe.

```bash
npm install
npm run dev          # http://localhost:3000/demo
npm test             # domaine + boucle et droits sur base en mémoire
npm run typecheck
npm run build
npm run db:reset     # serveur arrêté : recrée .data/pglite
```

Avec le serveur lancé, « Réinitialiser la démo » sur `/demo` recharge le jeu fictif sans redémarrer.

Démonstration conseillée : `/demo` → Marine Roy → `+ Ajouter` un jour → enregistrer → « Publier pour Camille » ; puis `/demo` → Camille Laurent (fenêtre étroite ou téléphone) → Aujourd’hui / Programme → séance du jour → « Donner mon retour » ; puis Marine → Retours → « Ouvrir le retour » → « Marquer comme traité ».

## Stories

| Story | État | Preuve |
|---|---|---|
| C01-01 Monorepo TypeScript | Fait (npm workspaces, D-001) | `npm install`, `npm run build`, `npm run typecheck` |
| C01-03 Base locale + jeu à deux espaces | Fait sur PGlite (D-002) | `npm run db:reset` : 2 espaces, 4 athlètes, 6 séances, 1 retour |
| C01-04 Migrations ordonnées | Fait (manifeste `supabase/migrations`, table `supabase_migrations.schema_migrations`) | Base vierge migrée à chaque test |
| C03-01 Fiche athlète | Partiel : fiches issues du jeu fictif, état invité affiché. Création par le coach : tranche C | — |
| C04-01 Semaine coach | Fait : 7 dates locales dans le fuseau de l’athlète | test changement d’heure (domain.test.ts) |
| C04-04 Séance simple en brouillon | Fait | test + navigateur |
| C05-01 Publier une séance | Fait, une seule version après double clic | test + navigateur (1 seule requête de publication) |
| C05-03 Modifier sans changer la version lue | Fait (révision immuable, état « Modifiée, non publiée ») | test |
| C06-01 Programme athlète publié seulement | Fait | test + navigateur (brouillon du jeudi absent) |
| C06-02 Déclarer réalisé | Fait | test + navigateur |
| C06-04 RPE 0 à 10 facultatif | Fait | tests domaine |
| C06-06 Révision obsolète rejetée | Fait (409 avec message) | test |
| C06-07 Rejouer après réseau coupé | Fait (même clé, une seule ligne) | test + navigateur (réponse perdue simulée, 2 requêtes, 1 cas) |
| C06-08 Version observée conservée | Fait | test |
| C06-09 Marquer traité une seule fois | Fait (date + audit) | test |
| C09-01 Compter les retours à revoir | Fait (badge Retours) | test + navigateur (2 → 1) |
| C09-04 Raison du signal / source | Fait (« Nouveau retour : … », page d’indisponibilité) | navigateur |
| C09-06 Clore un cas | Fait via markFeedbackReviewed | test |
| Autres C01 (CI, Sentry, secrets, page d’état, restauration) | Non commencés | — |

## Preuves obtenues (session 1)

Commandes exécutées et résultat :

- `npx vitest run` : 2 fichiers, **26 tests passés** (domaine ; boucle et droits avec coach A, coach B, athlète affecté, athlète tiers).
- `npm run typecheck` : OK. `npm run build` (Next 16.4.6) : OK, toutes les routes privées dynamiques (ƒ).
- `npm audit` : 1 avis faible restant (esbuild, D-012).
- `curl` sur `POST /api/v1/.../workouts` : sans Origin → 403, Origin tierce → 403, sans Idempotency-Key → 400, champs invalides → 422 avec `fields[]` par chemin.

Parcours dans le navigateur intégré (thème sombre système) :

- Coach, 800 à 1024 px : semaine de Camille avec Brouillon / Publiée distincts ; création « Fartlek nature » au 18 nov. → page séance « Brouillon · invisible pour Camille » → double clic sur Publier → une seule requête, état « Publiée ».
- Athlète, 375 × 812 (mobile émulé) : Aujourd’hui affiche la séance du jour en une action ; Programme liste le Fartlek publié et **pas** le brouillon du jeudi ; barre de navigation basse.
- Retour : Réalisée + effort 6 + commentaire ; première réponse perdue volontairement (fetch patché) → bandeau « Connexion interrompue, saisie conservée » → « Renvoyer » → confirmation. Journal serveur : 2 requêtes `feedback` OK (6 ms pour la reprise), la file coach montre **un** cas.
- Revue : file triée, détail Prévu (version 1 vue par Camille) / Déclaré, « Marquer comme traité » → « Traité le … », badge 2 → 1, « Retour suivant » proposé.
- Isolation : Hugo (espace B) sur une URL de l’espace A → 404 uniforme (coach et athlète), et `createWorkout` par fetch → 404 `RESOURCE_NOT_VISIBLE`.

Non prouvé à ce stade : lecteur d’écran et parcours clavier complet, vrai téléphone, vrai PostgreSQL/Supabase, concurrence réelle (PGlite sérialise), temps de publication 90 s et retour 30 s avec de vrais utilisateurs.

## Fichiers principaux

- `supabase/migrations/20261117000000_coachos.sql` : copie exacte de `database/001_coachos.sql`.
- `packages/domain/src/` : dates locales, schémas séance et retour, statut brouillon/publié.
- `apps/web/server/db/` : client PGlite, shim auth local, migrations, jeu fictif.
- `apps/web/server/commands/` : créer, modifier, publier, envoyer un retour, traiter (idempotence, audit).
- `apps/web/server/repo/` : lectures sous RLS (coach, athlète, contexte).
- `apps/web/app/api/v1/…` : routes du contrat. `apps/web/app/coach/[wid]/…` et `apps/web/app/athlete/[wid]/…` : écrans X10 à X21, X40 à X43.
- `apps/web/server/loop.test.ts` : boucle à deux rôles et cas d’autorisation.

## Écarts et dette connus

- Contrat OpenAPI à corriger (bornes à 10, RPE min 1), voir D-007.
- Pas encore : annulation de séance, report d’un cas (snooze), publication par lot multi-séances (X22 limité à une séance), filtre persistant de la file (C09-08), routes GET pour Expo, E2E automatisé, CI.
- Top bar mobile encore chargée côté athlète. À revoir après observation.

## Prochaine action

**Tranche C, étape 1 : authentification réelle.** Remplacer `/demo` par `/login` (lien magique Supabase Auth) et `/auth/callback`, garder `requireActor()` comme unique point d’entrée et supprimer `/api/dev/*` hors développement.

- **Prérequis stricts.** Supabase CLI + Docker Desktop installés sur le poste (décision du fondateur : installation système). Jamais de projet Supabase de production.
- **Si le prérequis tarde.** Sans bloquer, (1) corriger `contracts/openapi.json` et ajouter un test de contrat sur les réponses (D-007), (2) écrire un E2E Playwright de la boucle à deux rôles (desktop 1440 + mobile 390), (3) ajouter C03-02 à C03-05 (création de fiche et invitation) sur PGlite avec un fournisseur d’email simulé.
- **Pour le fondateur.** Organiser une première observation (1 coach, 1 athlète) sur `/demo` : publication et retour sur la même séance, chronométrés.
