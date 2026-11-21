# État d’exécution

Dernière mise à jour : 2026-11-19 (régularité dans la liste des élèves, D-043 ; séance de groupe, D-042 ; saisie rapide en texte, D-041 ; graphique de la séance, D-040 ; retour rapide depuis Aujourd’hui, D-039 ; suivi de l’entraînement et onglet Progression, D-037 ; appel de bienvenue, D-038 ; bibliothèque et messages liés aux séances, D-035, D-036 ; rendez-vous depuis la conversation, D-034 ; messagerie, D-033 ; lots G et H : Planning du coach, groupes, fiche élève, tâches et rendez-vous, D-032 ; retours de recette, D-031 ; 7 zones et VMA, D-029 ; constructeur par glisser-déposer et guide CoachOS, D-030 ; visite interactive, D-028).

## Résumé

Tranches **A (publier et lire)** et **B (retour et revue)** démontrables en local sur données fictives. La boucle créer → publier → lire sur téléphone → envoyer un retour → traiter fonctionne de bout en bout pour les deux rôles. Les droits sont vérifiés en base (RLS du SQL de référence) et dans chaque commande.

Tranche **C, étape 1** faite : l’application tourne sur le PostgreSQL de Supabase local avec une connexion réelle (Supabase Auth). **Depuis D-020 (instruction du fondateur), la connexion se fait par adresse et mot de passe** pour le coach comme pour l’athlète ; seul « Mot de passe oublié » envoie encore un e-mail (Mailpit en local). PGlite reste le moteur des tests rapides et le repli sans Docker. Tranche **C, étape 2** faite : un nouveau coach s’inscrit, crée son espace, ajoute un athlète et l’invite par e-mail ; l’athlète ouvre le lien, se connecte avec la bonne adresse et voit sa première séance publiée. Tranche **C, étape 3** faite : premier réglage athlète (X07) et profil (nom de compte, langue, fuseau), athlète présent dans deux espaces (C03-10). Une revue critique a ajouté des tests de concurrence réelle et de contrat, et corrigé le contrat OpenAPI. **La tranche C est terminée côté développement ; sa validation dépend de la recette du fondateur** (`docs/execution/GUIDE_RECETTE.md`).

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
npm run supabase:migrate # applique les nouvelles migrations à Supabase local
npm run test:pg          # boucle/droits + concurrence sur Supabase. Refuse si la base contient d’autres comptes que le jeu fictif (D-019)
npm run supabase:stop
```

Sans `apps/web/.env.local`, l’application repasse en mode PGlite + `/demo`. Après un changement de `supabase/config.toml`, relancer `supabase:stop` puis `supabase:start`, puis redémarrer `npm run dev`.

Comptes fictifs : `marine.roy@`, `camille.laurent@`, `noah.dubois@`, `hugo.petit@`, `lea.moreau@` suivis de `demo.coachos.test`, mot de passe `DEMO_PASSWORD` de `apps/web/server/db/fixtures.ts` (Supabase local uniquement). Les e-mails (invitation, mot de passe oublié) arrivent dans Mailpit (http://127.0.0.1:54324). En développement, `/demo` reste un raccourci sans e-mail ; « Réinitialiser la démo » recharge le jeu fictif sans redémarrer.

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
| C03-03 Accepter | Fait : adresse égale à l’invitation requise, une seule relation, rechargement sans doublon ; création du compte athlète depuis l’invitation (D-020) | tests + navigateur (mobile) |
| C03-04 Révoquer | Fait | test |
| C03-05 Renvoyer | Fait : l’ancien lien échoue, le dernier fonctionne | test |
| C03-09 Premier réglage | Fait : guide d’introduction avec avatar, puis questionnaire en trois étapes (langue, fuseau, sport, niveau, ancienneté, volume, objectif, disponibilités), aucune donnée de santé (D-021) | tests + navigateur |
| C03-10 Deux portefeuilles | Fait : deux contextes indépendants, aucun croisement espace/dossier | tests |
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
| C02-01 Inscrire un coach | Fait : `/signup` adresse + mot de passe → création d’espace, profil sans doublon. Adresse non confirmée (D-020) | navigateur |
| C02-02 Finaliser le lien Auth | Fait pour la réinitialisation : lien réutilisé ou expiré → message et nouvelle demande | navigateur |
| C02-05 Quitter la session | Fait : retour navigateur après déconnexion → `/login`, aucune donnée affichée | navigateur |
| C02-07 Nom d’affichage | Fait : `PATCH /me`, rôle inchangé ; nom de compte distinct du nom de dossier choisi par le coach (D-018) | tests + navigateur |
| C02-06 Réponse publique identique | Fait : « Mot de passe oublié » et échec de connexion neutres. Exception assumée : l’inscription signale une adresse déjà inscrite (D-020) | navigateur |
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

Revue critique et tranche C, étape 3 (même session) :

- Concurrence réelle sur PostgreSQL (`concurrency.test.ts`) : 5 envois simultanés avec la même clé → 1 retour, réponses identiques (une fausse alerte : `jsonb` réordonne les clés) ; 2 premiers envois depuis deux appareils → 1 succès + 1 conflit 409 ; 2 publications simultanées → 1 seule version publiée. Garde-fou ajouté : une violation d’unicité 23505 devient un 409 lisible.
- Contrat : 51 bornes corrigées dans `contracts/openapi.json` (D-007) ; `contract.test.ts` valide les réponses réelles et les erreurs de 10 routes contre le contrat. Preuve de sensibilité : le même test échoue sur l’ancien contrat (RPE 0 et 35 min refusés).
- Navigateur : déconnexion puis retour → `/login?next=…`, aucune donnée. Profil athlète 375 px avec barre à trois onglets ; enregistrement → Aujourd’hui ; incohérence trouvée et corrigée (le coach voit le nom de dossier, pas le nom de compte).
- Totaux : `npm test` **46 passés** (+3 réservés à PostgreSQL) ; `npm run test:pg` **19 passés** ; typecheck et build OK.

Connexion par mot de passe (D-020, même session) :

- `npm test` : **50 passés** (+3 réservés à PostgreSQL), dont `register.test.ts` : mauvaise adresse, mot de passe court, lien consommé, adresse déjà inscrite, lien expiré → aucun compte créé ; bonne adresse → un compte, un profil, une relation. `npm run test:pg` : 19 passés. Typecheck et build OK.
- Navigateur sur Supabase local : `/signup` Paul → `/coach/new` avec le nom prérempli → espace → invitation d’Emma → déconnexion. Emma (375 px) : lien d’invitation → formulaire « Créer mon compte et rejoindre » → mauvaise adresse refusée sur le champ (0 compte créé, vérifié en base) → bonne adresse → « Bienvenue ! » dans l’espace de Paul, jeton effacé → déconnexion → mauvais mot de passe : « Adresse e-mail ou mot de passe incorrect », destination conservée → bon mot de passe → Aujourd’hui. Paul : « Mot de passe oublié » → e-mail « Réinitialiser ton mot de passe CoachOS » → nouveau mot de passe → « Mot de passe modifié ».
- Comptes de test supprimés ensuite ; jeu fictif rechargé (5 comptes).

Retour de recette du fondateur (même session, D-021) :

- Recette du fondateur : parcours jugé « fluide et bien pensé » ; demandes : guide d’introduction avec avatar, présentation et questionnaire de profil pour l’athlète.
- `npm test` : **55 passés** (+3 réservés à PostgreSQL), dont `athlete-profile.test.ts` (lecture coach affecté seulement, écriture athlète seulement, champ « injuries » refusé) et le contrat de `PUT athlete-profile`. `npm run test:pg` : 19 passés. Typecheck et build OK. Migration appliquée à Supabase local (RLS active, 1 politique).
- Navigateur, 375 px : invitation → création du compte → guide « Allure » en 5 étapes → questionnaire (Entrée et « Suivant » ne soumettent plus avant la fin) → Aujourd’hui. Coach : profil sportif visible dans le dossier, guide coach depuis le menu « Guide ».
- **Incident** : un lancement de `test:pg` a effacé les données de recette du fondateur (comptes conservés). Garde-fou corrigé et prouvé (D-019).

Personnalisation de l’espace coach (même session, D-022) :

- `npm test` : **64 passés** (+3 réservés à PostgreSQL), dont `workspace-profile.test.ts` (propriétaire seul en écriture, membres seuls en lecture, lien http et champ inconnu refusés, SVG/GIF/fichier vide ou trop lourd refusés, e-mail au nom du coach, aperçu sans donnée d’athlète, lien utilisé sans aperçu) et le contrat des quatre nouvelles opérations. Typecheck OK ; build OK avant les derniers ajustements de libellés.
- `npm run test:pg` **refusé par le garde-fou** : la base contient l’espace « Pauletta » créé par le fondateur. Non forcé.
- Navigateur : assistant en quatre étapes (présentation, spécialités, logo + couleur « Océan » avec aperçu, infos pratiques), lien http refusé avec message « Site web : adresse commençant par https:// », puis guide coach aux couleurs de l’espace. E-mail « Marine Roy t’invite à rejoindre Atelier Endurance » avec l’accroche ; page d’invitation (375 px, non connecté) avec logo, coach, ville et accroche ; Camille : logo et couleur en haut de ses écrans, écran « Ton coach ».
- Incident technique : après un build de production lancé pendant le serveur de développement, celui-ci servait une version périmée d’un fichier (erreur 500 sur l’envoi du logo) ; corrigé en relançant le serveur. Éviter `npm run build` pendant `npm run dev`.

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

- Pas encore : publication par lot multi-séances (X22 limité à une séance), routes GET pour Expo, E2E automatisé, CI. (Report d’un cas et filtre de la file : D-082.)
- Top bar mobile encore chargée côté athlète. À revoir après observation.
- Le profil créé à la première connexion prend la partie avant @ comme nom ; le coach peut le corriger à la création d’espace ou dans `/profile`, l’athlète dans Profil.
- Langue : le choix « English » est enregistré mais l’interface reste en français (V1).
- Démo : l’espace « Atelier Endurance » porte maintenant une présentation, un logo de test et la couleur « Océan » ; une fiche « Aperçu Test » invitée y a été ajoutée pendant la vérification.
- `npm run build` pendant `npm run dev` corrompt le cache du serveur de développement : relancer le serveur ensuite.
- Un compte peut être coach et athlète du même espace s’il accepte sa propre invitation : cas non bloqué, à trancher.

## Prochaine action

**Cible coach et élève (D-024).** Lire [16_COMPLEMENT_COACH_ELEVE.md](../16_COMPLEMENT_COACH_ELEVE.md), [COUVERTURE.md](COUVERTURE.md), [AUDIT_FOULEE.md](AUDIT_FOULEE.md), puis la section « Lots de la cible coach et élève » de la roadmap.

Fait dans la reprise du 18 novembre (non commité depuis 31df2d2) :
- D-026 (Garmin différé, essai sur Fenix 8, base de chaque coach) et D-027 (audit de Foulée, reprise par les idées) ; stories ajoutées (CE-C-03, CE-B-09, CE-E-04, CE-E-05, CE-P-05 à 07…).
- **CE-C-01, visite interactive d’Allure (D-028)**. Preuves navigateur : élève à 375 px (accueil → carte du jour en projecteur, cas « repos » avec texte adapté, étapes de séance sautées sans affichage parasite, « Précédent » sans boucle, Programme, Profil, bouton Allure, « Terminer ») ; coach (Planning, choix de l’élève, clic réel sur « + Ajouter » qui ouvre la création et poursuit la visite sur le constructeur, modèles, enregistrement, Retours, Élèves, Paramètres) ; coach sans élève (simulé sans écrire en base : clic sur « + Ajouter un athlète » puis formulaire). `npm test` : **73 passés** (+3 PostgreSQL), dont `tours.test.ts` (pages reconnues, chaque élément visé présent dans les écrans) ; typecheck OK.
- Petit correctif : « 19 nov.. » (double point) sur Aujourd’hui.
- **D-029** 7 zones (échelle du fondateur) ; VMA fixée par le coach dans la fiche élève (table `athlete_references`, migration `20261118030000` appliquée à Supabase local) ; allures par zone, kilomètres et durées estimés dans le constructeur, la lecture coach et athlète et la revue. Preuves : VMA 15 km/h saisie pour Camille (tableau Z1 6:40 à 6:09 /km … Z7 4:00 à 3:38 /km) ; « Séries courtes » lue « environ 1 h 08 · environ 10,8 km » côté coach et athlète (375 px).
- **D-030** constructeur : glisser-déposer réel vérifié (réordonner dans une série, faire entrer l’échauffement dans une répétition), flèches clavier avec focus conservé et annonce, menu « ⋯ » ; répétitions encadrées ; numéro unique ; pas de débordement à 375 px. Guide renommé « guide CoachOS », personnage en pied qui montre l’élément ; écran « La suite de la visite se passe sur la page « Planning ». Je t’y emmène ? » puis reprise vérifiée.
- `npm test` : **83 passés** (+3 PostgreSQL), dont `athlete-references.test.ts` (coach affecté seul en écriture, athlète en lecture, autre espace refusé, bornes), `block-tree.test.ts` (déplacements et limites du schéma), estimation et 7 zones dans `structure.test.ts`, contrat de `PUT …/references`. Typecheck OK. `test:pg` non lancé (garde-fou : données de recette du fondateur).

- **D-031** (recette du fondateur) : « 20 min 01 » corrigé à la saisie ; allure de l’élève derrière la zone ; retour « séance faite autrement » (ce qui a changé, sport, répétitions par série, distance ; migration `20261118040000` appliquée) affiché dans la revue avec allure moyenne ; Programme élève en vue mois (vérifiée à 375 px). `npm test` : **85 passés** (+3 PostgreSQL). Le serveur de développement tourne dans un onglet du Terminal (l’aperçu s’arrête en fin de tour).

- **D-032, lots G et H** (19 novembre) : migration additive `20261118050000` (groupes ordonnés et archivables, niveaux confirmés, tâches, suivis automatiques, rendez-vous) appliquée à Supabase local ; 13 opérations au contrat (dont 5 déjà prévues) ; `npm test` : **101 passés** (+3 PostgreSQL), dont `portfolio.test.ts` (propriétaire seul pour les groupes, autre espace refusé, notes invisibles pour l’élève, transitions et conflit de tâche, suivis uniques reportables et clos à la résolution, rendez-vous à l’heure locale, rendez-vous et tâches invisibles pour l’élève) et `portfolio.test.ts` du domaine (classement, urgence, fuseaux). Navigateur (Marine) : Planning avec tâches classées et motif ; tâche créée puis terminée ; visio avec Camille vendredi 18 h 30 visible dans l’agenda avec « Rejoindre » ; deux groupes créés, Camille ajoutée aux deux depuis sa fiche ; groupe filtré + regroupement par niveau → fiche → retour au même contexte ; 375 px sans débordement ; visite guidée qui part du Planning puis suit vers Séances.

- **D-033, messagerie** : fil privé par élève, fil par groupe, vocaux, suivi « Répondre au message », réponses rapides ; migration `20261119000000` appliquée à Supabase local. `npm test` : **108 passés** (+3 PostgreSQL), dont `messages.test.ts` (fil unique, tiers refusés, non-lus, suivi ouvert puis fermé par la réponse, vocal : format, durée, écoute réservée ; groupe : membres seulement, noms signés, retrait = plus d’accès) et le contrat des 7 opérations. Navigateur : Camille (375 px) écrit à son coach et envoie un vrai fichier WebM de 2 s (enregistré à partir d’un son de synthèse) ; Marine voit « Messages 2 » et « Répondre au message · Camille » dans son Planning, lit le vocal (1,7 s, sans erreur), répond par Cmd + Entrée : pastille et suivi disparaissent ; fil de groupe avec avertissement ; « Bravo ! 👏 » envoyé depuis un retour. Affichage façon Messenger vérifié (ordinateur et 375 px : bulles regroupées, vocal lu dans la bulle, Entrée envoie, barre du bas à 4 onglets sans débordement) ; non-lus corrigés (arrondi à la milliseconde). `npm test` : **109 passés**. Branche `feat/CE-G-H-planning-coach`.

- **D-034** rendez-vous depuis la conversation et la fiche : planification rapide (types, jours, heures, durées en un toucher ; lien de visio Jitsi créé d’office ; « Prévenir » coché) ; carte dans la conversation avec « Rejoindre l’appel » et « Ajouter à mon agenda » ; migration `20261119010000` appliquée. `npm test` : **110 passés**. Navigateur : Marine planifie depuis la conversation, la carte apparaît chez elle et chez Camille (375 px).

- **D-035, D-036** : Séances avec sous-onglets Semaine, Bibliothèque, À préparer ; bibliothèque (créer, modifier, dupliquer, archiver, séances de départ, utiliser pour un élève, ajouter depuis une séance) ; messages liés à une séance et retours intercalés dans la conversation ; nom de l’espace dans l’en-tête des conversations ; bouton « Relancer » du questionnaire ; plus de faux « Répondre » quand le coach est aussi l’élève. Migration `20261119020000` appliquée. `npm test` : **115 passés**. Navigateur vérifié (Marine : séances de départ, « Utiliser pour un élève » pré-remplit 3 blocs, À préparer liste Noah, message cité et carte de retour de Camille).

- **D-037, D-038** : onglet Progression de l’élève (objectif avec J-x, régularité, volume, distance, effort, série, colonnes par semaine, tableau, définitions ; barre à 5 onglets à icône) ; « Suivi de l’entraînement » dans la fiche élève ; suivi « Planifier l’appel de bienvenue » après le questionnaire, avec planification dans la tâche. Migration `20261119030000` appliquée. `npm test` : **122 passés** (+3 PostgreSQL), dont `stats.test.ts` (droits, brouillons exclus) et le cycle du suivi (ouvert, clos par un rendez-vous, rouvert à l’annulation, « Pas besoin d’appel »). Navigateur : Camille à 375 px (Progression, bulle dans le cadre, semaine en cours visible) ; Marine : fiche de Camille sur 12 semaines, suivi de Noah avec planification dépliée dans la tâche. Données de démonstration : questionnaire de Noah rempli pour la vérification.

- **D-039** : retour rapide en deux gestes sur Aujourd’hui (séance du jour et d’hier sans retour), intention déduite des zones, écart de ressenti affiché. Vérifié à 375 px (Camille, données de démonstration).

- **D-040** : graphique de la séance (élève, coach, constructeur) ; clés stables du constructeur (plus d’écart d’hydratation).

- **D-041** : saisie rapide d’une séance en notation texte dans le constructeur, aperçu et erreurs au fil de la saisie, aller-retour exact.

- **D-042, lot G2** : séance de groupe (onglet Séances → Groupes) : base commune, destinataires exacts, un brouillon par élève, adaptation individuelle, exceptions rappelées, publication atomique ; semaine du groupe. Migration `20261119040000` appliquée. Données de démonstration : Noah ajouté au « Groupe du mardi », séance « Piste du mardi » publiée pour Noah seul.

- **D-043** : régularité sur 4 semaines par élève et par groupe dans Élèves, filtre « Régularité sous 50 % ». `npm test` : **139 passés** (+3 PostgreSQL).

- Commit `66651b8` (D-034 à D-043). Puis, le 19 novembre au matin (non commité) :
  - **D-044** : export FIT d’une séance (élève et coach). Fichier vérifié par un lecteur indépendant et par le contrôle CRC d’un vrai fichier Garmin. Droits vérifiés au navigateur.
  - **D-045** : suivis automatiques réglables (Paramètres, migration `20261119050000`).
  - **D-046** : modifier la base d’une séance de groupe, répercutée sur les séances qui la suivent, sans rien publier (migration `20261119060000`).
  - **D-047** : correction de l’accusé de lecture quand un retour termine la conversation.
  - Migrations appliquées à Supabase local, sans remise à zéro. `npm test` : **148 passés** (+3 PostgreSQL), typecheck OK.
- Commit `7b9e0ec` (D-044 à D-047). Puis (non commité) :
  - **D-048** : import de l’activité de la montre (FIT, TCX, GPX), lue dans le navigateur, durée et distance préremplies, provenance conservée (migration `20261119070000`).
  - **D-049** : annonce facultative d’une séance de groupe dans le fil du groupe.
  - **D-050** : comparaison avec la période précédente dans le suivi.
  - `npm test` : **156 passés** (+3 PostgreSQL), typecheck OK.
- Commit `306247d` (D-048 à D-050). Puis (non commité) :
  - **D-051** : semaines types (enregistrer, appliquer en brouillons) et « Publier la semaine ».
  - **D-052** : historique séance par séance dans la fiche.
  - **D-053** : filtre par objectif dans la liste des élèves.
  - `npm test` : **159 passés** (+3 PostgreSQL), typecheck OK. COUVERTURE remise à jour (lignes périmées corrigées).
- Commit `44cc3a8` (D-051 à D-053). Puis (non commité) :
  - **D-054** : bilan d’arrivée inspiré de Foulée (une question par écran, questions conditionnelles, brouillon serveur et reprise, confirmation coach, entretien avec provenance) ; migration `20261119080000` appliquée.
  - `npm test` : **170 passés** (+3 PostgreSQL), typecheck OK.
- Commit `3ca7ca6` (D-054). Puis (non commité) :
  - **D-055** : FTP et CSS de l’élève, zones traduites en watts et en allures de nage partout, y compris dans le fichier FIT ; migration `20261119090000` appliquée.
  - `npm test` : **177 passés** (+3 PostgreSQL), typecheck OK.
- Commit `51d81ec` (D-055). Puis (non commité) :
  - **D-056** : « Adapter la semaine », quatre propositions inspirées de Foulée, appliquées en brouillons.
  - `npm test` : **186 passés** (+3 PostgreSQL), typecheck OK.
  - **D-057** : faisabilité de l’objectif (statut, critères, solutions, paramètres, message proposé jamais envoyé seul) ; correction des fenêtres « + … » coupées par les cartes.
  - **D-058** (instruction du fondateur) : le passif de l’élève entre dans la faisabilité ; le statut n’est qu’une indication ; le coach valide l’objectif (paramètres et justification, table `goal_decisions`, migration `20261119100000`). **Le futur générateur de programme (lot P) devra atteindre les objectifs validés par le coach.**
  - **D-059** : suivi « Confirmer le bilan » (niveau confirmé avec), tâches récurrentes, historique du bilan (migrations `20261119110000` à `20261119130000`).
  - **D-060** : résultats de référence (courses, tests), équivalences, VMA d’un test ; chrono visé jugé par prédiction de Riegel dans la faisabilité ; résultats visibles par l’élève (migration `20261119140000`).
  - **D-061** (instruction du fondateur) : générateur de programme à règles — à la hauteur de l’objectif validé, 4 semaines de tremplin depuis le volume réel, développement, affûtage ; risques signalés au coach qui décide ; brouillons (migration `20261119150000`).
  - `npm test` : **212 passés** (+3 PostgreSQL), typecheck OK.
- Commit `1c81285` (D-056 à D-061). Puis commit `994104a` (D-062, D-063) :
  - **D-062** (inspiré de Foulée) : le générateur reprend d’abord les séances de la bibliothèque du coach (même sport, même catégorie, durée proche), en alternance ; chaque séance dit « Pourquoi cette séance ? », dans l’aperçu et dans les consignes des brouillons.
  - `npm test` : **213 passés** (+3 PostgreSQL), typecheck OK.
  - **D-063** (CE-P-06) : régénération partielle d’un programme. Le coach choisit les semaines et les jours et voit les différences avant d’appliquer. Les séances passées, réalisées ou retouchées sont protégées. Une séance publiée attend la republication. Migration `20261119160000` appliquée en local, sans remise à zéro. Les séances annulées sont mieux affichées dans Séances.
  - `npm test` : **217 passés** (+3 PostgreSQL), typecheck OK.
- Puis (non commité) :
  - **D-064** (CE-X-03) : plusieurs activités de la montre par séance. Elles sont additionnées, l’élève peut en retirer une, et la même activité ne peut pas être rattachée à deux séances. Seul leur résumé est conservé (migration `20261119170000` appliquée en local). Le coach voit la liste des activités dans le retour.
  - `npm test` : **219 passés** (+3 PostgreSQL), typecheck OK.
  - **D-065** (CE-H-06) : créneau de travail (jour, heure) et durée estimée des tâches, distincts de l’échéance et des rendez-vous. Le créneau apparaît dans l’agenda, le haut du Planning donne la charge estimée du jour, et la récurrence suit le créneau. Migration `20261119180000` appliquée en local.
  - `npm test` : **220 passés** (+3 PostgreSQL), typecheck OK.
  - **D-066** : bilan, temps disponible en semaine, moment préféré, jour de la séance longue, matériel selon le sport, contraintes pratiques (sans information médicale). Le générateur place la séance longue le jour préféré et signale les séances de semaine trop longues. Migration `20261119190000` appliquée en local.
  - `npm test` : **223 passés** (+3 PostgreSQL), typecheck OK.
  - **D-067** : notifications.
    - Centre coach et élève, sans contenu de message, regroupées.
    - E-mails « essentiels » ou aucun, un par type toutes les 3 h, vers Mailpit en local.
    - Liens revérifiés au clic. Migration `20261119200000`.
  - **D-068** (instruction du fondateur) : bibliothèque Foulée, 324 séances en 79 familles par paliers ; paliers intermédiaires recalculés et signalés.
    - Bouton d’import ; le générateur respecte niveaux et phases.
    - **Importée dans l’espace du fondateur** (324 séances ajoutées, aucune modifiée).
  - **D-069** (retour du fondateur sur Emma) : valider un objectif ouvre le générateur ; bandeau « Prochaine étape » sur la fiche et dans Séances.
  - `npm test` : **230 passés** (+3 PostgreSQL), typecheck OK.
- Commit `fa86509` (D-064 à D-069). Puis (non commité) :
  - **D-070** (CE-E-06) : CoachOS installable sur l’écran d’accueil. Manifeste, icônes générées (Android, iPhone), couleurs de thème.
  - `npm test` : **231 passés** (+3 PostgreSQL), typecheck OK.
  - **D-071** (instruction du fondateur) : « Ajuster avec l’IA ».
    - Le coach écrit sa demande ; l’IA (simulée pour l’instant) la traduit en réglages bornés du générateur ; le moteur recalcule avec les mêmes garde-fous ; le coach décide.
    - Propositions tracées dans `ai_suggestions`, nom de l’élève retiré.
    - Claude est branché (SDK officiel 1.10.0, installé avec l’accord du fondateur) : il est actif dès que la clé est dans `apps/web/.env.local`.
  - `npm test` : **236 passés** (+3 PostgreSQL), typecheck OK.
  - Clé Anthropic du fondateur en place ; compte sans crédit : l’IA répond « plus de crédit », la simulation reste possible avec `COACHOS_AI=simulation`.
  - **D-072** : « Ma méthode » (Coach DNA). Règles du coach appliquées par défaut au générateur ; propositions apprises de ses retouches (5 observations, 2 semaines, 80 %). Migration `20261119210000`.
    - Corrigé en route : allure de course sans allure chiffrée (plus de VMA ou de PMA par défaut) ; identifiants d’action sur téléphone en http.
  - `npm test` : **243 passés** (+3 PostgreSQL), typecheck OK.
- Commit `8698998` (D-070 à D-072). Puis (non commité) :
  - **D-073** : résumé de la semaine de chaque élève, sans IA (trois faits au plus, une question utile, données insuffisantes signalées), en tête de sa fiche ; « Poser la question » prépare le message sans l’envoyer.
  - `npm test` : **247 passés** (+3 PostgreSQL), typecheck OK.
  - **D-074** : blocs réutilisables (garder une partie de séance, l’insérer ailleurs ; Bibliothèque › Mes blocs). Migration `20261119220000`.
  - **D-075** : source et fraîcheur des mesures en tête du suivi de la fiche.
  - `npm test` : **251 passés** (+3 PostgreSQL), typecheck OK.
- Commit `252afeb` (D-073 à D-075). Puis (non commité) :
  - **D-076** : notifications des fils de groupe, dans l’application seulement. Migration `20261119230000`.
  - **D-077** (instruction du fondateur) : paliers Foulée calculés validés.
    - Repères Foulée sortis des consignes : un élève les aurait lus. Corrigé dans l’espace du fondateur et dans la démo.
    - Repère visible du coach seul dans la bibliothèque.
  - `npm test` : **252 passés** (+3 PostgreSQL), typecheck OK.
- Commit `a1fa6b9` (D-076, D-077). Puis, la nuit du 19 novembre (le fondateur a accepté d’avance et autorisé les commits) :
  - **D-078** : régénération, choix séance par séance.
  - **D-079** : import de la base d’un coach (CSV, cellules de tableur, lignes « Titre : séance »), aperçu ligne par ligne. Une séance d’essai importée dans la démo.
  - **D-080** : lecture hors ligne de l’espace élève (service worker, réseau d’abord, effacé à la déconnexion ; https seulement).
  - **D-081** : coût réel de chaque appel à Claude, budget mensuel par espace (10 $ par défaut), carte « IA ce mois-ci ».
  - `npm test` : **264 passés** (+3 PostgreSQL), typecheck OK. Aucune migration cette nuit.
- Commit `1536c96` (D-078 à D-081). Puis :
  - **D-082** : file des retours, reporter un cas (date future, retour seul dans la file) et filtre gardé au retour du détail (C09-08).
  - `npm test` : **266 passés** (+3 PostgreSQL), typecheck OK.
- Commit `e9cd51a` (D-082). Puis :
  - **D-083** : blocs de 2 à 12 semaines (programmes types) enregistrés depuis un élève, appliqués en brouillons à un autre.
  - `npm test` : **267 passés** (+3 PostgreSQL), typecheck OK.
- Question du fondateur sur les données de santé (« faire signer un cookie ») : réponse donnée. Le 20 novembre, le fondateur garde l’exclusion (**D-084**).
- 20 novembre : le fondateur partage 7 programmes réels (Google Docs).
  - **D-085** : lecture tolérante de son écriture (71/71 séances lues) ; import d’un ancien programme entier comme programme type (Bibliothèque › Importer un programme). Ses 7 documents donnent 14 programmes.
  - Sa méthode et les écarts avec le générateur : [METHODE_FONDATEUR.md](METHODE_FONDATEUR.md).
  - `npm test` : **276 passés** (+3 PostgreSQL), typecheck OK.
  - **D-086** (« Oui, aligne-le ») : générateur aligné sur sa méthode. Course/marche, lignes droites, qualité du court au long, test 5 km, rappel d’allure, puis veille ; risques en minutes ; consignes types. `npm test` : **280 passés**.
  - **D-087** (« mixer les deux ») : 7 zones de CoachOS avec ses repères (Z2 endurance, Z3 endurance active, Z4 seuil, Z5 allure 5 km, Z6 VMA, Z7 vitesse) ; ses documents traduits un cran plus haut à l’import. `npm test` : **281 passés**.
  - **D-088** (« sans le corps ») : « Peux-tu faire tes séances à 100 % ? » dans le retour ; le coach voit « Pas à 100 % » en tête de file, avec un filtre. Migration `20261120090000` appliquée en local. `npm test` : **282 passés**.
- 20 novembre, « continue sans moi » :
  - **D-089** : suivi automatique « En parler avec l’élève » (urgent) quand il n’est pas à 100 % ; il se clôt par un message du coach. Repère « Pas à 100 % » dans Élèves.
  - **D-090** : test 5 km : l’élève saisit son chrono ; le coach voit la VMA estimée et décide (résultat de référence, nouvelle VMA). Non vérifié dans le navigateur (pas de séance « Test 5 km » dans la démo).
  - **D-091** : consignes générales d’un programme importé, gardées et ajoutées à la première séance appliquée.
  - **D-092** : le résumé de la semaine signale d’abord un élève qui n’est pas à 100 %. `npm test` : **286 passés**.
  - **D-096, D-097 (21 novembre) : CoachOS modulaire, endurance et musculation.** Lot M1-M2 fait :
    - sport Musculation, exercices dans la séance (répétitions, charge, repos, séries) ;
    - onglet Séances › Exercices (34 exercices de départ, vidéo par lien ou fichier filmé) ;
    - constructeur et écriture en texte ;
    - lecture élève avec « Voir comment faire ».
    - Migration `20261121090000` appliquée. `npm test` : **300 passés**.
    - **D-098 : M3 fait.** « ▶ Suivre la séance pas à pas » : une étape par écran, vidéo, série en cours, repos chronométré automatique, reprise après coupure. `npm test` : **302 passés**.
    - **D-099 : deux options de vidéo.** La vidéo du coach d’abord, sinon une vidéo de base CoachOS (fondateur, IA ou mélange), avec son origine affichée. Le coach peut la refuser. Catalogue vide : vidéos à produire par le fondateur ([VIDEOS_DE_BASE.md](VIDEOS_DE_BASE.md)). Migration `20261121100000` appliquée. `npm test` : **304 passés**.
    - **D-100 : M4 fait.** Séries et charges notées pendant « Suivre », reprises dans le retour, comparées au prévu (coach et élève), progression des charges par exercice. Migration `20261121110000` appliquée. Correction e0df365 (pages de séance en erreur depuis D-099). `npm test` : **309 passés**.
    - **D-101** : page « Programme » refondue, programme en premier (graphique du volume par phase, semaines dépliables, création, réglages repliés).
    - **D-102 : M5 fait, lot M terminé.** Modules d’après les sports encadrés (rien de coché = tout), onglet Exercices et sports proposés en conséquence, séance mixte « + Renforcement » et « renfo » en texte. `npm test` : **312 passés**.
    - **D-103 : relances pré-rédigées.** Planning › « Relances » : statut lisible (silencieux, à risque, à surveiller, en rythme), message prêt, relu et envoyé par le coach, puis en attente de réponse 3 jours. `npm test` : **319 passés**.
    - **D-104 :** statut d’adhésion dans Élèves ; Paramètres › Mes relances (modèles à trous, aperçu). Migration `20261121120000` appliquée. `npm test` : **322 passés**.
    - **D-105 à D-107 (retours du fondateur)** : programme en lignes de semaine avec séances en cases, regroupé par blocs, semaines allégées marquées. Tremplin de 3 semaines puis décharge avant le développement. `npm test` : **324 passés**.
    - **D-108 (retour du fondateur en recette)** : bilan multisport (sport principal et autres sports), questions adaptées à la musculation. Migration `20261121130000` appliquée. `npm test` : **327 passés**.
    - Le paiement attend la validation du parcours des deux rôles (CLAUDE.md) et l’accord du fondateur.
  - **Analyse produit (21 novembre)** : [docs/17_ANALYSE_PRODUIT.md](../17_ANALYSE_PRODUIT.md), en réponse au cadrage « OS du coach sportif hybride ». Recommandations : rester sur le coach de course à pied indépendant ; geler les nouvelles fonctions ; mettre en ligne ; pilote de 4 semaines avec les athlètes du fondateur ; brief du jour et mode simple. 8 questions à trancher par le fondateur, aucune décision prise sans lui.
  - **D-095** : téléphone sur le même Wi-Fi : http://192.168.65.68:3000 (adresse « Network » du serveur), réseaux privés autorisés en développement.
  - **D-094** : « Ajouter des blocs à ma bibliothèque » (au lieu de « garder ») ; saisie rapide renommée « Écrire la séance en texte », avec principe expliqué, aperçu bloc par bloc et exemples.
  - **D-093** : base de séances = Foulée (instruction du fondateur). Fractions courtes Foulée (30"/30", 200 m, 300 m) en Z6 ; bouton « Mettre à jour Foulée » pour les séances déjà importées et non modifiées. Démo mise à jour ; espace du fondateur en attente de son clic. `npm test` : **288 passés**.
  - Migrations appliquées en local : `20261120100000`, `20261120110000`, `20261120120000`. `npm test` : **285 passés** (+3 PostgreSQL), typecheck OK.
- Prochaines tranches : tout ce qui reste demande le fondateur.
  - Recette, dont l’import avec sa vraie base, l’essai FIT sur la Fenix 8 et l’installation sur téléphone.
  - Crédit IA ; accès Garmin.
  - Commercial, après validation du parcours.
  - Possibles sans lui : rappels push (clés et service d’envoi à choisir).

Non prouvé : import du fichier FIT sur une vraie montre ; enregistrement au micro réel (autorisation du micro non automatisable ici) ; visite et glisser-déposer sur vrai téléphone (toucher), lecteur d’écran sur la bulle et l’annonce des déplacements, visite coach à 375 px.

À faire, dans l’ordre (D-032) :
1. Recette des lots G et H par le fondateur (Planning, Élèves, fiche).
2. Recette par le fondateur des nouveautés de la nuit et du matin, dont **l’essai du fichier FIT sur la Fenix 8** (GUIDE_RECETTE).
3. Ensuite :
   - rapprochement de plusieurs activités (CE-X-03) et propositions de semaine (CE-P-05) : faits (D-064, D-056).
3. **Lot G** (détail) : CE-G-01 à CE-G-08 (groupes sur `teams` étendu par migration additive, niveaux par sport `athlete_sport_levels`, vue d’ensemble, groupe filtré avec contexte conservé, fiche élève centrale, notes privées `coach_notes`, objectifs `goals`).
3. Lot H, puis S, B, E, G2, P ; export FIT (CE-X-01) possible en parallèle.

**Pour le fondateur** :
- Crédit Anthropic pour l’IA ; le budget mensuel est de 10 $ par espace par défaut.
- **Cocher « Musculation » (et « Course à pied ») dans Paramètres › sports encadrés** : ton espace n’a que « Trail » coché, la musculation y est donc masquée (D-102).
- Vidéos de base des 34 exercices : à filmer ou produire (guide [VIDEOS_DE_BASE.md](VIDEOS_DE_BASE.md)), puis à me transmettre.
- Base de séances : celle de Foulée fait foi (D-093), plus de tableur attendu. Dans Bibliothèque, clique « 🏃 Mettre à jour Foulée (23) » pour passer tes fractions courtes en Z6. Tes programmes sont reçus et lus (D-085).
- Accès Garmin reporté (D-026).
