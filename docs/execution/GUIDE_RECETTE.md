# Guide de recette pour le fondateur

But : vérifier soi-même, sans code, que CoachOS est simple à utiliser pour un coach et pour un athlète. Durée : 20 à 30 minutes. Données fictives uniquement ; aucun vrai e-mail n’est envoyé.

Pendant le test, garde une note ouverte et écris **chaque hésitation** : où tu as cherché, ce qui n’était pas clair, ce qui t’a fait revenir en arrière. C’est le résultat le plus utile.

## Si tu as déjà fait ce test

Tes comptes **paul.coach@demo.coachos.test** et **emma@demo.coachos.test** existent déjà (leurs données de test ont été effacées le 17 novembre). Utilise **Se connecter** avec ton mot de passe au lieu de « Créer un compte », ou choisis de nouvelles adresses inventées (par exemple paul2.coach@… et emma2@…).

## Avant de commencer

1. Regarde en haut à droite de l’écran : la **baleine** de Docker doit être présente et immobile. Sinon, ouvre **Docker** depuis le dossier **Applications** et attends qu’elle s’arrête.
2. Ouvre **Safari** et va sur **http://localhost:3000/login**. Tu dois voir la page « Connexion ».
   - Si la page ne s’ouvre pas, l’application n’est pas lancée : demande à Claude de la relancer.
3. Ouvre un **deuxième onglet** (Cmd + T) sur **http://127.0.0.1:54324**. C’est la boîte e-mail de test : l’invitation de l’athlète et les e-mails « mot de passe oublié » y arrivent.
4. Choisis un mot de passe de test (8 caractères minimum) que tu utiliseras pour les deux comptes fictifs. N’utilise pas un de tes vrais mots de passe.

Pour simuler un téléphone, réduis la fenêtre de Safari à sa largeur minimale.

## Partie 1 · Le coach (environ 10 minutes)

1. Sur la page « Connexion », clique sur **Créer un compte coach**.
2. Remplis **Ton nom**, une adresse inventée comme **paul.coach@demo.coachos.test** et ton mot de passe de test, puis **Créer mon compte**.
3. Tu arrives sur « Créer ton espace coach » : donne un **Nom de l’espace** (par exemple « Paul Endurance »), garde le fuseau, puis **Créer mon espace**.
4. **Personnalise ton espace** en 4 étapes facultatives : présentation (accroche, parcours, approche, diplômes), spécialités (sports, publics, objectifs), identité visuelle (logo ou photo, couleur de l’espace) et infos pratiques (ville, langues, site, contact). Note ce qui manque ou ce qui est de trop. Tu pourras tout modifier ensuite dans **Paramètres**.
5. Tu arrives sur ton Planning et le **guide CoachOS** démarre la visite : il assombrit l’écran et éclaire le bouton dont il parle. Clique **Suivant**, puis, quand il te le demande, touche **+ Ajouter un athlète** : la visite te suit sur la page suivante. Tu peux la quitter avec **Passer** et la relancer à tout moment en cliquant sur le guide, en bas à droite. Note si chaque bulle montre clairement l’élément dont elle parle.
6. Sur « Ajouter un athlète » : nom **Emma Test**, adresse **emma@demo.coachos.test**, puis **Créer et inviter**. Note si le message de confirmation est clair.
7. Clique sur **Séances** dans le menu de gauche, puis sur **+ Ajouter** à la date d’aujourd’hui. (Le **Planning** est désormais ta page d’accueil de coach : tâches à faire et agenda de la semaine.)
8. Crée une séance simple (titre, durée, consignes), puis **Enregistrer le brouillon**.
9. Lis l’écran : comprends-tu que la séance est un **brouillon invisible** pour Emma ? Clique sur **Publier pour Emma**.
10. Chronomètre si possible les étapes 7 à 9 : l’objectif est **moins de 90 secondes**.
11. Clique sur **Se déconnecter** en haut à droite.

## Partie 2 · L’athlète (environ 10 minutes)

1. Réduis la fenêtre de Safari au plus étroit (format téléphone).
2. Dans la boîte de test, ouvre l’e-mail **« … t’invite à rejoindre Paul Endurance sur CoachOS »** et clique sur **Rejoindre l’espace**. La page montre la présentation de ton espace (logo, accroche) avant la création du compte.
3. Remplis **Ton nom**, l’adresse **emma@demo.coachos.test** et ton mot de passe de test, puis **Créer mon compte et rejoindre**.
   - Essai facultatif : tape d’abord une autre adresse. L’application doit refuser, sans créer de compte.
4. Le questionnaire « Faisons connaissance » compte 3 étapes : **Toi** (nom, langue, fuseau), **Ta pratique** (sport, niveau, ancienneté, séances par semaine), **Tes objectifs** (objectif, prochaine course, jours disponibles). Note s’il te paraît trop long ou s’il manque une question. Termine avec **Terminer et voir ma séance**.
5. Le **guide CoachOS** démarre la visite sur l’écran Aujourd’hui : il éclaire la séance du jour, te demande de toucher **Voir la séance** et te suit jusqu’au déroulé et au bouton de retour, puis montre **Programme** et **Profil**. Note si c’est clair et pas trop long.
6. Ouvre la séance, puis **Donner mon retour**. Choisis « Réalisée », un effort, écris un court commentaire et **Envoyer le retour**. Objectif : **moins de 30 secondes**.
7. Clique sur **Se déconnecter**.

## Partie 3 · Le coach traite le retour (environ 5 minutes)

1. Agrandis la fenêtre. Connecte-toi avec **paul.coach@demo.coachos.test** et ton mot de passe de test.
2. Clique sur **Retours** dans le menu de gauche : un retour doit être à traiter.
3. Clique sur **Ouvrir le retour**. Compare « Prévu » et « Déclaré ».
4. Clique sur **Marquer comme traité**. Le compteur de Retours doit diminuer.
5. Dans **Athlètes**, ouvre **Emma Test** : son **Profil sportif** (réponses au questionnaire) doit apparaître.

## Ce que tu peux essayer en plus

- Te connecter avec un mauvais mot de passe : un message doit l’indiquer sans dire si l’adresse existe.
- **Mot de passe oublié ?** sur la page de connexion : l’e-mail arrive dans la boîte de test, le lien ouvre « Nouveau mot de passe ».
- Te déconnecter puis appuyer sur la flèche « retour » du navigateur : aucune donnée ne doit réapparaître.

## Après le test

Envoie à Claude tes notes, même brèves : ce qui t’a fait hésiter, ce que tu as trouvé lent, les mots qui ne te parlaient pas. Ce retour décide de la suite : corriger la fluidité d’abord, puis seulement ensuite les modèles de séance et la messagerie.
