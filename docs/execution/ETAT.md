# État d’exécution

Dernière mise à jour : 2026-11-17, session 1 (tranche C, étapes 1 et 2 : connexion réelle, espace, invitation).

## Résumé

Tranches **A (publier et lire)** et **B (retour et revue)** démontrables en local sur données fictives. La boucle créer → publier → lire sur téléphone → envoyer un retour → traiter fonctionne de bout en bout pour les deux rôles. Les droits sont vérifiés en base (RLS du SQL de référence) et dans chaque commande.

Tranche **C, étape 1** faite : l’application tourne sur le PostgreSQL de Supabase local avec la connexion réelle par lien magique (Supabase Auth, e-mails capturés par Mailpit). PGlite reste le moteur des tests rapides et le repli sans Docker. Tranche **C, étape 2** faite : un nouveau coach s’inscrit, crée son espace, ajoute un athlète et l’invite par e-mail ; l’athlète ouvre le lien, se connecte avec la bonne adresse et voit sa première séance publiée. Reste de la tranche C : premier réglage athlète (X07), nom d’affichage, reprise réseau lent et conflits sur ces écrans, isolation de deux portefeuilles pour un même athlète (C03-10).

## Lancer en local

Prérequis : Node ≥ 22.12 (testé avec 24.14.1). L’application et les tests n’exigent ni Docker ni compte externe ; Docker Desktop sert seulement à Supabase local.

```bash
npm install
npm run dev          # http://localhost:3000/demo
npm test             # domaine + boucle et droits sur base en mémoire
npm run typecheck
npm run build
npm run db:reset     # serveur arrêté : recrée .data/pglite
```

Mode Supabase (connexion réelle). Docker Desktop doit être ouvert, baleine immobile :

```bash
npm run supabase:start   # base 54322, API 54321, e-mails de test http://127.0.0.1:54324
npm run supabase:env     # écrit apps/web/.env.local (local uniquement, ignoré par Git)
npm run supabase:seed    # comptes Auth fictifs + données métier
npm run dev              # http://localhost:3000/login
npm run test:pg          # même suite boucle/droits sur Supabase. Attention : efface les autres données métier et recharge le jeu fictif
npm run supabase:stop
```

Sans `apps/web/.env.local`, l’application repasse en mode PGlite + `/demo`. Après un changement de `supabase/config.toml`, relancer `supabase:stop` puis `supabase:start`, puis redémarrer `npm run dev`.

Comptes fictifs : `marine.roy@`, `camille.laurent@`, `noah.dubois@`, `hugo.petit@`, `lea.moreau@` suivis de `demo.coachos.test`. Le lien de connexion arrive dans Mailpit (http://127.0.0.1:54324). En développement, `/demo` reste un raccourci sans e-mail ; « Réinitialiser la démo » recharge le jeu fictif sans redémarrer.

Démonstration conseillée : `/demo` → Marine Roy → `+ Ajouter` un jour → enregistrer → « Publier pour Camille » ; puis `/demo` → Camille Laurent (fenêtre étroite ou téléphone) → Aujourd’hui / Programme → séance du jour → « Donner mon retour » ; puis Marine → Retours → « Ouvrir le retour » → « Marquer comme traité ».

## Stories

| Story | État | Preuve |
|---|---|---|
| C01-01 Monorepo TypeScript | Fait (npm workspaces, D-001) | `npm install`, `npm run build`, `npm run typecheck` |
| C01-03 Base locale + jeu à deux espaces | Fait sur PGlite (D-002) | `npm run db:reset` : 2 espaces, 4 athlètes, 6 séances, 1 retour |
| C01-04 Migrations ordonnées | Fait (manifeste `supabase/migrations`, table `supabase_migrations.schema_migrations`) | Base vierge migrée à chaque test |
| C02-03 Créer un espace | Fait : espace + propriétaire dans une transaction | tests + navigateur |
| C02-04 Fuseau d’espace | Fait : zone IANA invalide → erreur de champ | test |
| C02-08 Pas de doublon d’espace | Fait : même clé → même espace, un seul rôle | test |
| C03-01 Fiche athlète | Fait : fiche « invitée » affectée au propriétaire ; coach d’un autre espace et athlète refusés | tests + navigateur |
| C03-02 Inviter par e-mail | Fait : lien à usage unique, 7 jours, jeton et adresse jamais stockés en clair, jeton hors des URL serveur | tests + base Supabase vérifiée |
| C03-03 Accepter | Fait : adresse vérifiée égale requise, une seule relation, rechargement sans doublon | tests + navigateur (mobile) |
| C03-04 Révoquer | Fait | test |
| C03-05 Renvoyer | Fait : l’ancien lien échoue, le dernier fonctionne | test |
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
| C01-08 Secrets hors build client | Vérifié pour la clé service Supabase | recherche dans `.next/static` : 0 fichier |
| C02-01 Inscrire un coach | Partiel : compte vérifié par lien, profil `users` créé à la première connexion sans doublon. Création d’espace (X04) à faire | navigateur |
| C02-02 Finaliser le lien Auth | Fait : lien réutilisé ou expiré → message et nouveau lien | navigateur |
| C02-05 Quitter la session | Fait (session Supabase et cookie démo effacés, pages `no-store`). Retour navigateur non testé | navigateur |
| C02-06 Réponse publique identique | Fait : même message neutre quelle que soit l’adresse | code |
| C02-09 Redirections | Fait : `next` externe ou ambigu écarté | tests domaine |
| Autres C01 (CI, Sentry, page d’état, restauration) | Non commencés | — |

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

Tranche C, étape 1 (même session, Supabase local) :

- `npx supabase start` : migration `20261117000000_coachos.sql` appliquée sur PostgreSQL 17 ; 44 tables publiques, 0 sans RLS, 27 politiques, 7 fonctions `private`.
- `npm run supabase:seed` : 5 comptes Auth (UUID fixes via l’API d’administration), 4 athlètes, 6 séances, 1 retour.
- `npm test` : **28 tests passés** (PGlite). `npm run test:pg` : **16 tests boucle/droits passés sur le PostgreSQL de Supabase**.
- `npm run typecheck`, `npm run build` : OK (proxy de session actif, routes privées dynamiques). Clé service absente de `.next/static`.
- Navigateur, coach : `/login` → adresse de Marine → « Vérifie ta boîte » → lien lu dans Mailpit → planning de Marine (données Supabase) → publication de « Montées régulières » OK → « Se déconnecter » → `/coach/…/review` redirige vers `/login?next=…` → réutilisation du même lien → « Ce lien n’est plus valable ».
- Navigateur, athlète 375 px : `/athlete/…/today` sans session → `/login?next=…` → e-mail **en français** « Ton lien de connexion CoachOS » → lien → arrivée directe sur Aujourd’hui ; Programme montre la séance publiée par Marine.

Tranche C, étape 2 (même session) :

- `npm test` : **37 tests passés** (dont 9 sur espace, fiche, invitation, acceptation, révocation, expiration, échec d’envoi). `npm run test:pg` : 16 passés. Typecheck et build OK.
- Navigateur, sur Supabase local : nouvelle adresse `nina.durand@…` → lien → « Aucun espace » → « Créer un espace coach » → « Nina Run Club » → ajout de « Zoé Martin » avec son adresse → « Invitation envoyée, valable jusqu’au 24 novembre » → séance « Premier footing » créée et publiée avant l’arrivée de Zoé → déconnexion.
- Athlète, 375 px : lien d’invitation (e-mail « Invitation à rejoindre Nina Run Club ») → jeton retiré de la barre d’adresse → connexion par lien avec l’adresse de Zoé → retour sur `/invite` → « Rejoindre l’espace » → Aujourd’hui avec « Bienvenue dans Nina Run Club » et la séance publiée. Jeton effacé du navigateur après usage.
- Base Supabase : 1 invitation, 0 adresse et 0 jeton en clair ; Zoé `active` et reliée ; audit `workspace.create, athlete.create, invitation.issue, workout.create, workout.publish, invitation.accept`.

Non prouvé à ce stade : lecteur d’écran et parcours clavier complet, vrai téléphone, concurrence réelle sous charge, retour navigateur après déconnexion, temps de publication 90 s et retour 30 s avec de vrais utilisateurs.

## Fichiers principaux

- `supabase/migrations/20261117000000_coachos.sql` : copie exacte de `database/001_coachos.sql`.
- `packages/domain/src/` : dates locales, schémas séance et retour, statut brouillon/publié.
- `apps/web/server/db/` : deux moteurs (`driver.ts` PostgreSQL, PGlite), shim auth local, migrations PGlite, jeu fictif.
- `apps/web/server/supabase/`, `apps/web/proxy.ts`, `apps/web/app/login`, `apps/web/app/auth/*` : session Supabase, lien magique, rappel PKCE, déconnexion.
- `supabase/config.toml`, `supabase/templates/magic_link.html` : configuration locale et e-mail en français.
- `apps/web/server/commands/invitations.ts`, `server/crypto.ts`, `server/email/send.ts` : espace, fiche, invitation, acceptation, envoi d’e-mail.
- `apps/web/app/coach/new`, `coach/[wid]/athletes/new`, `coach/[wid]/athletes/[aid]`, `app/invite` : écrans X04, X13, X14 (minimal), X06.
- `apps/web/server/commands/` : créer, modifier, publier, envoyer un retour, traiter (idempotence, audit).
- `apps/web/server/repo/` : lectures sous RLS (coach, athlète, contexte).
- `apps/web/app/api/v1/…` : routes du contrat. `apps/web/app/coach/[wid]/…` et `apps/web/app/athlete/[wid]/…` : écrans X10 à X21, X40 à X43.
- `apps/web/server/loop.test.ts` : boucle à deux rôles et cas d’autorisation.

## Écarts et dette connus

- Contrat OpenAPI à corriger (bornes à 10, RPE min 1), voir D-007.
- Pas encore : annulation de séance, report d’un cas (snooze), publication par lot multi-séances (X22 limité à une séance), filtre persistant de la file (C09-08), routes GET pour Expo, E2E automatisé, CI.
- Top bar mobile encore chargée côté athlète. À revoir après observation.
- Le profil créé à la première connexion prend la partie avant @ comme nom. Réglage du nom (X07, C02-07) à faire.

## Prochaine action

**Recette des deux rôles avec le fondateur, puis fin de la tranche C.**

1. **Pour le fondateur (sans code).** Dérouler le parcours complet en local : inscription d’un coach, création d’espace, invitation, acceptation sur téléphone (ou fenêtre étroite), publication, retour, revue. Noter hésitations et blocages. Guide pas à pas donné en fin de session.
2. **Développement.** Premier réglage athlète (X07, C03-09 : langue, fuseau, sport ; aucune donnée médicale) et nom d’affichage (C02-07) ; isolation d’un athlète présent dans deux espaces (C03-10) ; reprise réseau lent sur les nouveaux formulaires.
3. **Avant toute donnée réelle (gate G1).** Fournisseur d’e-mails (Resend), `COACHOS_INVITE_HMAC_KEY` par environnement, décision sur l’inscription libre (`shouldCreateUser`), projet Supabase de staging distinct.

- **En parallèle si utile.** Corriger `contracts/openapi.json` (D-007) ; E2E Playwright du parcours invitation → retour.
