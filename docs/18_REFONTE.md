# 18 · Refonte de CoachOS : cible

Document de l’étape 2 de D-123 (23 novembre 2026). Il fixe le verdict sur le socle, la carte complète du produit avec sa nouvelle navigation, et ce que l’on retient des produits de référence. Il est relu avec les trois directions visuelles (étape 3) : **le fondateur valide la carte et les changements du socle en même temps qu’il choisit une direction.**

## 1. Verdict sur le socle

Relevé fait sur le code, pas sur docs/07 (qui décrit une cible jamais construite : workers, paquet de contrats, application mobile).

| Couche | Réalité | Verdict |
|---|---|---|
| Base | PostgreSQL (Supabase en ligne, PGlite pour les tests et la démo) ; 44 migrations additives ; 67 tables ; 48 politiques RLS ; immuabilité des révisions et du journal par déclencheur | **Garder.** Prouvé en ligne, testé, additif. Ajouter un test automatique qui vérifie table par table : RLS active, rien pour `anon`, écriture réservée aux commandes. |
| Droits | Lecture des pages sous le rôle `authenticated` (RLS) ; écritures par commandes serveur qui vérifient les droits en base (`private.*`) dans la même transaction ; idempotence de chaque intention | **Garder.** C’est la meilleure partie du produit : rien ne la remplace avantageusement. |
| Commandes et API | 24 fichiers de commandes, 82 routes, contrat OpenAPI vérifié par test | **Garder et compléter** (voir 1.2). |
| Domaine | Paquet `@coachos/domain` : règles pures, testées (zones, structure de séance, notation texte, générateur, faisabilité, statistiques, FIT) | **Garder.** Il porte la valeur métier ; l’interface ne doit jamais recalculer à côté. |
| Rendu | Next.js 16 (App Router), pages serveur, petits composants client ; 57 pages | **Garder Next.js**, **changer la façon de charger** : la fiche élève fait 20 lectures l’une après l’autre, le gabarit coach 7 à chaque page. |
| Interface | `globals.css` de 1 406 lignes, 90 couleurs en dur hors jetons, 109 styles en ligne, 7 composants partagés pour 70 fichiers, 38 pictogrammes emoji, thème uniquement subi (système), pas de page publique | **Reconstruire entièrement** (étapes 4 et 5). |
| Tâches de fond | Aucun worker ; la table `jobs` n’est utilisée par aucun code ; e-mails et rappels envoyés après la validation de la commande | **Garder ce choix** à cette échelle ; ajouter plus tard une reprise planifiée (cron Vercel) des envois en échec, sans worker. |
| Médias | Vidéos et vocaux en base (`bytea`), 4 Mo au plus par vidéo en ligne | **Changer** : stockage de fichiers (Supabase Storage), lecture par adresse signée courte. |
| Mobile | Application web installable (PWA), hors ligne pour l’élève, rappels push | **Garder** (D-120 : pas d’application native maintenant). |

### 1.1 Ce qui freine l’expérience visée, et ce qu’on change

1. **Vitesse ressentie.** Lectures en parallèle dans chaque page ; regroupement des comptes du gabarit (retours, messages, notifications) en une requête ; écrans de chargement squelettes ; mises à jour optimistes côté client pour les gestes fréquents (déplacer une séance, marquer traité, cocher une tâche).
2. **Calendrier « glisser, copier, coller ».** Aujourd’hui : créer, modifier, publier une séance à la fois ; pas de déplacement direct, pas de copie, pas de suppression d’un brouillon, pas d’annulation. Il faut des opérations groupées.
3. **Panneau latéral.** Ouvrir un élève ou une séance sans quitter sa page : routes interceptées de Next.js (`@panneau`), qui gardent une vraie adresse partageable.
4. **Recherche globale et palette de commandes.** Une lecture unique sous RLS (élèves, groupes, séances récentes, bibliothèque, actions) et une palette au clavier (⌘K).
5. **Thème choisi.** Clair, sombre ou système, mémorisé par personne (cookie lu au rendu serveur : pas de flash).
6. **Couleurs du coach chez l’élève.** `workspace_profiles.accent` existe (6 teintes) : il devient un jeton de thème appliqué à tout l’espace élève, avec contraste vérifié.

### 1.2 Changements du socle à valider (tous additifs)

| Changement | Pourquoi | Base |
|---|---|---|
| Opérations groupées sur les séances : déplacer, copier vers un ou plusieurs élèves ou un groupe, coller une semaine, supprimer des brouillons, publier une sélection, avec un journal d’annulation (l’opération inverse est enregistrée, « Annuler » pendant 10 secondes) | Calendrier façon TrainingPeaks ou Final Surge, sans fenêtres de confirmation | Nouvelles routes ; une table `undo_log` (additive) ; aucune donnée existante modifiée |
| Recherche globale | Palette de commandes et barre de recherche | Une route de lecture ; index trigram facultatif (additif) |
| Préférence de thème | Clair et sombre soignés à égalité, choisis | Cookie ; colonne `users.theme` facultative (additive) |
| Médias dans Supabase Storage | Vidéos longues, base allégée, sauvegardes plus rapides | Seau privé et colonnes `storage_path` (additives) ; anciennes données lues tant qu’elles existent |
| Abonnement (mode test) | Offres par nombre d’élèves, essai gratuit | Tables `subscriptions` et `invoices` déjà au contrat ; interrupteur éteint en production |

## 2. Carte du produit

### 2.1 Principes

- **L’essentiel d’abord, la profondeur à la demande.** Cinq destinations pour le coach, quatre pour l’élève ; tout le reste dans le panneau, la palette ou un sous-onglet.
- **Un objet, une adresse, un panneau.** Élève, séance, groupe, programme s’ouvrent en panneau depuis n’importe où, et en page pleine si on le demande.
- **Une seule boîte de réception.** Retours, messages et notifications arrivent au même endroit, triés par ce qui demande une action.
- **Le vocabulaire du coach.** « Élève » partout (jamais « athlète » dans l’interface), « séance », « semaine », « programme », « bibliothèque », « retour ». Aucune phrase qui suppose que le coach est le fondateur.

### 2.2 Navigation du coach

Barre latérale sur ordinateur, barre basse sur téléphone (cinq destinations), palette ⌘K partout.

| Destination | Contenu | Pages actuelles reprises |
|---|---|---|
| **Accueil** | Brief du jour : qui a besoin de moi (retours à traiter, messages, silences, « pas à 100 % », semaines non publiées, programmes qui s’achèvent), ce que je fais aujourd’hui (rendez-vous, tâches, créneaux), chiffres de la semaine (régularité moyenne, charge, retours traités) | `planning`, `to-plan`, relances, résumé de semaine |
| **Calendrier** | Vue semaine de tous les élèves (lignes) ou d’un groupe, vue semaine ou mois d’un élève ; glisser, copier, coller, sélectionner, publier ; panneau séance | `calendar`, `groups/[tid]/week`, `group-sessions`, séance de groupe |
| **Élèves** | Portefeuille par groupe, niveau ou urgence ; fiche en panneau ou en page, avec onglets Vue d’ensemble, Calendrier, Progression, Bilan, Notes, Échanges, Données | `athletes`, `athletes/[aid]`, `bilan`, `programme`, `athletes/new` |
| **Boîte de réception** | Retours à traiter au clavier (J/K, Entrée, T pour traité, R pour répondre), messages privés et de groupe, notifications | `review`, `review/[rid]`, `messages`, `notifications` |
| **Bibliothèque** | Séances, blocs, semaines types, programmes types, exercices (si musculation) ; imports ; « Ma méthode » | `library`, `library/*`, `exercises`, `methode` |

Hors barre : **Paramètres** (espace et présentation, suivis automatiques, relances, notifications, IA, données), **Compte** (profil, sécurité, thème), **Abonnement**, **Aide** ; accessibles depuis le menu du compte et la palette.

### 2.3 Navigation de l’élève (téléphone d’abord)

| Onglet | Contenu |
|---|---|
| **Aujourd’hui** | La séance du jour dans ses allures, ses watts ou ses charges en un coup d’œil ; « Suivre » ; retour en 15 secondes ; la suite de la semaine |
| **Programme** | Semaine et mois, objectif et compte à rebours |
| **Progression** | Régularité, volume, charge d’entraînement, records, charges en musculation ; ce qui a progressé ce mois-ci |
| **Échanges** | Conversation avec le coach et fils de groupe |

Profil, bilan, réglages, données et présentation du coach passent dans le menu de l’avatar. L’espace entier prend la couleur du coach.

### 2.4 Surfaces d’un produit vendu

| Surface | État | Remarque |
|---|---|---|
| Page publique (présentation, offres, questions fréquentes) | **Fait (D-174)** | « / » présente CoachOS au visiteur, `/offres`, `/conditions`, `/mentions-legales` |
| Inscription et premiers pas (liste de 5 étapes jusqu’au premier retour traité) | **Partiel** | Inscription et assistant d’espace existent ; pas de liste de premiers pas mesurée |
| Offres, essai gratuit, abonnement | **Manquant** | Mode test seulement (D-120) |
| Aide intégrée (articles courts, recherche, visite guidée) | **Partiel** | Visite guidée et guide existent ; pas de centre d’aide |
| Compte et données | **Fait** | Profil, confidentialité, export, effacement (D-115) ; à intégrer à la nouvelle navigation |
| Pages légales (CGU, mentions) | **Partiel** | Confidentialité seulement ; brouillons à faire relire |

### 2.5 Fonctions existantes : où elles vont

Aucune ne disparaît. Les fusions et replis :

| Fonction | Devient |
|---|---|
| Planning (tâches, agenda, relances) | Accueil (tâches et agenda) ; relances dans « qui a besoin de moi » |
| À préparer | Accueil (« semaines non publiées ») et filtre du Calendrier |
| Retours, Messages, Notifications (trois entrées) | Boîte de réception (une entrée, trois filtres) |
| Méthode | Bibliothèque › Ma méthode |
| Visite guidée et guide Allure | Aide › Visite guidée ; le personnage reste discret, à la demande |
| Page « Mon profil » hors espace | Compte |
| Choix d’espace | Menu du compte (sélecteur d’espace) |

## 3. Les produits de référence

Relevé du 23 novembre 2026 (sites, centres d’aide, fiches des magasins, comparatifs). On reprend des principes, jamais un écran, une marque ou un texte.

| Produit | On reprend | On évite | On fait mieux |
|---|---|---|---|
| **TrainingPeaks** | Calendrier où l’on glisse pour déplacer, Maj ou touche pour copier, sélection de plages de jours et de semaines, calendrier double pour copier d’un élève à l’autre ; raccourcis clavier | Densité et vocabulaire d’expert (CTL, ATL, TSB sans explication) ; pas d’annulation sur les opérations de semaine | Annulation de chaque geste ; charge expliquée en mots ; brief du jour au lieu d’un tableau de graphiques |
| **Intervals.icu** | Rigueur de la donnée, courbes et zones lisibles ; organisation des élèves par étiquettes | Interface d’ingénieur, peu accueillante pour un coach débutant ou un élève | La même rigueur, présentée pour un humain : les zones comme couleur commune à tout le produit |
| **Nolio** | Séances individuelles et collectives, groupes et sous-groupes, commentaires de séance, envoi vers la montre | Écrans qui s’accumulent | Une seule boîte de réception, un panneau au lieu de nouvelles pages |
| **Final Surge** | Bibliothèque glissée sur le calendrier d’un élève ou d’une équipe, copie de semaines, plans sauvegardés | Aspect daté, réglages dispersés | Bibliothèque ouverte en tiroir à côté du calendrier |
| **Hevy Coach, Everfit, TrueCoach** | Côté élève : séance de musculation exercice par exercice, vidéo, série cochée ; côté coach : vue d’activité des clients, rendez-vous | Logique « client » de salle de sport transposée telle quelle à l’endurance | Un seul produit pour l’endurance et le renforcement, la séance mixte comme cas normal |
| **Runna** | Aujourd’hui qui dit quoi faire, combien de temps, à quelle allure ; montre au centre | Fragilité : une panne empêche de voir la séance du jour (avis de 2026) | Lecture hors ligne déjà en place ; la séance du jour toujours lisible, même sans réseau |
| **Strava** | Récompense visuelle d’une séance faite, résumé partageable, progression qui donne envie | Comparaison sociale, données publiques | Progression privée, coach au centre, aucune donnée de santé |
| **Linear** | Palette de commandes, raccourcis mnémotechniques, mises à jour optimistes, sobriété | Interface pensée pour le clavier seul, inutilisable au toucher | Les mêmes gestes au clavier sur ordinateur, et des gestes de pouce sur téléphone pour le tour du soir |
| **Stripe** | Hiérarchie par la typographie et l’espace plutôt que par la couleur, chiffres tabulaires, quelques nombres avec tendance, tableaux denses mais calmes | Froideur d’un outil financier | La chaleur d’un outil de sport : la couleur réservée à la donnée (zones) et au coach |

Sources consultées : [guide coach de TrainingPeaks](https://help.trainingpeaks.com/hc/en-us/articles/231470308-TrainingPeaks-Coach-User-Guide), [raccourcis clavier de TrainingPeaks](https://help.trainingpeaks.com/hc/en-us/articles/38847458144013-Keyboard-Shortcuts), [fonctions d’efficacité du calendrier TrainingPeaks](https://www.trainingpeaks.com/coach-blog/speed-up-your-coaching-with-5-trainingpeaks-calendar-efficiency-features/), [calendrier double](https://help.trainingpeaks.com/hc/en-us/articles/204761644-Dual-Calendar), [Intervals.icu, planifier](https://www.intervals.icu/features/plan/), [Nolio sur l’App Store](https://apps.apple.com/app/nolio/id1615773607?l=fr), [Final Surge pour les coachs](https://finalsurge.com/coaches), [comparatif Hevy Coach, TrueCoach, Everfit](https://www.g2.com/compare/hevy-coach-vs-truecoach-vs-everfit), [test de Runna par Tom’s Guide](https://www.tomsguide.com/reviews/runna-app), [avis Runna](https://www.trustpilot.com/review/runna.com?page=2), [palette de commandes de Linear](https://linear.app/features/level-up), [analyse du tableau de bord de Stripe](https://www.925studios.co/blog/stripe-dashboard-design-breakdown).

## 4. Suite

- Étape 3 : trois directions visuelles sur quatre écrans (accueil du coach, calendrier, « Aujourd’hui » de l’élève sur téléphone, suivi d’une séance), clair et sombre, avec recommandation. **Le fondateur choisit, et valide la carte (section 2) et les changements du socle (section 1.2).**
- Étape 4 : design system dans le code (jetons, composants, page de démonstration interne).
- Étape 5 : reconstruction parcours par parcours, dans cet ordre : élève Aujourd’hui et retour ; coach Accueil ; Boîte de réception ; Calendrier ; Élèves ; Bibliothèque ; Paramètres et compte ; surfaces publiques.
