# Audit de Foulée pour CoachOS

Sources : `FOULEE_DOSSIER_TRANSMISSION.md` (17 novembre 2026, commit Foulée `1065eee`) et dix captures `FOULEE_CAPTURES/` (données de démonstration). Le code de Foulée n’est pas joint : on reprend des **idées, règles et comportements**, pas des fichiers. Consigne du fondateur : ne pas copier, garder ce qui fonctionne et l’améliorer vers une suite complète de gestion du coaching (« un Odoo du coaching »), selon [16_COMPLEMENT_COACH_ELEVE.md](../16_COMPLEMENT_COACH_ELEVE.md).

## Ce que Foulée a prouvé et que CoachOS reprend en l’améliorant

| Idée Foulée (preuve) | Pourquoi elle marche | Version CoachOS (amélioration) | Story |
|---|---|---|---|
| Mascotte du coach et visite guidée avec projecteur sur l’élément à toucher, visites par état, bouton « Guide », aperçu côté coach (capture 08, `Guide.tsx`, `tours.ts`) | Le nouvel élève comprend l’app sur ses vrais écrans | Visite d’Allure pour les deux rôles, sur les vrais écrans : voile et projecteur, barre basse « Passer · Voix · points · Suivant », progression quand l’action est faite, reprise d’une page à l’autre, mouvement réduit respecté, relance depuis un bouton | CE-C-01 |
| Notation texte ↔ blocs `15' Z1 + 8×(400m Z5 + R200m) + 10' Z1` (`notation.ts`) | Le coach écrit une séance en quelques secondes, comme sur papier | Saisie rapide dans le constructeur (texte → blocs → texte), multisport (allure, puissance, FC, nage), même modèle que D-023 ; sert aussi à l’import des bases de coachs | CE-B-09 |
| Graphique en barres de la séance, touchable (captures 02, 04, `SessionChart`) | L’élève voit d’un coup d’œil la forme de la séance | Graphique accessible (table équivalente, texte des zones, jamais la couleur seule), coach et élève, tous sports | CE-E-04 |
| Accueil élève : séance du jour, semaine avec repos, phase, « semaine allégée », vue mois (captures 02, 03) | La prochaine action est évidente | Aujourd’hui + Programme semaine/mois, repos explicites, phase et numéro de semaine dès que le programme existe (lot P) | CE-E-01, CE-P-01 |
| Retour rapide en 15 s depuis l’accueil, ressenti comparé à l’intention (« visé : facile ») (capture 05) | Plus de retours, moins d’effort | Retour rapide sur Aujourd’hui (fait / en partie / pas fait puis ressenti), intention de ressenti portée par la séance, détail facultatif | CE-C-03 |
| « Autrement » : séance prévue modifiée, autre sortie, autre sport ; durée, distance, répétitions réelles, allure par rapport au prévu (capture 06) | Le réalisé remplace le prévu dans les calculs sans culpabiliser | Déclaration du réalisé reliée à la version suivie, puis rapprochement avec les activités importées (lot X) | CE-E-05, CE-X-03 |
| Éditeur de semaine coach : glisser, propositions (récupération, alléger, endurance seule, reprise) avec différences et conséquence probable, verrous, historique et restauration (capture 09) | Le coach garde la main sur un programme proposé | Propositions explicables appliquées en brouillon, différences avant publication, verrous, versions de programme (on garde nos révisions immuables) | CE-P-05, CE-P-06 |
| Suivi du groupe en petites cases, 7 jours colorés par élève, tri « ceux qui attendent le coach d’abord », fil des retours balayable, « Bravo » en un geste | Le coach voit tout son groupe sur un écran de téléphone | Vue d’ensemble par groupe (lot G) et accueil priorisé (lot H) ; réponse rapide sous un retour | CE-G-03, CE-H-01, CE-H-08 |
| Faisabilité de l’objectif en 4 statuts, solutions chiffrées, message proposé (capture 10) | Une conversation d’objectif concrète | Même principe pour tous les sports, branché sur le bilan et le programme ; rien ne part sans le coach | CE-P-07 |
| Questionnaire une question par écran, conditions, récapitulatif, brouillon, versions (capture 01) | Les élèves le terminent | Bilan CE-B-04 : même ergonomie, reprise côté serveur (pas seulement sur le téléphone), confirmation coach | CE-B-04 |
| Moteur déterministe qui ne choisit que dans la bibliothèque du coach, méthodologie écrite, « Pourquoi cette séance ? » | Le coach peut expliquer chaque séance | Règles du coach (Coach DNA) + exemples de sa bibliothèque ; explications et références montrées ; le moteur Foulée sert de **référence de règles**, pas de code à reprendre | CE-P-02, D-026 |
| Bibliothèque de départ (324 séances, 79 familles par paliers) | Le coach démarre sans page blanche | Bibliothèque CoachOS commune, multisport, par familles et paliers ; reprise du contenu Foulée seulement avec l’accord écrit du fondateur (propriété intellectuelle) | CE-B-08 |
| Zones de référence (7) affichées simplifiées (5) aux non-confirmés | Simple pour un débutant, précis pour un confirmé | Seuils par élève et par sport (VMA, FTP, CSS, FC seuil), affichage adapté au niveau | CE-B-03 |
| Notifications push, rappels matin et soir, boîte de notifications, vocaux, export agenda, app installable | Lien quotidien coach-élève sur téléphone | Lot E et H, après la messagerie écrite | CE-E-06, CE-H-09 |
| Rapprochement Strava (fonctions pures), bilan 12 mois | Valider automatiquement | Rapprochement générique multi-sources (lot X) ; Strava seulement après l’examen D04 | CE-X-03, CE-X-07 |

## Ce que CoachOS fait déjà mieux

Espaces multi-coachs et affectations contrôlées en base (Foulée : un coach par élève, liste d’autorisation en SQL) ; révisions immuables et version observée par retour ; contrat d’API stable pour le Web et une future app (Foulée : actions serveur liées à Next.js) ; idempotence et tests de concurrence ; invitation à usage unique liée à l’adresse (Foulée : lien réutilisable qui peut fuiter) ; séance structurée multisport ; migrations versionnées appliquées par le CLI ; fuseau par élève (Foulée : Bruxelles en dur).

## Ce qu’on ne reprend pas

Liste d’autorisation des coachs en SQL ; un seul coach par élève ; JSON dans des colonnes texte (`session_logs.feeling`) ; règles cachées dans les titres (« Course : », « Footing ») ; fuseau en dur ; migrations lancées à la main ; e-mails depuis une adresse personnelle ; lien d’invitation partagé ; publication automatique sans relecture.

## Décisions à prendre par le fondateur

1. **Données de santé.** Foulée recueille douleur (zone, niveau, aggravation), aptitude type PAR-Q et bilan de semaine (fatigue, sommeil, stress). CoachOS les exclut tant que le traitement n’est pas décidé (D11, D-025). C’est l’écart le plus important avec Foulée pour l’adaptation des programmes. Décision attendue : garder l’exclusion, ou ouvrir le jalon « données de santé » (base juridique, consentement, accès, durée).
2. **Bibliothèque Foulée.** Autoriser par écrit l’usage des 324 séances et de la méthodologie comme base de la bibliothèque commune (CE-B-08) ou les réserver à ton propre espace.
3. **Accès au dépôt `foul-e`.** Utile pour porter, avec leurs tests, les modules purs : notation, segments du graphique, rapprochement d’activités, adaptation. Sans accès, on les réécrit depuis ce dossier.
4. **Migration des données Foulée.** Non prévue (données d’élèves réels, santé, Strava) ; à décider plus tard avec un audit (docs/15).

## Effet sur la roadmap

Lot C gagne CE-C-03 (retour rapide). Les autres idées s’insèrent dans les lots existants (G, H, E, B, P, X) via les stories ci-dessus ; l’ordre des lots ne change pas (D-027).
