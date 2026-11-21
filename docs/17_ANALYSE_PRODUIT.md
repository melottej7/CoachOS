# 17 · Analyse produit : la valeur réelle de CoachOS

Version du 21 novembre 2026. Réponse au cadrage « OS du coach sportif hybride » proposé par le fondateur. Aucune ligne de code n’a été modifiée pour cette analyse.

> **Décision du fondateur après lecture (D-096, 21 novembre).** CoachOS sera **modulaire : endurance, musculation, ou les deux**, avec des programmes vidéo de musculation suivis à distance, puis la gestion du coach (relances, suivi, paiement). Les recommandations « course à pied seulement » et « abandonner le repositionnement musculation » sont donc écartées. Le reste de l’analyse (preuve d’usage, mise en ligne, brief du jour, pilote) reste valable.

**Comment lire ce document.** Chaque affirmation porte une étiquette :
- **[Fait]** : constaté dans le projet, le code, les documents du fondateur ou une source publique citée ;
- **[Hypothèse]** : raisonnement plausible, non prouvé ;
- **[À valider]** : question à poser à de vrais coachs ou athlètes avant de décider.

Les sources de marché sont en fin de document. Les comparatifs publiés par un éditeur (Trainerize, Everfit, FitBudd, Coachful, coachingportal) sont des textes commerciaux : ils indiquent ce que le marché met en avant, pas ce que les coachs utilisent vraiment.

---

## En bref

1. **Le cadrage « coach sportif hybride, musculation / performance, 10 à 50 clients » ne correspond pas à ce que CoachOS est, ni à ce que tu fais.**
   - [Fait] Tout ce qui existe est taillé pour l’endurance : séances par zones et allures, VMA, Garmin, bibliothèque Foulée, ta méthode lue dans tes 14 programmes de course.
   - [Fait] Le marché de la musculation hybride est occupé par des outils mûrs (Trainerize, TrueCoach, Everfit), qui ont 2 000 à 3 000 exercices, la nutrition et le paiement. CoachOS n’a rien de cela.
   - **Recommandation :** garder l’endurance, et commencer par la course à pied. « Hybride » doit vouloir dire « séances collectives sur place, plus plan à distance », pas « musculation ».
2. **Le vrai problème n’est pas le manque de fonctionnalités, c’est le manque de preuve d’usage.**
   - [Fait] 95 décisions et un produit très large, mais aucun athlète réel n’a encore utilisé CoachOS sur son téléphone pendant une vraie semaine.
   - [Fait] Hier, ton propre téléphone n’arrivait pas à ouvrir l’app : CoachOS ne tourne que sur ton Mac.
3. **Le cœur à défendre est la boucle 3 : adhésion, adaptation et relance.** Les boucles 1 (prospection) et 2 (paiement) sont des standards bien servis ailleurs. Elles ne différencieront pas CoachOS et l’alourdiraient.
4. **Les différences crédibles sont au nombre de trois, toutes à valider :**
   - **ta méthode** appliquée sans ressaisie : import de tes écrits, tes zones, ta progression ;
   - **un brief quotidien** qui transforme des retours simples en actions, avec un message déjà préparé ;
   - **une expérience athlète** pensée pour les débutants et les reprises, pas pour les passionnés de données.
5. **Prochain MVP :** mettre CoachOS en ligne, puis faire vivre 4 semaines réelles à toi et à tes 6 ou 7 athlètes, sur un périmètre réduit. Ensuite seulement, 3 à 5 coachs d’endurance extérieurs.

---

## 1. Le cadrage, analysé de façon critique

### Ce qui est juste dans le cadrage
- **[Fait]** Le coach doit garder la décision ; l’outil élimine les oublis, les ressaisies et la dispersion. C’est déjà la règle de CoachOS : rien n’est publié ni envoyé sans le coach (CLAUDE.md, D-058, D-071).
- **[Hypothèse forte]** La détection précoce du décrochage est un problème réel et peu outillé.
  - Les outils d’endurance montrent ce qui a été fait (les couleurs de conformité de TrainingPeaks), mais ils ne disent pas qui contacter aujourd’hui ni quoi lui dire.
  - Je n’ai pas trouvé d’alerte automatique de séance manquée documentée chez TrainingPeaks.
  - Everfit a un tableau « À risque » en bêta, fondé sur l’adhésion aux séances.

### Ce qui pose problème

| Point du cadrage | Problème | Preuve |
|---|---|---|
| « Coach sportif hybride, musculation / performance » | C’est un autre métier que celui pour lequel CoachOS est construit. Il demande une bibliothèque d’exercices, le suivi des charges, des vidéos et souvent la nutrition. | [Fait] Aucune de ces briques n’existe. Trainerize, TrueCoach et Everfit annoncent 2 000 à 3 000 exercices. |
| « OS du coach », trois boucles de la prospection au renouvellement | C’est trop large pour un fondateur seul, et c’est déjà la promesse de Coachful et de Trainerize (tout-en-un : CRM, agenda, paiement, programmes). | [Fait] Coachful se présente comme un remplaçant de l’agenda, du paiement, des cours, des e-mails, de la messagerie et du tableur CRM. |
| Boucle 1 : prospection et qualification | Un coach indépendant d’endurance trouve ses athlètes par le bouche-à-oreille, son club et Instagram. Un CRM de prospects répond à un besoin de commercial, pas d’entraîneur. | [À valider] Tes 7 programmes concernent des proches : amis et famille. |
| Boucle 2 : paiement | C’est utile, mais c’est un standard. Un lien de paiement Stripe ou un virement suffisent au départ. CLAUDE.md réserve le paiement à l’après-validation du parcours des deux rôles. | [Fait] CLAUDE.md : « Attendre la validation du parcours des deux rôles pour ouvrir le chantier commercial, les offres et Stripe. » |
| Athlète : « signaler une douleur » | Ce sont des données de santé, que tu as exclues (D-084). Le compromis actuel est la question « Peux-tu faire tes séances à 100 % ? », suivie d’une conversation (D-088, D-089). | [Fait] Décisions D-084 et D-088. |

### Positionnement recommandé
> **CoachOS : l’outil de travail du coach de course à pied indépendant, pour que chaque athlète sache quoi faire aujourd’hui, que le coach sache qui a besoin de lui, et que la méthode du coach soit appliquée sans ressaisie.**

« Hybride » reste valable au sens de la course : séance de groupe sur la piste le mardi, plan individuel le reste de la semaine. CoachOS le gère déjà avec les séances de groupe, leurs adaptations et leurs exceptions (D-042).

---

## 2. Problèmes à résoudre, par ordre de priorité

Fréquence : **Q** = chaque jour, **H** = chaque semaine, **M** = chaque mois. Intensité de 1 (gêne) à 3 (perte de client ou d’athlète).

### Côté coach

| # | Problème concret et observable | Qui, quand | Fréq. | Int. | Contournement actuel | Pourquoi c’est insuffisant | Statut |
|---|---|---|---|---|---|---|---|
| C1 | **Ne pas savoir qui a besoin de lui aujourd’hui.** Un athlète ne répond plus depuis 10 jours et le coach s’en aperçoit trop tard. | Coach de 5 à 30 athlètes, le soir | Q | 3 | Faire défiler WhatsApp et Strava de mémoire | Le silence ne se voit pas dans une messagerie : rien ne s’affiche quand rien n’arrive | [Hypothèse forte] · [À valider] la fréquence chez tes athlètes |
| C2 | **Préparer et ajuster les semaines.** Recopier le Google Doc, décaler une séance, adapter après une fatigue. | Dimanche soir, et en semaine après un imprévu | H | 2 | Google Docs par athlète, copier-coller | Chaque modification se fait à la main dans chaque document ; aucune vue d’ensemble | [Fait] Tes 7 documents, 14 programmes |
| C3 | **Comprendre le retour d’une séance.** Ce qui a été fait, comment c’était ressenti, s’il y a un problème. | Après chaque séance | Q | 2 | Message WhatsApp libre, capture Strava | Les retours sont dispersés, incomplets, mélangés aux conversations | [Hypothèse] · [À valider] |
| C4 | **Personnaliser selon le niveau, le temps et les contraintes** sans tout réécrire | À chaque nouvel athlète | M | 2 | Partir d’un ancien document | La méthode n’est écrite nulle part de façon réutilisable | [Fait] Tes documents reprennent les mêmes règles (METHODE_FONDATEUR.md) |
| C5 | **Prouver la valeur du coaching** : montrer les progrès, justifier un renouvellement | Fin de cycle | M | 2 | Comparer deux chronos de mémoire | Rien ne montre la régularité ni la progression | [Hypothèse] |
| C6 | **Tâches administratives** : rendez-vous, facturation, relances de paiement | Mensuel | M | 1–2 | Calendly, virement, rappels | Ces outils fonctionnent bien ; le gain serait marginal | [Hypothèse] · ce n’est pas le problème douloureux |
| C7 | **Prospection** | Ponctuel | M | 1 | Bouche-à-oreille | — | [À valider] ; probablement hors sujet au départ |

### Côté athlète

| # | Problème | Qui, quand | Fréq. | Int. | Contournement | Insuffisance | Statut |
|---|---|---|---|---|---|---|---|
| A1 | **Ne pas savoir exactement quoi faire aujourd’hui** (zone, allure, durée) | Avant chaque séance, sur téléphone | Q | 3 | Rouvrir le Google Doc, chercher la bonne semaine | Le document est long, il n’est pas pensé pour un téléphone, et les zones ne sont pas traduites en allures | [Fait] Tes documents font plusieurs pages, avec un tableau de zones en tête |
| A2 | **Ne pas oser ou oublier de donner son retour** | Après la séance | Q | 2 | Rien, ou un message vague | Il faut écrire un message | [Hypothèse] · le retour rapide de Foulée a été bien accueilli [À valider] |
| A3 | **Adapter quand il manque de temps ou qu’il est fatigué** | Le jour même | H | 2 | Sauter la séance ou improviser | Il n’a pas la règle du coach sous les yeux (« si une séance saute, c’est le footing ») | [Fait] Cette règle revient dans tes documents |
| A4 | **Perdre la motivation, ne pas voir de progrès** | Après 3 à 6 semaines | M | 3 | Strava, les kudos | Strava montre l’activité, pas la progression vers son objectif | [Hypothèse] |
| A5 | **Avoir la séance sur sa montre** | Avant les séances structurées | H | 2 | Lire sur son téléphone pendant la course, ou retaper la séance dans Garmin Connect | Retaper prend du temps et provoque des erreurs | [Fait] Standard chez Nolio, TrainingPeaks et Runna · [À valider] combien de tes athlètes ont une montre compatible |
| A6 | **Une app trop complexe** | Au premier jour | 1 fois | 3 | Abandonner l’app | TrainingPeaks est conçu pour les passionnés de données | [Hypothèse] |

**Conclusion.** C1, C2, C3, A1, A2 et A3 forment une seule boucle : savoir quoi faire, le faire, dire comment ça s’est passé, voir qui a besoin d’aide, ajuster. Cette boucle hebdomadaire est le produit. CLAUDE.md la désignait déjà comme prioritaire.

---

## 3. Parcours prioritaires

Pour chaque parcours : parcours probable aujourd’hui → parcours cible → état dans CoachOS → validation.

### Coach

**P1 · « Qui a besoin de moi aujourd’hui ? » (brief quotidien)**
- **Aujourd’hui :** WhatsApp, Strava et la mémoire du coach. 10 à 20 minutes, avec des oublis.
- **Cible :** une liste courte, triée par urgence. Chaque ligne donne une raison lisible (« pas de retour depuis 6 jours », « pas à 100 % », « 2 séances manquées ») et un bouton d’action avec un message déjà rédigé, modifiable.
  - Moins de 2 minutes pour 10 athlètes. Rien à faire = un message rassurant (« Tout le monde est en rythme »).
- **CoachOS :** [Fait] il y a un onglet Planning (tâches automatiques, D-032 et D-045), un résumé de la semaine (D-073, D-092) et une file des retours (D-082). Il y en a trop : ces trois écrans se partagent le même travail.
  - **À améliorer :** les fusionner en un seul « brief du jour ».
- **Données :** dernière séance publiée, retours, réponse « à 100 % ? », messages non lus.
- **Complexité :** faible, les briques existent.
- **Validation :** pendant 4 semaines, chronométrer ton tour du soir avant et après. Compter les athlètes contactés avant 7 jours de silence.

**P2 · Préparer et ajuster un programme**
- **Aujourd’hui :** copier l’ancien Google Doc, réécrire, envoyer le lien.
- **Cible :** coller son ancien programme ou partir de sa méthode, relire, appliquer à l’athlète en brouillon, publier la semaine.
- **CoachOS :** [Fait] import de tes documents tels quels (D-085, D-091), générateur aligné sur ta méthode (D-086), semaines types (D-051), régénération partielle (D-063).
  - Risque : c’est beaucoup d’options pour un geste hebdomadaire.
- **Complexité :** déjà construit. Le risque est l’alourdissement.
- **Validation :** combien de minutes pour publier la semaine de 7 athlètes ? Quels boutons utilises-tu réellement ? Mesurer l’usage de chaque écran.

**P3 · Comprendre un retour**
- **Cible :** réalisé ou non, ressenti comparé au ressenti visé, « à 100 % ? », commentaire, données de la montre si elles existent. Le tout sur une ligne, avec une réponse en un geste (« Bravo », message).
- **CoachOS :** [Fait] retour rapide (D-039), revue, réponse dans la conversation (D-036).
- **Validation :** part des retours traités en moins de 24 heures.

**P4 · Relancer sans quitter le dossier**
- **CoachOS :** [Fait] messagerie et fiche élève (D-033). La relance est rédigée par le coach.
- **À tester :** une relance proposée et modifiable (voir l’IA, partie 6).

**P5 · Planifier une séance sur place ou en visio**
- **CoachOS :** [Fait] rendez-vous (D-034) et séance de groupe (D-042).
- **Recommandation :** garder la séance de groupe ; un rendez-vous simple suffit, sans réservation en ligne façon Calendly.

**P6 · Encaisser et renouveler : reporter.** Un lien de paiement externe suffit pour le pilote.

### Athlète

**A-P1 · « Quoi faire aujourd’hui ? »**
- **Cible :** j’ouvre l’icône et je vois la séance du jour, traduite en allures personnelles, avec le graphique et les consignes du coach. Moins de 5 secondes.
- **CoachOS :** [Fait] Aujourd’hui, déroulé, allures depuis la VMA (D-029), graphique (D-040), installable (D-070).
- **Blocage :** [Fait] l’app n’est pas en ligne. Aucun athlète ne peut l’ouvrir hors de ton Wi-Fi.

**A-P2 · Donner son retour en 15 secondes, même hors ligne**
- **CoachOS :** [Fait] retour rapide (D-039). La lecture hors ligne existe (D-080), mais l’envoi d’un retour hors ligne n’est pas prouvé, et il faut https.
- **Validation :** part des séances publiées qui reçoivent un retour dans les 48 heures. Cible : 70 % ou plus [Hypothèse].

**A-P3 · « Je n’ai que 30 minutes » ou « je suis fatigué »**
- **Cible :** un bouton « Je ne peux pas la faire comme prévue » propose la version courte prévue par le coach (même famille, palier inférieur, ou footing). Le coach est prévenu et peut corriger.
- **CoachOS :** partiel. Il y a « Séance faite autrement » (D-031) et les paliers Foulée (D-068), mais pas d’adaptation proposée à l’athlète.
- **Validation :** voir l’hypothèse H6.

**A-P4 · Voir ses progrès** : régularité, volume, chrono de test, compte à rebours vers l’objectif.
- [Fait] Onglet Progression (D-037), test 5 km et VMA (D-090).
- [À valider] Est-ce que ça motive vraiment ? Combien d’ouvertures de cet onglet ?

**A-P5 · La séance sur la montre** : voir la partie 4 (Garmin).

---

## 4. Évaluation des fonctionnalités

Catégories : **MVP** = essentielle au MVP · **Second** = importante mais secondaire · **Diff.** = potentiellement différenciante, à tester · **Lourd** = risque d’alourdissement · **Abandon** = à abandonner ou reporter.

| Fonctionnalité | Dans CoachOS | Catégorie | Recommandation | Pourquoi |
|---|---|---|---|---|
| Brief quotidien / tableau des priorités | Planning, résumé de la semaine et file des retours : trois écrans | **MVP · Diff.** | **Améliorer :** fusionner en un seul écran | C’est le cœur de la promesse. Ailleurs, on trouve des couleurs de conformité, pas des actions. |
| Statut d’adhésion (« en rythme », « à surveiller », « à risque », « silencieux ») | Régularité (D-043), « pas à 100 % » (D-089), règles de suivi | **MVP** | **Améliorer :** 4 statuts calculés par règles lisibles, **pas de score opaque** | Avec 5 à 30 athlètes, une règle explicable vaut mieux qu’un modèle prédictif impossible à entraîner. |
| Relances pré-rédigées, validées par le coach | Non | **Diff.** | **Tester** (H4) | Fréquent, et faible en complexité si c’est un modèle de message avant d’être de l’IA. |
| Suivi individuel (fiche élève) | Fiche complète | **MVP** | **Conserver, simplifier** | La fiche est riche, peut-être trop. Garder ce qui sert au brief et à la revue. |
| Questionnaires et check-ins | Bilan d’arrivée (D-054), « à 100 % ? » (D-088) | **MVP** (arrivée) · **Second** (check-in hebdo) | **Conserver** le bilan ; **tester** un check-in de 3 questions maximum | Chaque question en plus fait baisser le taux de réponse [Hypothèse]. |
| Bibliothèque personnelle de séances | 324 séances Foulée, ta base, blocs | **MVP** | **Conserver** | C’est la matière première de la méthode. |
| Programmes réutilisables et modèles | Semaines types, programmes types, import de tes documents | **MVP · Diff.** | **Conserver :** l’import de tes écrits est une vraie différence à démontrer | Il enlève une ressaisie concrète (RECHERCHE_MARCHE.md, hypothèse migration). |
| Aide de l’IA à la préparation des programmes | Générateur à règles et « Ajuster avec l’IA » (D-071), sans crédit actif | **Diff.** | **Tester plus tard** (H5) | Le générateur à règles fonctionne sans IA. Rien ne prouve que l’IA réduise le temps d’édition. |
| Adaptation selon le temps, la fatigue, le matériel | Partielle | **Diff.** | **Tester** (H6) : version courte prévue par le coach | Fréquent et concret. La règle « si ça saute, c’est le footing » est déjà la tienne. |
| Groupes et niveaux | Complet (D-032, D-042) | **Second** | **Conserver la séance de groupe, cacher le reste** tant que tu as moins de 15 athlètes | Utile pour un club, superflu pour 7 athlètes. |
| Messages et communication | Messagerie, groupes, vocaux, accusés de lecture | **Second** | **Conserver sans étendre** | Les athlètes resteront sur WhatsApp [Hypothèse]. Ne pas chercher à le remplacer : garder les messages liés à une séance. |
| Planification hybride (sur place, visio, autonome) | Rendez-vous, séance de groupe | **Second** | **Conserver tel quel** | Pas de réservation en ligne. |
| Connexions Garmin et Strava | Import de fichier (D-048), export FIT (D-044) ; pas d’API | **MVP pour l’endurance** (Garmin, envoi de séances) · **Second** (Strava) | **Décider** (Q4) | La séance sur la montre est un standard du marché (Nolio, TrainingPeaks, Runna). Le fichier FIT est inutilisable depuis un téléphone. |
| Paiement, contrats, facturation, renouvellement | Non | **Abandon (reporter)** | **Reporter** après le pilote | C’est un standard ; Stripe Payment Links suffisent. CLAUDE.md le demande. |
| Prospection et qualification (CRM) | Non | **Abandon** | **Abandonner** pour l’instant | Ce n’est pas le problème douloureux du persona. |
| Analyse vidéo, feedback technique | Non | **Abandon** | **Abandonner** | Peu utile en course sur route, coûteux et peu fiable. |
| Communauté, challenges, badges | Fil de groupe ; badges dans Foulée | **Lourd** | **Reporter.** Garder le fil de groupe. | Strava occupe déjà ce terrain. |
| Nutrition, récupération, santé | Exclues (D-084) | **Abandon** | **Garder l’exclusion.** Le compromis « à 100 % ? » suffit. | Risque juridique et de confiance ; hors du cœur. |
| Statistiques avancées et rapports | Suivi, Progression, sources | **Lourd** | **Ne rien ajouter.** Un bilan de fin de cycle simple suffira. | Intervals.icu et TrainingPeaks font mieux, souvent gratuitement. |
| Multisport (vélo, natation : FTP, CSS) | Construit (D-055) | **Lourd** | **Masquer** dans le MVP | Ça dilue le persona course à pied. Le code reste. |
| Tâches avec 6 statuts, récurrence, créneaux de travail | Construit (D-059, D-065) | **Lourd** | **Simplifier :** « à faire » et « fait », plus le report | C’est le métier d’un gestionnaire de projet, pas celui d’un coach de 7 athlètes [Hypothèse]. |
| Visite guidée avec mascotte | Construit (D-028) | **Second** | **Conserver** si les athlètes la terminent | À mesurer pendant le pilote. |

**Point critique sur l’alourdissement.** [Fait] CoachOS compte aujourd’hui environ 8 sections côté coach : Planning, Séances, Retours, Messages, Élèves, Notifications, Méthode, Paramètres. Il compte aussi des dizaines d’options. [Hypothèse] Pour un coach de 7 athlètes, c’est plus que TrueCoach, que ses comparatifs décrivent comme le plus simple pour du 1:1. La meilleure amélioration n’est probablement pas une nouvelle fonction, mais un **mode simple** qui ne montre que la boucle.

---

## 5. Différenciation et concurrence

### Ce qui est devenu un standard (ce n’est pas une différence)

| Standard | Qui le fait déjà | Source |
|---|---|---|
| Calendrier des séances, bibliothèque de séances types, blocs | Nolio, TrainingPeaks, Final Surge, TrueCoach, Everfit | Nolio (Stadion) ; TrainingPeaks (fonctions coach) |
| Séances structurées envoyées sur la montre, activités importées | Nolio (Garmin, Polar, Coros, Suunto…), TrainingPeaks (calendrier Garmin Connect), Runna (2 semaines synchronisées) | Recherches du 21 novembre |
| Conformité prévu / réalisé en couleurs | TrainingPeaks | Guide coach TrainingPeaks |
| Messagerie, check-ins, formulaires | Trainerize, Everfit, TrueCoach | Comparatifs 2026 |
| Paiement, agenda, portail à la marque du coach | Coachful, Trainerize | Fiches Coachful |
| Plan d’entraînement généré par IA | Runna (racheté par Strava en avril 2025), générateur de TrainingPeaks, TrainerDay | Presse ; RECHERCHE_MARCHE.md |
| Repérage des clients à risque | Everfit (tableau des check-ins « À risque », bêta), Athleex | Centre d’aide Everfit ; communiqué Athleex |
| IA branchée sur la plateforme (MCP) | Nolio | RECHERCHE_MARCHE.md |

**Conséquence.** Le repérage des athlètes à risque n’est **pas une idée unique** : Everfit et Athleex le font déjà en musculation.

### Les concurrents qui comptent pour notre persona

| Alternative | Force | Faiblesse ou friction (source) | Ce que CoachOS ne doit pas croire différenciant |
|---|---|---|---|
| **Nolio** (français, endurance, partenaire de la FFA) | Concurrent direct. Synchronisation montres, banque de séances, tags, tarif bas (19,90 € à 39,90 €). | Un avis App Store dit que l’ordre des séances revient à l’original après synchronisation Garmin (source ancienne). Pas d’indice public d’un brief d’actions. [À valider] auprès de coachs qui l’utilisent. | Calendrier, banque de séances, montre |
| **TrainingPeaks** | Référence mondiale, conformité, synchronisation Garmin | Pensé pour les passionnés de données [Hypothèse] ; les séances non téléversées paraissent manquées | Constructeur de séances, couleurs de conformité |
| **Final Surge, Intervals.icu** | Très bas prix, voire gratuit ; analyse poussée | Interface technique [Hypothèse] | Statistiques |
| **Runna / Strava** | Plan IA pour le grand public, montre, immense audience | Pas de coach humain identifiable ; plan générique | Plan généré automatiquement |
| **Trainerize, TrueCoach, Everfit, FitBudd, My PT Hub** | Musculation, nutrition, paiement, automatisations | Hors endurance : pas de zones d’allure ni de montre au cœur | Messagerie, check-ins, paiement |
| **Google Docs + WhatsApp + Strava** | Gratuit, connu, souple : c’est **ton outil actuel** | Dispersion, rien ne signale le silence, pas de vue d’ensemble | — : c’est l’alternative à battre en premier |

### Différenciations crédibles, toutes à valider

1. **« Ta méthode, sans ressaisie. »** [Fait] CoachOS lit tes documents tels que tu les écris (71 notations sur 71, 14 programmes), traduit tes zones et suit ta progression (D-085 à D-087).
   - Aucun concurrent étudié ne documente l’import d’un programme rédigé librement.
   - [À valider] Est-ce que les autres coachs écrivent comme toi ?
   - Différence : meilleure intégration et meilleure personnalisation.
2. **« Qui a besoin de moi, et quoi lui dire. »** Un brief qui part de retours **déclarés** (fait ou non, ressenti, « à 100 % ? »), pas seulement des données de montre.
   - Il fonctionne donc aussi pour les débutants sans montre ou qui oublient de synchroniser.
   - Différence : meilleure exécution et meilleur contexte. Ce n’est pas une idée nouvelle.
3. **L’athlète débutant ou en reprise d’abord :** course-marche, « facile = parler », consignes dans tes mots, une séance par écran.
   - [Hypothèse] TrainingPeaks et Nolio servent mieux les coureurs confirmés.
   - Différence : meilleure simplicité pour un segment précis.

**Ce qui n’est pas différenciant** et ne doit pas être mis en avant : groupes, statistiques, messagerie, IA générative en soi, paiement.

---

## 6. La place réelle de l’IA

Règle produit, inchangée : **l’IA prépare, détecte, suggère et rédige ; le coach décide, personnalise, valide et porte la relation.** [Fait] CLAUDE.md interdit aussi d’envoyer à l’IA les données Strava ou dérivées.

| Usage | Problème résolu | Données | Ce que l’IA (ou une règle) propose | Ce qui reste au coach | Risques | Verdict |
|---|---|---|---|---|---|---|
| Détection du décrochage | C1 | Retours, dates, « à 100 % ? », messages | **Des règles, pas de l’IA :** silence de 5 jours ou plus, 2 séances manquées sur 7 jours, « pas à 100 % » | Décider de contacter | Faux positifs (vacances) : prévoir « en pause » | **Immédiat, sans IA.** Avec 5 à 30 athlètes, il n’y a pas assez de données pour un modèle. |
| Rédaction des relances et des retours | P1, P4 | Prénom, motif, dernière séance, style du coach | Un brouillon court dans ton ton | Relire, modifier, envoyer | Ton faux ou trop générique ; ne jamais envoyer seul | **Utile vite.** Des modèles de messages d’abord ; l’IA seulement si les modèles lassent. |
| Synthèse de la semaine | P1 | Retours déclarés | [Fait] déjà fait par des règles (D-073) | Lire | — | **Garder sans IA** |
| Premier programme selon ta méthode | C2, C4 | Bilan, ta méthode, ta bibliothèque | [Fait] générateur à règles ; l’IA ajuste les réglages (D-071) | Relire chaque séance, publier | Une erreur de charge ; confiance | **Second.** Mesurer le temps d’édition avant d’investir (H5). |
| Lecture de tes écrits (import) | C2 | Texte collé | [Fait] lecture par règles tolérantes | Vérifier l’aperçu | Mauvaise lecture d’une zone | **Garder les règles.** L’IA n’intervient qu’en secours sur les lignes illisibles. |
| Adaptation d’une séance | A3 | Séance prévue, minutes disponibles, bibliothèque | Version courte de la même famille | Le coach a défini les règles ; il est prévenu | Douleur cachée derrière la fatigue : renvoyer vers « à 100 % ? » et le coach | **Tester sans IA** (règle des paliers) |
| Repérage de tendances (surmenage, stagnation) | C5 | Historique sur 8 semaines ou plus | Signal « en baisse depuis 3 semaines » | Interpréter | Bruit, faux signal | **Second.** Une règle simple suffit. |
| Analyse vidéo | — | Vidéo | — | — | Peu fiable, coûteux, hors course sur route | **Abandonner** |

**Conclusion.** L’IA n’est **pas** la différence de CoachOS. Les gains immédiats viennent de règles lisibles et de brouillons de messages. L’IA générative est un confort à tester une fois le crédit ajouté, pas une fondation.

---

## 7. Public cible initial

### Persona coach prioritaire : « le coach de course à pied indépendant qui accompagne ses proches et sa communauté »
- **Profil :** coach de course à pied indépendant francophone. Activité principale ou à côté. 5 à 30 athlètes, du 5 km au marathon. Beaucoup de débutants, de reprises et de coureurs réguliers qui veulent passer un cap.
- **Mode :** surtout à distance (plan hebdomadaire), plus éventuellement une séance collective sur place.
- **Outils actuels :** Google Docs ou Sheets par athlète, WhatsApp, Strava, parfois Garmin Connect. [Fait] C’est ton cas.
- **Frustrations :** ressaisie et copier-coller ; pas de vue d’ensemble ; il découvre trop tard qu’un athlète a décroché ; les zones expliquées encore et encore.
- **Revenu :** [À valider] de 0 € (proches) à quelques centaines d’euros par mois. Le prix n’est pas le sujet de ce document.
- **Besoin principal :** garder ses athlètes réguliers sans y passer ses soirées. **Retenir et gagner du temps, pas grandir à 100 clients.**

### Persona athlète
- Adulte de 25 à 55 ans, 2 à 4 séances par semaine, un objectif daté (10 km, semi, retour de blessure, perte de poids).
- Téléphone toujours sur lui, montre Garmin pour une partie [À valider : quelle part ?].
- Il attend de la clarté (« quoi faire aujourd’hui »), de l’encouragement et une réponse humaine. Pas de tableaux de données.

### Pourquoi ce segment d’abord
- [Fait] C’est ton métier. Tu peux observer, tester et corriger toi-même chaque semaine, avec 6 ou 7 vrais athlètes.
- [Fait] Tout le produit déjà construit le sert : allures, VMA, course-marche, Foulée, ta méthode.
- **Ce qui diluerait le produit :** le triathlon (trois sports, outils experts en place), la musculation (autre métier, marché saturé), les gros clubs (droits, plusieurs coachs, facturation). On les sert plus tard, avec des preuves.

---

## 8. Livrables

### Proposition de valeur
- **Pour le coach :** « Chaque soir, CoachOS te dit en deux minutes quels athlètes ont besoin de toi et ce que tu pourrais leur dire. Tes programmes s’écrivent comme tu les écris déjà, et ta méthode est appliquée sans copier-coller. »
- **Pour l’athlète :** « Ouvre l’app : ta séance du jour est là, dans tes allures, avec les mots de ton coach. Dis comment ça s’est passé en 15 secondes : il le voit, et il te répond. »

### Bénéfices essentiels (mesurables)

| # | Bénéfice | Problème | Mesure | Cible indicative [Hypothèse] |
|---|---|---|---|---|
| B1 | Aucun athlète oublié | C1 | Athlètes silencieux depuis 7 jours ou plus non contactés | 0 sur 4 semaines |
| B2 | Le tour du soir en quelques minutes | C1, C3 | Temps du tour quotidien, chronométré avant et après | −50 % |
| B3 | Séance claire et retour facile | A1, A2 | Séances publiées avec un retour sous 48 h | ≥ 70 % |
| B4 | La méthode sans ressaisie | C2, C4 | Minutes pour publier la semaine de tous les athlètes | −30 % |
| B5 | Des athlètes qui restent | A4 | Athlètes encore actifs à 8 semaines | ≥ 85 % |

### Décisions produit

| Décision | Éléments |
|---|---|
| **Conserver** | Boucle publier → lire → retour → revue ; séance structurée et allures personnelles ; retour rapide ; « à 100 % ? » et son suivi ; bibliothèque (Foulée et la tienne) ; import de tes écrits ; installation sur téléphone ; séance de groupe ; rien publié ni envoyé sans le coach ; exclusion des données de santé |
| **Améliorer** | Fusionner Planning, résumé de la semaine et file des retours en un **brief du jour** ; statuts d’adhésion lisibles (en rythme, à surveiller, à risque, silencieux, en pause) ; **mode simple** côté coach ; mise en ligne avec https (lecture hors ligne et accès hors Wi-Fi) |
| **Tester** | Relances pré-rédigées ; adaptation « je n’ai que 30 minutes » ; check-in hebdo en 3 questions ; générateur et IA (temps d’édition) ; intérêt réel pour la séance sur la montre |
| **Reporter** | Paiement et renouvellement ; Strava ; multisport ; statistiques avancées ; gamification ; groupes et niveaux au-delà de la séance de groupe ; IA générative en production |
| **Abandonner** | CRM de prospection ; analyse vidéo ; nutrition et santé (tant que D-084 tient) ; réservation façon Calendly ; repositionnement vers la musculation |

### Questions décisives (à trancher par toi)
1. **Quel coach servons-nous d’abord ?** Proposition : le coach de course à pied indépendant francophone, de 5 à 30 athlètes. Abandonnes-tu définitivement la piste « musculation hybride » ?
2. **Quel problème unique CoachOS résout-il mieux que tout le reste ?** Proposition : « savoir chaque jour qui a besoin de moi, avec la séance et la méthode au même endroit ».
3. **Quelle action fréquente optimiser en premier ?** Côté athlète : ouvrir la séance et donner son retour. Côté coach : le tour du soir.
4. **La séance sur la montre est-elle indispensable dès le pilote ?** Si oui, l’accès Garmin, donc la création de l’entreprise, devient le premier chantier. Sinon, le téléphone suffit pendant le pilote.
5. **Des adaptations peuvent-elles être automatiques ?** Proposition : seule la version courte prévue par le coach, toujours signalée. Tout le reste est validé par toi.
6. **Remplacer ou cohabiter ?** Proposition : remplacer Google Docs et le suivi de tête, cohabiter avec WhatsApp et Strava.
7. **Quel indicateur prouve la valeur ?** Proposition : séances avec un retour sous 48 h (athlète), et athlètes silencieux contactés à temps (coach).
8. **Que s’est-il passé avec Foulée en production ?** Combien d’élèves l’ont utilisée, combien de temps, quels écrans ? C’est la meilleure preuve d’usage disponible aujourd’hui, et elle n’est pas exploitée.

### Hypothèses à tester (par priorité)

| # | Hypothèse | Risque si elle est fausse | Méthode | Qui | Critère de succès | Décision |
|---|---|---|---|---|---|---|
| H1 | Les athlètes ouvrent CoachOS et donnent leur retour sans relance | Tout le produit repose sur ces retours | Pilote de 4 semaines en ligne | Tes 6 ou 7 athlètes | ≥ 70 % de séances avec un retour sous 48 h, au moins 3 semaines sur 4 | Échec : simplifier le retour, tester des rappels, comprendre pourquoi |
| H2 | Le brief du jour fait gagner du temps et évite les oublis | La promesse principale tombe | Chronométrer le tour du soir 1 semaine sans CoachOS, puis 3 semaines avec ; noter chaque oubli | Toi | −50 % de temps, 0 silence de 7 jours non vu | Échec : revoir les règles et l’écran |
| H3 | D’autres coachs écrivent leurs programmes comme toi, et l’import les lit | La différence « ta méthode » ne s’étend pas | Demander 3 programmes réels à 5 coachs et mesurer le taux de lecture | 5 coachs d’endurance | ≥ 85 % des lignes lues sans correction | Échec : garder l’import pour toi, ne pas en faire un argument |
| H4 | Une relance pré-rédigée est envoyée sans gros changement | Fonctionnalité inutile | Pendant le pilote, proposer un brouillon et mesurer la part envoyée et les retouches | Toi | ≥ 60 % envoyées avec peu de retouches | Échec : abandonner, garder le message libre |
| H5 | Le générateur produit un premier programme que tu modifies peu | Grosse brique à faible valeur | Pour 3 athlètes, comparer le générateur et ton Google Doc : temps et nombre de corrections | Toi, puis 2 coachs | Moins de 20 % de séances modifiées | Échec : figer le générateur, privilégier les programmes types |
| H6 | « Je n’ai que 30 minutes » évite des séances sautées | Fonction inutile | Prototype sur 2 semaines, compter son usage et les séances sautées | Tes athlètes | Au moins 1 usage par athlète et par mois, moins de séances sautées | Échec : ne pas construire |
| H7 | La séance sur la montre est attendue dès le départ | Pilote biaisé ou abandon | Questionner tes athlètes : quelle montre, utilisent-ils les séances structurées ? | Tes athlètes, puis 20 coureurs | ≥ 50 % équipés et intéressés | Oui : l’accès Garmin devient prioritaire, avec création de l’entreprise |
| H8 | Des coachs extérieurs préfèrent CoachOS à Nolio, aux Docs ou à TrainingPeaks | Pas de marché au-delà de toi | Entretiens, puis essai accompagné de 2 semaines | 3 à 5 coachs (dont des utilisateurs de Nolio) | 2 sur 5 veulent continuer | Échec : revoir le persona avant toute offre commerciale |

---

## 9. Recommandation : le prochain MVP et les premières validations

**MVP « une vraie semaine », 4 semaines, toi et tes 6 ou 7 athlètes.**

1. **Mettre CoachOS en ligne avec une adresse https.**
   - [Fait] C’est le blocage n° 1 : hors de ton Wi-Fi, personne ne peut l’ouvrir.
   - Il faut un hébergement et une base Supabase en ligne. Ce sont des comptes que toi seul peux créer ; je te guiderai pas à pas.
   - Les données réelles restent limitées à ton espace (règles de CLAUDE.md).
2. **Un périmètre réduit, visible.**
   - Côté athlète : Aujourd’hui, retour rapide, « à 100 % ? », Programme, Échanges.
   - Côté coach : **brief du jour**, revue des retours, fiche, bibliothèque et import, publication de la semaine.
   - Le reste est caché par un **mode simple**, pas supprimé.
3. **Mesurer dès le premier jour :** retours sous 48 h, temps du tour du soir, silences repérés, écrans réellement ouverts.
4. **Trancher la montre (Q4 et H7)** dans la première semaine, en interrogeant tes athlètes.
5. **Puis, après la semaine 2,** 5 entretiens avec des coachs d’endurance extérieurs (H3, H8), dont au moins 2 utilisateurs de Nolio.

**Geler jusqu’au bilan du pilote :** nouvelles fonctions, paiement, Strava, multisport, IA en production. La roadmap ne change qu’avec les résultats du pilote.

---

## Sources consultées le 21 novembre 2026

- [Trainerize vs TrueCoach vs Everfit, blog Trainerize](https://www.trainerize.com/blog/trainerize-vs-truecoach-vs-everfit-online-coaches/) · [Everfit vs Trainerize vs TrueCoach, FitBudd](https://www.fitbudd.com/insights/everfit-vs-trainerize-vs-truecoach?c84a98fb_page=10) · [Everfit vs Trainerize vs TrueCoach, blog Everfit](https://blog.everfit.io/everfit-vs-trainerize-vs-truecoach) · [Trainerize vs TrueCoach, Capterra](https://www.capterra.com/compare/140262-155784/Trainerize-vs-truecoach) · [Trainerize vs TrueCoach, Software Advice](https://www.softwareadvice.com/fitness/trainerize-profile/vs/truecoach/)
- [Nolio, un partenaire pour les entraîneurs d’athlétisme (Stadion)](https://stadion-actu.fr/nolio-un-partenaire-de-taille-pour-les-entraineurs-dathletisme) · [Nolio et la FFA (Stadion)](https://stadion-actu.fr/nolio-lapplication-pour-le-suivi-de-lentrainement-sassocie-a-la-ffa/) · [Nolio sur l’App Store](https://apps.apple.com/app/nolio/id1615773607) · [Tarifs Nolio](https://www.nolio.io/pricing/) · [Nolio MCP](https://www.nolio.io/en/mcp/)
- [TrainingPeaks : guide du coach](https://help.trainingpeaks.com/hc/en-us/articles/231470308-TrainingPeaks-Coach-User-Guide) · [TrainingPeaks : fonctions coach](https://trainingpeaks.com/coach-features) · [TrainingPeaks : synchronisation Garmin](https://help.trainingpeaks.com/hc/en-us/articles/204070864)
- [Everfit : tableau des check-ins (bêta)](https://help.everfit.io/en/articles/14495409-introducing-coach-check-in-dashboard-beta) · [Comparatif Everfit, Gymkee](https://gymkee.com/compare/everfit/) · [Athleex, clients sur le point d’arrêter](https://insider.fitt.co/press-release/athleex-launches-coaching-platform-that-flags-which-clients-are-about-to-quit/)
- [Strava rachète Runna (Engadget)](https://www.engadget.com/apps/strava-buys-uk-based-personalized-running-plan-app-runna-133044850.html) · [DC Rainmaker sur Strava et Runna](https://dcrainmaker.com/2025/04/strava-acquires-runna-thoughts-forward.html) · [Fonctionnement de Runna (the5krunner)](https://the5krunner.com/runna/)
- [Coachful, fiche Capterra](https://www.capterra.com/p/10038191/Coachful/) · [Coachful, Slashdot](https://slashdot.org/software/p/Coachful/) · [Coachful, SaaSWorthy](https://www.saasworthy.com/product/coachful)
- Sources du texte collé, non relues et à considérer comme des textes commerciaux : [Coachful](https://www.coachful.co/blog/best-software-for-hybrid-coaching) · [Coaching Portal (1)](https://coachingportal.io/blog/hybrid-coaching-delivery) · [Coaching Portal (2)](https://coachingportal.io/blog/best-software-for-hybrid-coaches) · [Gaugius](https://gaugius.com/best/online-fitness-coaching-software/)
- Projet : [RECHERCHE_MARCHE.md](../lecture/RECHERCHE_MARCHE.md) · [METHODE_FONDATEUR.md](execution/METHODE_FONDATEUR.md) · [DECISIONS.md](execution/DECISIONS.md) · [COUVERTURE.md](execution/COUVERTURE.md)
