# CoachOS · Instructions permanentes pour Claude Code

**Langue : réponds toujours en français au fondateur, dans chaque message, y compris les guides pas à pas et les réponses courtes. Les libellés d’interface en anglais (boutons Supabase, GitHub, Vercel) sont cités tels quels dans des phrases françaises.**

Construire une application d’endurance fluide pour deux personnes. Le coach planifie et traite les retours. L’athlète trouve sa séance sur téléphone et dit ce qu’il a réalisé. Leur boucle manuelle est prioritaire. L’IA, les intégrations et le paiement suivent les preuves d’usage.

## Reprise et ordre de travail

1. **Reprendre depuis docs/execution/ETAT.md, lu jusqu’à « Pour le fondateur » inclus.** Ce fichier et la mémoire suffisent pour repartir. Les autres documents (README, docs/16, COUVERTURE, docs/03_UX, docs/11_ROADMAP, docs/12_CLAUDE_CODE, DECISIONS) ne s’ouvrent que pour la section utile à la tranche en cours (recherche ciblée, extrait), jamais en entier.
2. **Priorités en vigueur**, à appliquer sans relire leurs décisions :
   - **D-120** (23 novembre 2026, prévaut sur les priorités antérieures) : produit professionnel vendable ; chantiers dans l’ordre Confiance, Coach inconnu, De quoi vendre ; avancer seul sur tout ce qui est réversible.
   - **D-200** (28 novembre 2026, précise l’ordre de D-120) : utilisable d’abord, vendre ensuite ; IA essayée sur de vrais usages, boucle quotidienne sans friction et bouton « Une idée, un souci ? », temps gagné mesuré, besoins manquants, coachs testeurs gratuits, puis seulement paiement, domaine, textes légaux et prix.
   - **D-123** : refonte carte blanche (structure et interface), socle audité et protégé, direction Chrono (D-128) : clair, sombre ou automatique, palette ⌘K, deux densités.
   - **docs/16** (17 novembre 2026) : cible coach et élève (groupes et niveaux, dossier élève, accueil et tâches, bibliothèque, bilan, programmes supervisés, statistiques, activités et Garmin) ; prévaut en cas de divergence (D-024).
   - **Les demandes du fondateur dans la conversation passent avant la tranche prévue.**
3. **Une tranche est « faite »** quand :
   - les tests, le typecheck, la construction et les parcours de bout en bout sont verts ;
   - les droits sont testés ;
   - les deux rôles ont été vus au navigateur, à 1440 et 390 px.
   Distinguer « vérifié » et « non vérifié ». Les contrats SQL et OpenAPI sont tenus à jour.
4. **À chaque fin de tranche** : une décision courte dans DECISIONS.md, l’état et la prochaine action dans ETAT.md, un commit. Les décisions documentées restent en vigueur sauf nouvelle preuve ou instruction du fondateur.

## Économie de jetons

- **Une conversation par tranche.** Après chaque « c’est fusionné », l’état est écrit et le fondateur ouvre une nouvelle conversation ; une conversation qui s’allonge renvoie tout son contexte à chaque message.
- **Lire juste ce qu’il faut** :
  - recherche ciblée et extraits de fichiers plutôt que des fichiers entiers ;
  - sorties de commandes filtrées (résultat, erreurs) ;
  - pas de sous-agent sans nécessité.
- **Photos d’écran** :
  - deux ou trois par tranche, sur l’élément concerné ou réduites de moitié ;
  - la page pleine seulement pour juger une mise en page ;
  - le texte de la page plutôt qu’une photo quand il suffit.
- **Comptes rendus courts en français** : ce qui change pour le fondateur, ce qui est vérifié ou non, la prochaine action et, s’il y en a une, sa marche à suivre. Pas de récapitulatif de ce qu’il a déjà lu.
- **Décisions de dix lignes au plus.**

## Limites du développement

- Commencer sur données fictives. Foulée est une source facultative. Reprendre ses composants seulement si leur usage apporte un gain mesurable et s’ils conviennent à la cible. Auditer avant reprise de ses données.
- Toute donnée réelle est limitée à son espace et à son affectation. Les droits sont contrôlés au serveur et en base. Toute publication de prescription et tout envoi de message restent explicites.
- Ne pas envoyer à l’IA les données Strava ou dérivées. Garder la voie manuelle utilisable.
- Chantier commercial ouvert par D-120 (23 novembre 2026), dans ses limites : paiement en mode test derrière un interrupteur éteint en production ; prix = hypothèses de docs/13, modifiables sans toucher au code ; textes légaux marqués « à faire relire par un professionnel ». Avancer seul sur tout ce qui est réversible ; tenir la liste unique « Pour le fondateur » dans ETAT.md.
- Ce qui arrive sur main part en ligne : seulement des parcours entièrement refaits et vérifiés (D-123), qui ont passé tests, typecheck et build, jamais un code qui attend une migration non appliquée en ligne ; migrations additives uniquement ; la base en ligne n’est jamais un terrain d’essai (D-019).
