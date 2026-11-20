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

## Nouveautés du 19 novembre (nuit) à essayer

Avec ton compte coach :
1. **Élèves** : sous chaque élève, la **régularité** des 4 dernières semaines ; sur chaque carte de groupe, celle du groupe. Le filtre « Régularité sous 50 % » isole ceux qui décrochent.
2. Ouvre la **fiche** d’un élève : nouvelle section **Suivi de l’entraînement** (4, 8 ou 12 semaines, graphique par semaine, « Voir le tableau »).
3. Quand un élève a rempli son questionnaire, le **Planning** propose **Planifier l’appel de bienvenue** : le bouton « 📅 Planifier l’appel » ouvre la planification dans la tâche. « Plus tard → Pas besoin d’appel » la retire.
4. **Séances → Groupes** : « 📅 Nouvelle séance pour le groupe ». Coche les élèves, crée les brouillons, clique **Adapter** pour un élève, puis **Publier** : les exceptions sont rappelées avant l’envoi. **Semaine du groupe** montre chaque élève jour par jour.
5. Dans le constructeur d’une séance : **✍️ Saisie rapide en texte**. Essaie `15' Z1 + 8×(400m Z5 + R200m) + 10' Z1`, puis **Remplacer le déroulé**. Sous le total, le **graphique de la séance** se met à jour.

Avec ton compte élève (sur téléphone si possible) :
1. **Aujourd’hui** : sous la séance du jour, « Ta séance d’aujourd’hui ? » → **Faite**, puis ton ressenti. Le message compare ton ressenti à ce que visait ton coach.
2. Ouvre une séance : le **graphique** montre sa forme ; touche une barre pour le détail.
3. Nouvel onglet **Progression** : ton objectif (compte à rebours), ta régularité et tes volumes.

## Après le test

Envoie à Claude tes notes, même brèves : ce qui t’a fait hésiter, ce que tu as trouvé lent, les mots qui ne te parlaient pas. Ce retour décide de la suite : corriger la fluidité d’abord, puis seulement ensuite les modèles de séance et la messagerie.

## Nouveautés du 19 novembre (matin) à essayer

Avec ton compte coach :
1. **Paramètres → Suivis automatiques** (ou « Régler les suivis » dans le Planning) : décoche un suivi qui ne te sert pas, ou change un délai, puis « Enregistrer les suivis ». Ton Planning se met à jour.
2. **Séances → Groupes → une séance de groupe → ✏️ Modifier la base commune** : change la séance, lis qui sera mis à jour et qui reste inchangé (les séances adaptées), puis enregistre. Rien n’est envoyé : publie ensuite plus bas.
3. Sur la page d’une séance, **⌚ Fichier FIT** télécharge la séance pour une montre.

Avec un compte élève, sur un ordinateur :
4. Ouvre une séance, puis **⌚ Télécharger pour ma montre**. Branche ta Fenix 8, copie le fichier dans **GARMIN › NewFiles**, débranche, puis cherche la séance dans **Entraînement › Séances** sur la montre. Dis-moi ce que tu vois :
   - la séance apparaît-elle ?
   - les répétitions sont-elles correctes ?
   - les allures cibles sont-elles affichées ?

   Sur Mac, si la montre n’apparaît pas dans le Finder, dis-le-moi : on choisira ensemble un outil de transfert.

## Nouveautés du 19 novembre (fin de matinée) à essayer

Avec un compte élève :
1. Après une séance, ouvre « Mon retour », choisis « Réalisée », puis **⌚ Importer depuis ma montre**, et choisis le fichier de l’activité exporté de Garmin Connect (.fit, .tcx ou .gpx). La durée et la distance se remplissent ; corrige si besoin, puis envoie.

Avec ton compte coach :
2. Dans « Retours », ouvre ce retour : la ligne **Provenance** indique si les mesures viennent de la montre ou ont été saisies à la main.
3. **Plusieurs activités** (élève) : si tu as enregistré l’échauffement et la course à part, ajoute les deux fichiers (**Ajouter une autre activité**). Durée et distance s’additionnent ; **Retirer** enlève une activité. Rattache ensuite la même activité à une autre séance : elle est refusée tant qu’elle n’est pas retirée de la première.
3. En publiant une séance de groupe, coche **Annoncer dans le fil du groupe**, relis le message, puis publie. Le message apparaît dans le fil du groupe.
4. Dans la fiche d’un élève, « Suivi de l’entraînement » : sous chaque chiffre, la comparaison avec la période précédente apparaît dès qu’il y a des séances avant la période choisie.

## Nouveautés du 19 novembre (midi) à essayer

Avec ton compte coach :
1. **Séances → Semaine**, choisis un élève dont la semaine est prête : « 💾 Enregistrer comme semaine type », donne-lui un nom.
2. Choisis un autre élève (ou une autre semaine) : « 📋 Appliquer une semaine type », relis l’aperçu, puis « Ajouter… brouillons ». Rien n’est visible pour l’élève.
3. « Publier la semaine » liste ce qui sera publié ; publie quand tout est prêt.
4. **Séances → Bibliothèque**, en bas : tes semaines types (renommer, archiver).
5. **Fiche d’un élève → Suivi de l’entraînement → Séance par séance** : prévu et réalisé côte à côte.
6. **Élèves** : filtre « Objectif » (avec, dans les 8 semaines, sans) ; le prochain objectif s’affiche sous chaque élève.

En démonstration, Noah a déjà 6 brouillons la semaine du 23 novembre (semaine type « Semaine VMA (reprise) ») pour essayer « Publier la semaine ».

## Bilan d’arrivée (inspiré de Foulée) à essayer

Avec un compte élève qui n’a pas encore de bilan :
1. Sur Aujourd’hui, « Ton bilan » → **Commencer**. Une question par écran ; touche une réponse pour avancer. Quitte au milieu, reviens : tu reprends au même endroit (aussi depuis un autre appareil).
2. Au récapitulatif, touche une ligne pour la modifier, puis **Envoyer mon bilan**.

Avec ton compte coach :
3. Fiche de l’élève → section **Bilan** : réponses, état « Envoyé, à confirmer », bouton **✓ Confirmer le bilan**.
4. **📞 Compléter en entretien** : le même parcours, à remplir pendant l’appel ; les réponses que tu changes sont marquées « Entretien ».

En démonstration : Camille a envoyé son bilan (confirmé par Marine) ; celui de Noah a été complété en entretien.

**Temps, matériel et contraintes** (ajoutés au bilan) : deux écrans facultatifs après les jours disponibles.
- « Ton temps et tes habitudes » : temps pour une séance en semaine, moment préféré, jour de la séance longue. Seuls les jours disponibles sont proposés.
- « Ton matériel et tes contraintes » : le matériel proposé dépend du sport (piscine pour la natation, home trainer pour le vélo…), plus une phrase sur les contraintes, sans information médicale.
- Dans la fiche, ces réponses apparaissent dans **Bilan**. Le générateur de programme place la séance longue le jour préféré et te prévient si une séance du lundi au vendredi dépasse le temps disponible.
- En démonstration : Camille, moins de 45 min en semaine, le soir, séance longue le samedi, montre GPS et piste.

## Repères FTP et CSS à essayer

Avec ton compte coach :
1. Fiche d’un élève → **Repères d’entraînement** : renseigne la FTP (vélo, en watts) ou la CSS (natation, par exemple 1:45). Le tableau traduit les 7 zones.
2. Crée une séance de vélo ou de natation pour cet élève avec des zones : derrière chaque zone, les watts ou l’allure pour 100 m de l’élève.
3. Dis-moi si les plages te conviennent, et si tu préfères d’autres noms de zones pour le vélo et la natation.

En démonstration : Noah a une FTP de 250 W et une CSS de 1:45.

## Adapter la semaine (inspiré de Foulée) à essayer

Avec ton compte coach :
1. **Séances → Semaine**, choisis un élève et une semaine avec des séances à venir, puis ouvre **Adapter la semaine**.
2. Compare les quatre propositions (récupération, alléger, endurance seule, reprise) : volume avant → après, chaque séance barrée et remplacée, conséquence probable.
3. Choisis-en une puis **Appliquer … en brouillons**. Relis les séances, puis **Publier la semaine** quand tout te convient.
4. Dis-moi si les règles te semblent justes (par exemple −25 % pour « Alléger », 40 minutes au plus pour « Reprise »).

En démonstration : la semaine du 23 novembre de Noah a reçu « Endurance seule » (brouillons non publiés).

## Faisabilité de l’objectif (inspirée de Foulée) à essayer

Avec ton compte coach, pour un élève qui a envoyé son bilan :
1. Ajoute-lui un objectif daté, par exemple « Semi de Bruxelles en moins de 2 h ».
2. Dans sa fiche, ouvre **Faisabilité** : statut, critères, solutions avec leur statut.
3. **Essayer cette solution** change les paramètres ; « Nouveau calcul » montre l’effet. Tu peux aussi changer les paramètres toi-même. Rien n’est enregistré.
4. **Rédiger un message**, relis-le, puis **Ouvrir la conversation avec ce message** : il t’attend dans la conversation, tu l’envoies toi-même.
5. Dis-moi si les seuils te paraissent justes (semaines conseillées, séance longue, séances par semaine).

En démonstration : Camille a l’objectif « Semi de Bruxelles en moins de 2 h » au 17 janvier.
6. Dans la faisabilité, regarde les critères **Passif** et **Régularité réelle** : ce que l’élève a vraiment fait compte. Puis, dans **Ta décision**, valide l’objectif (même s’il est jugé risqué) avec ta justification : il porte ensuite « ✓ Validé par toi ». Ta justification reste privée.

En démonstration : l’objectif de Camille est validé par Marine malgré l’indication « risqué ».

## Bilan à confirmer, tâches récurrentes, historique à essayer

1. Quand un élève envoie son bilan, **Confirmer le bilan** apparaît dans ton Planning ; le confirmer confirme aussi son niveau.
2. **+ Tâche → Répéter** (chaque semaine, 2 semaines, mois) : marque-la « Terminé », la suivante apparaît à la bonne date.
   - **Quand je m’y mets** (jour, heure, durée estimée) : distinct de l’échéance. La tâche se range au jour de son créneau, l’agenda de la semaine montre « 🕘 14:30 · … · créneau de travail » à côté des rendez-vous, et le haut du Planning affiche la charge estimée du jour. Sur une tâche existante, **🕘 Planifier** change ou retire le créneau.
3. Fiche d’un élève → Bilan → **Historique** : chaque version, sa source et ce qui a changé.

En démonstration : tâche « Point hebdo avec Camille » chaque semaine (prochaine le 26 novembre).

## Résultats de référence à essayer

1. Fiche d’un élève → **Résultats de référence → + Ajouter un résultat** : une course (« 10 km en 52:30 ») ou un test (« Test 6 minutes, 1500 m en 6' »). Tu vois l’allure, les équivalences et, pour un test de 6 minutes, une VMA estimée.
2. Dans **Faisabilité**, le chrono visé est maintenant jugé d’après ce résultat.
3. Côté élève, **Progression** montre ses résultats et leurs équivalences.

En démonstration : Camille a « 10 km de Bruxelles » en 52:30.

## Générateur de programme à essayer

1. Pour un élève avec un bilan, valide un objectif daté (Faisabilité → Ta décision).
2. **📅 Générer le programme** : choisis le premier lundi et les jours, puis **Recalculer**.
3. Lis le résumé (départ → pic), les **risques** et les semaines : tremplin (4 semaines), développement (une semaine allégée sur quatre), affûtage, course.
   - Les séances marquées 📚 viennent de ta bibliothèque (même type, durée proche). Touche une séance pour lire **Pourquoi cette séance ?**. Dis-moi si une séance de ta bibliothèque aurait dû être choisie.
4. Coche « J’ai lu les risques… » puis **Créer les séances en brouillons**. Relis-les dans Séances, ajuste, puis publie semaine par semaine.
5. Dis-moi ce qui ne te convient pas : durées, types de séances, jours, progression. Les règles sont faciles à ajuster.

En démonstration : le programme de Camille (semi du 17 janvier) est créé en brouillons à partir du 23 novembre. Ses semaines 2 et 3 ont été régénérées (lundi, mercredi, samedi).

### Régénérer une partie du programme

1. Sur la page Programme de l’objectif, **Programme déjà créé → Régénérer une partie**.
2. Choisis les semaines (de … à …) et les jours, puis **Voir les différences**.
3. Lis chaque semaine : 🔒 gardée (passée, réalisée ou retouchée par toi), = inchangée, ✎ modifiée, + ajoutée, − retirée.
4. Retouche une séance dans Séances, puis reviens : elle doit apparaître 🔒 « retouchée par toi ».
5. **Appliquer** : tout reste en brouillons. Une séance déjà publiée garde sa version côté élève jusqu’à **Publier la semaine**.

## Notifications, bibliothèque Foulée et suite logique de l’objectif à essayer

1. **Emma** : ouvre sa fiche, ou Séances avec Emma choisie. Le bandeau « Prochaine étape » propose **📅 Générer le programme** pour son semi. Lis les risques, coche, crée : tout reste en brouillons.
2. **Bibliothèque** : les 324 séances Foulée sont déjà dans ta bibliothèque (cherche « Seuil », « 30"/30" », « Course-marche »). Chaque séance dit sa famille, son palier, ses niveaux et ses phases. Les paliers intermédiaires sont marqués « recalculé, à vérifier » : signale-moi ceux qui ne correspondent pas à ta méthode.
3. **Notifications** (menu « Notifications ») : publie une semaine à un élève ou écris-lui. Lui voit la cloche 🔔 en haut de son espace. Quand il t’écrit ou envoie un retour, ton menu « Notifications » se met à jour. Chaque notification ouvre l’écran où agir.
4. **E-mails** : en local, ils arrivent dans la boîte de test (Mailpit), jamais chez une vraie personne. Ils ne contiennent jamais le texte d’un message. Change le réglage « L’essentiel » / « Aucun e-mail » en bas de la page Notifications.

## Installer CoachOS sur ton téléphone

Sur le même réseau Wi-Fi que ton Mac, ouvre l’adresse réseau affichée par le serveur (« Network: http://… :3000 ») :
- **iPhone** (Safari) : bouton Partager → **Sur l’écran d’accueil**. L’icône verte « CoachOS » apparaît ; elle ouvre l’application en plein écran.
- **Android** (Chrome) : menu ⋮ → **Installer l’application**.

Dis-moi si l’icône, le nom et l’ouverture te conviennent.

## Ajuster un programme avec l’IA (simulée)

1. Ouvre la page Programme d’un objectif validé (bouton « 📅 Générer le programme »), ou Régénérer pour un programme existant.
2. Carte **✨ Ajuster avec l’IA** : écris par exemple « Emma est fatiguée : moins de fractionné, sortie longue le samedi et progressive », ou clique sur les exemples.
3. **Proposer des réglages** : la page se recalcule. Le bandeau dit ce qui a été réglé et pourquoi, les risques sont mis à jour, les séances changent.
4. **Créer** (ou **Appliquer**) si ça te convient, sinon **Sans réglage**.
5. Dis-moi les demandes qu’elle ne comprend pas : la version simulée reconnaît des mots-clés ; la vraie IA (Claude) comprendra des demandes libres une fois la clé branchée.

## Ma méthode (Coach DNA)

1. Menu **Méthode** → **+ Ajouter une règle**, par exemple « Jour de la sortie longue : samedi » ou « Éviter VMA, niveau débutant ».
2. Ouvre le programme d’un élève concerné : le bandeau « Ta méthode s’applique » le confirme et les séances suivent ta règle.
3. Retouche plusieurs programmes générés de la même façon (au moins 5 fois sur 2 semaines, plusieurs élèves) : une proposition apparaît dans « Appris de tes corrections ». Accepte-la ou écarte-la.
4. Note ce qui manque : quelles règles de ta méthode ne rentrent pas dans ces cinq types ?

## Résumé de la semaine

1. Ouvre la fiche d’un élève qui a eu des séances la semaine dernière : la carte **Semaine dernière** donne au plus trois faits (fait sur prévu, ce qui manque, l’effort déclaré) et une question à lui poser.
2. **✉️ Poser la question** ouvre votre conversation avec la question prête : relis, modifie, envoie (ou non).
3. Dis-moi si les faits et la question sonnent juste pour tes élèves.

## Blocs réutilisables et fraîcheur des mesures

1. Dans une séance (ou une séance de bibliothèque), construis un échauffement, puis **💾 Garder des blocs dans ma bibliothèque** : coche-le, nomme-le, **Garder ce bloc**.
2. Dans une autre séance, **+ Mon bloc…** l’ajoute d’un geste. Bibliothèque › **Mes blocs** les liste ; **Retirer** ne touche pas aux séances déjà faites.
3. Fiche d’un élève › **Suivi** : d’où viennent les chiffres (montre ou saisie) et depuis quand ; un avertissement apparaît après 14 jours sans nouvelle mesure.


## Choisir les changements d’une régénération

1. Programme d’un élève → **Régénérer une partie** → **Voir les différences**.
2. Chaque changement a sa case : décoche ceux que tu ne veux pas (la séance actuelle reste, ou rien n’est ajouté ce jour-là).
3. Le bouton dit combien seront appliqués (« Appliquer 4 sur 6 changements »). Tout reste en brouillons.

## Importer ta base de séances

1. Séances → Bibliothèque → **Importer mes séances**.
2. Essaie **Voir un exemple**, puis ta vraie base :
   - un fichier CSV exporté d’Excel, Numbers ou Google Sheets ;
   - ou des cellules copiées d’un tableur ;
   - ou une séance par ligne « Titre : séance ».
3. Lis l’aperçu : chaque ligne dit ce qui a été compris ou ce qui bloque. Corrige la catégorie si besoin, décoche ce que tu ne veux pas, puis **Importer**.
4. Envoie-moi les lignes mal comprises : c’est ce qui me servira pour adapter l’import à ta façon d’écrire.

## IA ce mois-ci

Paramètres → carte **IA ce mois-ci** : nombre de propositions, coût réel et budget du mois (10 $ par défaut). Au budget, l’IA s’arrête jusqu’au mois suivant ; tout reste faisable à la main.

## Reporter un retour, filtrer la file

1. Menu **Retours** : filtre par élève, groupe, « avec commentaire » ou « effort 8/10 ou plus ». Ouvre un retour, puis reviens : le filtre est toujours là.
2. Dans un retour, **Reporter à → Demain** : il quitte la file et revient seul demain à 7 h. Section « Reportés » : **Remettre maintenant** pour le reprendre plus tôt.

## Garder un bloc de plusieurs semaines

1. Séances › Semaine d’un élève : **💾 Enregistrer comme semaine type**, puis **Semaines à garder → 4 semaines**.
2. Chez un autre élève : **📋 Appliquer une semaine type**, choisis le bloc. Les brouillons couvrent les 4 semaines suivantes ; rien n’est publié.

## Importer un ancien programme (D-085)

1. Bibliothèque › **Importer un programme**.
2. Ouvre un de tes programmes dans Google Docs, sélectionne tout (Cmd+A), copie (Cmd+C), puis colle dans la grande zone.
3. Vérifie l’aperçu :
   - semaines S1, S2… ;
   - chaque séance avec sa structure lue ;
   - ses consignes ;
   - son jour (« proposé » quand ton texte n’en donnait pas).
4. Décoche ce que tu ne veux pas, change un jour si besoin, puis donne un nom au programme.
5. Clique sur **Enregistrer comme programme type**. Il apparaît dans Bibliothèque › Semaines types.
6. Pour le donner à un élève : ouvre sa semaine dans Séances, puis applique le programme type. Tout arrive en brouillons, rien n’est publié.

À me signaler : une séance mal lue (copie-moi la ligne), une semaine manquante, ou un jour mal placé.
