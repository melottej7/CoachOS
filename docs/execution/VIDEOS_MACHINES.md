# Montrer les exercices sur machine (D-178)

But : dans sa séance, l’élève touche un exercice et voit tout de suite comment régler la machine et faire le mouvement. Boucle muette de 3 à 6 s, lisible au téléphone, moins de 1 Mo, avec image d’aperçu, disponible sans réseau.

- Bibliothèque : 31 machines, 68 exercices, rangés par type de machine (`packages/domain/src/gym-machines.ts`). Liste à cocher et détail : [MACHINES_A_COCHER.md](MACHINES_A_COCHER.md).
- Comparaison des quatre façons sur les trois pilotes, côte à côte : [videos-machines.html](videos-machines.html) (ouvrir dans un navigateur).

## Ce qu’on sait des clubs Basic-Fit en Belgique

- 230 clubs et plus en Belgique ([Basic-Fit](https://www.basic-fit.com/fr-be/home), [La Libre, janvier 2026](https://www.lalibre.be/sports/omnisports/2026/01/17/fitness-en-belgique-comment-les-salles-de-sport-ont-conquis-tout-le-pays-EIQF6BQKWZF7FHKOR6A73ZN4L4/)).
- Marque : Matrix selon la page « newest equipment » belge ([en-be](https://www.basic-fit.com/en-be/newestequipment)) ; Matrix et Technogym selon la page « pourquoi Basic-Fit » ([fr-be](https://www.basic-fit.com/fr-be/pourquoi-basic-fit)). Les deux pages ne disent pas la même chose : à vérifier sur place (plaque de la marque sur chaque machine).
- Zones ([fr-be](https://www.basic-fit.com/fr-be/trainingzones)) : cardio, musculation assistée, poids libres et machines à charges libres, HIIT et fonctionnel, gainage et étirements, cours collectifs et vidéo.
- **Sûr** (nommé par Basic-Fit) : tapis de course, vélo elliptique, leg extension, développé incliné à la machine, développé épaules à la machine. **Très probable** : le reste d’une gamme guidée Matrix (presse, leg curl, abducteurs, développé, pec deck, tirage vertical, rowing, biceps, triceps, abdominaux), double poulie, Smith machine, vélos, rameur. **Selon le club** : leg curl allongé, fessiers, mollets, lombaires à la machine, tractions assistées, hack squat, escalier, vélo à air, SkiErg.

## Filmer dans un club Basic-Fit

Le règlement intérieur belge ([lien](https://www.basic-fit.com/fr-be/a-propos-de-nous/reglement-interieur)) :

- photos et vidéos interdites dès qu’elles peuvent porter atteinte à la vie privée des autres personnes présentes ; vestiaires exclus ;
- **activités commerciales ou promotionnelles et entraînement personnel interdits sans autorisation écrite préalable de Basic-Fit.** Tourner des vidéos pour CoachOS, produit vendu, en relève.

Conséquence : avant de filmer, demander une autorisation écrite (gérant du club ou service client), en précisant le but, les créneaux et l’absence de logo et d’autres membres à l’image. Sans cet accord, filmer ailleurs : salle indépendante qui l’accepte par écrit, ou machine équivalente chez soi.

## Les quatre façons, sur les trois pilotes

| | 1. Animation dessinée | 2. Vidéo du fondateur | 3. Bibliothèque achetée | 4. Vidéo IA |
|---|---|---|---|---|
| Fait ici | Oui, les trois pilotes (environ 60 Ko chacune : silhouette en volume, 24 images par seconde, plaques qui montent) | Non (plans et maquette prêts) | Non (aucune image reprise sans licence) | Non |
| Justesse du geste | Vérifiée par des tests à chaque image (angles des genoux et des coudes, mains sur la poignée, membres de longueur fixe), puis relue par toi | La meilleure : un vrai geste | Bonne, faite par des professionnels | **Non prouvable ici** ; défauts connus : membres qui changent de longueur, machine qui se déforme, poignées traversées |
| Ressemblance avec les machines Basic-Fit | Schéma générique, sans marque ; reconnaissable par la forme | Exacte pour ton club | Machines génériques | Variable d’un clip à l’autre |
| Style CoachOS (clair, sombre) | Oui, couleurs du thème | Photo réelle | Style du vendeur | Style imposé |
| Poids, hors ligne | Dans la page : rien à télécharger | Environ 400 à 800 Ko par boucle | Selon format | Environ 1 Mo |
| Droits | À nous | À toi, si le club l’autorise par écrit | Licence à vérifier par contrat | Conditions de l’outil, image d’IA à signaler |

Bibliothèques repérées (prix publics au 26 novembre 2026, à confirmer par devis) : [WorkoutLabs](https://workoutlabs.com/exercise-illustrations-licensing/) dessins 2D, 679 exercices, à partir de 15 $ par image et par an ou 25 $ à vie, bibliothèque entière dès 1 200 $ par an ou 3 500 $ à vie, animations MP4 en option pour une partie des exercices ; packs 3D d’animations sur [Fab](https://www.fab.com), [Unity Asset Store](https://assetstore.unity.com) (souvent sans les machines, à monter soi-même) ; clips isolés sur [Envato Elements](https://elements.envato.com/horizontal-leg-press-EDEAJAQ). Aucune ne couvre toute notre liste dans un style unique.

Vidéos IA : protocole pour qu’une vidéo soit admise, mesuré image par image sur chaque pilote : 1) longueur des membres constante à 5 % près ; 2) mains et pieds qui ne quittent pas la poignée ou la plateforme ; 3) amplitude conforme (90° aux genoux à la presse, barre au haut de la poitrine au tirage, bras presque tendus au développé) ; 4) machine indéformable d’une image à l’autre ; 5) aucun logo. Tant qu’un outil ne passe pas ces cinq points sur les trois pilotes, pas de vidéo IA.

## Recommandation

**L’animation dessinée pour toute la liste, puis tes vidéos là où elles apportent le plus**, si Basic-Fit l’autorise par écrit.

- Pourquoi : faite et vérifiée aujourd’hui, aucune licence, aucune autorisation de club, juste par construction (le gabarit place genoux et coudes, les tests vérifient les angles), au style de l’app en clair et en sombre, dans la page donc sans réseau, quelques kilo-octets.
- Fait le 26 novembre, à la demande du fondateur : les 68 exercices ont leur animation (vue de face pour les abducteurs, élévations, écartés et oiseaux ; pédalage et foulée en cycle continu pour le cardio ; rameur en trois temps, jambes puis buste puis bras). Relecture : `npx tsx scripts/machines-gallery.ts animations.html`.
- **Temps réel** : une session de travail pour le gabarit et les 65 animations restantes. De ton côté : environ une minute de relecture par animation, une heure en tout.
- **Coût** : 0 € de licence. À comparer : environ 1 500 $ à vie pour 60 dessins WorkoutLabs, sans animation garantie ni style CoachOS ; ou deux séances de tournage de deux heures (après autorisation écrite) et l’installation de l’outil de découpe sur le Mac.

## Si tu filmes : plans et règles de tournage

- **Avant** : autorisation écrite du club ; créneau creux ; personne d’autre dans le cadre ; aucun logo (cache le logo de la machine s’il est visible, ou cadre sans lui) ; même tenue sobre à chaque fois.
- **Téléphone** : posé sur un trépied ou un banc, jamais tenu ; vertical ; 1080p ; 30 images par seconde ; mode avion.
- **Angle et cadrage** : de profil (côté où la machine ne cache rien), à 2,5 ou 3 m, objectif à hauteur de la partie qui bouge ; tout le corps et la partie mobile de la machine dans le cadre, avec une marge.
- **Contenu** : d’abord les réglages en 5 s (montrer le levier du siège, la goupille), puis 3 répétitions au tempo des animations (1 s d’effort, 2 s de retour freiné). Environ 15 s par plan.
- **Plans des pilotes** : presse à cuisses de profil côté plateforme libre, téléphone à hauteur de hanche ; tirage vertical de profil à 3 m, de la poulie haute aux pieds ; développé machine de profil, dossier, poignées et pieds dans le cadre.
- **Ce que je fais ensuite** : je garde la meilleure répétition, cadre en 4:5, fais la boucle (aller-retour sans saut), retire le son, compresse sous 1 Mo (H.264, environ 720 px de large) et tire l’image d’aperçu. Les consignes restent affichées par l’app sous la vidéo, pas incrustées : on les corrige sans refaire la vidéo.
- **Envoi** : un fichier par exercice, nommé avec la clé de l’exercice (par exemple `tirage-vertical.mov`), dans Bibliothèque › Exercices › l’exercice › « Ajouter ma vidéo ».

## Relecture

Aucune animation n’est montrée à un élève avant ta validation : elle reste « À relire » dans la bibliothèque du coach. Pour valider : ouvre la page de comparaison, regarde chaque boucle, dis-moi « validé : presse, tirage, développé » ou ce qui cloche. Je l’inscris avec la date (`MOTION_REVIEWS`).
