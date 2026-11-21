# Mise en ligne de CoachOS : guide pas à pas

Préparé le 21 novembre 2026 (D-112). Rien n’est encore en ligne : CoachOS tourne sur ton Mac. Ce guide dit ce que **toi seul** peux faire (créer des comptes, payer, valider une adresse), puis ce que je fais ensuite.

## Pourquoi c’est nécessaire

- Tes élèves ne sont pas sur ton Wi-Fi : sans mise en ligne, ils ne peuvent pas ouvrir l’app.
- L’adresse sécurisée (https) active la lecture hors connexion et l’écran qui reste allumé pendant « Suivre la séance ».
- Les invitations et les mots de passe oubliés partent alors par e-mail pour de vrai.

## État vérifié

- La version de production se construit sans erreur ni avertissement (`npm run build`, 21 novembre).
- L’accès de démonstration (identités fictives) est coupé d’office en production.
- L’envoi d’e-mails par **Resend** est branché et testé avec un faux serveur. Il s’active dès que la clé est fournie ; il n’a pas encore été essayé avec un vrai compte.

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

À **ne pas** renseigner en production : `COACHOS_DEMO_AUTH`, `MAILPIT_URL`.

Supabase › Authentification : l’adresse du site et l’adresse de retour (`https://…/auth/callback`).

## Étape 3 · Ce que je fais ensuite

1. J’applique toutes les migrations de la base au projet Supabase, dans l’ordre. Aucune donnée de démonstration n’est créée.
2. Je vérifie l’app en ligne : inscription coach, invitation reçue par e-mail, compte élève, séance publiée, retour, vidéo d’exercice sur iPhone, hors connexion.
3. Je consigne le tout dans ETAT.md et GUIDE_RECETTE.md.

## Points d’attention avant d’inviter de vrais élèves

- **Tes données locales restent sur ton Mac.** Ton espace de test et ses élèves fictifs ne sont pas copiés. En ligne, tu crées ton compte coach puis tu invites tes élèves. Ta bibliothèque Foulée s’importe en un clic.
- **Données personnelles réelles.** Il faut une courte page de confidentialité (ce qui est collecté, pourquoi, combien de temps, comment le supprimer). Les données de santé restent exclues (D-084). Je peux t’en préparer un brouillon, à faire relire.
- **Vidéos filmées.** Elles sont gardées dans la base (25 Mo au plus chacune). Au-delà de quelques dizaines de vidéos, il faudra un stockage de fichiers dédié : je te préviendrai avant.
- **Coûts.** Les offres gratuites de ces services suffisent souvent pour un pilote. Vérifie les tarifs le jour de l’inscription : ils changent.
