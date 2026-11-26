# État d’exécution

Dernière mise à jour : 2026-11-26 (D-161 à D-184, D-187, D-189 à D-192). Reprendre ici : ce fichier suffit pour repartir ; n’ouvrir les autres documents (DECISIONS, COUVERTURE, docs/16…) que pour la section utile à la tranche en cours. Historique : [HISTORIQUE.md](HISTORIQUE.md).

## Où en est CoachOS

**En ligne** : https://coach-os-xi-kohl.vercel.app (Vercel, fonctions à Dublin ; base Supabase « CoachOS » en Irlande, 47 migrations appliquées). Compte coach du fondateur créé en ligne. `GET /api/health` répond `{"ok":true,"db":"ok","services":{"email":"resend","push":true,"ai":"simulation","contact":false}}`.

**Vérifié en ligne (23 novembre)** : base joignable ; page de connexion, inscription et confidentialité ; en-têtes de sécurité ; routes de données personnelles et de rappels déployées et protégées (401 sans session) ; premier e-mail réel d’invitation envoyé par Resend et reçu par le fondateur (adresse de test `onboarding@resend.dev`, qui n’envoie qu’à lui) ; rappels push prêts (clés en place).

**Vérifié en local seulement (Supabase local, données fictives, navigateur)** : la boucle complète coach → élève → coach, les données personnelles (export, demande, effacement), les rappels (abonnement, désabonnement), les finitions D-121.

**Pas prouvé** : la boucle complète en ligne avec un vrai élève (il faut un domaine pour que les e-mails partent vers d’autres adresses) ; réception d’un rappel push sur un téléphone ; suppression d’un compte Auth en ligne ; sauvegarde de la base en ligne (`npm run db:backup`) jamais exécutée (la restauration est essayée en local, D-163) ; migrations automatiques à la construction (variables Vercel à saisir) ; Action GitHub (premier push à venir).

**Chiffres** : `npm test` 540 passés au 27 novembre (3 ignorés sans Docker), typecheck OK, `npm run build` OK, 19 fichiers de parcours de bout en bout (27 parcours, verts le 27 novembre), revue de sécurité du 23 novembre sans faille haute ou moyenne (D-115).

**Ce que le produit fait** : la matrice [COUVERTURE.md](COUVERTURE.md) (cible coach et élève, D-024) et les décisions D-001 à D-122 dans [DECISIONS.md](DECISIONS.md). En deux lignes : un coach planifie des séances structurées par sport (zones VMA, FTP, CSS), des programmes générés selon sa méthode, des groupes, des tâches, des relances, des bilans ; l’élève lit sa séance sur téléphone (hors ligne, montre, pas à pas en musculation), envoie son retour, échange avec son coach ; les données personnelles ont leur page, leur export et leur effacement.

## Refonte (D-123) et suite

Espace élève (D-129 à D-141) et espace coach (D-143 à D-160) refaits en direction Chrono (D-128) et **en ligne**. On travaille sur la branche `refonte`, fusionnée vers `main` par Pull Request (le fondateur pousse et fusionne). Depuis : droits vérifiés profil par profil (D-161), limitation des abus (D-162, en ligne), sauvegarde et restauration (D-163), cardio en paliers (D-164, en ligne), exercice en séries et circuit (D-165), suivre sa séance avec chronomètre, pause, bips et voix (D-166) ; tout est en ligne depuis la Pull Request n° 5 (24 novembre). Puis suivi finalisé (D-167, en ligne par la Pull Request n° 6) : circuits enchaînés, mise en place de 5 s, reprise après rechargement ou « Quitter », « À suivre », déroulé. Puis suivre malgré les péripéties (D-172, en ligne par la Pull Request n° 8) : écran entre deux exercices où l’élève lance quand elle est prête, pause sous le pouce, reprise avec mise en place, dernière série et mi-chemin annoncés. Voix du coach enregistrée et voix de synthèse à son image : plus tard, à sa demande. Détail : [HISTORIQUE.md](HISTORIQUE.md) et [DECISIONS.md](DECISIONS.md).

## Chantiers en cours (D-120)

1. **Confiance.** Fait : en-têtes de sécurité, pages d’erreur, contrôle de santé avec services, sauvegarde complétée de l’historique des migrations et restauration essayée en local, avec `npm run db:restore` qui ne peut rien écraser (D-116, D-163), revue de sécurité du lot données personnelles, contrôles automatiques (Action GitHub), migrations à la construction Vercel, tests de bout en bout dans un vrai navigateur (D-125 ; quatre parcours : boucle coach → élève → coach, bilan, gestes du calendrier, palette), droits en base vérifiés table par table et profil par profil, sans fuite (D-127, D-161), limitation des abus sur la connexion, l’inscription, le mot de passe et l’invitation (D-162, en ligne et contrôlé le 24 novembre), suivi des erreurs en production en ligne, éteint tant que `SENTRY_DSN` manque (D-168, Pull Request n° 8 ; `/api/health` répond `"errors":false`, contrôlé le 26 novembre). Vidéos filmées dans le stockage de fichiers Supabase, 50 Mio au lieu de 4 Mo en ligne (D-173, code en ligne par la Pull Request n° 10 ; sa migration n’a en réalité été appliquée en ligne que le 25 novembre au soir, avec celle de D-175). Chantier Confiance terminé côté code.
2. **Le coach inconnu.** Fait et en ligne (D-169, Pull Request n° 8) : trois coachs fictifs joués de l’inscription au premier retour traité ; « Ajouter plusieurs élèves » (liste collée de Google Docs ou d’un tableur, groupes compris, liens à copier), « Premiers pas » sur l’Accueil, brief du jour complété, mode simple ; six accrocs corrigés. Reste : un vrai coach chronométré sans aide ; invitations groupées par e-mail (après le domaine). Retouches du fondateur (D-170) : déplacer un palier cardio, note d’exercice lisible. Installation sur le téléphone guidée pas à pas pour l’élève (D-171).
3. **De quoi vendre.** Fait et **en ligne** (D-174, D-175, Pull Request n° 12, 25 novembre) : page publique sur « / », page Offres (prix réglables par `COACHOS_OFFERS`, aucun prix publié tant que l’interrupteur `COACHOS_BILLING` est éteint), conditions d’utilisation et mentions légales en brouillon, liens au pied des pages hors espace. Puis essai gratuit de 30 jours et limite d’élèves actifs par offre, contrôlée à l’acceptation d’invitation, rubrique Paramètres › Abonnement (D-175, migration `20261125000000` appliquée en ligne par le fondateur le 25 novembre). Reste : abonnement en mode test derrière l’interrupteur, aide intégrée, mesure du temps gagné sans identité d’élève.

**Branche `fluidite`** : le bilan produit (16 commits, sans migration) est en ligne par la Pull Request n° 14 (26 novembre ; `/api/health` répond `"db":"ok"`). D-178 (trois retouches) est en ligne par la Pull Request n° 15 (26 novembre).

**Chantier IA (branche `claude/ia-socle-a07d62`)** : IA-0 faite (D-187, sans migration) : socle commun `apps/web/server/ai/` (client, modèle par `COACHOS_AI_MODEL`, budget sur tous les tours, cache, repli, simulation), quatre outils en lecture bornés à l’espace, interrupteur par espace et modèle dans Paramètres › IA, Anthropic sous-traitant dans la notice (v2, à faire relire). IA-1 faite (D-189) : « Dicter ou écrire avec l’IA » dans l’éditeur de séance, proposition en notation relue ligne par ligne, insérée en brouillon. IA-2 faite (D-190) : « Ma méthode en quelques mots » (six champs versionnés) et « Proposer depuis ma bibliothèque », méthode lue par l’IA. IA-3 faite (D-191) : « Programme avec l’IA » pour un élève ou un groupe, relu par le serveur, enregistré en brouillon. IA-4 faite (D-192) : « Demander » sur l’Accueil et dans la palette ⌘K, réponses avec sources et brouillons seulement. **IA-1 à IA-3 demandent la migration `20261127010000_ai_dictation.sql`** (point 12). Appel réel à Claude non vérifié (pas de clé). **Prochaine action : IA-5** (prompt dans MARCHE_IA.md).

**Exercices sur machine (D-179, branche `machines-videos`, en ligne (Pull Request n° 16), sans migration)** : bibliothèque des machines (31 machines, 68 exercices, étiquette et vue Basic-Fit), animations dessinées (trois pilotes, « À relire »), fiche de l’exercice dans la séance et en mode « Suivre », notation `4×10 presse 60kg R2'`, séances de la semaine gardées hors ligne. Les 68 exercices ont leur animation, toutes validées par le fondateur le 26 novembre (« Oui, tout validé »). Essai ChatGPT fait, non admis (machine déformée). Suite : Pull Request vers `main` ; numéros des machines Basic-Fit à relever. Détail : [VIDEOS_MACHINES.md](VIDEOS_MACHINES.md).

**À la salle (D-180 à D-182, en ligne (Pull Request n° 16), sans migration)** : tirer vers le bas pour actualiser dans l’app installée (D-180) ; « Machines » dans l’éditeur de séance avec la salle Basic-Fit, exercices touchés dans l’ordre et reliés à la bibliothèque (D-181) ; « Machine prise ? Changer » pendant le suivi : autre ordre, remplacement, exercice en plus, repris dans le retour (D-182). 

**Prochaine tranche** : chantier « IA du coach » (demande du fondateur du 26 novembre, à la manière de Relay Athletic), tranches IA-0 à IA-5 avec leurs prompts dans [MARCHE_IA.md](MARCHE_IA.md), en commençant par IA-0 (socle) ; il faut la clé Anthropic (point 11). Ensuite : « De quoi vendre », suite : abonnement Stripe en mode test derrière l’interrupteur (choix de l’offre, essai terminé en lecture et export, impayé avec 14 jours de grâce) ; il faut la clé de test (point 9). D-174 à D-177 sont en ligne (Pull Request n° 12) ; contrôlé le 25 novembre : « / », `/offres`, `/conditions`, `/mentions-legales` répondent 200, la page publique s’affiche sans prix (« pendant la phase pilote »), `/api/health` répond `"db":"ok"`. Les migrations D-173 et D-175 ne sont passées en ligne qu’après la fusion (« Remote database is up to date. » contrôlé dans le Terminal le 25 novembre) : avant toute fusion, faire coller au fondateur la sortie de `npx supabase db push --remote`. D-179 à D-183 sont en ligne (Pull Request n° 16, sans migration) ; contrôlé le 26 novembre : `/api/health` répond `"db":"ok"`, « / » et `/offres` répondent 200. D-184 (charge et répétitions série par série, retour du fondateur) attend sa Pull Request, sur la branche `machines-videos`, sans migration.

## Pour le fondateur

Liste unique, dans l’ordre d’utilité. Pour chaque point : ce que c’est, pourquoi, ce que ça débloque, le temps, les clics. Tout le reste avance sans toi.

00 bis. **Cocher les machines de ton club Basic-Fit** · 15 minutes à la salle · [MACHINES_A_COCHER.md](MACHINES_A_COCHER.md) › coche ce que tu vois, note le numéro de chaque machine et son nom écrit en anglais ; photographie (de côté, plaque visible) celles que tu ne reconnais pas. Débloque : la vue Basic-Fit avec les bons numéros. Pour filmer au club, il faut d’abord l’accord écrit de Basic-Fit (règlement intérieur).
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
7. **Relire les pages légales** · 20 minutes, après la mise en ligne de D-174 · `/confidentialite`, `/conditions` et `/mentions-legales`. Textes exacts techniquement, marqués « à faire relire par un professionnel » dans nos documents ; c’est toi qui les assumes. Deux choix à toi : le droit applicable (supposé belge) et l’identité de l’éditeur. Vercel › Environment Variables › **« Add »** : `COACHOS_LEGAL_PUBLISHER` = `Ton nom ou ta société | ton adresse | ton numéro d’entreprise` (séparés par « | ») ; facultatif `COACHOS_CONTACT_EMAIL` = ton adresse de contact.
7 quater. **Le prix et le nom** · quand tu veux · les offres affichent « 0 € pendant la phase pilote » ; aucun prix n’est publié tant que tu ne l’as pas décidé. Pour essayer d’autres prix sans toucher au code : Vercel › `COACHOS_OFFERS` = `[{"id":"starter","price":25}]` par exemple.
7 ter. **Essayer l’installation guidée sur ton téléphone** · 3 minutes, c’est en ligne (D-171) · avec un compte élève, ouvre CoachOS dans Safari (ou Chrome) › « Aujourd’hui » › carte « Installe CoachOS sur ton téléphone ». À vérifier : l’appareil reconnu, des étapes qui correspondent exactement à tes menus, l’icône qui s’ouvre en plein écran. Dis-moi tout libellé qui diffère.
7 bis. **Essayer « Suivre la séance » sur ton téléphone** · 5 minutes, c’est en ligne (D-172) · une séance du jour avec deux exercices › « Suivre la séance » › « C’est parti ». À vérifier : les bips (s’ils ne sonnent pas, le bouton silencieux sur le côté de l’iPhone est sans doute activé), la voix, l’écran qui reste allumé, le bouton pause en bas en plein exercice puis « Reprendre », l’écran entre deux exercices, « Quitter » puis « Reprendre la séance ». Dis-moi ce qui accroche.
8. **Rappels sur ton iPhone** · 3 minutes · CoachOS installée sur l’écran d’accueil, ouverte depuis l’icône › 🔔 Notifications › **« Activer les rappels sur cet appareil »** › accepte. Puis publie-toi une séance depuis le Mac : dis-moi si le rappel arrive.
9. **Paiement en mode test** · quand le chantier 3 commence · 10 minutes · https://stripe.com › compte › **mode test** (interrupteur en haut à droite) › Developers › API keys › copie la **clé secrète de test** (`sk_test_…`) dans Vercel `STRIPE_SECRET_KEY` (Sensitive). Rien ne sera facturé : l’interrupteur reste éteint en production jusqu’à ta décision. Le prix final et le nom du produit sont à toi (hypothèses : 29/59/99 € HT par mois).
10. **Hygiène des comptes** · 5 minutes · Vercel › Account Settings › Authentication › **« Regenerate »** les codes de récupération (apparus sur une capture) et supprime cette capture. GitHub › ton avatar › **Settings** › **« Developer settings »** › **« Personal access tokens »** › **« Fine-grained tokens »** › le jeton collé dans la conversation (il commence par `github_pat_11CUYS`) › **« Delete »** : il a circulé en clair, il ne doit plus servir.
11. **Clé Anthropic, avant le chantier IA** · 10 minutes · marche pas à pas dans [MARCHE_IA.md](MARCHE_IA.md) › « Pour le fondateur » (crédit, clé `ANTHROPIC_API_KEY` dans Vercel et en local ; budget 10 $ par espace et par mois par défaut). **Facultatif** : vidéos de base des 34 exercices ([VIDEOS_DE_BASE.md](VIDEOS_DE_BASE.md)) ; cocher « Musculation » dans Paramètres › sports encadrés de ton espace si tu veux la musculation.
12. **Migration de la dictée IA, avant de fusionner la branche IA** · 2 minutes · après la fusion de l’abonnement si elle passe avant · Terminal, dossier CoachOS : `npx supabase db push --remote`, puis colle-moi la sortie. Elle ajoute la dictée, la méthode et le programme au journal de l’IA (élève facultatif), sans toucher aux données. En local : `npm run supabase:migrate`.

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

Aperçu « interrupteur commercial allumé » sur données fictives : configuration `coachos-vente` de `.claude/launch.json` (port 3300).

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
