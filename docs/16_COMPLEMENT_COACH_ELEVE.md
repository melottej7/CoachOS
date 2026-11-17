# CoachOS · Complément produit pour la suite du développement

Instruction du fondateur à intégrer au projet, 17 novembre 2026. Lire l’ensemble de ce fichier avant de modifier le périmètre et la roadmap.

## 1. Mission et point de reprise

Nous sommes actuellement à la tranche C. Construis progressivement une application complète, fluide et utilisable au quotidien par un coach d’endurance et ses élèves. Le coach doit pouvoir organiser son portefeuille, savoir quoi faire et quand, concevoir des programmes personnalisés et suivre leur réalisation. L’élève doit comprendre sa séance, l’exécuter avec sa montre quand elle est compatible, transmettre son retour et consulter son évolution.

Ce complément précise la cible demandée. Intègre ses exigences dans les documents et dans le code. Les groupes, tâches, statistiques et liens entre bibliothèque, bilan et génération de programme appartiennent au périmètre produit attendu. Pour les intégrations externes, indique les accès réellement obtenus et ce qui dépend encore du fournisseur.

Commence par lire CLAUDE.md, l’état d’exécution, les décisions, le PRD, l’UX, la roadmap et le code correspondant aux parcours concernés. Pour chaque exigence ci-dessous, relève ce qui fonctionne réellement, ce qui est partiel, ce qui est seulement prévu et ce qui reste à ajouter. Cite les écrans, routes, données et stories concernés. Si le code de Foulée est accessible, évalue les composants utiles à cette cible. La conception des parcours part des besoins décrits ici.

Préserve les fonctions et données existantes. Fais des évolutions incrémentales à partir de l’état constaté. Cette instruction autorise la mise à jour des spécifications et la réalisation progressive des fonctions. Prends les décisions réversibles de mise en œuvre et consigne-les. Le plan de vente détaillé reste postérieur à la validation de l’usage.

## 2. Portefeuille organisé par groupes et niveaux

Permettre de créer, renommer, réordonner et archiver des groupes. Exemples, débutants, intermédiaires, confirmés, préparation marathon, trail, triathlon ou groupe du mardi. Distinguer le groupe, le niveau et l’objectif. Un élève peut appartenir à plusieurs groupes et avoir un niveau défini par sport. Le coach confirme tout changement de niveau.

Depuis une vue d’ensemble, afficher les groupes, leur effectif, les retours à traiter et la couverture des programmes à venir. En ouvrant un groupe, retrouver ses élèves avec recherche, filtres par sport, niveau, objectif et statut. Une progression groupe → élève → séance doit garder le groupe, les filtres et la période lorsqu’on revient en arrière.

Prévoir l’ajout ou le retrait d’élèves et une vue de planning par groupe. Le coach doit pouvoir préparer une même base de séance ou de semaine pour plusieurs élèves, puis vérifier les adaptations individuelles avant publication. Montrer les destinataires exacts et les exceptions. Une modification ultérieure du groupe laisse intactes les prescriptions déjà publiées.

Les groupes servent à organiser le travail. Les droits du coach, des collaborateurs et des élèves restent contrôlés par les affectations autorisées. Un élève voit son propre accompagnement.

## 3. Fiche individuelle et suivi longitudinal

En cliquant sur un élève, ouvrir une fiche de suivi avec accès direct aux éléments suivants.

- Profil sportif, groupe(s), niveau par sport, objectifs et échéances.
- Disponibilités, contraintes connues, matériel, préférences, questionnaire et synthèse du dernier entretien.
- Programme actuel, prochaines séances, historique du prévu et du réalisé, retours et éléments à examiner.
- Statistiques et graphiques sur une période choisie, rendez-vous, messages et tâches liées au dossier.
- Notes privées du coach, distinctes des informations que l’élève peut consulter.

Afficher le sport, la période, la source et la fraîcheur des mesures. La fiche doit permettre d’ouvrir une séance ou de reprendre la planification sans ressaisir les informations de l’élève. Chaque information recueillie a un usage défini et des permissions adaptées.

## 4. Accueil coach, tâches et agenda

À la connexion, l’application doit répondre à trois questions. Qu’est-ce qui demande mon attention, quelle est ma prochaine action et pour quand faut-il la réaliser ?

Prévoir un accueil avec les rendez-vous du jour, les tâches en retard, les actions du jour et celles de la semaine. Ajouter filtres par élève, groupe, type, échéance et priorité. Le coach peut créer une tâche libre ou depuis un dossier, un message, une séance et un rendez-vous.

Couvrir notamment ces actions.

- Répondre à une conversation ou à une question sur une séance.
- Examiner un retour, vérifier une séance modifiée ou demander une information manquante.
- Préparer ou renouveler un programme pour un élève dont la période suivante approche.
- Relire un programme proposé par l’IA et le publier après correction.
- Relancer un questionnaire d’accueil ou un bilan périodique attendu.
- Préparer puis effectuer un appel, une visioconférence ou un bilan d’objectif.
- Recontacter un élève qui reste sans nouvelles selon une règle choisie par le coach.
- Vérifier une synchronisation échouée ou une séance non rapprochée du planning.

Une tâche comporte titre, type, élève ou groupe éventuel, responsable, échéance, priorité, statut, estimation de durée facultative et lien direct vers l’action. Prévoir à faire, en cours, en attente, terminé, reporté et annulé, avec récurrence quand elle sert le suivi.

Les tâches humaines ont leurs propres données et états. Le planning distingue l’échéance d’une tâche, son éventuel créneau de travail et l’horaire fixe d’un rendez-vous. Une tâche ouverte mène à un écran où le coach peut réellement accomplir l’action et revenir à sa liste.

Proposer un classement explicable fondé sur la priorité choisie, l’échéance et le motif métier. Les règles de délai et de relance sont configurables. Une information absente reste une information à vérifier. Le coach peut réorganiser la liste, reporter ou désactiver une règle.

Éviter plusieurs tâches ouvertes pour le même événement. Réévaluer une tâche automatique lorsque son objet change, puis la clore si le problème est résolu. Un nouveau message après traitement peut rouvrir le suivi. Relier les rendez-vous à la fiche élève avec fuseau, début, durée, lien vidéo éventuel, notes de préparation et compte rendu. Commencer par un lien de visioconférence et un formulaire de notes utilisables avec le service choisi par le coach.

## 5. Bibliothèque personnelle et historique de carrière

Permettre au coach de constituer une bibliothèque de séances, semaines types, blocs de préparation et programmes complets, avec création manuelle, duplication, classement, recherche et versions. Classer par sport, objectif, niveau, durée disponible, phase de préparation et matériel pertinent.

Les séances structurées doivent représenter échauffement, étapes, répétitions, récupération et retour au calme. Les cibles peuvent être une durée, une distance, une allure, une zone cardiaque, une puissance ou un effort, selon le sport et les données disponibles. Prévoir des cibles relatives au profil de l’élève pour que la réutilisation reste personnalisée.

Permettre l’import progressif de mes anciens programmes dans les formats effectivement disponibles. Commencer par les formats qui représentent mon historique réel, avec prévisualisation, correction des unités, doublons et validation avant insertion. Une ancienne prescription, un modèle réutilisable et une séance réalisée doivent rester identifiables séparément.

Lors de la réutilisation, copier vers un brouillon indépendant. Les anciennes versions et les prescriptions publiées restent retraçables. Séparer les contenus de méthode du coach des données personnelles des élèves. Seuls les contenus dont l’utilisation est autorisée alimentent la personnalisation IA.

## 6. Assistant de conception de programmes fondé sur ma méthode

Je veux que l’application puisse s’appuyer sur mes séances, programmes historiques, règles et corrections pour proposer des programmes cohérents avec ma pratique. Recherche une solution de personnalisation adaptée au volume disponible, au coût et à la qualité mesurée. Une bibliothèque consultable, une sélection d’exemples pertinents et un profil Coach DNA versionné peuvent constituer la première solution.

Offrir deux entrées vers le même bilan structuré.

- Un questionnaire en ligne envoyé à l’élève, avec sauvegarde, reprise et statut de complétude.
- Un entretien téléphonique ou vidéo, pendant lequel le coach renseigne le bilan ou le complète après l’appel. Le même dossier peut combiner questionnaire et notes relues.

Le bilan rassemble sport(s), objectifs, dates cibles, expérience, niveau, volume récent, jours et temps disponibles, matériel, préférences et contraintes utiles. Le coach confirme les informations avant génération. Les informations sensibles éventuelles suivent un traitement défini. Une transcription d’appel reste une extension qui exige l’accord des participants et une validation de son contenu.

Parcours attendu, sélectionner l’élève, vérifier le bilan, choisir horizon et objectif, retrouver les exemples pertinents, générer un programme brouillon, expliquer les choix et informations manquantes, corriger, puis publier explicitement.

Le programme proposé doit contenir des semaines, des séances structurées, les objectifs de chaque séance et les éléments permettant la progression et la récupération selon les règles du coach. Vérifier les disponibilités, sports, zones, unités et contraintes. Montrer les références de bibliothèque et les règles utilisées. Préserver les adaptations individuelles lors d’une génération depuis un groupe.

Permettre de modifier une séance, une semaine ou le programme entier et de régénérer uniquement la partie demandée. Présenter les différences et protéger les séances passées et déjà réalisées. Les informations insuffisantes conduisent à des questions ciblées ou à un brouillon explicitement incomplet.

Les corrections du coach peuvent proposer des règles candidates qu’il confirme, en distinguant préférence durable et exception. Définir des essais de qualité sur des cas connus. Revoir les anciens plafonds de longueur conçus pour un résumé hebdomadaire afin qu’ils permettent réellement de générer un programme structuré. Les coûts et délais restent suivis par type de demande.

Le coach garde la décision de publication. Une panne IA laisse accessibles bibliothèque, rédaction manuelle, planning et suivi.

## 7. Espace élève, retours et évolution

Concevoir d’abord l’espace élève pour le téléphone. À l’ouverture, présenter la séance du jour, les consignes et la prochaine action. Prévoir calendrier, détail, retour, historique, objectifs et progression, ainsi qu’accès aux échanges avec le coach.

Après chaque séance, l’élève peut indiquer réalisé, partiel, reporté ou non réalisé, ce qu’il a effectivement fait, durée, distance, effort ressenti, ressenti général, commentaire et difficulté particulière. Les champs restent courts et une mesure peut être absente. Relier le retour à la version de séance suivie.

Prévoir l’association d’une ou plusieurs activités réalisées à la séance prescrite, leur ajout ou retrait et la correction d’un rapprochement erroné. Les statuts de déclaration, de réception d’activité, de revue du coach et de synchronisation restent cohérents. Un clic répété ou une reprise réseau crée un seul retour logique.

Les mesures importées préremplissent ce qui est disponible. Le ressenti et le commentaire de l’élève restent éditables séparément. Une différence entre mesure, déclaration et prescription est visible. Un résultat peut exister même si l’élève a fait une séance différente de celle prévue.

Proposer des statistiques lisibles pour l’élève et, dans le cadre des permissions applicables, pour le coach. Couvrir séances effectuées, régularité, volumes, durée, distance, dénivelé, allure, fréquence cardiaque, puissance ou cadence selon le sport et les données. Ajouter évolution des tests et performances comparables, progression vers les objectifs et comparaison prévu/réalisé. Offrir vues hebdomadaire, mensuelle et période personnalisée.

Chaque graphique indique la période, les unités et les observations manquantes. Les calculs ont une définition et une provenance vérifiables. Comparer des efforts comparables pour parler de progression. Afficher « données insuffisantes » lorsque le résultat serait trompeur. Une statistique réservée au coach reste dans son espace.

## 8. Activités entrantes et séances sortantes vers Garmin

La récupération d’activités réalisées et l’envoi de séances prescrites sont deux flux à construire et à vérifier séparément. L’objectif produit est de limiter les doubles saisies et de permettre à l’élève de suivre la séance sur une montre compatible.

Pour les activités entrantes, étudier Garmin et Strava à partir de leurs documentations et conditions actuelles. Prévoir autorisation du compte, indicateur de dernière synchronisation, erreurs compréhensibles, reprise, déconnexion et traitement des suppressions. La même sortie reçue de deux sources doit être rapprochée avec prudence, avec confirmation en cas d’ambiguïté et sans double comptage.

Proposer aussi un import manuel de fichiers d’activités compatibles, notamment FIT ou TCX quand leur prise en charge est vérifiée. Conserver provenance et versions. Un import de fichier ne change pas les droits attachés à sa source.

Pour les séances sortantes, concevoir le modèle structuré dès maintenant pour préserver échauffement, étapes, récupération, répétitions, unités et zones sur le chemin vers Garmin Connect et les appareils compatibles. Une séance d’endurance libre et une séance d’intervalles doivent chacune avoir un scénario de validation.

Étudier l’API Training officielle de Garmin et l’accès réellement disponible au projet. L’intégration cible permet publication vers Garmin Connect puis synchronisation de l’appareil. Si l’accès manque, développer les éléments indépendants et proposer un export de séance FIT accompagné d’une procédure vérifiée sur les appareils retenus. Un fichier téléchargeable a un statut distinct d’une séance reçue par Garmin Connect ou confirmée sur un appareil.

Vérifier aussi mise à jour, déplacement et annulation d’une séance déjà envoyée. L’interface reflète seulement les confirmations effectivement fournies par l’intégration. Signaler les étapes ou appareils incompatibles et les actions utilisateur encore nécessaires.

Documenter les dépendances externes, les validations obtenues et les fonctionnalités bloquées. Prévoir un essai sur une montre réellement disponible avant de déclarer le transfert opérationnel. Les données utilisées par l’IA sont filtrées par leurs droits d’usage et leur provenance. Les restrictions actuelles de Strava imposent un examen explicite avant tout affichage au coach, calcul ou utilisation IA. Poursuivre les autres fonctions pendant une attente d’accès fournisseur.

## 9. Interface et critères de recette

Proposer une navigation cohérente autour de l’accueil priorisé, des groupes/élèves, du calendrier, de la bibliothèque, des échanges et de la méthode du coach. La fiche élève relie les tâches, le bilan, le programme et le suivi. Sur téléphone, l’élève retrouve rapidement Aujourd’hui, Programme, Progression et Échanges selon les parcours retenus.

Dérouler au minimum ces scénarios avec des données fictives puis sur les environnements autorisés.

1. Créer deux groupes, affecter un élève aux deux, filtrer un groupe et ouvrir sa fiche en gardant le contexte au retour.
2. Ouvrir l’accueil et comprendre l’ordre des actions, leur motif et leur échéance. Une réponse réellement envoyée met à jour la tâche correspondante.
3. Prévoir un appel vidéo avec fuseau, lien et préparation, saisir les informations utiles et retrouver le bilan dans le dossier.
4. Faire remplir le même bilan par questionnaire, reprendre une réponse incomplète et confirmer les données côté coach.
5. Enregistrer une séance et un bloc en bibliothèque, importer un exemple historique autorisé et les réutiliser sans modifier l’original.
6. Produire un programme depuis le bilan et la bibliothèque, modifier une semaine et publier la version corrigée. Vérifier que l’élève reçoit cette version.
7. Donner un retour depuis le téléphone, l’associer à l’activité réalisée et comparer prévu, mesuré et déclaré côté coach.
8. Consulter une progression sur plusieurs semaines et retrouver les séances sources. Les valeurs absentes restent identifiables.
9. Recevoir deux fois la même activité et vérifier un rapprochement sans doublon, puis tester une reprise après erreur.
10. Exporter une séance structurée, puis vérifier son envoi vers Garmin Connect et sa lecture sur un appareil compatible lorsque les accès sont obtenus.

Pour chaque parcours, relever les permissions, l’état vide, les erreurs, la reprise et les conflits. Privilégier des actions directes et des explications compréhensibles. Une fonction est livrée lorsque l’action complète, sa persistance et son effet côté autre rôle sont vérifiés.

## 10. Travail autonome et livrables attendus

Produis d’abord une courte matrice de couverture reliant chaque exigence à son état constaté et à son lot de livraison. Distingue les fonctions internes réalisables, les étapes du développement et les dépendances fournisseur encore ouvertes. Explique les changements de données ou d’API nécessaires dès maintenant pour éviter les incompatibilités ultérieures.

Les noms d’entités et les contrats du package initial sont des points de départ à faire évoluer. Prévoir notamment les appartenances multiples aux groupes, niveaux par sport, tâches humaines, bilans et réponses, versions des programmes, activités réalisées et associations aux séances, séries de mesures et états de synchronisation. L’organisation de ces données doit préserver les permissions et les données déjà créées.

Mets à jour les documents existants utiles, les critères d’acceptation, le backlog et la roadmap avec des identifiants stables. Rends les groupes/niveaux, tâches, bilans, statistiques, programmes complets et échanges Garmin explicitement traçables. Fais évoluer CLAUDE.md pour que ce complément soit relu lors des reprises. En cas de divergence avec les anciennes priorités produit, applique cette instruction et consigne la décision. Les contraintes de sécurité et les accords fournisseurs réellement applicables continuent de s’appliquer.

Termine les prérequis réels de la tranche C puis enchaîne les fonctions par parcours complet. Priorise groupes et dossiers, accueil de travail et statistiques de base, bibliothèque et bilan, génération supervisée et intégrations selon leurs dépendances. Prépare tôt le format de séance et la provenance des données nécessaires aux échanges Garmin. Maintiens une vue des exigences restantes jusqu’à la réalisation de la cible.

Après le plan bref et sa mise à jour documentaire, commence la prochaine tranche réalisable et poursuis les suivantes dans le cadre autorisé. Mets à jour le journal avec les travaux terminés, les preuves, les blocages et l’action de reprise. Les choix réversibles courants relèvent de ton autonomie. Sollicite le fondateur pour une décision de fond, un accès manquant ou une opération de production qui exige son intervention. Avance pendant ce temps sur les travaux indépendants.

## Références à revérifier pour les intégrations

Sources officielles consultées le 17 novembre 2026. Les accès exacts et accords propres au projet sont à établir avant intégration réelle.

- [Garmin Connect Developer Program](https://developer.garmin.com/gc-developer-program/overview/). Le programme distingue accès personnel et accès business. Vérifier les capacités et limites réellement accordées à l’application.
- [Garmin Training API](https://developer.garmin.com/gc-developer-program/enterprise/training-api/). Publication des séances et plans vers le calendrier Garmin Connect, puis synchronisation par l’utilisateur vers les appareils compatibles.
- [Garmin Activity API](https://developer.garmin.com/gc-developer-program/enterprise/activity-api/). Réception des activités et fichiers après autorisation et synchronisation du compte.
- [Garmin FIT Workout](https://developer.garmin.com/fit/file-types/workout/). Un fichier de séance structurée contient les messages et étapes de prescription. Vérifier le contenu décodé et la compatibilité du parcours de transfert.
- [Strava API Policy](https://www.strava.com/legal/api_policy). Examiner notamment affichage, rétention, usage IA et données dérivées. Garder ces restrictions dans la provenance et les autorisations du traitement.
