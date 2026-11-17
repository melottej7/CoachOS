# 10 · Backlog produit

300 stories avec description, EPIC, feature, dépendances, estimation et critère observable. Le CSV est la source d’import. Les dépendances de lot sont notées Sxx et pointent vers le livrable du sprint correspondant. Les identifiants Cxx-yy sont stables. Un ordre d’exécution sur le sprint suit aussi les préconditions indiquées dans les spécifications.

P0 = boucle core ou blocage opérationnel. P1 = gain ou qualité avant ouverture de la phase. P2 = hypothèse, confort ou extension sous gate. Chaque estimation est en jours idéaux pour un développeur. Les dates réelles nécessitent disponibilité et marge de support. Pour l’implémentation, suivre l’ordre de construction par tranche dans la roadmap. Reporter le lot Stripe après G2. Le lot de migration s’active uniquement si des données Foulée utiles sont à reprendre.

## S01 · Fondations — Environnement reproductible

| ID | Description | Priorité | Dépendances | j | Acceptation |
|---|---|---|---|---:|---|
| C01-01 | Créer le monorepo TypeScript | P0 | G0 | 2 | Un clone installe les versions du lockfile et compile web et paquets sans configuration privée |
| C01-02 | Isoler les environnements | P0 | C01-01 | 1 | Preview ne dispose d’aucun secret de production |
| C01-03 | Initialiser Supabase local | P0 | C01-01 | 1 | Un reset charge un jeu de données synthétique à deux espaces |
| C01-04 | Tracer les migrations | P0 | C01-01 | 1 | Une base vierge atteint la version attendue dans l’ordre du manifeste |
| C01-05 | Protéger la branche principale | P0 | C01-01 | 0.5 | Une PR avec typecheck en échec ne peut pas fusionner |
| C01-06 | Publier les contrats | P0 | C01-01 | 0.5 | Le générateur de types refuse un schéma incompatible avec le contrat |
| C01-07 | Installer le suivi Sentry | P0 | C01-01 | 0.5 | Une erreur de staging est corrélable par requestId sans texte athlète |
| C01-08 | Séparer les secrets | P0 | C01-01 | 0.5 | Le build client ne contient aucune clé privée |
| C01-09 | Créer une page d’état interne | P0 | C01-01 | 0.5 | Une base indisponible est signalée sans exposer le composant défaillant publiquement |
| C01-10 | Tester la restauration locale | P0 | C01-01 | 1 | Le jeu de référence restauré retrouve ses comptes et clés |

## S02 · Identité — Accès coach vérifié

| ID | Description | Priorité | Dépendances | j | Acceptation |
|---|---|---|---|---:|---|
| C02-01 | Inscrire un coach | P0 | S01 | 1 | Un compte vérifié arrive à la création d’espace sans double profil |
| C02-02 | Finaliser le lien Auth | P0 | S01 + C02-01 | 1 | Un lien expiré affiche une demande de renouvellement |
| C02-03 | Créer un espace coach | P0 | S01 + C02-01 | 1 | La transaction crée à la fois espace et rôle propriétaire |
| C02-04 | Définir le fuseau d’espace | P0 | S01 + C02-01 | 0.5 | Une zone IANA invalide reçoit une erreur de champ |
| C02-05 | Quitter la session | P0 | S01 + C02-01 | 0.5 | Retour navigateur après logout ne rend pas de portefeuille |
| C02-06 | Récupérer l’accès | P0 | S01 + C02-01 | 1 | Une réponse publique identique couvre une adresse connue et inconnue |
| C02-07 | Mettre à jour le nom d’affichage | P0 | S01 + C02-01 | 0.5 | Le changement se reflète au rechargement sans altérer le rôle |
| C02-08 | Éviter le doublon d’espace | P0 | S01 + C02-01 | 0.5 | Deux créations avec la même clé rendent le même espace |
| C02-09 | Tester les redirections | P0 | S01 + C02-01 | 0.5 | Un next externe est écarté et la page coach est utilisée |
| C02-10 | Journaliser les identités | P0 | S01 + C02-01 | 0.5 | Le journal identifie acteur et type d’opération sans jeton |

## S03 · Portefeuille — Invitation et affectation

| ID | Description | Priorité | Dépendances | j | Acceptation |
|---|---|---|---|---:|---|
| C03-01 | Créer une fiche athlète | P0 | S02 | 1 | Un propriétaire voit la fiche créée avec état invité |
| C03-02 | Inviter par email | P0 | S02 + C03-01 | 1 | Le lien est à usage unique, expire et masque le token dans les logs |
| C03-03 | Accepter une invitation | P0 | S02 + C03-01 | 1.5 | Une identité avec email vérifié égal active exactement une affectation |
| C03-04 | Révoquer une invitation | P0 | S02 + C03-01 | 0.5 | Le lien révoqué ne peut plus relier le compte |
| C03-05 | Renvoyer l’invitation | P0 | S02 + C03-01 | 0.5 | Le dernier lien est valable et l’ancien échoue |
| C03-06 | Lister le portefeuille | P0 | S02 + C03-01 | 1 | Les pages par curseur restent stables avec deux noms identiques |
| C03-07 | Rechercher un athlète | P0 | S02 + C03-01 | 0.5 | Une recherche filtrée ne montre que les affectations légitimes |
| C03-08 | Archiver une relation | P0 | S02 + C03-01 | 1 | Après archive, aucune nouvelle séance ni message ne peut être écrit dans le dossier |
| C03-09 | Faire le premier onboarding | P0 | S02 + C03-01 | 1 | L’athlète choisit langue, zone et sport sans saisir de donnée médicale |
| C03-10 | Isoler deux portefeuilles | P0 | S02 + C03-01 | 1 | Un athlète invité dans deux espaces voit deux contextes indépendants |

## S04 · Planification — Brouillons et calendrier

| ID | Description | Priorité | Dépendances | j | Acceptation |
|---|---|---|---|---:|---|
| C04-01 | Ouvrir la semaine coach | P0 | S03 | 1 | Les sept dates suivent le fuseau sélectionné et restent stables lors du changement d’heure |
| C04-02 | Créer un plan daté | P0 | S03 + C04-01 | 1 | Une date de fin antérieure au début est refusée |
| C04-03 | Ajouter un bloc | P0 | S03 + C04-01 | 0.5 | Le bloc doit être contenu dans la période du plan |
| C04-04 | Créer une séance simple | P0 | S03 + C04-01 | 1 | Le brouillon accepte un sport supporté et reste invisible à l’athlète |
| C04-05 | Déplacer un brouillon | P0 | S03 + C04-01 | 0.5 | La séance conserve sa durée et sa nouvelle date locale |
| C04-06 | Enregistrer un objectif | P0 | S03 + C04-01 | 0.5 | L’échéance peut être vide et le statut est explicite |
| C04-07 | Afficher une journée vide | P0 | S03 + C04-01 | 0.25 | Le coach peut créer une séance depuis la cellule du jour |
| C04-08 | Gérer un conflit d’édition | P0 | S03 + C04-01 | 1 | La révision périmée ne remplace aucune modification validée |
| C04-09 | Lister la charge prévue | P0 | S03 + C04-01 | 0.75 | La durée prévue est affichée dans la bonne unité et les données inconnues sont identifiées |
| C04-10 | Renommer un bloc | P0 | S03 + C04-01 | 0.5 | Le libellé change sans déplacement des séances |

## S05 · Publication — Séances visibles et versionnées

| ID | Description | Priorité | Dépendances | j | Acceptation |
|---|---|---|---|---:|---|
| C05-01 | Publier une séance | P0 | S04 | 1 | Une seule version publiée est visible après double clic |
| C05-02 | Publier une semaine | P0 | S04 + C05-01 | 1.5 | Un conflit sur une séance empêche le lot entier et désigne la ligne |
| C05-03 | Modifier une séance publiée | P0 | S04 + C05-01 | 1 | Le changement crée un brouillon en conservant la version lue par l’athlète |
| C05-04 | Republication explicite | P0 | S04 + C05-01 | 0.75 | L’athlète voit la nouvelle révision après confirmation coach |
| C05-05 | Annuler une séance | P0 | S04 + C05-01 | 1 | Une séance annulée reste dans l’historique avec sa raison |
| C05-06 | Copier une séance | P0 | S04 + C05-01 | 0.5 | La copie a un nouvel ID et ne reprend aucun résultat |
| C05-07 | Afficher les intervalles | P0 | S04 + C05-01 | 0.75 | Chaque étape indique valeur, unité et répétitions |
| C05-08 | Filtrer calendrier par statut | P0 | S04 + C05-01 | 0.5 | Brouillon, publié et annulé donnent des résultats disjoints |
| C05-09 | Afficher la prochaine séance | P0 | S04 + C05-01 | 0.75 | Une séance future est classée par date puis ordre |
| C05-10 | Conserver les révisions | P0 | S04 + C05-01 | 1 | Les éléments d’un lot publié restent reconstructibles après réédition |

## S06 · Retours — Boucle séance et ressenti

| ID | Description | Priorité | Dépendances | j | Acceptation |
|---|---|---|---|---:|---|
| C06-01 | Consulter le programme athlète | P0 | S05 | 1 | L’athlète ne voit que ses séances publiées |
| C06-02 | Déclarer une séance terminée | P0 | S05 + C06-01 | 1 | La durée réelle et l’état persistent au rechargement |
| C06-03 | Signaler une séance manquée | P0 | S05 + C06-01 | 0.5 | La vue coach distingue manqué et absence de retour |
| C06-04 | Saisir la difficulté perçue | P0 | S05 + C06-01 | 0.5 | Le serveur valide entier de 0 à 10 et accepte absence de réponse |
| C06-05 | Saisir un commentaire | P0 | S05 + C06-01 | 0.5 | Le texte respecte la taille, est rendu en texte et reste dans le dossier |
| C06-06 | Corriger un retour | P0 | S05 + C06-01 | 1 | Une révision obsolète est rejetée avec état actuel |
| C06-07 | Rejouer après réseau coupé | P0 | S05 + C06-01 | 0.75 | La même clé crée un seul feedback après retour du réseau |
| C06-08 | Lier retour à révision publiée | P0 | S05 + C06-01 | 0.5 | Une republication ne change pas la séance observée au moment du retour |
| C06-09 | Marquer un retour traité | P0 | S05 + C06-01 | 0.5 | La date de revue et l’acteur sont enregistrés une seule fois |
| C06-10 | Consulter historique personnel | P0 | S05 + C06-01 | 0.75 | Les séances annulées et passées ont des libellés distincts |

## S07 · Bibliothèque — Réutiliser des séances

| ID | Description | Priorité | Dépendances | j | Acceptation |
|---|---|---|---|---:|---|
| C07-01 | Enregistrer une séance modèle | P0 | S04 | 0.75 | Le modèle copie seulement contenu et unités |
| C07-02 | Organiser par sport | P0 | S04 + C07-01 | 0.5 | Le filtrage distingue course, trail, vélo et natation |
| C07-03 | Ajouter un modèle au calendrier | P0 | S04 + C07-01 | 0.75 | Une instance brouillon indépendante est créée |
| C07-04 | Éditer un modèle | P0 | S04 + C07-01 | 0.5 | Les instances existantes ne changent pas |
| C07-05 | Archiver un modèle | P0 | S04 + C07-01 | 0.5 | Il quitte les sélecteurs et reste présent dans les historiques pertinents |
| C07-06 | Enregistrer une semaine type | P0 | S04 + C07-01 | 1 | Les décalages relatifs et les répétitions sont conservés |
| C07-07 | Appliquer une semaine type | P0 | S04 + C07-01 | 1 | Les séances sont proposées en aperçu avant insertion |
| C07-08 | Dupliquer un bloc de plan | P0 | S04 + C07-01 | 0.75 | La cible reçoit de nouveaux identifiants et des dates valides |
| C07-09 | Afficher les volumes du modèle | P0 | S04 + C07-01 | 0.5 | Les totaux affichent explicitement les valeurs inconnues |
| C07-10 | Gérer le catalogue vide | P0 | S04 + C07-01 | 0.25 | Un raccourci mène à la création avec sport présélectionné |

## S08 · Messagerie — Échange privé minimal

| ID | Description | Priorité | Dépendances | j | Acceptation |
|---|---|---|---|---:|---|
| C08-01 | Ouvrir un fil de dossier | P0 | S03 | 1 | Deux demandes concurrentes rendent le même fil |
| C08-02 | Envoyer un message | P0 | S03 + C08-01 | 1 | La clé répétée confirme le même envoi et ne le duplique pas |
| C08-03 | Lire les messages récents | P0 | S03 + C08-01 | 0.5 | La pagination n’oublie pas les messages du même instant |
| C08-04 | Marquer un message lu | P0 | S03 + C08-01 | 0.5 | Le curseur de lecture avance sans régression |
| C08-05 | Afficher le non lu | P0 | S03 + C08-01 | 0.5 | Un nouveau message apparaît chez le destinataire uniquement |
| C08-06 | Avertir d’un nouveau message | P0 | S03 + C08-01 | 0.75 | Le courriel contient un lien de connexion sans extrait privé |
| C08-07 | Bloquer une relation archivée | P0 | S03 + C08-01 | 0.5 | La lecture historique est possible selon la politique et l’écriture échoue |
| C08-08 | Limiter le débit des envois | P0 | S03 + C08-01 | 0.5 | Un dépassement répond 429 avec délai |
| C08-09 | Afficher l’état d’envoi | P0 | S03 + C08-01 | 0.5 | Un délai indique en cours et permet de reprendre sans doublon |
| C08-10 | Lister les discussions | P0 | S03 + C08-01 | 0.75 | Le dernier message met l’ordre à jour dans le bon espace |

## S09 · Dashboard — File de revue coach

| ID | Description | Priorité | Dépendances | j | Acceptation |
|---|---|---|---|---:|---|
| C09-01 | Compter les retours à revoir | P0 | S06 | 0.75 | Seuls les retours courants sans revue sont comptés |
| C09-02 | Trier par échéance | P0 | S06 + C09-01 | 0.5 | Deux signaux de même gravité ont un ordre reproductible |
| C09-03 | Séparer manqué et inconnu | P0 | S06 + C09-01 | 0.5 | Un silence n’est pas classé comme non réalisé |
| C09-04 | Voir la raison du signal | P0 | S06 + C09-01 | 0.5 | Le lien aboutit au retour source ou explique son indisponibilité |
| C09-05 | Reporter un cas | P0 | S06 + C09-01 | 0.75 | Le cas revient à la date choisie et n’est pas effacé |
| C09-06 | Clore un cas | P0 | S06 + C09-01 | 0.75 | L’état se propage au compteur et l’acteur est horodaté |
| C09-07 | Afficher des données incomplètes | P0 | S06 + C09-01 | 0.5 | Le coach voit le dénominateur et le nombre manquant |
| C09-08 | Filtrer une cohorte | P0 | S06 + C09-01 | 0.5 | Le filtre reste actif lors du retour du détail |
| C09-09 | Exporter le décompte de la semaine | P0 | S06 + C09-01 | 0.75 | Le fichier est agrégé, sans commentaire ni nom |
| C09-10 | Mesurer le temps de revue | P0 | S06 + C09-01 | 0.5 | Les actions métier sont agrégées sans rejouer le texte du coach |

## S10 · Données personnelles — Pilotage des droits

| ID | Description | Priorité | Dépendances | j | Acceptation |
|---|---|---|---|---:|---|
| C10-01 | Afficher la notice athlète | P0 | S03 + S06 | 0.5 | La notice indique finalités et contact du responsable |
| C10-02 | Historiser la version de notice | P0 | S03 + S06 + C10-01 | 0.5 | La version affichée est rattachée à l’espace et à la date |
| C10-03 | Déposer une demande d’accès | P0 | S03 + S06 + C10-01 | 0.75 | Un accusé identifie la demande sans divulguer son contenu |
| C10-04 | Construire un export personnel | P0 | S03 + S06 + C10-01 | 1.5 | L’archive ne contient aucune note privée de coach ni donnée tierce |
| C10-05 | Signer l’accès à l’export | P0 | S03 + S06 + C10-01 | 0.75 | Le téléchargement authentifié expire et est limité au demandeur |
| C10-06 | Déposer une demande d’effacement | P0 | S03 + S06 + C10-01 | 0.75 | La demande est routée au décideur avec délai et exceptions à examiner |
| C10-07 | Effacer via tâche durable | P0 | S03 + S06 + C10-01 | 1.5 | La reprise retente les fragments échoués sans recréer les données |
| C10-08 | Déconnecter les appareils | P0 | S03 + S06 + C10-01 | 0.5 | Le compte révoqué ne réutilise pas son jeton de renouvellement |
| C10-09 | Purger les journaux | P0 | S03 + S06 + C10-01 | 0.5 | Une tâche élimine les journaux échus sans toucher aux écritures obligatoires |
| C10-10 | Vérifier absence de PII analytique | P0 | S03 + S06 + C10-01 | 0.75 | Les propriétés imprévues et les textes libres sont rejetés |

## S11 · IA fondation — Génération isolée

| ID | Description | Priorité | Dépendances | j | Acceptation |
|---|---|---|---|---:|---|
| C11-01 | Construire un contexte autorisé | P1 | S09 + S10 | 1.5 | Le manifeste liste provenance et version pour tout fait transmis |
| C11-02 | Exclure les erreurs de provenance | P1 | S09 + S10 + C11-01 | 1 | Un fait inconnu ou Strava bloque sa branche de contexte |
| C11-03 | Créer un job logique | P1 | S09 + S10 + C11-01 | 1 | Une demande identique ne débite qu’une réservation |
| C11-04 | Valider la sortie typée | P1 | S09 + S10 + C11-01 | 1 | Une sortie invalide ne produit aucun brouillon |
| C11-05 | Configurer le premier fournisseur | P1 | S09 + S10 + C11-01 | 0.75 | Le modèle est épinglé par configuration serveur et figure au journal |
| C11-06 | Gérer l’indisponibilité IA | P1 | S09 + S10 + C11-01 | 0.75 | La voie manuelle reste accessible avec un statut compréhensible |
| C11-07 | Fermer le budget IA | P1 | S09 + S10 + C11-01 | 1 | Le plafond bloque avant appel après réservation atomique |
| C11-08 | Capturer la latence et le coût | P1 | S09 + S10 + C11-01 | 0.5 | Les chiffres sont enregistrés sans texte ni identité athlète |
| C11-09 | Invalidation de contexte | P1 | S09 + S10 + C11-01 | 0.75 | Une révision modifiée rend la proposition périmée avant affichage ou validation |
| C11-10 | Construire le jeu d’évaluation | P1 | S09 + S10 + C11-01 | 1 | Les cas synthétiques couvrent données manquantes, injection et signaux de prudence |

## S12 · Assistant — Résumé bêta en brouillon

| ID | Description | Priorité | Dépendances | j | Acceptation |
|---|---|---|---|---:|---|
| C12-01 | Demander un résumé hebdomadaire | P1 | S11 | 1 | Une semaine avec deux retours liste les faits et leur couverture |
| C12-02 | Rendre l’alerte de complétude | P1 | S11 + C12-01 | 0.5 | Avec trop peu de faits, le coach voit une abstention et le motif |
| C12-03 | Comparer prévu et réalisé | P1 | S11 + C12-01 | 0.75 | Le calcul affiche la source et ignore les unités non comparables |
| C12-04 | Mettre le brouillon en revue | P1 | S11 + C12-01 | 0.75 | Le résumé reste réservé au coach attribué |
| C12-05 | Éditer le brouillon | P1 | S11 + C12-01 | 0.75 | La version éditée est visible avec auteur et horodatage |
| C12-06 | Valider une synthèse interne | P1 | S11 + C12-01 | 0.5 | La validation conserve le contenu final et l’empreinte des preuves |
| C12-07 | Rejeter une synthèse | P1 | S11 + C12-01 | 0.5 | Le motif est enregistré et la synthèse sort des brouillons à traiter |
| C12-08 | Échantillonner les erreurs | P1 | S11 + C12-01 | 1 | Les évaluateurs distinguent fait faux, oubli et préférence stylistique |
| C12-09 | Évaluer le gain | P1 | S11 + C12-01 | 0.75 | Le rapport compare temps total et corrections sur les mêmes cas |
| C12-10 | Désactiver le résumé | P1 | S11 + C12-01 | 0.25 | Le drapeau arrête les demandes et la revue historique reste accessible |

## S13 · Coach DNA — Fiche déclarative

| ID | Description | Priorité | Dépendances | j | Acceptation |
|---|---|---|---|---:|---|
| C13-01 | Créer un brouillon de profil | P1 | S11 + S12 | 0.75 | La première version est inactive et appartient au coach |
| C13-02 | Choisir un ton | P1 | S11 + S12 + C13-01 | 0.5 | Le choix est dans la liste et n’altère aucune règle métier |
| C13-03 | Saisir une préférence de progression | P1 | S11 + S12 + C13-01 | 0.75 | Une valeur hors fourchette de configuration tombe en erreur |
| C13-04 | Ajouter une règle de prudence | P1 | S11 + S12 + C13-01 | 1 | La règle est affichée avec contexte et action interne autorisée |
| C13-05 | Simuler une règle | P1 | S11 + S12 + C13-01 | 0.75 | Le résultat montre règle appliquée et raisons sans écrire au calendrier |
| C13-06 | Comparer deux versions | P1 | S11 + S12 + C13-01 | 0.75 | Le diff affiche les dimensions et règles changées |
| C13-07 | Activer une version | P1 | S11 + S12 + C13-01 | 1 | Une seule version active subsiste même avec deux requêtes concurrentes |
| C13-08 | Revenir à un profil précédent | P1 | S11 + S12 + C13-01 | 0.75 | Le retour active une nouvelle révision de la configuration précédente |
| C13-09 | Épingler la version au brouillon | P1 | S11 + S12 + C13-01 | 0.5 | Une nouvelle version du profil ne réécrit pas la preuve d’une ancienne suggestion |
| C13-10 | Désactiver la personnalisation | P1 | S11 + S12 + C13-01 | 0.5 | Le mode générique conserve la revue et les garde-fous |

## S14 · Bêta — Valider la boucle coach

| ID | Description | Priorité | Dépendances | j | Acceptation |
|---|---|---|---|---:|---|
| C14-01 | Créer une cohorte manuelle | P1 | S06 + S08 + S09 + S10 + S12 + S13 | 0.5 | Chaque espace autorisé accède aux drapeaux dédiés |
| C14-02 | Enregistrer la référence de temps | P1 | S06 + S08 + S09 + S10 + S12 + S13 + C14-01 | 0.5 | La fiche indique semaine, dénominateur et méthode |
| C14-03 | Limiter le pilote | P1 | S06 + S08 + S09 + S10 + S12 + S13 + C14-01 | 0.5 | Un espace externe n’accède pas aux fonctionnalités de bêta |
| C14-04 | Donner un guide de démarrage | P1 | S06 + S08 + S09 + S10 + S12 + S13 + C14-01 | 0.5 | Le coach peut accomplir invite, publication et feedback sans aide |
| C14-05 | Tracer les échecs d’activation | P1 | S06 + S08 + S09 + S10 + S12 + S13 + C14-01 | 0.75 | Le rapport identifie l’étape bloquante sans texte privé |
| C14-06 | Recueillir les abandons | P1 | S06 + S08 + S09 + S10 + S12 + S13 + C14-01 | 0.5 | Une raison et une date sont attachées à la cohorte |
| C14-07 | Simuler un incident | P1 | S06 + S08 + S09 + S10 + S12 + S13 + C14-01 | 1 | Le runbook indique délai de détection, responsable et restauration |
| C14-08 | Contrôler l’accessibilité du flux | P1 | S06 + S08 + S09 + S10 + S12 + S13 + C14-01 | 0.75 | Le parcours complet clavier et lecteur d’écran fonctionne sur le web |
| C14-09 | Faire la revue pilote | P1 | S06 + S08 + S09 + S10 + S12 + S13 + C14-01 | 0.75 | Le rapport expose gain, incidents, dispersion et décision |
| C14-10 | Suspendre sans perdre les données | P1 | S06 + S08 + S09 + S10 + S12 + S13 + C14-01 | 0.5 | Les fonctions IA bêta s’arrêtent et la boucle manuelle reste opérationnelle |

## S15 · Facturation — Abonnement coach

| ID | Description | Priorité | Dépendances | j | Acceptation |
|---|---|---|---|---:|---|
| C15-01 | Afficher les offres HT | P0 | S14 | 0.5 | Les limites d’athlètes et frais sont lisibles sur le Web coach |
| C15-02 | Créer une session Checkout | P0 | S14 + C15-01 | 1 | Le serveur choisit un prix autorisé et lie l’espace |
| C15-03 | Ouvrir le portail Stripe | P0 | S14 + C15-01 | 0.75 | Seul le propriétaire voit son portail pour le bon client |
| C15-04 | Vérifier la signature Stripe | P0 | S14 + C15-01 | 0.75 | Un événement échoué ne modifie aucun droit |
| C15-05 | Dédupliquer les événements | P0 | S14 + C15-01 | 1 | Le même event ID est acquitté une fois sans double effet |
| C15-06 | Réconcilier hors ordre | P0 | S14 + C15-01 | 1.5 | Le worker récupère l’état courant et la vue locale converge |
| C15-07 | Vérifier le quota | P0 | S14 + C15-01 | 1 | Des acceptations simultanées ne dépassent jamais la limite contractuelle |
| C15-08 | Gérer un impayé | P0 | S14 + C15-01 | 0.75 | La période de grâce est visible puis les mutations bloquées ciblées |
| C15-09 | Gérer une baisse de formule | P0 | S14 + C15-01 | 0.75 | Le dépassement conserve lectures et bloque de nouvelles activations |
| C15-10 | Inclure les factures | P0 | S14 + C15-01 | 0.5 | Le propriétaire ouvre la facture via le fournisseur et l’athlète ne la voit jamais |

## S16 · Mobile — Expo lecture et feedback

| ID | Description | Priorité | Dépendances | j | Acceptation |
|---|---|---|---|---:|---|
| C16-01 | Établir la session Expo | P1 | S06 + S08 + S14 | 1 | Le stockage sécurisé ne conserve que les jetons nécessaires |
| C16-02 | Ouvrir un lien d’invitation | P1 | S06 + S08 + S14 + C16-01 | 1 | Le lien validé ouvre l’espace et reprend après connexion |
| C16-03 | Afficher Aujourd’hui | P1 | S06 + S08 + S14 + C16-01 | 1 | Les séances du jour s’affichent dans le fuseau explicite |
| C16-04 | Consulter le calendrier Expo | P1 | S06 + S08 + S14 + C16-01 | 0.75 | Les séances publiées sont paginées et accessibles |
| C16-05 | Saisir le feedback Expo | P1 | S06 + S08 + S14 + C16-01 | 1 | Une déconnexion réseau montre une reprise explicite sans perte de la saisie active |
| C16-06 | Voir les messages Expo | P1 | S06 + S08 + S14 + C16-01 | 0.75 | Seule la relation active peut envoyer et le fil reste trié |
| C16-07 | Gérer la perte de session | P1 | S06 + S08 + S14 + C16-01 | 0.5 | Les écrans privés se ferment et la reconnexion est proposée |
| C16-08 | Vider le cache au logout | P1 | S06 + S08 + S14 + C16-01 | 0.5 | Un autre compte sur l’appareil ne retrouve aucune donnée privée |
| C16-09 | Relire les métadonnées stores | P1 | S06 + S08 + S14 + C16-01 | 0.5 | Les captures ne comportent aucune donnée réelle ou lien d’achat |
| C16-10 | Contrôler le contrat ancien client | P1 | S06 + S08 + S14 + C16-01 | 0.75 | Le précédent binaire supporte les nouveaux champs additionnels |

## S17 · Internationalisation — FR et EN

| ID | Description | Priorité | Dépendances | j | Acceptation |
|---|---|---|---|---:|---|
| C17-01 | Externaliser la navigation | P1 | S16 | 0.5 | Aucune clé brute n’apparaît dans les menus |
| C17-02 | Traduire les erreurs | P1 | S16 + C17-01 | 0.5 | Le même code de validation a un libellé FR et EN |
| C17-03 | Formater les unités | P1 | S16 + C17-01 | 0.75 | Le stockage est SI et les conversions d’affichage respectent la préférence |
| C17-04 | Formater les dates | P1 | S16 + C17-01 | 0.5 | Les deux langues gardent la date du portefeuille |
| C17-05 | Choisir la langue manuellement | P1 | S16 + C17-01 | 0.5 | Le choix persiste et ne change pas les données sportives |
| C17-06 | Traduire les emails | P1 | S16 + C17-01 | 0.75 | Invitation et changement de statut partent dans la langue du destinataire |
| C17-07 | Traduire les textes d’accessibilité | P1 | S16 + C17-01 | 0.5 | Les champs et contrôles sont annoncés dans la langue choisie |
| C17-08 | Contrôler les textes longs | P1 | S16 + C17-01 | 0.5 | Un libellé long n’empêche pas d’atteindre l’action |
| C17-09 | Adapter le format de saisie | P1 | S16 + C17-01 | 0.75 | La virgule décimale française et le point anglais suivent la locale |
| C17-10 | Contrôler le glossaire | P1 | S16 + C17-01 | 0.5 | Les noms des six sports et statuts sont cohérents dans les deux apps |

## S18 · Intégrations — Import utilisable sans Strava

| ID | Description | Priorité | Dépendances | j | Acceptation |
|---|---|---|---|---:|---|
| C18-01 | Télécharger un exemple CSV | P1 | S03 + S06 + S10 | 0.5 | Le modèle précise identifiants, date, unités et provenance acceptées |
| C18-02 | Prévisualiser un import | P1 | S03 + S06 + S10 + C18-01 | 1 | Les erreurs sont localisées ligne et colonne avant écriture |
| C18-03 | Importer les lignes valides | P1 | S03 + S06 + S10 + C18-01 | 1 | Le lot est confirmé après aperçu et chaque ligne conserve une provenance |
| C18-04 | Dédupliquer une pièce importée | P1 | S03 + S06 + S10 + C18-01 | 0.75 | Le même lot prévisualisé produit un résultat unique après reprise |
| C18-05 | Traiter une date non valide | P1 | S03 + S06 + S10 + C18-01 | 0.5 | Une heure ambiguë exige une désambiguïsation et ne déplace rien |
| C18-06 | Annuler un lot récent | P1 | S03 + S06 + S10 + C18-01 | 1 | Les lignes modifiées ensuite sont signalées au lieu d’être supprimées |
| C18-07 | Valider l’accord Strava | P2 | S03 + S06 + S10 + C18-01 | 0.75 | Une preuve datée spécifie les usages autorisés ou le drapeau reste arrêté |
| C18-08 | Simuler révocation Strava | P2 | S03 + S06 + S10 + C18-01 | 1 | Les éléments rattachés deviennent inaccessibles et leur purge est tracée |
| C18-09 | Vérifier les circuits interdits | P1 | S03 + S06 + S10 + C18-01 | 1 | Aucun objet Strava ne sort vers coach, IA, export coach ou analytics |
| C18-10 | Collecter la demande d’intégration | P1 | S03 + S06 + S10 + C18-01 | 0.5 | La mesure indique les coachs bloqués et l’impact sur l’activation |

## S19 · Assistant avancé — Recommandations explicables

| ID | Description | Priorité | Dépendances | j | Acceptation |
|---|---|---|---|---:|---|
| C19-01 | Calculer les ruptures de série | P2 | S12 + S13 | 0.75 | Une unité différente ou un dénominateur nul déclenche abstention |
| C19-02 | Calculer une tendance de ressenti | P2 | S12 + S13 + C19-01 | 0.75 | Le calcul déclare fenêtre, observations manquantes et source |
| C19-03 | Détecter une incohérence de saisie | P2 | S12 + S13 + C19-01 | 0.75 | Le coach voit la valeur, la limite et une demande de vérification |
| C19-04 | Générer un commentaire | P2 | S12 + S13 + C19-01 | 0.75 | Le brouillon est strictement basé sur les preuves et la locale |
| C19-05 | Proposer un décalage limité | P2 | S12 + S13 + C19-01 | 1 | Chaque changement cite une règle et demande confirmation |
| C19-06 | Bloquer la proposition si prudence | P2 | S12 + S13 + C19-01 | 0.75 | Un signal de prudence route le cas en suivi humain |
| C19-07 | Comparer avant/après | P2 | S12 + S13 + C19-01 | 0.75 | Le coach voit dates, écarts et versions avant décision |
| C19-08 | Regénérer sur nouvelles preuves | P2 | S12 + S13 + C19-01 | 0.75 | La proposition rendue valide diffère par fiche de contexte récente |
| C19-09 | Mesurer les rejets de fond | P2 | S12 + S13 + C19-01 | 0.5 | Le taux distingue manque de preuves et erreur de règle |
| C19-10 | Permettre un kill switch module | P2 | S12 + S13 + C19-01 | 0.5 | Le module arrêté ne crée pas de nouveaux brouillons |

## S20 · Coach DNA — Apprentissage supervisé

| ID | Description | Priorité | Dépendances | j | Acceptation |
|---|---|---|---|---:|---|
| C20-01 | Classer une correction | P2 | S13 + S19 | 0.75 | L’utilisateur choisit style, méthode, cas exceptionnel ou inconnu |
| C20-02 | Refuser l’apprentissage d’un cas | P2 | S13 + S19 + C20-01 | 0.5 | Une exception n’alimente aucune règle candidate |
| C20-03 | Former un groupe de corrections | P2 | S13 + S19 + C20-01 | 1 | Seules des corrections indépendantes et éligibles sont regroupées |
| C20-04 | Proposer une règle bornée | P2 | S13 + S19 + C20-01 | 1 | La candidate indique sport, condition, effet, preuves et limites |
| C20-05 | Tester la candidate à blanc | P2 | S13 + S19 + C20-01 | 1 | Les résultats historiques sont comparés sans écriture |
| C20-06 | Détecter une contradiction | P2 | S13 + S19 + C20-01 | 0.75 | Deux conséquences incompatibles demandent un arbitrage |
| C20-07 | Rejeter une généralisation | P2 | S13 + S19 + C20-01 | 0.5 | La candidate est close et le motif est tracé |
| C20-08 | Supprimer une preuve révoquée | P2 | S13 + S19 + C20-01 | 0.75 | Les candidates liées sont invalidées et recalculées si autorisées |
| C20-09 | Mesurer le bénéfice DNA | P2 | S13 + S19 + C20-01 | 0.75 | Le rapport compare temps d’édition et erreurs à la version générique |
| C20-10 | Auditer un changement de règle | P2 | S13 + S19 + C20-01 | 0.5 | L’acteur, les preuves permises et la version sont consultables |

## S21 · Clubs — Cohorte multi coach

| ID | Description | Priorité | Dépendances | j | Acceptation |
|---|---|---|---|---:|---|
| C21-01 | Créer une équipe | P2 | S03 + S10 + S15 | 0.75 | Une équipe ne change pas les permissions des athlètes |
| C21-02 | Inviter un coach collaborateur | P2 | S03 + S10 + S15 + C21-01 | 1 | Le rôle actif ne donne accès à aucun athlète sans affectation |
| C21-03 | Attribuer un athlète | P2 | S03 + S10 + S15 + C21-01 | 1 | Le nouveau coach peut lire uniquement la relation accordée |
| C21-04 | Retirer un coach | P2 | S03 + S10 + S15 + C21-01 | 1 | La prochaine requête perd accès aux athlètes et jobs associés |
| C21-05 | Partager un modèle approuvé | P2 | S03 + S10 + S15 + C21-01 | 0.75 | Les coachs membres peuvent copier un modèle partagé explicitement |
| C21-06 | Distinguer propriétaire et coach | P2 | S03 + S10 + S15 + C21-01 | 0.75 | Un coach collaborateur ne peut jamais lancer Checkout |
| C21-07 | Filtrer la charge par équipe | P2 | S03 + S10 + S15 + C21-01 | 0.75 | Les résultats excluent les athlètes non affectés |
| C21-08 | Traiter une délégation temporaire | P2 | S03 + S10 + S15 + C21-01 | 0.75 | Le droit cesse à la date d’expiration prévue |
| C21-09 | Voir l’historique d’affectation | P2 | S03 + S10 + S15 + C21-01 | 0.75 | L’événement identifie auteur et cible sans exposer les termes privés |
| C21-10 | Départ d’un propriétaire | P2 | S03 + S10 + S15 + C21-01 | 1 | Le transfert se fait en une transaction avec un successeur autorisé |

## S22 · Séances avancées — Endurance multisport

| ID | Description | Priorité | Dépendances | j | Acceptation |
|---|---|---|---|---:|---|
| C22-01 | Éditer étapes répétées | P2 | S05 + S07 | 1 | La limite d’imbrication est validée et les répétitions sont calculées |
| C22-02 | Ajouter une séance vélo puissance | P2 | S05 + S07 + C22-01 | 0.75 | Les watts sont stockés et affichés séparément de la fréquence cardiaque |
| C22-03 | Ajouter une séance natation en mètres | P2 | S05 + S07 + C22-01 | 0.75 | Les intervalles reflètent distance et repos plutôt qu’une allure course |
| C22-04 | Estimer allure course | P2 | S05 + S07 + C22-01 | 0.75 | L’allure min/km n’est calculée que pour distance et temps positifs |
| C22-05 | Afficher dénivelé trail | P2 | S05 + S07 + C22-01 | 0.5 | Un dénivelé absent est distinct de zéro |
| C22-06 | Planifier une transition triathlon | P2 | S05 + S07 + C22-01 | 0.75 | L’enchaînement ordonne natation, vélo et course en séances liées |
| C22-07 | Planifier une transition duathlon | P2 | S05 + S07 + C22-01 | 0.75 | Les deux segments course restent distincts |
| C22-08 | Présenter la charge par sport | P2 | S05 + S07 + C22-01 | 0.75 | L’agrégation ne mélange pas des métriques incompatibles |
| C22-09 | Décaler une série de brouillons | P2 | S05 + S07 + C22-01 | 1 | Les dates sont prévisualisées et aucun publié ne bouge sans republication |
| C22-10 | Comparer modèle et prescription | P2 | S05 + S07 + C22-01 | 0.5 | Les différences de durée, cible et répétitions sont lisibles |

## S23 · Exploitation — Résilience et coûts

| ID | Description | Priorité | Dépendances | j | Acceptation |
|---|---|---|---|---:|---|
| C23-01 | Mesurer la latence API | P2 | S11 + S15 | 0.75 | Le p95 par route est disponible pour la charge de référence |
| C23-02 | Éprouver le fan-out notifications | P2 | S11 + S15 + C23-01 | 1 | Un même idempotency key n’envoie qu’un email après reprise |
| C23-03 | Mettre en quarantaine un job | P2 | S11 + S15 + C23-01 | 0.75 | Les échecs permanents sortent de la file et sont consultables sans payload sensible |
| C23-04 | Rejouer un job isolé | P2 | S11 + S15 + C23-01 | 0.75 | Le rejouer reprend l’identifiant logique et applique les droits actuels |
| C23-05 | Désactiver la capture sensible | P2 | S11 + S15 + C23-01 | 0.5 | Le replay et les corps de requête sont absents des écrans privés |
| C23-06 | Alerter sur les coûts | P2 | S11 + S15 + C23-01 | 0.5 | Un dépassement du seuil mensuel crée une alerte sans texte athlète |
| C23-07 | Restaurer un snapshot staging | P2 | S11 + S15 + C23-01 | 1 | RTO et RPO mesurés sont comparés aux objectifs |
| C23-08 | Documenter un rollback Web | P2 | S11 + S15 + C23-01 | 0.5 | Le binaire précédemment validé fonctionne avec le schéma courant |
| C23-09 | Créer un tableau SLO | P2 | S11 + S15 + C23-01 | 0.75 | Les échecs client et fournisseur sont séparés pour la boucle |
| C23-10 | Fixer les limites DB | P2 | S11 + S15 + C23-01 | 0.75 | Un plan de test montre pagination bornée et pool sans saturation |

## S24 · Migration — Pilote Foulée

| ID | Description | Priorité | Dépendances | j | Acceptation |
|---|---|---|---|---:|---|
| C24-01 | Figurer le schéma Foulée réel | P2 | S03 + S05 + S10 + S23 | 1 | Les tables et versions sont liées à un export daté |
| C24-02 | Cartographier les identités | P2 | S03 + S05 + S10 + S23 + C24-01 | 1 | Les collisions d’email ont un résultat explicite et révisable |
| C24-03 | Reprendre la planification historique | P2 | S03 + S05 + S10 + S23 + C24-01 | 1 | Les dates de changement d’heure et séances publiées sont rapprochées |
| C24-04 | Détecter les orphelins | P2 | S03 + S05 + S10 + S23 + C24-01 | 0.75 | Les lignes orphelines restent en quarantaine avec raison |
| C24-05 | Rejouer le lot de migration | P2 | S03 + S05 + S10 + S23 + C24-01 | 1 | Les IDs et décomptes sont inchangés au second passage |
| C24-06 | Dresser la preuve de réutilisation | P2 | S03 + S05 + S10 + S23 + C24-01 | 0.75 | Le tableau lie composant, commit, adaptation et tests |
| C24-07 | Comparer les permissions | P2 | S03 + S05 + S10 + S23 + C24-01 | 1 | Les fixtures d’accès conservent les droits attendus et aucun accès supplémentaire |
| C24-08 | Tester le retour arrière | P2 | S03 + S05 + S10 + S23 + C24-01 | 1 | Les écritures post bascule sont récupérées dans la simulation |
| C24-09 | Préparer les communications pilote | P2 | S03 + S05 + S10 + S23 + C24-01 | 0.5 | Le texte explique action, date, impact et accès historiques |
| C24-10 | Obtenir la décision de bascule | P2 | S03 + S05 + S10 + S23 + C24-01 | 0.5 | Le rapport de rapprochement et ses signatures sont renseignés |

## S25 · Notifications — Préférences et regroupement

| ID | Description | Priorité | Dépendances | j | Acceptation |
|---|---|---|---|---:|---|
| C25-01 | Choisir la fréquence | P2 | S08 + S16 + S23 | 0.5 | Le coach peut passer de digest à aucun email optionnel |
| C25-02 | Programmer un digest | P2 | S08 + S16 + S23 + C25-01 | 0.75 | Le job utilise un fuseau explicite et s’exécute une fois par fenêtre |
| C25-03 | Signaler un message non livré | P2 | S08 + S16 + S23 + C25-01 | 0.75 | Le support voit un état technique sans contenu du message |
| C25-04 | Renvoyer un courriel autorisé | P2 | S08 + S16 + S23 + C25-01 | 0.5 | Le retry reprend le même identifiant et respecte le plafond |
| C25-05 | S’abonner au push | P2 | S08 + S16 + S23 + C25-01 | 0.75 | Le jeton est associé au compte et effacé à la révocation |
| C25-06 | Désactiver le push | P2 | S08 + S16 + S23 + C25-01 | 0.5 | Aucune alerte optionnelle nouvelle n’est envoyée à l’appareil |
| C25-07 | Limiter les rappels répétés | P2 | S08 + S16 + S23 + C25-01 | 0.75 | Un cas ne produit qu’un rappel par fenêtre |
| C25-08 | Afficher le centre de notifications | P2 | S08 + S16 + S23 + C25-01 | 0.75 | L’utilisateur voit seulement ses événements et peut les marquer lus |
| C25-09 | Traduire les liens d’alertes | P2 | S08 + S16 + S23 + C25-01 | 0.5 | Le lien ouvre le bon écran ou un accès retiré explicite |
| C25-10 | Mesurer les alertes utiles | P2 | S08 + S16 + S23 + C25-01 | 0.5 | Le rapport compte ouvertes, ignorées et corrigées |

## S26 · Facturation — Consolidation commerciale

| ID | Description | Priorité | Dépendances | j | Acceptation |
|---|---|---|---|---:|---|
| C26-01 | Afficher le nombre facturable | P2 | S15 + S23 | 0.5 | Le propriétaire voit actifs, limite et date de mesure |
| C26-02 | Régler la période de grâce | P2 | S15 + S23 + C26-01 | 0.75 | L’échéance est configurable et la restauration d’accès est idempotente |
| C26-03 | Réconcilier les remboursements | P2 | S15 + S23 + C26-01 | 0.75 | Le tableau sépare annulations, remboursements et MRR |
| C26-04 | Exporter le rapprochement | P2 | S15 + S23 + C26-01 | 0.75 | Les montants en centimes correspondent aux objets Stripe |
| C26-05 | Mettre à jour un prix | P2 | S15 + S23 + C26-01 | 0.75 | Les anciens abonnés conservent leur prix tant que l’offre n’est pas changée |
| C26-06 | Mesurer le coût par cohorte | P2 | S15 + S23 + C26-01 | 0.75 | Le rapport inclut IA, email, paiement et support |
| C26-07 | Afficher une facture indisponible | P2 | S15 + S23 + C26-01 | 0.5 | La page montre un état de reprise non bloquant |
| C26-08 | Informer avant résiliation | P2 | S15 + S23 + C26-01 | 0.5 | Date d’effet et disponibilité de l’export sont visibles |
| C26-09 | Tester programme ambassadeur | P2 | S15 + S23 + C26-01 | 0.75 | Le lien campagne attribue un coach payant vérifié une seule fois |
| C26-10 | Réviser les limites d’offres | P2 | S15 + S23 + C26-01 | 0.5 | La décision cite marge, conversion et tickets liés au quota |

## S27 · Échelle — Capacité 1000/20000

| ID | Description | Priorité | Dépendances | j | Acceptation |
|---|---|---|---|---:|---|
| C27-01 | Créer un jeu 1000/20000 | P2 | S21 + S23 + S26 | 1 | Les portefeuilles comprennent des pics à 300 et deux années de données synthétiques |
| C27-02 | Rejouer le pic du lundi | P2 | S21 + S23 + S26 + C27-01 | 1 | La mesure reproduit lectures, publications et notifications concurrentes |
| C27-03 | Examiner les index critiques | P2 | S21 + S23 + S26 + C27-01 | 0.75 | Les plans d’exécution utilisent les clés de rattachement prévues |
| C27-04 | Isoler les budgets par espace | P2 | S21 + S23 + S26 + C27-01 | 0.75 | Le burst d’un workspace ne bloque pas les autres |
| C27-05 | Limiter les traitements simultanés | P2 | S21 + S23 + S26 + C27-01 | 0.75 | Une saturation IA retarde ses jobs sans bloquer la saisie |
| C27-06 | Vérifier le bac résiduel | P2 | S21 + S23 + S26 + C27-01 | 0.75 | Le rapport mesure stockage, sauvegardes et croissance par mois |
| C27-07 | Découper les publications lourdes | P2 | S21 + S23 + S26 + C27-01 | 0.75 | L’aperçu annonce la taille et chaque lot respecte l’atomicité documentée |
| C27-08 | Évaluer une montée de compute | P2 | S21 + S23 + S26 + C27-01 | 0.5 | La décision cite CPU, plan SQL, budget et mesure avant/après |
| C27-09 | Vérifier la récupération partielle | P2 | S21 + S23 + S26 + C27-01 | 0.75 | La reprise récupère l’ordre métier après redémarrage d’un worker |
| C27-10 | Éprouver la proximité d’hébergement | P2 | S21 + S23 + S26 + C27-01 | 0.5 | La latence mesurée est acceptable depuis les régions de lancement |

## S28 · Marché — Répéter les canaux

| ID | Description | Priorité | Dépendances | j | Acceptation |
|---|---|---|---|---:|---|
| C28-01 | Attribuer LinkedIn | P2 | S14 + S15 + S26 | 0.5 | Une campagne et une cohorte relient démo, activation et paiement |
| C28-02 | Publier une démonstration YouTube | P2 | S14 + S15 + S26 + C28-01 | 0.75 | La vidéo utilise des données synthétiques et mène au flux d’essai |
| C28-03 | Tester une page sport | P2 | S14 + S15 + S26 + C28-01 | 0.75 | La page annonce le périmètre exact et capture la demande |
| C28-04 | Tester un webinar club | P2 | S14 + S15 + S26 + C28-01 | 0.75 | Le rapport compte participants pilotes et activation distinctement |
| C28-05 | Qualifier des ambassadeurs | P2 | S14 + S15 + S26 + C28-01 | 0.5 | Les critères exigent usage actif et autorisation du témoignage |
| C28-06 | Attribuer un partenaire | P2 | S14 + S15 + S26 + C28-01 | 0.5 | La source est mesurée sans transmettre les profils athlètes |
| C28-07 | Calculer les douze cohortes | P2 | S14 + S15 + S26 + C28-01 | 0.75 | Les échantillons et mois incomplets sont signalés |
| C28-08 | Suivre le prix testé | P2 | S14 + S15 + S26 + C28-01 | 0.5 | Les versions des offres apparaissent dans le rapport de conversion |
| C28-09 | Calculer le délai de retour CAC | P2 | S14 + S15 + S26 + C28-01 | 0.75 | La formule tient compte de la contribution et du coût fondateur |
| C28-10 | Arrêter un canal inefficace | P2 | S14 + S15 + S26 + C28-01 | 0.5 | Le critère de coupure est mesuré et la décision datée |

## S29 · Extensions — Décider les paris V3

| ID | Description | Priorité | Dépendances | j | Acceptation |
|---|---|---|---|---:|---|
| C29-01 | Mesurer les demandes côté coach | P2 | S20 + S21 + S27 + S28 | 0.5 | Le rapport distingue demandes spontanées et intentions en entretien |
| C29-02 | Tester l’annuaire sur maquette | P2 | S20 + S21 + S27 + S28 + C29-01 | 0.75 | Les coachs vérifient leur consentement et le contenu réellement public |
| C29-03 | Évaluer les opérations de paiement | P2 | S20 + S21 + S27 + S28 + C29-01 | 1 | Une note couvre KYC, remboursement, litiges et responsabilité |
| C29-04 | Simuler la densité locale | P2 | S20 + S21 + S27 + S28 + C29-01 | 0.75 | Le scénario estime acheteurs, coachs et échecs de mise en relation |
| C29-05 | Tester l’activation supervisée | P2 | S20 + S21 + S27 + S28 + C29-01 | 0.75 | La simulation n’écrit que des tâches internes réversibles |
| C29-06 | Consigner l’opt-in de supervision | P2 | S20 + S21 + S27 + S28 + C29-01 | 0.75 | La fonction est inactive par défaut et désactivable immédiatement |
| C29-07 | Simuler la cadence d’automatisation | P2 | S20 + S21 + S27 + S28 + C29-01 | 0.75 | Quota et conditions d’arrêt s’appliquent au même cas à répétition |
| C29-08 | Évaluer un second connecteur | P2 | S20 + S21 + S27 + S28 + C29-01 | 0.75 | Les permissions documentées, coûts et gains sont tracés |
| C29-09 | Mesurer l’usage hors connexion | P2 | S20 + S21 + S27 + S28 + C29-01 | 0.5 | Les essais distinguent lecture, saisie et conflits réseau |
| C29-10 | Rendre une décision V3 | P2 | S20 + S21 + S27 + S28 + C29-01 | 0.5 | Chaque piste ouvre un travail chiffré ou reste hors engagement |

## S30 · Release — Préparer le cycle suivant

| ID | Description | Priorité | Dépendances | j | Acceptation |
|---|---|---|---|---:|---|
| C30-01 | Comparer les docs applicables | P2 | S24 + S27 + S28 + S29 | 0.75 | La matrice lie stories livrées, routes et migrations |
| C30-02 | Vérifier les regressions horizontales | P2 | S24 + S27 + S28 + S29 + C30-01 | 1 | Échec, retries et accès tiers sont vérifiés sur les flux impactés |
| C30-03 | Auditer la rétention réelle | P2 | S24 + S27 + S28 + S29 + C30-01 | 0.75 | Les délais effectifs sont rapprochés de l’inventaire |
| C30-04 | Calculer la marge réelle | P2 | S24 + S27 + S28 + S29 + C30-01 | 0.75 | Le rapport inclut les factures fournisseurs et le temps de support |
| C30-05 | Compiler les incidents | P2 | S24 + S27 + S28 + S29 + C30-01 | 0.75 | Chaque incident dispose d’une cause, action et mesure d’efficacité |
| C30-06 | Prioriser la dette | P2 | S24 + S27 + S28 + S29 + C30-01 | 0.75 | La liste relie sévérité, effort et risque utilisateur |
| C30-07 | Réviser les versions supportées | P2 | S24 + S27 + S28 + S29 + C30-01 | 0.5 | Les clients et migrations incompatibles ont un plan de dépréciation |
| C30-08 | Vérifier le kit de rollback | P2 | S24 + S27 + S28 + S29 + C30-01 | 0.75 | Les commandes et garde-fous référencent des versions disponibles |
| C30-09 | Clore les expérimentations | P2 | S24 + S27 + S28 + S29 + C30-01 | 0.5 | Chaque fonctionnalité pilote a une décision, un responsable et une date |
| C30-10 | Préparer le prochain cycle | P2 | S24 + S27 + S28 + S29 + C30-01 | 0.5 | Les hypothèses et contraintes actualisées sont approuvées avant planification |

