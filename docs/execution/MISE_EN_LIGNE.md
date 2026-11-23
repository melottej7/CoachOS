# Mise en ligne de CoachOS : guide pas à pas

Préparé le 21 novembre 2026 (D-112), **mis en ligne le 22 novembre (D-114) : https://coach-os-xi-kohl.vercel.app**. Ce guide reste la référence des réglages. Il dit ce que **toi seul** peux faire (créer des comptes, payer, valider une adresse), puis ce que je fais ensuite.

## Pourquoi c’est nécessaire

- Tes élèves ne sont pas sur ton Wi-Fi : sans mise en ligne, ils ne peuvent pas ouvrir l’app.
- L’adresse sécurisée (https) active la lecture hors connexion et l’écran qui reste allumé pendant « Suivre la séance ».
- Les invitations et les mots de passe oubliés partent alors par e-mail pour de vrai.

## État vérifié

- La version de production se construit sans erreur ni avertissement (`npm run build`, 21 novembre).
- L’accès de démonstration (identités fictives) est coupé d’office en production.
- L’envoi d’e-mails par **Resend** est branché et testé avec un faux serveur. Il s’active dès que la clé est fournie ; il n’a pas encore été essayé avec un vrai compte. **Sans clé, l’invitation d’un élève est refusée avec un message clair** : règle Resend avant d’inviter.
- **22 novembre** : base Supabase « CoachOS » (Irlande, 42 migrations appliquées) ; projet Vercel `coach-os` (fonctions à Dublin). `https://coach-os-xi-kohl.vercel.app/api/health` répond `{"ok":true,"db":"ok"}` ; la page de connexion et l’aperçu d’invitation lisent la base.

## Étape 1 · Ce que tu crées (environ 30 minutes, je te guide en direct)

| Compte | À quoi il sert | Ce que tu me transmets |
|---|---|---|
| **Supabase** (projet en région Europe) | Base de données et comptes des utilisateurs | L’adresse du projet et les clés, que tu colles toi-même dans Vercel ; je ne les vois pas |
| **Vercel** | Héberge l’application | Rien : tu y importes le projet |
| **GitHub** (dépôt privé) | Vercel y récupère le code | Le nom du dépôt ; j’y envoie le code avec ton accord |
| **Resend** | Envoie les e-mails (invitations, mot de passe) | La clé, à coller dans Vercel, et l’adresse d’expéditeur |
| **Un nom de domaine** (facultatif au départ) | Une adresse à toi (ex. coachos.be) et des e-mails qui arrivent bien | Le nom choisi |

Sans nom de domaine, l’app peut démarrer sur une adresse fournie par Vercel. En revanche, Resend demande un domaine vérifié pour écrire à n’importe quelle adresse : vérifie leurs conditions au moment de créer le compte.

## Étape 2 · Les réglages (je te dis exactement quoi coller)

Variables à renseigner dans Vercel (les valeurs viennent de tes comptes et ne passent jamais par moi) :

| Variable | Rôle |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Connexion à Supabase |
| `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL` | Accès du serveur à la base |
| `COACHOS_INVITE_HMAC_KEY` | Signature des liens d’invitation (une longue suite aléatoire) |
| `RESEND_API_KEY`, `EMAIL_FROM` | Envoi des e-mails (ex. `CoachOS <bonjour@ton-domaine.be>`) |
| `ANTHROPIC_API_KEY`, `COACHOS_AI_MONTHLY_BUDGET_USD` | Facultatif : l’IA, avec un budget mensuel par espace |
| `COACHOS_CONTACT_EMAIL` | Facultatif : adresse de contact affichée sur la page de confidentialité (sinon, le contact passe par le coach) |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Rappels push (D-118). Dans le Terminal : `cd apps/web && npx web-push generate-vapid-keys` ; `VAPID_SUBJECT` = `mailto:` suivi de ton adresse. Sans elles, la section « Rappels » le dit et ne propose rien |

`DATABASE_URL` : l’adresse du **pooler de transactions** de Supabase (port 6543), qui se termine par `/postgres` sans rien après. Un espace ou un retour à la ligne collé en trop fait répondre `3D000` à `/api/health` ; un mot de passe faux, `28P01`. Après chaque modification d’une variable, Vercel doit reconstruire (un « Push origin » suffit).

À **ne pas** renseigner en production : `COACHOS_DEMO_AUTH`, `MAILPIT_URL`.

Supabase › Authentification : l’adresse du site et l’adresse de retour (`https://…/auth/callback`).

Supabase › Authentication › **SMTP Settings** (après Resend) : sans ce réglage, Supabase n’envoie « Mot de passe oublié » qu’aux membres de ton équipe Supabase, pas à tes élèves. Active « Enable Custom SMTP » : Sender email = ton adresse d’envoi vérifiée chez Resend, Host `smtp.resend.com`, Port `465`, Username `resend`, Password = ta clé API Resend. Puis « Save ».

Après chaque réglage, ouvre `https://coach-os-xi-kohl.vercel.app/api/health` : la ligne `services` dit ce qui est branché (`email: resend`, `push: true`, `ai: claude`, `contact: true`), sans jamais montrer une clé (D-119).

## Étape 3 · Ce que je fais ensuite

1. Fait le 22 novembre : les 42 migrations sont appliquées au projet Supabase (`supabase db push`). Aucune donnée de démonstration n’est créée. **Le 23 novembre, deux migrations (effacement D-115, rappels push D-118) attendent ton `npx supabase db push --remote` dans le Terminal** : l’agent n’a pas le droit de modifier la base en ligne.
2. Vérifié en ligne : page de connexion, formulaire d’inscription, contrôle de santé, lecture de la base. Reste à vérifier avec toi (section « Recette en ligne » du guide de recette) : inscription coach, invitation reçue par e-mail (après Resend), compte élève, séance publiée, retour, vidéo d’exercice sur iPhone, hors connexion.
3. Consigné dans ETAT.md et GUIDE_RECETTE.md.

## Points d’attention avant d’inviter de vrais élèves

- **Tes données locales restent sur ton Mac.** Ton espace de test et ses élèves fictifs ne sont pas copiés. En ligne, tu crées ton compte coach puis tu invites tes élèves. Ta bibliothèque Foulée s’importe en un clic.
- **Données personnelles réelles.** La page de confidentialité existe (`/confidentialite`, D-115) : elle décrit exactement ce que le code fait. **Relis-la** avant d’inviter de vrais élèves : c’est toi qui l’assumes. L’élève peut télécharger ses données et demander l’effacement depuis son Profil ; tu effaces un dossier depuis sa fiche (« Données de X »). Les données de santé restent exclues (D-084).
- **Vidéos filmées.** Elles sont gardées dans la base. En ligne, l’envoi est limité à **4 Mo par vidéo** (limite de Vercel, D-113) : filme 10 à 15 secondes en qualité réduite, ou mets un lien YouTube. Pour des vidéos plus longues, ou au-delà de quelques dizaines, il faudra un stockage de fichiers dédié : je te préviendrai avant.
- **Coûts.** Les offres gratuites de ces services suffisent souvent pour un pilote. Vérifie les tarifs le jour de l’inscription : ils changent.
- **Sauvegarde (D-116).** L’offre gratuite de Supabase ne garde pas de copie restaurable. Avant chaque grosse mise à jour et une fois par semaine : Docker ouvert, puis dans le Terminal `npm run db:backup`. Les fichiers arrivent dans le dossier `backups/` du projet (jamais envoyés sur GitHub) ; efface ceux de plus de 30 jours, ils contiennent les données de tes élèves.
- **Sécurité (D-116).** En ligne, chaque page porte les en-têtes qui interdisent l’affichage dans un autre site et imposent https. Rien à régler.
