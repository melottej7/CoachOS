# 09 · Coach DNA™

Coach DNA versionne les préférences confirmées et les règles métier d’un coach par espace. Phase MVP, fiche déclarative avec simulation. V2, candidats appris à partir de corrections autorisées et confirmées. V3, automatisation des tâches internes si le gain mesuré couvre le risque et le coût. Le pitch utilisateur précise ce que le profil change, d’où vient la règle et comment la modifier.

## Modèle canonique

Un profil actif par coach et espace. Chaque version a coachId, workspaceId, version, schemaVersion, policyVersion, state, createdAt et journal d’activation. Le JSON stocke philosophie textuelle courte, ton, adaptations bornées, opt-in de tâches internes et règles typées. Couches liées à la phase, sport, situation et préférence. Les notes privées et documents externes sont exclus sans décision distincte. Les règles n’ont ni texte exécutable ni accès aux données externes.

| Dimension | Champs / exemples | Validation |
|---|---|---|
| Philosophie | « priorité à la régularité » | 1 à 500 caractères, contexte de lecture. Aucun effet exécutable. |
| Style | direct, encourageant, pédagogique | Ton et langue bornés. Aucun effet sur la prescription. |
| Méthodologie | progression en durée, récupération, critères de répétition | Bornes par famille, activité sportive et phase. Comparaisons uniquement sur unités concordantes. |
| Arbitrage | seuil de durée ou RPE, demande de revue, priorité locale | Prédicat typé et effet autorisé. Pas de règle arbitraire. |
| Prudence | signal de douleur, information incomplète, règle opposée | Bloquer les propositions de changement et faire revoir. La blessure est une information sensible éventuelle, absente du flux MVP. |
| Supervision | mode suggestion ou préparation interne | Par défaut suggestion. Autoriser uniquement file interne et rappels non cliniques au coach. |

```json
{
  "schemaVersion": 1,
  "philosophy": "Prioriser la régularité.",
  "style": "pédagogique",
  "maxChangePercent": 10,
  "allowInternalQueue": false,
  "rules": [{
    "id": "581fd284-5fa5-4f3f-870a-d1428b21b290",
    "sport": "running",
    "metric": "rpeDelta",
    "operator": "gte",
    "threshold": 2,
    "effect": "review_only"
  }]
}
```

Le seuil est une préférence de revue, sans interprétation clinique. Codifier les tuples permis. Exemple, rpeDelta/gte/0..10/review_only ou plannedDurationSeconds/gte/1..86400/review_only. Un effet de proposition d’ajustement, s’il est activé en V2, nécessite borne absolue et relative, prochaine séance future et validation humaine. Refuser les pilotes qui appliquent des règles entre coachs.

## Compilation et décision

1. Vérifier le schéma du profil et charger uniquement la dernière version active pour ce coach. Les drapeaux, consentements et l’affectation sont contrôlés avant toute personnalisation. Retenir version de profil et de moteur, date et contexte.
2. Résoudre les règles en ordre stable. Priorité égale implique groupe de règles d’un même champ. Ordre de sécurité, politiques de traitement et garde-fous, contraintes du dossier explicitement configurées, règles spécifiques coach/sport, puis paramètres génériques.
3. Évaluer en logique à trois valeurs vrai, faux, inconnu. En cas de valeur manquante, afficher inconnu, ne pas activer l’effet. Deux effets incompatibles engendrent revue humaine. Un effet de prudence l’emporte.
4. Produire une trace contenant règle, opérande, unité, résultat, raison et actions possibles. Construire candidats autorisés et bloquer les autres. L’assistant reçoit seulement la trace autorisée.
5. Avant validation humaine recalculer l’empreinte. Une différence entraîne périmé. L’activation d’un profil n’agit pas rétroactivement. Revenir à une version ancienne en créant une révision auditée.

## Apprentissage depuis les corrections

Attribuer action, rédaction, exception ou donnée manquante. Le coach peut écarter une correction avant tout apprentissage. Extraire les différences structurées lorsque la décision est comparable. Éliminer données Strava, texte privé non autorisé, signaux médicaux et historiques sans provenance. Grouper par coach, sport, métrique, effet et signe du changement. Une même séance, édition, semaine répliquée ou plusieurs corrections du même exemple comptent une fois. Sur les 90 derniers jours, exiger au moins 5 observations indépendantes et 2 semaines, au plus une observation par dossier et semaine pour une candidate. Exiger une concordance de 80 % et un contre-exemple affiché si disponible. Refuser la proposition si contradiction connue ou couverture insuffisante. Les seuils restent internes et calibrables.

Une candidate contient support, contradictions, contexte, portée, identité de preuve pseudonymisée, date d’expiration et estimation du nombre de décisions touchées. Elle passe par simulation sur une fenêtre tenue à part, puis validation explicite. L’acceptation crée un draft. Une seconde action active. En cas de retrait du droit de traitement ou d’effacement, retirer les preuves associées et invalider la candidate. Revoir la version active si la justification disparaît. Aucune collecte ou réutilisation inter-coachs pour apprentissage sans une décision de traitement distincte.

## Confiance et supervision

Le niveau est un contrôle produit, pas une probabilité. Faible si couverture insuffisante ou règle non confirmée, donc abstention. Moyen si règles cohérentes mais preuve récente partielle, permettant la revue sans proposition exécutable. Élevé si règle validée, preuve complète, désaccord absent et contexte récent, permettant un brouillon contextualisé. Une confiance élevée ne donne aucun droit supplémentaire. Le coach peut arrêter la supervision dans les paramètres. Toute tâche interne automatique a quota par dossier, déduplication quotidienne, trace, annulation et liste des personnes autorisées.

Prompt en V2, « À partir des différences structurées, décris une hypothèse de règle avec sport, contexte, opérandes, effet et contre-exemples. S’il manque une preuve indépendante, rends abstain. Ne modifie aucune règle. » Le moteur recalcule le support et valide la candidate. Les futures préférences par cycle, équipes, imports opt-in et modèles fournisseurs sont ouvertes seulement après mesure générique vs DNA et validation de la provenance et de la rétention.
