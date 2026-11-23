# État d’exécution

Dernière mise à jour : 2026-11-23, fin de session (D-120 à D-122). Relire d’abord **D-120** (instruction du fondateur : produit professionnel, vendable à d’autres coachs), puis cet état, puis COUVERTURE.md. L’historique complet des sessions est dans [HISTORIQUE.md](HISTORIQUE.md).

## Où en est CoachOS

**En ligne** : https://coach-os-xi-kohl.vercel.app (Vercel, fonctions à Dublin ; base Supabase « CoachOS » en Irlande, 44 migrations appliquées). Compte coach du fondateur créé en ligne. `GET /api/health` répond `{"ok":true,"db":"ok","services":{"email":"resend","push":true,"ai":"simulation","contact":false}}`.

**Vérifié en ligne (23 novembre)** : base joignable ; page de connexion, inscription et confidentialité ; en-têtes de sécurité ; routes de données personnelles et de rappels déployées et protégées (401 sans session) ; premier e-mail réel d’invitation envoyé par Resend et reçu par le fondateur (adresse de test `onboarding@resend.dev`, qui n’envoie qu’à lui) ; rappels push prêts (clés en place).

**Vérifié en local seulement (Supabase local, données fictives, navigateur)** : la boucle complète coach → élève → coach, les données personnelles (export, demande, effacement), les rappels (abonnement, désabonnement), les finitions D-121.

**Pas prouvé** : la boucle complète en ligne avec un vrai élève (il faut un domaine pour que les e-mails partent vers d’autres adresses) ; réception d’un rappel push sur un téléphone ; suppression d’un compte Auth en ligne ; sauvegarde (`npm run db:backup`) jamais exécutée ; restauration jamais essayée ; migrations automatiques à la construction (variables Vercel à saisir) ; Action GitHub (premier push à venir).

**Chiffres** : `npm test` 366 passés (3 ignorés sans Docker), typecheck OK, `npm run build` OK, revue de sécurité du 23 novembre sans faille haute ou moyenne (D-115).

**Ce que le produit fait** : la matrice [COUVERTURE.md](COUVERTURE.md) (cible coach et élève, D-024) et les décisions D-001 à D-122 dans [DECISIONS.md](DECISIONS.md). En deux lignes : un coach planifie des séances structurées par sport (zones VMA, FTP, CSS), des programmes générés selon sa méthode, des groupes, des tâches, des relances, des bilans ; l’élève lit sa séance sur téléphone (hors ligne, montre, pas à pas en musculation), envoie son retour, échange avec son coach ; les données personnelles ont leur page, leur export et leur effacement.

## Refonte complète (D-123, instruction du 23 novembre, soir)

Relevé du fondateur vérifié sur le code : `globals.css` 1 406 lignes, 90 couleurs en dur hors jetons (154 occurrences au total), 14 dans les composants, 109 styles en ligne, 7 composants dans `ui.tsx` sur 70 fichiers de composants, 38 pictogrammes emoji dans les écrans, pas de choix de thème (clair ou sombre suivent seulement le système), pas de page publique ; la police est chargée depuis D-121. Socle réel : 44 migrations, 67 tables, 48 politiques RLS, 24 fichiers de commandes, 12 de lectures, 82 routes API, 57 pages, 67 fichiers de test, 33 425 lignes TypeScript ; aucun worker (la table `jobs` n’est utilisée par aucun code), un seul paquet (`domain`), aucune application mobile : docs/07 décrit une cible, pas le code.

**Fait** : étape 1, filet de sécurité (D-125 : boucle coach → élève → coach et droits dans un vrai navigateur, `npm run test:e2e`, aussi dans l’Action GitHub) ; étape 2, cible ([docs/18_REFONTE.md](../18_REFONTE.md)) ; étape 3, trois directions visuelles sur le canevas « CoachOS · trois directions » (D-126, recommandation : A · Chrono).

**Choix du fondateur (D-128)** : direction A · Chrono, avec clair, sombre ou automatique, deux densités pour le coach et la couleur du coach chez l’élève. Carte et changements additifs du socle validés.

**Refonte en cours sur la branche `refonte`** (rien de visible en ligne tant qu’un espace n’est pas entièrement refait ; aperçus Vercel coupés pour cette branche) :
- fait (vérifié au navigateur, tests, typecheck, construction et parcours de bout en bout verts) : design system dans `apps/web/design/` et page interne `/systeme` (D-128, D-129) ; cadre de l’espace élève ; Aujourd’hui (D-129), détail d’une séance (D-130), Programme semaine et mois (D-131), retour détaillé (D-132), Suivre la séance (D-133), Progression (D-134), Échanges, liste et fil (D-135), Profil avec Clair / Sombre / Automatique (D-136), Notifications (D-137), bilan d’arrivée, présentation du coach, invitation et visite guidée (D-138 à D-141) ; passage à 1440 px et au clavier fait ;
- l’espace élève est donc entièrement refait : prochaine étape, le fusionner sur `main` (vérification finale, puis Pull Request à créer par le fondateur dans GitHub Desktop) ;
- ensuite : l’accueil du coach, la boîte de réception, le calendrier avec glisser-copier-coller et annulation, la fiche élève, la bibliothèque, les paramètres, les surfaces publiques ; enfin le nettoyage de l’ancien code.
- règle : `main` ne reçoit que des corrections ou un espace entièrement refait et vérifié ; la branche se fusionne espace par espace.

## Chantiers en cours (D-120)

1. **Confiance.** Fait : en-têtes de sécurité, pages d’erreur, contrôle de santé avec services, script de sauvegarde, revue de sécurité du lot données personnelles, contrôles automatiques (Action GitHub), migrations à la construction Vercel. À faire : tests de bout en bout dans un vrai navigateur (coach → élève → coach), suivi des erreurs en production (Sentry derrière une variable), sauvegarde puis restauration essayées en local, revue des droits en base table par table (test automatisé), limitation des abus (fréquence sur les routes publiques), vidéos hors de la base (Supabase Storage).
2. **Le coach inconnu.** À commencer : trois coachs fictifs (trail 25 élèves venant de Google Docs, musculation 40 clients, club à trois groupes), de l’inscription au premier retour traité, ordinateur et téléphone ; cible 15 minutes sans aide ; brief du jour et mode simple.
3. **De quoi vendre.** À commencer après 1 et 2 : page publique, essai gratuit, offres par nombre d’élèves (29/59/99 € HT, docs/13), abonnement en mode test derrière un interrupteur, pages légales en brouillon, aide intégrée, mesure du temps gagné sans identité d’élève.

**Prochaine tranche** : tests de bout en bout dans un vrai navigateur (Playwright, en local sur Supabase local ou PGlite), puis la revue des droits table par table.

## Pour le fondateur

Liste unique, dans l’ordre d’utilité. Pour chaque point : ce que c’est, pourquoi, ce que ça débloque, le temps, les clics. Tout le reste avance sans toi.

0. **Fait** : direction choisie (A · Chrono, D-128).
0 bis. **Maintenant, pour ta première élève** · 2 minutes · débloque : elle peut créer son compte depuis le lien. Supabase › ton projet › **Authentication** › **Sign In / Providers** › **Email** › décoche **« Confirm email »** › **« Save »**. Sans cela, Supabase voudrait lui envoyer un e-mail de confirmation qu’il ne sait pas encore envoyer (il n’écrit qu’aux membres de ton équipe Supabase avant le domaine). C’est le réglage prévu par D-020 et D-114. Puis, sur l’écran d’ajout ou sa fiche : « Je l’envoie moi-même », « Copier le lien », envoi par WhatsApp (D-152).
1. **Rendre les mises en ligne autonomes** · 15 minutes · débloque : je pousse le code moi-même et les migrations s’appliquent seules ; tu n’as plus rien à faire pour une mise en ligne. Aujourd’hui, `git push` depuis ma session échoue (« could not read Username for github.com ») : seul GitHub Desktop a tes identifiants.
   - GitHub : en haut à droite, ton avatar › **Settings** › tout en bas **« Developer settings »** › **« Personal access tokens »** › **« Fine-grained tokens »** › **« Generate new token »** › nom `CoachOS Mac` › expiration 1 an › Repository access : **« Only select repositories »** › `CoachOS` › Permissions › **Contents : Read and write** › **« Generate token »** › copie-le (il ne s’affiche qu’une fois).
   - Terminal (onglet de l’app) : colle cette commande en remplaçant `LE_JETON` par le jeton copié, puis Entrée. Je ne vois jamais le jeton ; il reste dans le trousseau du Mac.
     `printf 'protocol=https\nhost=github.com\nusername=melottej7\npassword=LE_JETON\n' | git credential-osxkeychain store`
   - Supabase : en bas à gauche, clique ton avatar › **« Account preferences »** › **« Access Tokens »** › **« Generate new token »** › nom `Vercel` › **« Generate token »** › copie-le (il ne s’affiche qu’une fois).
   - Vercel : projet coach-os › **Settings › Environment Variables** › **« Add »** trois fois : `SUPABASE_ACCESS_TOKEN` (la valeur copiée, **Sensitive**) ; `SUPABASE_DB_PASSWORD` (le mot de passe de ta base, app Mots de passe « CoachOS base », **Sensitive**) ; `SUPABASE_PROJECT_ID` = `mugtpcvxvdkpjixrqvna`. **« Save »** à chaque fois.
   - Dis-moi « variables Vercel faites » : au prochain déploiement, le journal de construction affichera « base en ligne à jour ».
2. **Être prévenu si l’app tombe** · 5 minutes · débloque : une alerte par e-mail en cas de panne, sans que personne regarde.
   - https://uptimerobot.com › **« Register for FREE »** › confirme ton adresse › **« + New monitor »** › Monitor type **HTTP(s)** › URL `https://coach-os-xi-kohl.vercel.app/api/health` › Friendly name `CoachOS` › Interval **5 minutes** › **« Create monitor »**.
3. **Suivi des erreurs en production** · 10 minutes · débloque : chaque erreur en ligne me parvient avec sa référence (celle affichée sur la page « Un problème est survenu »). Je prépare l’intégration ; elle s’active dès que la variable existe.
   - https://sentry.io › **« Get started »** (compte gratuit) › **« Create project »** › plateforme **Next.js** › nom `coachos` › sur la page suivante, copie la ligne `dsn: "https://…"` (seulement l’adresse entre guillemets).
   - Vercel › Environment Variables › **« Add »** : `SENTRY_DSN` = cette adresse › **« Save »**.
4. **Un nom de domaine** · 15 minutes · environ 12 € par an · débloque : les invitations et notifications arrivent chez tes élèves, « Mot de passe oublié » fonctionne pour eux, la page publique porte ton nom.
   - Choisis le nom (c’est toi qui décides) et achète-le chez un registraire (OVH, Gandi, Combell…). Dis-le-moi : je te guide ensuite pour Resend (Domains › Add Domain, trois enregistrements DNS à copier chez le registraire) et pour le réglage SMTP de Supabase (guide [MISE_EN_LIGNE.md](MISE_EN_LIGNE.md)).
5. **Sauvegarde, une première fois** · 2 minutes · débloque : une copie de la base sur ton Mac, et pour moi la possibilité d’essayer une restauration en local.
   - Docker ouvert (baleine immobile), puis dans le Terminal : `npm run db:backup`. Dis-moi ce qui s’affiche. Les fichiers sont dans `backups/`, jamais envoyés sur GitHub ; efface ceux de plus de 30 jours.
   - Plus tard, quand de vrais élèves payeront : Supabase Pro (25 $ par mois) pour des sauvegardes automatiques restaurables en un clic. Décision et paiement : toi.
6. **Un vrai élève volontaire** · après le point 4 · débloque : la preuve de la boucle complète en ligne (invitation reçue, compte, séance, retour, revue). C’est une vraie personne : je ne l’invite jamais à ta place.
7. **Relire la page de confidentialité** · 10 minutes · https://coach-os-xi-kohl.vercel.app/confidentialite. Texte exact techniquement, marqué « à faire relire par un professionnel » dans nos documents ; c’est toi qui l’assumes. Facultatif : Vercel › `COACHOS_CONTACT_EMAIL` = ton adresse de contact.
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
npm run db:backup        # copie schéma et données de la base EN LIGNE dans backups/ (hors Git)
npm run supabase:stop
```

Sans `apps/web/.env.local`, l’application repasse en mode PGlite + `/demo`. Comptes fictifs : `marine.roy@`, `camille.laurent@`, `noah.dubois@`, `hugo.petit@`, `lea.moreau@` suivis de `demo.coachos.test`, mot de passe `DEMO_PASSWORD` de `apps/web/server/db/fixtures.ts` (Supabase local uniquement). Le serveur de développement se lance dans un onglet du Terminal. La base locale contient aussi les données de recette du fondateur (comptes paul.coach et emma) : ne jamais la remettre à zéro sans son accord (D-019).

## Écarts et dette connus

- Pas de tests de bout en bout dans un vrai navigateur ; pas de suivi des erreurs en production ; restauration jamais essayée ; vidéos et vocaux en base (4 Mo au plus par vidéo en ligne, D-113).
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
