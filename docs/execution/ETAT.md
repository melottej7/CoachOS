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

- Pas encore : annulation de séance, report d’un cas (snooze), publication par lot multi-séances (X22 limité à une séance), filtre persistant de la file (C09-08), routes GET pour Expo, E2E automatisé, CI.
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

Non prouvé : import du fichier FIT sur une vraie montre ; enregistrement au micro réel (autorisation du micro non automatisable ici) ; visite et glisser-déposer sur vrai téléphone (toucher), lecteur d’écran sur la bulle et l’annonce des déplacements, visite coach à 375 px.

À faire, dans l’ordre (D-032) :
1. Recette des lots G et H par le fondateur (Planning, Élèves, fiche).
2. Recette par le fondateur des nouveautés de la nuit et du matin, dont **l’essai du fichier FIT sur la Fenix 8** (GUIDE_RECETTE).
3. Ensuite :
   - rapprochement de plusieurs activités par séance (CE-X-03) ;
   - créneau et récurrence des tâches (CE-H-06) ;
   - propositions de semaine et faisabilité (CE-P-05).
3. **Lot G** (détail) : CE-G-01 à CE-G-08 (groupes sur `teams` étendu par migration additive, niveaux par sport `athlete_sport_levels`, vue d’ensemble, groupe filtré avec contexte conservé, fiche élève centrale, notes privées `coach_notes`, objectifs `goals`).
3. Lot H, puis S, B, E, G2, P ; export FIT (CE-X-01) possible en parallèle.

**Pour le fondateur** : décision sur les données de santé, droit d’usage écrit de la bibliothèque et de la méthodologie Foulée, accès au dépôt `foul-e`, exemples anonymisés de vos anciens programmes. Accès Garmin reporté (D-026).
