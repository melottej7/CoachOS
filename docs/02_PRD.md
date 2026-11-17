# 02 · Product Requirements Document

CoachOS · Version 1.1 · 17 novembre 2026

Les fiches suivantes définissent les comportements métier et les critères d’acceptation. À lire avec UX, base, API et backlog. Les histoires citées permettent d’ouvrir la tranche concrète avec ses dépendances.

## Sommaire

- [01 · Promesse produit](#01)
- [02 · Hypothèses et exclusions](#02)
- [03 · Coach indépendant](#03)
- [04 · Coach premium](#04)
- [05 · Club et délégation](#05)
- [06 · Athlète invité](#06)
- [07 · Carte des versions](#07)
- [08 · Accueil du coach](#08)
- [09 · Acceptation de l’invitation](#09)
- [10 · Choix d’espace et rôle](#10)
- [11 · Liste et fiches athlètes](#11)
- [12 · Fin de relation](#12)
- [13 · Objectifs et plans](#13)
- [14 · Calendrier et fuseaux](#14)
- [15 · Création de séance](#15)
- [16 · Publication en lot](#16)
- [17 · Modification et annulation](#17)
- [18 · Bibliothèque et application](#18)
- [19 · Sémantique des six sports](#19)
- [20 · Programme du jour](#20)
- [21 · Saisie de feedback](#21)
- [22 · Historique personnel](#22)
- [23 · Fil de relation](#23)
- [24 · File des retours à traiter](#24)
- [25 · Notes internes et continuité](#25)
- [26 · Information et finalités](#26)
- [27 · Export et effacement](#27)
- [28 · Rétention minimale](#28)
- [29 · Contexte et provenance](#29)
- [30 · Résumé hebdomadaire](#30)
- [31 · Validation et repli](#31)
- [32 · Fiche déclarative](#32)
- [33 · Apprentissage candidat](#33)
- [34 · Supervision graduée](#34)
- [35 · Variations et anomalies](#35)
- [36 · Adaptation et commentaire](#36)
- [37 · Checkout coach](#37)
- [38 · Limites et impayés](#38)
- [39 · Compagnon athlète](#39)
- [40 · Langues et unités](#40)
- [41 · Résultats de sources permises](#41)
- [42 · Strava selon périmètre autorisé](#42)
- [43 · Équipe et portefeuille délégué](#43)
- [44 · Regroupement et fréquence](#44)
- [45 · Permissions et traçabilité](#45)
- [46 · Capacité et dégradation](#46)
- [47 · Évaluer la reprise de Foulée](#47)
- [48 · Mesure activation et rétention](#48)
- [49 · Mesure du gain et de la qualité](#49)
- [50 · Scénarios commerciaux différés](#50)
- [51 · Marketplace et hors connexion](#51)
- [52 · Critères de sortie](#52)

<a id="01"></a>
## 01 · Promesse produit

**VISION   /   MVP**

### Contexte et usage

CoachOS relie deux usages hebdomadaires. Le coach planifie, publie et traite les retours depuis sa semaine. L’athlète ouvre l’application sur son téléphone, comprend sa séance et indique ce qu’il a fait. Chaque rôle doit voir la prochaine action utile.

### Comportement du produit

Pour une semaine type, la prescription reste versionnée du brouillon au retour. Le coach peut retrouver la séance effectivement vue par l’athlète et mesurer les cas traités. L’athlète invité utilise gratuitement Web et, en V1, Expo.

### Reprise et mesure

La première tranche recouvre toute la boucle sur une séance. Mesurer d’abord le nombre de gestes, les hésitations et les échecs pour chaque rôle. Les améliorations et l’assistance IA suivent les preuves de fluidité et le temps de revue mesuré.

### Critères de recette associés

- **C09-01.** Seuls les retours courants sans revue sont comptés
- **C09-04.** Le lien aboutit au retour source ou explique son indisponibilité
- **C09-08.** Le filtre reste actif lors du retour du détail

<a id="02"></a>
## 02 · Hypothèses et exclusions

**VISION   /   MVP**

### Contexte et usage

Le travail se divise entre construction de semaine, publication, remontée de feedback, revue et réponse. Les temps consacrés aux corrections et à la coordination appartiennent au coût de suivi.

### Comportement du produit

L’objectif de prise en charge de 50 à 300 athlètes dépend du niveau de service. Le pilote valide d’abord 15 à 50 par coach. Le dimensionnement de l’architecture évalue des portefeuilles à 300 et 20 000 athlètes au total.

### Reprise et mesure

Aucun projet de marché athlète payant. Les tableaux avancés, les connecteurs secondaires et le traitement des données de santé exigent une preuve spécifique. Evaluer la coexistence avant de demander un basculement complet.

### Critères de recette associés

- **C14-01.** Chaque espace autorisé accède aux drapeaux dédiés
- **C14-04.** Le coach peut accomplir invite, publication et feedback sans aide
- **C14-08.** Le parcours complet clavier et lecteur d’écran fonctionne sur le web

<a id="03"></a>
## 03 · Coach indépendant

**PERSONAS   /   MVP**

### Contexte et usage

Le coach indépendant gère 15 à 50 athlètes, souvent avec plusieurs interfaces et des horaires irréguliers. Il paie pour déléguer la collecte et accélérer la revue sans perdre le détail d’un dossier.

### Comportement du produit

Scénario, il crée trois prescriptions types, invite les athlètes volontaires, publie son premier lot et traite les commentaires reçus dans la semaine. Le coaching continue pendant la transition.

### Reprise et mesure

Mesurer temps d’activation, nombre de dossiers actifs et taux d’effort manuel. Poser la question du changement seulement après deux semaines comparables.

### Critères de recette associés

- **C03-01.** Un propriétaire voit la fiche créée avec état invité
- **C03-04.** Le lien révoqué ne peut plus relier le compte
- **C03-08.** Après archive, aucune nouvelle séance ni message ne peut être écrit dans le dossier

<a id="04"></a>
## 04 · Coach premium

**PERSONAS   /   V1**

### Contexte et usage

Ce coach gère 50 à 200 athlètes. Son principal besoin est de préserver qualité et réactivité alors que le volume d’exceptions augmente. Il veut expliquer sa méthode et avoir un aperçu avant toute publication.

### Comportement du produit

Scénario, il trie les retours par jour et priorité, traite une exception, copie une semaine type et compare le brouillon générique avec celui de sa version DNA. La préparation ne doit pas devenir une nouvelle boîte de réception.

### Reprise et mesure

Mesurer la revue de 50 dossiers ainsi que les cas silencieux ou oubliés. Les portefeuilles lourds requièrent un contrôle spécifique de latence et support.

### Critères de recette associés

- **C09-01.** Seuls les retours courants sans revue sont comptés
- **C09-04.** Le lien aboutit au retour source ou explique son indisponibilité
- **C09-08.** Le filtre reste actif lors du retour du détail

<a id="05"></a>
## 05 · Club et délégation

**PERSONAS   /   V2**

### Contexte et usage

Le club achète pour un espace partagé, avec un propriétaire qui gère les droits et des coachs qui suivent les dossiers attribués. Une équipe aide à organiser le travail mais n’étend pas les droits.

### Comportement du produit

Scénario, un coach arrive pour une période définie. Le propriétaire l’affecte à un athlète, vérifie la fin de délégation, puis l’enlève. Le compte club et l’historique sportif restent accessibles selon leur périmètre.

### Reprise et mesure

Avant ouverture, couvrir retrait immédiat, coaffectation, fin de mandat, transfert de propriété et absence de visibilité transversale. Mesurer temps de support par club.

### Critères de recette associés

- **C21-01.** Une équipe ne change pas les permissions des athlètes
- **C21-04.** La prochaine requête perd accès aux athlètes et jobs associés
- **C21-08.** Le droit cesse à la date d’expiration prévue

<a id="06"></a>
## 06 · Athlète invité

**PERSONAS   /   MVP**

### Contexte et usage

L’athlète veut identifier le travail du jour, comprendre les unités, rapporter le réalisé et poser une question. Il peut avoir plusieurs relations dans CoachOS. Chaque relation est indépendante et reste identifiable.

### Comportement du produit

Scénario, ouverture de l’invitation, réglage du fuseau et de la langue, lecture de la séance du jour puis réponse courte après entraînement, éventuellement après perte du réseau.

### Reprise et mesure

Ne rien exiger pour un commentaire facultatif. Mentionner qui verra le retour. Le programme versionné et le feedback restent accessibles sans paiement athlète.

### Critères de recette associés

- **C06-01.** L’athlète ne voit que ses séances publiées
- **C06-04.** Le serveur valide entier de 0 à 10 et accepte absence de réponse
- **C06-08.** Une republication ne change pas la séance observée au moment du retour

<a id="07"></a>
## 07 · Carte des versions

**GOUVERNANCE   /   MVP**

### Contexte et usage

Le MVP est une bêta de la boucle manuelle. Must have, identité, droits, athlètes, planning, publication, retour, revue et droits des données. Les tâches apparaissent au bon moment dans l’espace de chaque rôle. Modèles simples et échanges complètent les usages fréquents.

### Comportement du produit

Après observation de la boucle, activer sous drapeau résumé et DNA déclaratif. V1 ouvre Expo, anglais et import autorisé selon le bénéfice mesuré. Paiement et stratégie commerciale démarrent après validation du produit. V2 et V3 restent guidées par les preuves.

### Reprise et mesure

L’ordre par tranches dans la roadmap prévaut sur la tentation de terminer tous les écrans d’un module avant de faire essayer le parcours. Les gates sur les accès réels restent strictes.

### Critères de recette associés

- **C01-01.** Un clone installe les versions du lockfile et compile web et paquets sans configuration privée
- **C01-04.** Une base vierge atteint la version attendue dans l’ordre du manifeste
- **C01-08.** Le build client ne contient aucune clé privée

<a id="08"></a>
## 08 · Accueil du coach

**IDENTITÉ   /   MVP**

### Contexte et usage

Le coach ouvre une session avec Supabase Auth. Le serveur valide l’identité. L’espace et le propriétaire sont créés dans une seule opération. La première action utile est l’invitation d’un athlète.

### Comportement du produit

Email en erreur ou inconnu, rendre une réponse uniforme. Lien expiré, offrir un renouvellement. Retour navigateur après déconnexion, rediriger. Si plusieurs espaces, en afficher la liste et le rôle courant.

### Reprise et mesure

Le nom de l’espace est modifiable. La création idempotente ne produit aucun rôle multiple. La date locale d’espace utilise une zone IANA valide.

### Critères de recette associés

- **C02-01.** Un compte vérifié arrive à la création d’espace sans double profil
- **C02-02.** Un lien expiré affiche une demande de renouvellement
- **C02-03.** La transaction crée à la fois espace et rôle propriétaire

<a id="09"></a>
## 09 · Acceptation de l’invitation

**IDENTITÉ   /   MVP**

### Contexte et usage

Une invitation est émise pour un dossier, une adresse vérifiable et un délai défini. Un lien consommé, révoqué ou expiré ne rattache plus de compte. L’activation dépend du quota au moment de l’acceptation.

### Comportement du produit

Si le compte connecté ne possède pas l’adresse attendue, l’athlète repart vers une authentification contrôlée. Réémettre remplace l’ancien lien. Aucune adresse brute n’apparaît dans les logs ou erreurs.

### Reprise et mesure

Le dossier devient actif avec une identité et une relation. L’athlète choisit son fuseau, sa langue et découvre sa notice avant les usages concernés.

### Critères de recette associés

- **C03-02.** Le lien est à usage unique, expire et masque le token dans les logs
- **C03-03.** Une identité avec email vérifié égal active exactement une affectation
- **C03-05.** Le dernier lien est valable et l’ancien échoue

<a id="10"></a>
## 10 · Choix d’espace et rôle

**IDENTITÉ   /   MVP**

### Contexte et usage

L’identité peut être coach ici et athlète ailleurs. Le sélecteur rend le rôle explicite. Pour chaque requête, l’espace du chemin fixe le contexte et la base décide l’accès à la date de la demande.

### Comportement du produit

Le propriétaire gère les droits de son espace et les abonnements. Lire un dossier requiert une affectation. Un coach collaborateur ne voit aucun dossier d’une équipe sans affectation. Un athlète voit ses relations et ses propres données publiées.

### Reprise et mesure

L’onglet précédent est fermé ou purgé au changement de contexte. Retour vers une relation révoquée, afficher une erreur neutre et les options autorisées.

### Critères de recette associés

- **C03-06.** Les pages par curseur restent stables avec deux noms identiques
- **C03-07.** Une recherche filtrée ne montre que les affectations légitimes
- **C03-10.** Un athlète invité dans deux espaces voit deux contextes indépendants

<a id="11"></a>
## 11 · Liste et fiches athlètes

**PORTEFEUILLE   /   MVP**

### Contexte et usage

La liste affiche nom, état, synthèse de semaine et cas ouverts. La pagination est stable pour deux noms égaux. Rechercher et filtrer sans révéler les dossiers non assignés.

### Comportement du produit

Créer une fiche avec nom et fuseau. État invited tant qu’aucune identité n’a accepté, active après activation, archived après fin. Une fiche inactive ne consomme pas la capacité d’abonnement.

### Reprise et mesure

Le détail donne accès aux séances, objectifs, notes privées et retours du dossier. À la sélection d’un athlète dans le calendrier, vérifier de nouveau les droits.

### Critères de recette associés

- **C03-01.** Un propriétaire voit la fiche créée avec état invité
- **C03-06.** Les pages par curseur restent stables avec deux noms identiques
- **C03-07.** Une recherche filtrée ne montre que les affectations légitimes

<a id="12"></a>
## 12 · Fin de relation

**PORTEFEUILLE   /   MVP**

### Contexte et usage

Un coach attribué archive après confirmation. Le système empêche les nouveaux messages, publications et séances. L’historique accessible dépend du rôle et de la politique de conservation.

### Comportement du produit

Un dossier archivé ne bloque pas une demande d’accès ou d’effacement. Le coach peut encore rapprocher une facture ou identifier le changement de statut sans consulter de données non autorisées.

### Reprise et mesure

Vérifier la concurrence archive/publication/invitation. Révoquer le traitement asynchrone qui dépend d’une affectation disparue et invalider les suggestions en cours.

### Critères de recette associés

- **C03-04.** Le lien révoqué ne peut plus relier le compte
- **C03-08.** Après archive, aucune nouvelle séance ni message ne peut être écrit dans le dossier
- **C03-10.** Un athlète invité dans deux espaces voit deux contextes indépendants

<a id="13"></a>
## 13 · Objectifs et plans

**PLANIFICATION   /   MVP**

### Contexte et usage

Un objectif daté ou non donne un contexte sportif partagé. Son état est planifié, atteint ou annulé. Un plan encadre une préparation par dates locales inclusives. Une préparation peut exister sans objectif de compétition.

### Comportement du produit

Les blocs ont un début et une fin dans les bornes du plan. Leur nom et ordre organisent la préparation sans réécrire les séances existantes. Les séances restent liées au bon athlète et espace.

### Reprise et mesure

Séparer modification du plan et accès à la prescription. Un coach peut créer un plan vide. Une plage hors bornes renvoie un contrôle localisé.

### Critères de recette associés

- **C04-02.** Une date de fin antérieure au début est refusée
- **C04-03.** Le bloc doit être contenu dans la période du plan
- **C04-06.** L’échéance peut être vide et le statut est explicite

<a id="14"></a>
## 14 · Calendrier et fuseaux

**PLANIFICATION   /   MVP**

### Contexte et usage

Stocker la date locale et la zone de la séance. Utiliser l’instant UTC pour l’audit et les événements. Les jours restent stables quand le décalage UTC évolue. Le coach voit le fuseau utilisé avant de publier.

### Comportement du produit

La semaine commence le lundi en FR et EN au lancement. Afficher cellules jour, liste accessible et navigation précédente/suivante. La fenêtre maximale de lecture du calendrier est de 42 jours.

### Reprise et mesure

Si deux séances partagent une date, conserver leur ordre puis l’identifiant. Aucune date de séance n’est dérivée arbitrairement du fuseau du navigateur.

### Critères de recette associés

- **C04-01.** Les sept dates suivent le fuseau sélectionné et restent stables lors du changement d’heure
- **C04-07.** Le coach peut créer une séance depuis la cellule du jour
- **C04-09.** La durée prévue est affichée dans la bonne unité et les données inconnues sont identifiées

<a id="15"></a>
## 15 · Création de séance

**PLANIFICATION   /   MVP**

### Contexte et usage

La séance a un sport, une date locale, un ordre, un titre et des instructions. Durée et distance restent facultatives. Une séance structurée simple porte des étapes avec durée ou distance, cible et répétitions bornées.

### Comportement du produit

Le brouillon est invisible à l’athlète. Le coach lit la version en cours et la version publiée. Modifier une séance publiée ne change pas immédiatement la prescription lue.

### Reprise et mesure

Pour valider une étape, sa cible et son unité doivent être compatibles. Présenter les sous-totaux connus et indiquer les parties manquantes. Aucune conversion implicite entre sports.

### Critères de recette associés

- **C05-04.** L’athlète voit la nouvelle révision après confirmation coach
- **C05-05.** Une séance annulée reste dans l’historique avec sa raison
- **C05-07.** Chaque étape indique valeur, unité et répétitions

<a id="16"></a>
## 16 · Publication en lot

**PLANIFICATION   /   MVP**

### Contexte et usage

Le coach affiche l’aperçu, le fuseau et 1 à 50 révisions d’un seul dossier. La confirmation sélectionne précisément les révisions à publier. Le serveur valide tout le lot avant de déplacer ses pointeurs.

### Comportement du produit

L’action refuse les doublons de séance. Si un statut ou une révision a changé, aucune ligne n’est publiée. Présenter la ligne en conflit et permettre la correction puis un nouvel envoi.

### Reprise et mesure

Notification asynchrone après commit. En replay, même clé et même lot rendent le même résultat. L’accès athlète se fonde sur le commit, indépendamment de la notification.

### Critères de recette associés

- **C05-01.** Une seule version publiée est visible après double clic
- **C05-02.** Un conflit sur une séance empêche le lot entier et désigne la ligne
- **C05-04.** L’athlète voit la nouvelle révision après confirmation coach

<a id="17"></a>
## 17 · Modification et annulation

**PLANIFICATION   /   MVP**

### Contexte et usage

Déplacer, copier ou modifier une séance crée un brouillon. Copier attribue un identifiant neuf et ne copie aucun résultat. Une modification publique passe par republication volontaire.

### Comportement du produit

Annuler exige une raison de communication courte et une révision dédiée. La séance reste identifiable dans l’historique et n’accepte pas de nouveau feedback pour une version annulée.

### Reprise et mesure

Quand un retour existant référence une version précédente, la conserver. Afficher au coach le détail des écarts et à l’athlète la version actuellement visible.

### Critères de recette associés

- **C05-03.** Le changement crée un brouillon en conservant la version lue par l’athlète
- **C05-05.** Une séance annulée reste dans l’historique avec sa raison
- **C05-06.** La copie a un nouvel ID et ne reprend aucun résultat

<a id="18"></a>
## 18 · Bibliothèque et application

**PLANIFICATION   /   MVP**

### Contexte et usage

La bibliothèque prive les modèles d’informations d’athlète. Une séance modèle contient exercices et unités. Une semaine type contient une séquence et des décalages. L’application crée de nouveaux brouillons.

### Comportement du produit

Un coach propriétaire édite ou archive son modèle. Un partage d’espace explicite peut ouvrir la copie en V2. Une séance créée reste indépendante des évolutions du modèle.

### Reprise et mesure

La prévisualisation annonce jours, unités et volume partiel. Revalider la version du modèle entre aperçu et confirmation. Aucune séance reçue par l’athlète avant publication.

### Critères de recette associés

- **C07-01.** Le modèle copie seulement contenu et unités
- **C07-04.** Les instances existantes ne changent pas
- **C07-07.** Les séances sont proposées en aperçu avant insertion

<a id="19"></a>
## 19 · Sémantique des six sports

**SPORT   /   MVP**

### Contexte et usage

Running, trail, cyclisme, natation, triathlon et duathlon font partie du référentiel. Stocker secondes et mètres. Cibles éventuelles RPE, watts, bpm ou zone adaptée. Triathlon et duathlon ont aussi des segments spécialisés.

### Comportement du produit

En MVP, une séance décrit librement les transitions et peut être créée pour chaque sport. En V2, l’ordre des segments et unités spécialisées s’affichent et se valident explicitement.

### Reprise et mesure

Le trail peut afficher un dénivelé absent distinct de zéro. Natation affiche longueurs et repos. Vélo privilégie puissance ou durée. Garder les métriques comparables par sport.

### Critères de recette associés

- **C22-01.** La limite d’imbrication est validée et les répétitions sont calculées
- **C22-03.** Les intervalles reflètent distance et repos plutôt qu’une allure course
- **C22-06.** L’enchaînement ordonne natation, vélo et course en séances liées

<a id="20"></a>
## 20 · Programme du jour

**ATHLÈTE   /   MVP**

### Contexte et usage

L’écran Aujourd’hui montre les séances publiées de la date locale, l’unité, l’ordre, le statut et le détail. En absence de séance, afficher le prochain travail si disponible.

### Comportement du produit

Le jour de repos, le silence du calendrier, une séance annulée et un chargement ne sont pas des états équivalents. Le statut est annoncé dans le texte.

### Reprise et mesure

Sur téléphone, le détail est accessible en une action depuis Aujourd’hui. Observer si l’athlète comprend sport, durée et premières consignes. Un ancien lien ouvre une explication et la version visible lorsque les droits le permettent.

### Critères de recette associés

- **C06-01.** L’athlète ne voit que ses séances publiées
- **C06-09.** La date de revue et l’acteur sont enregistrés une seule fois
- **C06-10.** Les séances annulées et passées ont des libellés distincts

<a id="21"></a>
## 21 · Saisie de feedback

**ATHLÈTE   /   MVP**

### Contexte et usage

Déclarer réalisé, partiel ou manqué avec durée, distance, RPE de 0 à 10 et commentaire facultatif. La version observée est stockée. Un retour par séance, avec révisions d’édition.

### Comportement du produit

Pour réalisé ou partiel, demander les mesures réellement connues. Pour manqué, durée et distance ne sont pas supposées. La plage et la taille sont validées côté serveur avec aide dans le formulaire.

### Reprise et mesure

Afficher la confirmation après envoi et maintenir l’édition possible. Se donner 30 secondes après prise en main pour la saisie courte. Même clé, un seul résultat. Deux appareils qui corrigent le même retour obtiennent une réponse de conflit.

### Critères de recette associés

- **C06-03.** La vue coach distingue manqué et absence de retour
- **C06-05.** Le texte respecte la taille, est rendu en texte et reste dans le dossier
- **C06-07.** La même clé crée un seul feedback après retour du réseau

<a id="22"></a>
## 22 · Historique personnel

**ATHLÈTE   /   MVP**

### Contexte et usage

L’historique reste une lecture des séances publiées et des résultats propres. Une séance révisée après réalisation garde la prescription observée dans le retour. Afficher statut et date dans les vues.

### Comportement du produit

Le détail explique si une mesure vient d’une déclaration directe ou d’un import autorisé. Sans donnée réelle, afficher non renseigné. Faire un export sur demande vérifiée.

### Reprise et mesure

Un changement de relation ou de compte purge la vue. Les données d’un autre athlète n’apparaissent jamais via pagination, recherche ou message d’erreur.

### Critères de recette associés

- **C06-06.** Une révision obsolète est rejetée avec état actuel
- **C06-08.** Une republication ne change pas la séance observée au moment du retour
- **C06-10.** Les séances annulées et passées ont des libellés distincts

<a id="23"></a>
## 23 · Fil de relation

**COMMUNICATION   /   MVP**

### Contexte et usage

Un fil par relation. Les messages sont du texte, jusqu’à 4 000 caractères, rendus sans HTML. Le coach et l’athlète sont les seuls utilisateurs du flux MVP. Pas de pièces jointes.

### Comportement du produit

Conserver ordre avec createdAt et id. Afficher non lu par curseur individuel. Le destinataire reçoit éventuellement une notification sans corps de message. Le retrait d’accès s’applique avant chaque lecture et écriture.

### Reprise et mesure

Un envoi lent reste en attente et réutilise la même clé. La lecture ne repositionne pas un curseur vers le passé.

### Critères de recette associés

- **C08-01.** Deux demandes concurrentes rendent le même fil
- **C08-04.** Le curseur de lecture avance sans régression
- **C08-08.** Un dépassement répond 429 avec délai

<a id="24"></a>
## 24 · File des retours à traiter

**REVUE   /   MVP**

### Contexte et usage

Les cas ouverts sont ordonnés par catégorie, rang, échéance, puis ID. Afficher pourquoi le cas remonte et l’état de complétude. La revue ne qualifie pas une mesure comme diagnostic.

### Comportement du produit

Le coach ouvre la source, lit le résultat et peut reporter ou clore. Reporter exige une date future. Un doublon de notification ne crée pas un second cas pour le même objet logique.

### Reprise et mesure

Le compteur suit les cas accessibles. L’absence de feedback n’équivaut pas à un manqué. Marquer un cas comme traité produit un audit sans texte libre.

### Critères de recette associés

- **C09-01.** Seuls les retours courants sans revue sont comptés
- **C09-04.** Le lien aboutit au retour source ou explique son indisponibilité
- **C09-08.** Le filtre reste actif lors du retour du détail

<a id="25"></a>
## 25 · Notes internes et continuité

**REVUE   /   MVP**

### Contexte et usage

Les notes sont attachées au dossier et à leur auteur. L’athlète, les autres coachs sans autorisation et l’IA MVP n’y accèdent pas. Définir l’usage autorisé et afficher le caractère privé dans le formulaire.

### Comportement du produit

Un coach peut retrouver son dernier contexte après retour du calendrier. La vue de revue dépend uniquement de preuves autorisées et donne un accès rapide au fil ou à la séance.

### Reprise et mesure

Champ court sans formatage, sans chargement médical dédié. Tester événements d’effacement et tolérance aux changements d’affectation lors d’une session ouverte.

### Critères de recette associés

- **C09-01.** Seuls les retours courants sans revue sont comptés
- **C09-04.** Le lien aboutit au retour source ou explique son indisponibilité
- **C09-08.** Le filtre reste actif lors du retour du détail

<a id="26"></a>
## 26 · Information et finalités

**CONFIDENTIALITÉ   /   MVP**

### Contexte et usage

La notice explique activités, destinataires, durées, droits et contact. L’identité, le planning et le feedback appartiennent à des finalités explicites. Les responsabilités sont attribuées selon le traitement réel.

### Comportement du produit

Évaluer les données de santé avant collecte ou envoi fournisseur. Les commentaires imprévus pouvant contenir du sensible, limiter leur accès, indiquer la finalité et exclure leur contenu de l’IA initiale.

### Reprise et mesure

Conserver version de notice et date. Paramétrer bases et durées après revue. Documenter les fournisseurs et vérifier routes en cas de retrait du droit.

### Critères de recette associés

- **C10-01.** La notice indique finalités et contact du responsable
- **C10-02.** La version affichée est rattachée à l’espace et à la date
- **C10-10.** Les propriétés imprévues et les textes libres sont rejetés

<a id="27"></a>
## 27 · Export et effacement

**CONFIDENTIALITÉ   /   MVP**

### Contexte et usage

Les demandes d’accès, portabilité et effacement sont liées à l’identité vérifiée et à l’espace concerné. La demande passe par une file et un responsable. Les mesures de délai suivent les obligations applicables.

### Comportement du produit

Générer le fichier côté serveur et vérifier le périmètre. Une URL courte ne suffit pas à autoriser un accès. Exclure données tierces sans droit et notes privées non portables après revue du responsable.

### Reprise et mesure

Effacer en ordre, reprendre par lot, révoquer liens, supprimer exports et invalider brouillons dépendants. Tenir un journal minimal compatible avec obligations.

### Critères de recette associés

- **C10-03.** Un accusé identifie la demande sans divulguer son contenu
- **C10-04.** L’archive ne contient aucune note privée de coach ni donnée tierce
- **C10-07.** La reprise retente les fragments échoués sans recréer les données

<a id="28"></a>
## 28 · Rétention minimale

**CONFIDENTIALITÉ   /   MVP**

### Contexte et usage

Cibles d’exploitation à valider, liens d’invitation 7 jours, export disponible 24 h, brouillons IA 90 jours, journaux techniques 30 jours, audit opérationnel 12 mois. Les obligations de facturation suivent une durée distincte.

### Comportement du produit

Le traitement d’historique sportif fermé a une durée justifiée par responsable. S’abstenir de prolonger en silence. Les sauvegardes ont une fenêtre connue et les effacements rejoués après restauration.

### Reprise et mesure

Tracer la règle et le résultat de purge. Deux réexécutions produisent le même état. Tester une restauration et l’absence de données réapparues après reprise.

### Critères de recette associés

- **C10-05.** Le téléchargement authentifié expire et est limité au demandeur
- **C10-07.** La reprise retente les fragments échoués sans recréer les données
- **C10-09.** Une tâche élimine les journaux échus sans toucher aux écritures obligatoires

<a id="29"></a>
## 29 · Contexte et provenance

**IA BÊTA   /   Après recette**

### Contexte et usage

Les faits envoyés au modèle se limitent à données directes autorisées, versions, dates, durées et RPE utiles. Exclure données Strava et dérivées, inconnues, texte libre, notes et contacts.

### Comportement du produit

Chaque fait porte ID opaque, origine, unité et révision. Le modèle ne reçoit aucune permission d’accès. Le serveur repositionne un brouillon à périmé si une preuve ou une relation change.

### Reprise et mesure

Les fixtures couvrent provenance transitivement interdite, ajout de texte hostile et format de sortie invalide. En cas de doute, rester en suivi manuel.

### Critères de recette associés

- **C11-01.** Le manifeste liste provenance et version pour tout fait transmis
- **C11-02.** Un fait inconnu ou Strava bloque sa branche de contexte
- **C11-04.** Une sortie invalide ne produit aucun brouillon

<a id="30"></a>
## 30 · Résumé hebdomadaire

**IA BÊTA   /   Après recette**

### Contexte et usage

Le coach commande un résumé de la semaine close sur un dossier affecté. Afficher nombre prévu, déclaré, manqué explicitement et inconnu. Les totaux gardent leur dénominateur et leur sport.

### Comportement du produit

Moins de deux observations, afficher insuffisant et les éléments disponibles. Une hypothèse non étayée est exclue. L’action de revue ne publie jamais un message ou une séance.

### Reprise et mesure

Contrôler génération et rendu, texte court, références distinctes et couverture. Mesurer la différence de temps entre traitement manuel et traitement avec brouillon.

### Critères de recette associés

- **C12-01.** Une semaine avec deux retours liste les faits et leur couverture
- **C12-02.** Avec trop peu de faits, le coach voit une abstention et le motif
- **C12-03.** Le calcul affiche la source et ignore les unités non comparables

<a id="31"></a>
## 31 · Validation et repli

**IA BÊTA   /   Après recette**

### Contexte et usage

Après génération, ouvrir un brouillon avec preuves affichées, version du prompt et profil utilisé. Le coach peut éditer, accepter en interne ou rejeter. Un contexte récent est requis à la décision.

### Comportement du produit

Si erreur, quota ou indisponibilité du fournisseur, l’écran précise l’état et propose la voie manuelle. Une suggestion n’affecte ni plan, ni statut athlète, ni messagerie.

### Reprise et mesure

L’acceptation traçable ne garde que les données nécessaires. Un concurrent qui change une preuve empêche validation de la version antérieure.

### Critères de recette associés

- **C12-04.** Le résumé reste réservé au coach attribué
- **C12-05.** La version éditée est visible avec auteur et horodatage
- **C12-06.** La validation conserve le contenu final et l’empreinte des preuves

<a id="32"></a>
## 32 · Fiche déclarative

**COACH DNA   /   Après recette**

### Contexte et usage

Le coach saisit philosophie, ton et règles typées de méthode. Le produit sépare style et prescriptions. Une règle a périmètre, condition et effet interne permis. Le moteur reste borné.

### Comportement du produit

Une version active par coach et espace. L’activation affiche le diff et le résultat de simulation. Le coach peut revenir à la configuration précédente en créant une version nouvelle.

### Reprise et mesure

Sans profil confirmé, utiliser un canevas générique. Une règle contradictoire ou inconnue crée une revue. Ouvrir cette fiche aux pilotes après la recette manuelle des deux rôles.

### Critères de recette associés

- **C13-01.** La première version est inactive et appartient au coach
- **C13-05.** Le résultat montre règle appliquée et raisons sans écrire au calendrier
- **C13-07.** Une seule version active subsiste même avec deux requêtes concurrentes

<a id="33"></a>
## 33 · Apprentissage candidat

**COACH DNA   /   V2**

### Contexte et usage

Le coach distingue correction stylistique, méthodologique, exception et manque de données. Une preuve non permise, une exception et une duplication restent hors corpus.

### Comportement du produit

Grouper les cas indépendants par sport, métrique et effet. Exiger le support minimal de la section 09, afficher contre-exemples, tester à blanc et décider. Accepter ouvre un draft puis action distincte pour activer.

### Reprise et mesure

Mesurer qualité par comparaison du même cas avec et sans DNA. La révocation invalide les preuves et ouvre une revue du profil si elles ont déterminé la règle.

### Critères de recette associés

- **C20-01.** L’utilisateur choisit style, méthode, cas exceptionnel ou inconnu
- **C20-03.** Seules des corrections indépendantes et éligibles sont regroupées
- **C20-06.** Deux conséquences incompatibles demandent un arbitrage

<a id="34"></a>
## 34 · Supervision graduée

**COACH DNA   /   V3**

### Contexte et usage

Le mode suggestion demeure le défaut. Supervision interne éventuelle, activée par le coach après démonstration du gain, autorise seulement des tâches réversibles et limitées par fenêtre.

### Comportement du produit

Exemples, créer un élément de revue ou regrouper une alerte. Garde-fou, le profil ne donne pas le droit de modifier un plan, envoyer un conseil ou publier. Toute règle appliquée indique provenance et heure.

### Reprise et mesure

Arrêt immédiat en désactivant le mode, quota par cas, audit et retour arrière pour chaque action interne. Tester l’arrêt avec jobs en file.

### Critères de recette associés

- **C29-01.** Le rapport distingue demandes spontanées et intentions en entretien
- **C29-04.** Le scénario estime acheteurs, coachs et échecs de mise en relation
- **C29-08.** Les permissions documentées, coûts et gains sont tracés

<a id="35"></a>
## 35 · Variations et anomalies

**IA V2   /   V2**

### Contexte et usage

Le moteur recherche incohérence de saisie, absence de preuve ou variation du ressenti par comparaison robuste. Les fenêtres et unités sont exposées. Les seuils sont des heuristiques de revue.

### Comportement du produit

Refuser l’inférence physiologique et l’agrégation de sports non comparables. Pour données faibles, afficher de quoi observer ou demander confirmation. Donner priorité à la règle déterministe.

### Reprise et mesure

Seuil de mise en service fondé sur exactitude, abstention, revue et bruit. Contrôler que le signal ne déclenche jamais d’action visible athlète.

### Critères de recette associés

- **C19-01.** Une unité différente ou un dénominateur nul déclenche abstention
- **C19-02.** Le calcul déclare fenêtre, observations manquantes et source
- **C19-03.** Le coach voit la valeur, la limite et une demande de vérification

<a id="36"></a>
## 36 · Adaptation et commentaire

**IA V2   /   V2**

### Contexte et usage

L’assistant peut expliquer un candidat borné calculé par le moteur et suggérer une formulation. Si indices de prudence ou données manquantes, demander revue. Aucun traitement ou recommandation médicale.

### Comportement du produit

Le coach voit l’avant, l’après, la preuve, la règle et l’espace. La prise de décision revalide l’état. Publication du nouveau brouillon de séance ou envoi du texte par une action explicite existante.

### Reprise et mesure

Evaluer les changements erronés, le temps d’édition, les propositions périmées et les oublis. Un nombre élevé de rejets de fond bloque l’extension du module.

### Critères de recette associés

- **C19-04.** Le brouillon est strictement basé sur les preuves et la locale
- **C19-05.** Chaque changement cite une règle et demande confirmation
- **C19-07.** Le coach voit dates, écarts et versions avant décision

<a id="37"></a>
## 37 · Checkout coach

**FACTURATION   /   Après G2**

### Contexte et usage

La vente détaillée et la facturation démarrent après validation de la boucle coach et athlète. Le propriétaire peut alors sélectionner une offre sur le Web. Un paiement réussi dans le navigateur reste une demande en cours jusqu’à ce que l’état Stripe ait été confirmé côté serveur.

### Comportement du produit

Le serveur vérifie l’événement signé, déduplique et relit Stripe. L’ordre d’arrivée ne suffit pas à établir l’état. Le portail client est réservé au propriétaire et résolu côté serveur.

### Reprise et mesure

Vérifier événement renvoyé, client inconnu, facture sans projection et changement d’offre au même instant. L’athlète ne reçoit aucune page tarifaire privée.

### Critères de recette associés

- **C15-02.** Le serveur choisit un prix autorisé et lie l’espace
- **C15-04.** Un événement échoué ne modifie aucun droit
- **C15-06.** Le worker récupère l’état courant et la vue locale converge

<a id="38"></a>
## 38 · Limites et impayés

**FACTURATION   /   Après G2**

### Contexte et usage

Le quota compte les liens actifs non archivés. Une invitation pendante ne réserve pas de place. Des acceptations simultanées se sérialisent sur l’espace. Les calculs sont visibles au propriétaire.

### Comportement du produit

Si passage à une offre inférieure au nombre actif, maintenir dossiers existants et bloquer les nouvelles activations. En cas d’impayé, délai de grâce affiché et accès coach lecture/exports après échéance.

### Reprise et mesure

Reprise de paiement remet en capacité sans recréer les dossiers. L’accès historique athlète et la récupération de données suivent la politique. Aucun effacement automatique.

### Critères de recette associés

- **C15-07.** Des acceptations simultanées ne dépassent jamais la limite contractuelle
- **C15-08.** La période de grâce est visible puis les mutations bloquées ciblées
- **C15-09.** Le dépassement conserve lectures et bloque de nouvelles activations

<a id="39"></a>
## 39 · Compagnon athlète

**EXPO   /   V1**

### Contexte et usage

L’app Expo couvre Aujourd’hui, Programme, Messages et Profil, avec la même API et le même état que le portail Web. Les droits sont lus à chaque opération. Les jetons nécessaires sont en stockage sécurisé.

### Comportement du produit

L’absence de réseau garde seulement la saisie active en mémoire. L’app ne promet pas la synchronisation hors ligne. Le cache mémoire est purgé après fermeture de session ou changement de compte.

### Reprise et mesure

Tester les liens universels, le précédent binaire, VoiceOver/TalkBack et la session expirée. Les modalités de diffusion sont revues pour la boutique concernée.

### Critères de recette associés

- **C16-01.** Le stockage sécurisé ne conserve que les jetons nécessaires
- **C16-04.** Les séances publiées sont paginées et accessibles
- **C16-08.** Un autre compte sur l’appareil ne retrouve aucune donnée privée

<a id="40"></a>
## 40 · Langues et unités

**INTERNATIONAL   /   V1**

### Contexte et usage

Le projet distingue stockage d’unité, présentation, traduction et langue choisie. FR au pilote et EN en V1. Le sportif peut choisir sa langue indépendamment de l’espace.

### Comportement du produit

Internationaliser navigation, mails, erreurs, dates, infobulles et textes accessibles. Utiliser date ISO au contrat et format local à l’affichage. Tester le séparateur décimal.

### Reprise et mesure

La préférence d’affichage n’affecte ni les seuils, ni les données sportives. La traduction de contenu libre ne s’active pas sans justification et contrôle de données.

### Critères de recette associés

- **C17-01.** Aucune clé brute n’apparaît dans les menus
- **C17-04.** Les deux langues gardent la date du portefeuille
- **C17-08.** Un libellé long n’empêche pas d’atteindre l’action

<a id="41"></a>
## 41 · Résultats de sources permises

**IMPORT   /   V1**

### Contexte et usage

CoachOS accepte les déclarations manuelles et un CSV direct autorisé après V1. Le guide précise colonnes, provenance, dates, identifiants, taille et unités. Une source inconnue ou Strava est exclue du flux.

### Comportement du produit

Prévisualiser erreurs ligne par ligne, confirmer par empreinte et écrire avec une clé de lot. Les données source sont temporaires et les données canoniques gardent leur provenance.

### Reprise et mesure

Répéter le lot sans doublons. Refuser les dates ambiguës et les valeurs des autres espaces. En annulation, conserver les lignes modifiées après l’import et les signaler.

### Critères de recette associés

- **C18-01.** Le modèle précise identifiants, date, unités et provenance acceptées
- **C18-02.** Les erreurs sont localisées ligne et colonne avant écriture
- **C18-04.** Le même lot prévisualisé produit un résultat unique après reprise

<a id="42"></a>
## 42 · Strava selon périmètre autorisé

**INTÉGRATION   /   Conditionnel**

### Contexte et usage

Le besoin historique est de réduire la saisie, mais l’accord 2026 impose des restrictions d’affichage et interdit l’usage IA direct ou dérivé. La bêta utilise la saisie et les sources directes autorisées.

### Comportement du produit

Tout pilote Strava nécessite une autorisation qui couvre précisément le parcours. État OAuth court, secrets serveur, portée minimale, stockage isolé, contrôle des quotas et révocation. Aucun transfert coach ou IA dans le périmètre par défaut.

### Reprise et mesure

Traiter révocation et purge, et maintenir le produit sans le connecteur. Une absence d’autorisation compatible arrête cette piste.

### Critères de recette associés

- **C18-07.** Une preuve datée spécifie les usages autorisés ou le drapeau reste arrêté
- **C18-08.** Les éléments rattachés deviennent inaccessibles et leur purge est tracée
- **C18-09.** Aucun objet Strava ne sort vers coach, IA, export coach ou analytics

<a id="43"></a>
## 43 · Équipe et portefeuille délégué

**CLUB   /   V2**

### Contexte et usage

Une équipe organise des dossiers déjà autorisés. Chaque délégation dit qui peut agir, à partir de quand, jusqu’à quand et sur quel dossier. Les droits de facturation sont indépendants.

### Comportement du produit

Lors du transfert de propriétaire, effectuer le passage en transaction. Lors du retrait de coach, invalider sessions métiers côté application, queues et suggestions selon les accès courants.

### Reprise et mesure

Le test contrôle que ressources publiques, étiquettes et aperçu de calendrier ne divulguent aucune affectation de tiers. Les exports d’équipe respectent les droits explicites.

### Critères de recette associés

- **C21-02.** Le rôle actif ne donne accès à aucun athlète sans affectation
- **C21-03.** Le nouveau coach peut lire uniquement la relation accordée
- **C21-04.** La prochaine requête perd accès aux athlètes et jobs associés

<a id="44"></a>
## 44 · Regroupement et fréquence

**NOTIFICATIONS   /   V2**

### Contexte et usage

Les messages transactionnels d’invitation et d’accès sont distincts des préférences de digest. Pour les notifications optionnelles, offrir réduction, désactivation et centralisation par destinataire.

### Comportement du produit

Ne pas inclure de contenu de retour, détail de séance ou fait de santé. Un lien exige une session et une nouvelle résolution des droits. Une tâche annulée ou obsolète n’envoie plus.

### Reprise et mesure

Tester doublon, préférence modifiée entre demande et envoi et téléphone révoqué. Mesurer utilité et signaux ignorés avant d’activer un nouveau canal.

### Critères de recette associés

- **C25-01.** Le coach peut passer de digest à aucun email optionnel
- **C25-04.** Le retry reprend le même identifiant et respecte le plafond
- **C25-08.** L’utilisateur voit seulement ses événements et peut les marquer lus

<a id="45"></a>
## 45 · Permissions et traçabilité

**SÛRETÉ OPÉRATIONNELLE   /   MVP**

### Contexte et usage

Toute requête reçoit un acteur et un contexte résolus côté serveur. Les jointures, identifiants et résultats sont filtrés avec RLS et contrats. La clé de serveur ne sort jamais des services privés.

### Comportement du produit

Les événements d’audit contiennent action, acteur, cible, heure et identité de requête. Les payloads transférés ne figurent ni dans le log, ni dans la métrique.

### Reprise et mesure

Un audit d’accès prouve zéro lecture hors périmètre et zéro write interdit. Couvrir anciennes sessions, changements d’état, liens partagés et usage de version périmée.

### Critères de recette associés

- **C01-01.** Un clone installe les versions du lockfile et compile web et paquets sans configuration privée
- **C01-04.** Une base vierge atteint la version attendue dans l’ordre du manifeste
- **C01-08.** Le build client ne contient aucune clé privée

<a id="46"></a>
## 46 · Capacité et dégradation

**SÛRETÉ OPÉRATIONNELLE   /   V2**

### Contexte et usage

L’architecture est dimensionnée sur 1 000 coachs et 20 000 athlètes, avec portefeuilles lourds. La concurrence porte surtout sur les lectures du lundi, la publication et les jobs.

### Comportement du produit

En dégradation, conserver programme, feedback et revue manuelle. Réduire la génération, les notifications facultatives et les opérations gourmandes avant de saturer les routes courantes.

### Reprise et mesure

Vérifier p95 et RPO/RTO avec fixture réaliste. Exécuter reprise de file, quota par espace et rendu sur réseau mobile. Mesurer d’abord avant d’augmenter la taille du serveur.

### Critères de recette associés

- **C27-01.** Les portefeuilles comprennent des pics à 300 et deux années de données synthétiques
- **C27-04.** Le burst d’un workspace ne bloque pas les autres
- **C27-08.** La décision cite CPU, plan SQL, budget et mesure avant/après

<a id="47"></a>
## 47 · Évaluer la reprise de Foulée

**MIGRATION   /   Conditionnel**

### Contexte et usage

Foulée est la première application du fondateur. Elle peut offrir une fonction existante ou des données utiles. Les usages coach et athlète guident l’interface cible. Un dépôt Foulée indisponible laisse avancer CoachOS avec un environnement neuf et des données fictives.

### Comportement du produit

Si une reprise est envisagée, examiner schéma, droits, stockage, interfaces, dette et exploitation au commit qui sera repris. Comparer chaque composant à la cible et justifier réutilisation ou adaptation par les coûts et les preuves.

### Reprise et mesure

Exiger une cartographie source et cible, un rapprochement, un second passage sans doublon et un retour arrière simulé avant import d’une cohorte réelle.

### Critères de recette associés

- **C24-01.** Les tables et versions sont liées à un export daté
- **C24-02.** Les collisions d’email ont un résultat explicite et révisable
- **C24-08.** Les écritures post bascule sont récupérées dans la simulation

<a id="48"></a>
## 48 · Mesure activation et rétention

**GOUVERNANCE   /   MVP**

### Contexte et usage

L’activation J7 mesure l’usage. Compter les espaces de la cohorte dont un athlète a accepté l’invitation, ouvert une séance publiée, envoyé un retour et dont le coach l’a traité dans la première semaine.

### Comportement du produit

Rétention coach S4, part des activés qui reviennent et traitent au moins un cas ou publient pendant la quatrième semaine. Relever également les athlètes qui ouvrent et retournent sur au moins deux semaines consécutives.

### Reprise et mesure

Tableau agrégé par cohorte, conserver effectif et semaines incomplètes. Eviter les métriques calculées depuis un texte ou un identifiant athlète dans l’analytics.

### Critères de recette associés

- **C14-02.** La fiche indique semaine, dénominateur et méthode
- **C14-05.** Le rapport identifie l’étape bloquante sans texte privé
- **C14-06.** Une raison et une date sont attachées à la cohorte

<a id="49"></a>
## 49 · Mesure du gain et de la qualité

**GOUVERNANCE   /   MVP**

### Contexte et usage

La variable centrale est le temps net du coach sur une semaine comparable, incluant délais, reprises et éditions. Relever deux semaines de référence et quatre d’usage, par coach.

### Comportement du produit

Comparer couverture des retours, heures, délais et corrections de fond. Calculer gain médian relatif et afficher dispersion et effectif. Seuil initial ≥30 % si couverture ≥90 % des cas attendus.

### Reprise et mesure

Le coût utile de l’IA est coût total des appels divisé par suggestions effectivement utiles. Un gain de temps accompagné d’oubli de suivi bloque l’ouverture.

### Critères de recette associés

- **C12-01.** Une semaine avec deux retours liste les faits et leur couverture
- **C12-08.** Les évaluateurs distinguent fait faux, oubli et préférence stylistique
- **C12-09.** Le rapport compare temps total et corrections sur les mêmes cas

<a id="50"></a>
## 50 · Scénarios commerciaux différés

**GOUVERNANCE   /   Après G2**

### Contexte et usage

Les scénarios de MRR et de marge sont des hypothèses réservées à la phase commerciale. La priorité pendant la construction est la recette des deux rôles, les usages récurrents et les coûts du pilote. Le plan exact se fonde sur ces données.

### Comportement du produit

Le modèle de base à 50/250/1 000 coachs est une hypothèse. Mesurer l’ARPA, parts des offres et charges réelles mensuelles. Suivre séparément CAC, churn et temps d’installation.

### Reprise et mesure

À budget plus élevé ou signal de faible rétention, réexaminer prix et périmètre. Afficher hypothèses contractuelles et période du rapport.

### Critères de recette associés

- **C26-03.** Le tableau sépare annulations, remboursements et MRR
- **C26-06.** Le rapport inclut IA, email, paiement et support
- **C26-10.** La décision cite marge, conversion et tickets liés au quota

<a id="51"></a>
## 51 · Marketplace et hors connexion

**EXTENSIONS   /   V3**

### Contexte et usage

Marketplace, annuaire public et paiement du coaching ne sont pas engagés. Tester demande de part et d’autre, densité par segment, coût de modération et obligations de paiement.

### Comportement du produit

Pour hors connexion avancé, valider nécessité, cache chiffré et stratégie de conflit. Une maquette suffit à mesurer le flux de demande. L’accès au programme reste disponible sur Web connecté.

### Reprise et mesure

Chaque piste possède décision et mesure. Si le besoin n’est pas démontré ou dépasse la capacité solo, la piste retourne au backlog de recherche.

### Critères de recette associés

- **C29-01.** Le rapport distingue demandes spontanées et intentions en entretien
- **C29-02.** Les coachs vérifient leur consentement et le contenu réellement public
- **C29-09.** Les essais distinguent lecture, saisie et conflits réseau

<a id="52"></a>
## 52 · Critères de sortie

**GOUVERNANCE   /   MVP**

### Contexte et usage

G0, parcours à deux rôles sur données fictives et première tranche choisie. G1, boucle manuelle et accès isolés avant bêta. G2, recette observée sur les deux interfaces et blocages corrigés avant vente. G3, preuve spécifique du gain avant extension DNA et clubs.

### Comportement du produit

La recette UX demande au coach de créer et publier une séance, puis de traiter un retour. Sur téléphone, l’athlète trouve la séance en une action et envoie un retour court. Inclure la reprise après erreur. Rapprocher les preuves, les stories et les contrats.

### Reprise et mesure

La page de clôture indique décisions ouvertes, seuils non atteints et critères du prochain sprint. Les hypothèses deviennent décisions après preuve, pas après changement de date.

### Critères de recette associés

- **C30-01.** La matrice lie stories livrées, routes et migrations
- **C30-08.** Les commandes et garde-fous référencent des versions disponibles
- **C30-10.** Les hypothèses et contraintes actualisées sont approuvées avant planification

