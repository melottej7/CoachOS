# Démarrer avec Claude Code

Extraire le package dans l’espace de développement. Si celui-ci contient déjà une application, préserver ses fichiers de configuration et placer le package dans un sous-dossier. Indiquer le chemin à Claude. Pour faire lire les instructions à chaque session, placer ou intégrer `CLAUDE.md` à la racine du dépôt de développement.

## Premier message à donner à Claude

> Utilise le package CoachOS comme spécification de référence et agis comme développeur principal sur plusieurs sessions. Lis CLAUDE.md, README.md, la section recette de docs/03_UX.md et l’ordre des tranches de docs/11_ROADMAP.md. Ouvre le prototype. Identifie le code et les outils déjà présents dans le dépôt. Si l’application cible n’a pas encore de code, initialise l’environnement local en suivant la stack du package. Commence avec le plus petit parcours réel dans lequel le coach crée et publie une séance et l’athlète la lit côté mobile. Ajoute ensuite le retour et la revue au lieu d’étendre séparément les modules. Utilise d’abord des données fictives. Consigne tes hypothèses dans docs/execution/DECISIONS.md et ton état dans docs/execution/ETAT.md. Lorsque tu rencontres une décision réversible, choisis l’option la plus simple compatible avec le produit. Rends chaque tranche démontrable et laisse une prochaine action concrète pour la session suivante.

## Résultat attendu par étape

| Étape | Démonstration attendue |
|---|---|
| Première tranche | Deux rôles sur une même séance, état brouillon distinct du publié, lecture de la séance sur téléphone. |
| Deuxième tranche | Retour rapide, version observée conservée et file coach expliquant ce qu’il reste à traiter. |
| Pilote | Invitation valide, accès isolés, reprise, confidentialité, erreurs utiles et fluidité observée sur les deux appareils. |
| Suite du produit | Routines répétées, modèles, messagerie, Expo ou IA dans l’ordre justifié par les usages mesurés. |
| Commercialisation | Plan exact, validation des offres, facturation et canaux après validation des deux expériences. |

## Message de reprise

> Lis CLAUDE.md, docs/execution/ETAT.md, docs/execution/DECISIONS.md et le diff courant. Reprends la tranche déjà engagée ou la prochaine action indiquée. Vérifie le résultat sur les deux rôles concernés et mets à jour les preuves de reprise. Ne me redemande pas les décisions déjà consignées. Explique seulement les écarts qui changent une décision ou bloquent la suite.

Foulée peut faire l’objet d’une inspection ciblée si le dépôt arrive en cours de route. Claude poursuit le travail sur CoachOS et ouvre une décision de reprise séparée pour les composants qui apportent une valeur vérifiable.
