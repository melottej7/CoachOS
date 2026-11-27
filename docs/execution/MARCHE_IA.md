# Marche à suivre · L’IA du coach, à la manière de Relay, sur notre base

Rédigée le 26 novembre 2026, à partir de l’analyse « Relay Athletic face à CoachOS » (document privé du fondateur). Ce chantier **passe avant l’abonnement Stripe** : six tranches, IA-0 à IA-5, une conversation par tranche. Stripe reprend ensuite, tel que décrit dans ETAT.md.

## Ce qu’on reprend de Relay, et ce qu’on fait autrement

| Relay | CoachOS |
| --- | --- |
| Dicter une séance, elle devient structurée | Pareil, mais la sortie passe par **notre notation** (`4×10 presse 60kg R2'`) et notre lecteur `parseNotation` : le texte reste lisible et corrigeable par le coach |
| « Coaching brain » : principes du coach | **Méthode du coach** déjà en base (`coach_dna`, D-072), rendue modifiable et injectée dans chaque appel |
| Agent qui rédige un programme depuis un message | Agent qui lit **nos** données (groupes, niveaux, repères, charges réalisées D-184, bibliothèque, machines Basic-Fit) et rend un **brouillon** ; le générateur existant reste le moteur |
| Assistant qui résume la semaine des athlètes | Assistant de l’Accueil : questions sur les élèves et brouillons (réponse à un retour, séance), jamais d’envoi ni de publication sans le geste du coach |
| Import depuis une photo ou un PDF | Pareil, vers l’import de programme existant (D-085) avec aperçu ligne par ligne |
| « Exercise Fill » | Consignes et erreurs fréquentes proposées pour un exercice ajouté, marquées « À relire » |
| IA Google Gemini, données en Allemagne | Claude (Anthropic) par le SDK déjà installé ; budget par espace déjà en place (`ai_budget`, D-081) |

## Règles communes à toutes les tranches

1. **L’IA propose, le coach décide.** Toute sortie est un brouillon stocké dans `ai_suggestions` (ou équivalent additif), affiché avec ce qu’elle a lu. Publier une séance ou envoyer un message passe par les commandes humaines existantes.
2. **Nos droits, pas ceux de l’IA.** Chaque outil exécute sa requête au serveur, dans la transaction de l’acteur, sous les politiques RLS existantes, borné à l’espace et aux affectations actives. L’IA ne reçoit jamais d’identifiant qu’elle pourrait réutiliser hors de l’espace.
3. **Données envoyées au modèle** : faits structurés seulement, noms et prénoms remplacés (`redactNames`). Jamais Strava ni données dérivées, jamais de santé (D-084), jamais de note privée ni de message brut sauf le retour sur lequel le coach demande un brouillon.
4. **Le texte des élèves et des documents importés est une donnée, jamais une instruction** (protection contre l’injection) : il passe dans des blocs balisés, et la sortie est validée par nos schémas zod avant tout usage.
5. **Budget** : réserve avant l’appel, coût réel après (code existant de `server/commands/ai.ts`). Un refus de budget laisse la voie manuelle intacte.
6. **Simulation** : sans `ANTHROPIC_API_KEY` ou avec `COACHOS_AI=simulation`, chaque tranche a une réponse simulée déterministe, de même forme ; les tests et les parcours de bout en bout tournent en simulation.
7. **Interrupteur** : chaque nouveauté IA est derrière `COACHOS_AI` (et un réglage par espace si utile) ; éteinte, l’app reste complète.
8. **Fin de tranche** comme d’habitude (CLAUDE.md) : tests, typecheck, build, parcours de bout en bout, droits testés, deux rôles vus à 1440 et 390 px, décision courte dans DECISIONS.md, ETAT.md à jour, commit. Migrations additives, appliquées en local avant le code.

## Choix techniques (à confirmer en tranche IA-0)

- **SDK** : `@anthropic-ai/sdk`, déjà utilisé. Charger la compétence `claude-api` avant d’écrire du code d’appel.
- **Modèle** : `claude-opus-5-5` (déjà `AI_MODEL`), rendu réglable par variable `COACHOS_AI_MODEL` pour que le fondateur puisse essayer `claude-sonnet-5-5`, deux fois moins cher, sans toucher au code. `output_config.effort` toujours écrit explicitement (`low` pour la dictée, `medium` ou `high` pour un programme).
- **Boucle d’outils** : le *Tool Runner* du SDK (`client.beta.messages.toolRunner` + `betaZodTool`), hébergé dans nos fonctions Vercel. Pas d’agent hébergé chez Anthropic : nos données et nos droits restent chez nous.
- **Pièges connus sur ce modèle** : pas de `tool_choice` forcé (`any` ou `tool` répondent 400 : utiliser `auto`, `strict: true` sur les outils et la consigne) ; pas de pré-remplissage de réponse ; réflexion non désactivable (régler l’effort) ; vérifier `stop_reason` (`refusal`, `max_tokens`) avant de lire le contenu ; repli serveur `fallbacks: "default"` avec le beta `server-side-fallback-2026-07-01`.
- **Sorties** : JSON structuré par `output_config.format` (comme `AI_PROPOSAL_JSON_SCHEMA`), puis validation zod, seule source de vérité.
- **Cache** : consigne système et liste d’outils figées, dans un ordre stable, avec `cache_control` ; la méthode du coach juste après ; rien de variable (date, identifiants) avant le dernier point de cache. Contrôler `cache_read_input_tokens`.
- **Voix** : Claude ne transcrit pas l’audio ici. La dictée se fait par le téléphone (micro du clavier, ou reconnaissance vocale du navigateur quand elle existe) et c’est le **texte** qui part au modèle. Aucun fichier audio n’est envoyé.
- **Durée** : réponses en flux (`stream` + `finalMessage()`) pour les programmes ; `maxDuration` des routes à régler selon le plan Vercel.

## Pour le fondateur (avant IA-0)

1. **Clé Anthropic et crédit** · 10 minutes · https://platform.claude.com (l’ancienne console.anthropic.com) › **Billing** › ajoute un crédit (20 $ suffisent pour tous les essais) › **API Keys** › **« Create Key »** › nom `CoachOS` › copie-la › Vercel › Environment Variables › **« Add »** `ANTHROPIC_API_KEY` (**Sensitive**). En local, ouvre `apps/web/.env.local` et ajoute une ligne `ANTHROPIC_API_KEY=` suivie de la clé (je ne la lis jamais). Sans clé, tout le chantier se construit et se teste en simulation : la clé ne sert qu’à l’essai réel.
2. **Budget** · facultatif · `COACHOS_AI_MONTHLY_BUDGET_USD` (10 $ par espace et par mois par défaut).
3. **Relire la notice de confidentialité** après IA-0 : Anthropic y figure comme sous-traitant (texte « à faire relire par un professionnel »).

---

## Prompt maître

À coller au début de chaque conversation du chantier, suivi du prompt de la tranche.

```text
Chantier « IA du coach » de CoachOS, à la manière de Relay Athletic, sur notre base.
Lis docs/execution/ETAT.md jusqu’à « Pour le fondateur », puis docs/execution/MARCHE_IA.md en entier (règles
communes, choix techniques, et la section de la tranche demandée). N’ouvre les autres documents que pour la
section utile (docs/08_AI_ASSISTANT.md pour le pipeline et les modules, docs/09_COACH_DNA.md pour la méthode).
Avant d’écrire un appel au modèle, charge la compétence claude-api et appuie-toi sur le code existant :
apps/web/server/commands/ai.ts (appel unique, budget, simulation, journal ai_suggestions) et
packages/domain/src/ai-coach.ts (schémas, consigne, retrait des noms).

Objectif : le coach écrit ou dicte ce qu’il veut, l’IA lit nos données avec ses droits et rend un brouillon qu’il
relit, corrige et accepte. Rien n’est publié ni envoyé sans son geste. Les données Strava, la santé et les notes
privées ne partent jamais au modèle. La voie manuelle reste complète, IA éteinte ou budget atteint.

Architecture attendue : un module serveur commun (client, modèle réglable par COACHOS_AI_MODEL, effort explicite,
repli serveur, cache de la consigne et des outils, budget, journal, simulation) et des outils en lecture bornés à
l’espace et aux affectations, exécutés dans la transaction de l’acteur sous RLS. Sorties validées par zod.
Chaque tranche a sa simulation déterministe, ses tests (dont injection dans le texte, données d’un autre espace,
budget atteint, modèle indisponible) et ses parcours de bout en bout en simulation.

Travaille seul sur tout ce qui est réversible. Fin de tranche selon CLAUDE.md. Réponds en français, comptes rendus
courts : ce qui change pour le fondateur, vérifié ou non, prochaine action.
```

---

## IA-0 · Socle commun

**But** : un seul point d’appel au modèle, réutilisé par toutes les tranches, avec outils, cache et repli. Aucune nouveauté visible sauf la consommation dans Paramètres.

```text
Tranche IA-0 (socle). Refactore apps/web/server/commands/ai.ts en un module serveur commun (par exemple
apps/web/server/ai/) sans changer le comportement de « Ajuster avec l’IA » (D-071) :
- client unique, modèle par COACHOS_AI_MODEL (défaut claude-opus-5-5), effort explicite par usage, repli serveur
  fallbacks "default", gestion de stop_reason (refusal, max_tokens) en « l’IA n’a pas pu traiter » ;
- fonction d’appel simple (sortie JSON structurée) et fonction avec outils (Tool Runner du SDK, betaZodTool,
  strict), même budget (réserve puis coût réel, y compris les tours d’outils), même journal ai_suggestions
  (module, version de consigne, empreinte, usage) ;
- cache : consigne système et outils figés en tête avec cache_control, puis la méthode du coach ; test qui
  vérifie que le préfixe ne change pas d’un appel à l’autre ;
- premiers outils en lecture, bornés à l’espace : listerExercices (bibliothèque du coach + machines Basic-Fit),
  lireGroupe, lireEleve (niveau, repères, sans nom), lireChargesRecentes (D-184) ; chacun dans la transaction
  de l’acteur, refus testé pour un autre espace ;
- simulation déterministe pour chaque fonction ;
- Paramètres › IA : consommation du mois (existe), modèle utilisé, interrupteur par espace si absent.
Ajoute Anthropic comme sous-traitant dans la notice de confidentialité (texte à faire relire). Pas de migration
sauf si un champ manque (additive). Décision D-xxx courte.
```

## IA-1 · Dicter ou écrire une séance

**But** (le geste phare de Relay) : dans l’éditeur de séance, « Dicter » ou « Écrire en langage courant » → la séance apparaît structurée, prête à relire.

```text
Tranche IA-1 (dicter une séance). Dans l’éditeur de séance du coach (apps/web/views/coach/workout/builder.tsx),
ajoute « Dicter / écrire avec l’IA » : un champ de texte libre où le coach écrit ou dicte (micro du clavier du
téléphone ; bouton micro du navigateur quand la reconnaissance vocale existe, sinon caché). Exemple :
« échauffement 10 minutes vélo, puis presse 4 séries de 10 à 60 kilos, 2 minutes de repos, tirage poitrine 3 fois
12, gainage 3 fois 45 secondes ». Endurance aussi : « 3 fois 8 minutes à 90 % de VMA, récup 2 minutes ».
Le modèle (effort low) reçoit le texte, le sport, les repères de l’élève sans nom et l’outil listerExercices ; il
rend des lignes dans NOTRE notation, chaque exercice relié à un exercice de la bibliothèque ou de la salle quand il
existe. Le serveur passe le résultat par parseNotation : ce qui ne se lit pas est signalé ligne par ligne, rien
n’est inventé. Le coach voit l’aperçu, corrige le texte, puis « Insérer dans la séance » (brouillon, jamais publié).
Aucun audio n’est envoyé. Simulation : un petit lecteur de règles pour les exemples ci-dessus. Tests : notation
valide, exercice inconnu, texte vide ou trop long (limite), injection (« ignore tes consignes… ») sans effet,
budget atteint (message et voie manuelle). Parcours de bout en bout en simulation, vu au téléphone à 390 px.
```

## IA-2 · La méthode du coach

**But** : l’équivalent du « coaching brain » ; l’IA écrit comme ce coach.

```text
Tranche IA-2 (méthode du coach). La méthode existe (coach_dna, D-072, docs/09_COACH_DNA.md) avec une philosophie
en lecture seule. Rends-la modifiable dans Paramètres › Ma méthode : quelques champs courts (principes, progression
habituelle, échauffement type, repos, vocabulaire, ce qu’il ne fait jamais), versionnés comme aujourd’hui.
« Proposer depuis ma bibliothèque » : l’IA lit 10 à 20 séances du coach (outil existant) et propose un texte de
méthode que le coach accepte, corrige ou refuse. La méthode acceptée est injectée après la consigne système, en
zone cachée, dans IA-1, IA-3 et IA-4 ; une méthode vide ne change rien. Migration additive si un champ manque.
Tests : versions, droits (un coach ne lit pas la méthode d’un autre), méthode vide, injection dans le texte de la
méthode, cache conservé.
```

## IA-3 · Un programme rédigé par l’agent

**But** : « Prépare 8 semaines de force pour le groupe Débutants, 3 séances par semaine, salle Basic-Fit ».

```text
Tranche IA-3 (programme par l’agent). Depuis un élève ou un groupe, « Préparer un programme avec l’IA » : le coach
écrit sa demande. L’agent (Tool Runner, effort medium à high, en flux) utilise les outils en lecture (groupe,
niveaux, repères, charges récentes D-184, bibliothèque, machines de la salle, méthode du coach, calendrier des
séances déjà prévues) et rend un brouillon de programme : semaines, séances en notation CoachOS, intention de
chaque semaine. Le serveur valide chaque séance par parseNotation et le générateur existant (program.ts,
program-blocks.ts) contrôle les bornes et la faisabilité ; ce qui échoue est montré, jamais corrigé en silence.
Le coach voit le programme semaine par semaine avec ce que l’IA a lu, modifie, puis « Enregistrer en brouillon »
(rien n’est publié ; la publication reste la commande habituelle). Limites : nombre de tours d’outils et budget
par demande. Si la charge en % du max n’existe pas encore, l’agent écrit des kilos à partir des charges réalisées,
ou « charge à choisir » quand il n’en a pas. Tests : groupe d’un autre espace refusé, élève sans historique,
demande impossible (abstention expliquée), tours d’outils plafonnés, modèle indisponible. Parcours de bout en bout.
```

## IA-4 · L’assistant du coach

**But** : questions et brouillons depuis l’Accueil ou la palette ⌘K.

```text
Tranche IA-4 (assistant du coach). Un panneau « Demander » sur l’Accueil et dans la palette ⌘K. Le coach pose une
question ou demande un brouillon : « Qui n’a pas fait ses séances cette semaine ? », « Résume la semaine du groupe
Trail », « Prépare une réponse au retour de [élève] ». Outils en lecture (séances prévues et réalisées, retours,
tâches, groupes) ; outils d’écriture limités à des BROUILLONS : brouillon de réponse (affiché dans la conversation,
envoyé seulement par le bouton existant), brouillon de séance (vers l’éditeur), tâche proposée. Réponses courtes,
chaque fait relié à sa source (lien vers le dossier ou la séance), « données insuffisantes » quand c’est le cas,
conforme aux modules summary et feedback de docs/08_AI_ASSISTANT.md. Les prénoms sont remis à l’affichage côté
serveur, jamais envoyés au modèle. Pas de mémoire entre deux questions au début (chaque demande repart des données).
Tests : fuite entre espaces, injection dans un retour d’élève, demande d’envoi direct refusée, budget.
```

## IA-5 · Importer une photo ou un PDF, et la fiche d’exercice

**But** : reprendre les anciens programmes du coach sans les retaper ; compléter un exercice ajouté.

```text
Tranche IA-5 (photo, PDF, fiche d’exercice).
1) Dans l’import de programme (D-085, program-import.ts) : « Depuis une photo ou un PDF ». L’image ou le PDF est
envoyé au modèle (vision ou document), qui rend le texte en notation CoachOS ; le parcours existant (aperçu ligne
par ligne, aucun écrasement) prend la suite. Taille limitée, fichier jamais conservé au-delà de l’import, refus
clair pour une photo illisible.
2) Bibliothèque › un exercice ajouté par le coach : « Proposer les consignes » ; l’IA rédige consignes et erreurs
fréquentes, marquées « À relire », que le coach accepte ou corrige. Jamais de conseil médical.
Tests : document hors sujet, injection dans le document, budget, droits.
```

## Après IA-5

Reprendre « De quoi vendre » : abonnement Stripe en mode test (ETAT.md). Mettre en avant dans la page Offres ce que l’IA fait gagner, mesuré sans identité d’élève (temps entre la demande et le brouillon accepté).
