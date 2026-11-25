# État d’exécution

Dernière mise à jour : 2026-11-25 (D-161 à D-173). Reprendre ici : ce fichier suffit pour repartir ; n’ouvrir les autres documents (DECISIONS, COUVERTURE, docs/16…) que pour la section utile à la tranche en cours. Historique : [HISTORIQUE.md](HISTORIQUE.md).

## Où en est CoachOS

**En ligne** : https://coach-os-xi-kohl.vercel.app (Vercel, fonctions à Dublin ; base Supabase « CoachOS » en Irlande, 45 migrations appliquées). Compte coach du fondateur créé en ligne. `GET /api/health` répond `{"ok":true,"db":"ok","services":{"email":"resend","push":true,"ai":"simulation","contact":false}}`.

**Vérifié en ligne (23 novembre)** : base joignable ; page de connexion, inscription et confidentialité ; en-têtes de sécurité ; routes de données personnelles et de rappels déployées et protégées (401 sans session) ; premier e-mail réel d’invitation envoyé par Resend et reçu par le fondateur (adresse de test `onboarding@resend.dev`, qui n’envoie qu’à lui) ; rappels push prêts (clés en place).

**Vérifié en local seulement (Supabase local, données fictives, navigateur)** : la boucle complète coach → élève → coach, les données personnelles (export, demande, effacement), les rappels (abonnement, désabonnement), les finitions D-121.

**Pas prouvé** : la boucle complète en ligne avec un vrai élève (il faut un domaine pour que les e-mails partent vers d’autres adresses) ; réception d’un rappel push sur un téléphone ; suppression d’un compte Auth en ligne ; sauvegarde de la base en ligne (`npm run db:backup`) jamais exécutée (la restauration est essayée en local, D-163) ; migrations automatiques à la construction (variables Vercel à saisir) ; Action GitHub (premier push à venir).

**Chiffres** : `npm test` 449 passés au 24 novembre (3 ignorés sans Docker), typecheck OK, `npm run build` OK, 8 parcours de bout en bout, revue de sécurité du 23 novembre sans faille haute ou moyenne (D-115).

**Ce que le produit fait** : la matrice [COUVERTURE.md](COUVERTURE.md) (cible coach et élève, D-024) et les décisions D-001 à D-122 dans [DECISIONS.md](DECISIONS.md). En deux lignes : un coach planifie des séances structurées par sport (zones VMA, FTP, CSS), des programmes générés selon sa méthode, des groupes, des tâches, des relances, des bilans ; l’élève lit sa séance sur téléphone (hors ligne, montre, pas à pas en musculation), envoie son retour, échange avec son coach ; les données personnelles ont leur page, leur export et leur effacement.

## Refonte (D-123) et suite

Espace élève (D-129 à D-141) et espace coach (D-143 à D-160) refaits en direction Chrono (D-128) et **en ligne**. On travaille sur la branche `refonte`, fusionnée vers `main` par Pull Request (le fondateur pousse et fusionne). Depuis : droits vérifiés profil par profil (D-161), limitation des abus (D-162, en ligne), sauvegarde et restauration (D-163), cardio en paliers (D-164, en ligne), exercice en séries et circuit (D-165), suivre sa séance avec chronomètre, pause, bips et voix (D-166) ; tout est en ligne depuis la Pull Request n° 5 (24 novembre). Puis suivi finalisé (D-167, en ligne par la Pull Request n° 6) : circuits enchaînés, mise en place de 5 s, reprise après rechargement ou « Quitter », « À suivre », déroulé. Puis suivre malgré les péripéties (D-172, en ligne par la Pull Request n° 8) : écran entre deux exercices où l’élève lance quand elle est prête, pause sous le pouce, reprise avec mise en place, dernière série et mi-chemin annoncés. Voix du coach enregistrée et voix de synthèse à son image : plus tard, à sa demande. Détail : [HISTORIQUE.md](HISTORIQUE.md) et [DECISIONS.md](DECISIONS.md).

## Chantiers en cours (D-120)

1. **Confiance.** Fait : en-têtes de sécurité, pages d’erreur, contrôle de santé avec services, sauvegarde complétée de l’historique des migrations et restauration essayée en local, avec `npm run db:restore` qui ne peut rien écraser (D-116, D-163), revue de sécurité du lot données personnelles, contrôles automatiques (Action GitHub), migrations à la construction Vercel, tests de bout en bout dans un vrai navigateur (D-125 ; quatre parcours : boucle coach → élève → coach, bilan, gestes du calendrier, palette), droits en base vérifiés table par table et profil par profil, sans fuite (D-127, D-161), limitation des abus sur la connexion, l’inscription, le mot de passe et l’invitation (D-162, en ligne et contrôlé le 24 novembre), suivi des erreurs en production prêt, éteint tant que `SENTRY_DSN` manque (D-168, branche `refonte`, pas encore sur `main`). Vidéos filmées dans le stockage de fichiers Supabase, 50 Mio au lieu de 4 Mo en ligne (D-173, migration appliquée en ligne par le fondateur, code en ligne par la Pull Request n° 10, 25 novembre). Chantier Confiance terminé côté code.
2. **Le coach inconnu.** Fait (D-169, branche `refonte`, pas encore sur `main`) : trois coachs fictifs joués de l’inscription au premier retour traité ; « Ajouter plusieurs élèves » (liste collée de Google Docs ou d’un tableur, groupes compris, liens à copier), « Premiers pas » sur l’Accueil, brief du jour complété, mode simple ; six accrocs corrigés. Reste : un vrai coach chronométré sans aide ; invitations groupées par e-mail (après le domaine). Retouches du fondateur (D-170) : déplacer un palier cardio, note d’exercice lisible. Installation sur le téléphone guidée pas à pas pour l’élève (D-171).
3. **De quoi vendre.** À commencer après 1 et 2 : page publique, essai gratuit, offres par nombre d’élèves (29/59/99 € HT, docs/13), abonnement en mode test derrière un interrupteur, pages légales en brouillon, aide intégrée, mesure du temps gagné sans identité d’élève.

**Prochaine tranche** : « De quoi vendre ». D-173 est en ligne (Pull Request n° 10, 46 migrations en ligne).

## Pour le fondateur

Liste unique, dans l’ordre d’utilité. Pour chaque point : ce que c’est, pourquoi, ce que ça débloque, le temps, les clics. Tout le reste avance sans toi.

0. **Envoyer une vidéo filmée, en ligne** · 3 minutes, c’est en ligne (D-173) · sur ton téléphone, Bibliothèque › Exercices › un exercice › « Ajouter ma vidéo (filmée au téléphone) » › filme 30 secondes à une minute. À vérifier : la barre d’avancement, « Vidéo enregistrée. », la vidéo qui se lit dans l’aperçu, puis chez un élève dans sa séance. Dis-moi ce qui accroche.
0 bis. **« Confirm email » dans Supabase** · 2 minutes · utile seulement pour l’inscription d’un **nouveau coach** (D-020, D-114) ; tes élèves invités n’en dépendent pas : leur compte est créé déjà vérifié par l’invitation (D-153). Supabase › ton projet › **Authentication** › **Sign In / Providers** › **Email** › décoche **« Confirm email »** › **« Save »**. Sinon, avant le domaine, un nouveau coach ne recevrait jamais l’e-mail de confirmation.
1. **Rendre les mises en ligne autonomes** · 15 minutes · débloque : je pousse le code moi-même et les migrations s’appliquent seules ; tu n’as plus rien à faire pour une mise en ligne. Aujourd’hui, `git push` depuis ma session échoue (« could not read Username for github.com ») : seul GitHub Desktop a tes identifiants.
   - GitHub : en haut à droite, ton avatar › **Settings** › tout en bas **« Developer settings »** › **« Personal access tokens »** › **« Fine-grained tokens »** › **« Generate new token »** › nom `CoachOS Mac` › expiration 1 an › Repository access : **« Only select repositories »** › `CoachOS` › Permissions › **Contents : Read and write** › **« Generate token »** › copie-le (il ne s’affiche qu’une fois).
   - Terminal (onglet de l’app) : colle cette commande en remplaçant `LE_JETON` par le jeton copié, puis Entrée. Je ne vois jamais le jeton ; il reste dans le trousseau du Mac.
     `printf 'protocol=https\nhost=github.com\nusername=melottej7\npassword=LE_JETON\n' | git credential-osxkeychain store`
   - Supabase : en bas à gauche, clique ton avatar › **« Account preferences »** › **« Access Tokens »** › **« Generate new token »** › nom `Vercel` › **« Generate token »** › copie-le (il ne s’affiche qu’une fois).
   - Vercel : projet coach-os › **Settings › Environment Variables** › **« Add »** trois fois : `SUPABASE_ACCESS_TOKEN` (la valeur copiée, **Sensitive**) ; `SUPABASE_DB_PASSWORD` (le mot de passe de ta base, app Mots de passe « CoachOS base », **Sensitive**) ; `SUPABASE_PROJECT_ID` = `mugtpcvxvdkpjixrqvna`. **« Save »** à chaque fois.
   - Dis-moi « variables Vercel faites » : au prochain déploiement, le journal de construction affichera « base en ligne à jour ».
2. **Être prévenu si l’app tombe** · 5 minutes · débloque : une alerte par e-mail en cas de panne, sans que personne regarde.
   - https://uptimerobot.com › **« Register for FREE »** › confirme ton adresse › **« + New monitor »** › Monitor type **HTTP(s)** › URL `https://coach-os-xi-kohl.vercel.app/api/health` › Friendly name `CoachOS` › Interval **5 minutes** › **« Create monitor »**.
3. **Suivi des erreurs en production** · 10 minutes · débloque : chaque erreur en ligne arrive dans Sentry avec sa référence (celle affichée sur la page « Un problème est survenu »), sans donnée personnelle. L’intégration est prête (D-168) ; elle s’active dès que la variable existe, après la prochaine mise en ligne.
   - https://sentry.io › **« Get started »** (compte gratuit) › à l’inscription, choisis la région de données **« European Union »** (tes élèves sont en Europe) › **« Create project »** › plateforme **Next.js** › nom `coachos` › sur la page suivante, copie la ligne `dsn: "https://…"` (seulement l’adresse entre guillemets). Ignore l’assistant d’installation proposé par Sentry : rien à installer.
   - Vercel › Environment Variables › **« Add »** : `SENTRY_DSN` = cette adresse › **« Save »** › Deployments › le dernier › **« Redeploy »**.
   - Contrôle : https://coach-os-xi-kohl.vercel.app/api/health doit afficher `"errors":true`.
4. **Un nom de domaine** (devenu urgent : une amie à coacher en musculation attend son invitation ; sans domaine, l’invitation est refusée à l’envoi) · 15 minutes · environ 12 € par an · débloque : les invitations et notifications arrivent chez tes élèves, « Mot de passe oublié » fonctionne pour eux, la page publique porte ton nom.
   - Choisis le nom (c’est toi qui décides) et achète-le chez un registraire (OVH, Gandi, Combell…). Dis-le-moi : je te guide ensuite pour Resend (Domains › Add Domain, trois enregistrements DNS à copier chez le registraire) et pour le réglage SMTP de Supabase (guide [MISE_EN_LIGNE.md](MISE_EN_LIGNE.md)).
5. **Sauvegarde, une première fois** · 2 minutes · débloque : une copie de la base sur ton Mac. La restauration est prête et essayée en local (D-163).
   - Docker ouvert (baleine immobile), puis dans le Terminal : `npm run db:backup`. Il écrit trois fichiers (schéma, données, historique des migrations) et finit par « Sauvegarde écrite dans backups/ ». Dis-moi ce qui s’affiche. Les fichiers sont dans `backups/`, jamais envoyés sur GitHub ; efface ceux de plus de 30 jours.
   - Plus tard, quand de vrais élèves payeront : Supabase Pro (25 $ par mois) pour des sauvegardes automatiques restaurables en un clic. Décision et paiement : toi.
6. **Un vrai élève volontaire** · après le point 4 · débloque : la preuve de la boucle complète en ligne (invitation reçue, compte, séance, retour, revue). C’est une vraie personne : je ne l’invite jamais à ta place.
7. **Relire la page de confidentialité** · 10 minutes · https://coach-os-xi-kohl.vercel.app/confidentialite. Texte exact techniquement, marqué « à faire relire par un professionnel » dans nos documents ; c’est toi qui l’assumes. Facultatif : Vercel › `COACHOS_CONTACT_EMAIL` = ton adresse de contact.
7 ter. **Essayer l’installation guidée sur ton téléphone** · 3 minutes, c’est en ligne (D-171) · avec un compte élève, ouvre CoachOS dans Safari (ou Chrome) › « Aujourd’hui » › carte « Installe CoachOS sur ton téléphone ». À vérifier : l’appareil reconnu, des étapes qui correspondent exactement à tes menus, l’icône qui s’ouvre en plein écran. Dis-moi tout libellé qui diffère.
7 bis. **Essayer « Suivre la séance » sur ton téléphone** · 5 minutes, c’est en ligne (D-172) · une séance du jour avec deux exercices › « Suivre la séance » › « C’est parti ». À vérifier : les bips (s’ils ne sonnent pas, le bouton silencieux sur le côté de l’iPhone est sans doute activé), la voix, l’écran qui reste allumé, le bouton pause en bas en plein exercice puis « Reprendre », l’écran entre deux exercices, « Quitter » puis « Reprendre la séance ». Dis-moi ce qui accroche.
8. **Rappels sur ton iPhone** · 3 minutes · CoachOS installée sur l’écran d’accueil, ouverte depuis l’icône › 🔔 Notifications › **« Activer les rappels sur cet appareil »** › accepte. Puis publie-toi une séance depuis le Mac : dis-moi si le rappel arrive.
9. **Paiement en mode test** · quand le chantier 3 commence · 10 minutes · https://stripe.com › compte › **mode test** (interrupteur en haut à droite) › Developers › API keys › copie la **clé secrète de test** (`sk_test_…`) dans Vercel `STRIPE_SECRET_KEY` (Sensitive). Rien ne sera facturé : l’interrupteur reste éteint en production jusqu’à ta décision. Le prix final et le nom du produit sont à toi (hypothèses : 29/59/99 € HT par mois).
10. **Hygiène des comptes** · 5 minutes · Vercel › Account Settings › Authentication › **« Regenerate »** les codes de récupération (apparus sur une capture) et supprime cette capture. GitHub › ton avatar › **Settings** › **« Developer settings »** › **« Personal access tokens »** › **« Fine-grained tokens »** › le jeton collé dans la conversation (il commence par `github_pat_11CUYS`) › **« Delete »** : il a circulé en clair, il ne doit plus servir.
11. **Facultatif** · crédit Anthropic pour l’IA (budget 10 $ par espace et par mois par défaut) ; vidéos de base des 34 exercices ([VIDEOS_DE_BASE.md](VIDEOS_DE_BASE.md)) ; cocher « Musculation » dans Paramètres › sports encadrés de ton espace si tu veux la musculation.

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
npm run supabase:env     # écrit apps/web/.env.local (conserve les réglages ajoutés à la main : clés VAPID, IA)
npm run supabase:seed    # comptes Auth fictifs + données métier
npm run dev              # http://localhost:3000/login
npm run supabase:migrate # applique les nouvelles migrations à Supabase local
npm run test:pg          # boucle/droits + concurrence sur Supabase. Refuse si la base contient d’autres comptes que le jeu fictif (D-019)
npm run db:backup        # copie schéma, données et historique des migrations de la base EN LIGNE dans backups/ (hors Git)
npm run db:restore -- <horodatage> "<adresse>"  # restaure dans un projet Supabase NEUF ; refuse toute base non vide (D-163)
npm run supabase:stop
```

Sans `apps/web/.env.local`, l’application repasse en mode PGlite + `/demo`. Supabase local démarre avec le stockage de fichiers (D-173) ; une sauvegarde locale des données de recette, prise avant ce redémarrage, est restée hors du dépôt. Comptes fictifs : `marine.roy@`, `camille.laurent@`, `noah.dubois@`, `hugo.petit@`, `lea.moreau@` suivis de `demo.coachos.test`, mot de passe `DEMO_PASSWORD` de `apps/web/server/db/fixtures.ts` (Supabase local uniquement). Le serveur de développement se lance dans un onglet du Terminal. La base locale contient aussi les données de recette du fondateur (comptes paul.coach et emma) : ne jamais la remettre à zéro sans son accord (D-019).

## Écarts et dette connus

- Vocaux (3 Mo) et logos (512 Kio) restent en base, comme les vidéos envoyées avant D-173 (lues comme avant). La sauvegarde de la base n’inclut pas les fichiers du stockage (D-173).
- Mode simple mémorisé par appareil (cookie, comme le thème) : le téléphone et l’ordinateur gardent chacun le leur (D-169).
- Supabase local contient trois comptes fictifs de la tranche D-169 (`julien.trail@`, `sofia.force@`, `camille.petit@` suivis de `demo.coachos.test`, mot de passe `DEMO_PASSWORD`) et leurs 65 fiches.
- Langue : « English » enregistré, interface en français seulement (hors périmètre, D-120).
- Un compte peut être coach et athlète du même espace s’il accepte sa propre invitation : cas non bloqué, à trancher.
- `npm run build` pendant `npm run dev` corrompt le cache du serveur de développement : relancer le serveur ensuite.
- Démo locale : l’espace « Atelier Endurance » contient des fiches de test (« Aperçu Test ») ajoutées pendant les vérifications.

## Où sont les choses

- Contrat : `supabase/migrations/` (SQL, additif), `contracts/openapi.json`, `docs/05_DATABASE.md`, `docs/06_API.md`.
- Domaine (règles pures, testées) : `packages/domain/src/`.
- Serveur : `apps/web/server/commands/` (écritures, droits vérifiés en base), `apps/web/server/repo/` (lectures sous RLS), `apps/web/app/api/v1/` (routes du contrat), `apps/web/server/http.ts` (enveloppes : origine, session, idempotence).
- Écrans : `apps/web/app/coach/[wid]/…`, `apps/web/app/athlete/[wid]/…`, composants dans `apps/web/components/`, styles dans `apps/web/app/globals.css`.
- Mise en ligne : [MISE_EN_LIGNE.md](MISE_EN_LIGNE.md) (variables, réglages, sauvegarde), `.github/workflows/ci.yml` (contrôles), `scripts/migrate-remote.mjs` (migrations à la construction), `apps/web/vercel.json`.
- Recette du fondateur : [GUIDE_RECETTE.md](GUIDE_RECETTE.md).
