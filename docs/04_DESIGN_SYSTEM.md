# 04 · Design system

La page de revue privilégie la lisibilité et le suivi. Design calme, états visibles par texte, hiérarchie de densité inspirée de Stripe, Linear et Notion. Les couleurs d’intensité de séance ne servent jamais à coder seules un risque ou une priorité. Web et Expo partagent noms de tokens et règles d’état dans un paquet TypeScript. Chaque plateforme conserve ses contrôles natifs adaptés.

| Token | Clair | Sombre | Usage |
|---|---|---|---|
| canvas | #F2F5F4 | #111827 | Fond page |
| surface | #FFFFFF | #1F2937 | Carte et panneau |
| ink | #162E37 | #F4F7FC | Texte courant |
| muted | #50646A | #B9C5D8 | Métadonnées |
| accent | #0A6452 | #A0EBD2 | Bouton primaire en clair, texte interactif en sombre |
| on-accent | #FFFFFF | #101931 | Texte sur accent |
| rule | #C9D2E1 | #52637B | Séparation décorative |
| control-border | #667892 | #91A3BD | Bord de contrôle sans autre indicateur |
| focus | #1B65B0 | #A0EBD2 | Contour de focus |
| positive | #16653A | #9CE7B0 | Succès avec icône et texte |
| attention | #7A4600 | #F5D08A | Attention |
| danger | #9E2534 | #FFABB4 | Erreur ou action destructive |

## Typographie et espacements

Inter pour interface, défaut système si indisponible. IBM Plex Mono pour code, révisions et métriques à chiffres tabulaires si utile. Titres 28/36 ou 24/32, sections 20/28, corps 15/22 Web et 16/24 sur mobile, métadonnées 13/18. Laisser la taille dynamique native. Échelle d’espace 4, 8, 12, 16, 24, 32, 48 px. Rayons 6 et 10. Ombres réservées aux popovers. Ne pas tronquer les instructions critiques. Max 70 caractères en largeur de texte continu.

## Composants

| Composant | API et états | Accessibilité et comportement |
|---|---|---|
| Button | primary, secondary, ghost, danger, pending et disabled | `button` natif, action stable, état annoncé et espace tactile. |
| Field | label, hint, error, required, value | ID stable, erreur associée, type approprié, contexte conservé. |
| Textarea | valeur, compteur, limite et erreur | Libellé visible, retour ligne normal, aucun rich text au MVP. |
| DatePicker | label, date ISO, zone, min et max | Saisie manuelle, boutons accessibles, clavier, refus des dates ambiguës. |
| StatusBadge | label, tone et icône | Texte obligatoire, taille suffisante et pas de couleur seule. |
| Table | colonnes, tri, pagination, actions | En-têtes sémantiques, `aria-sort`, alternative mobile en cartes. |
| WeekCalendar | date locale, zone, cellules, vue liste | Déplacement clavier, actions alternatives au drag, focus conservé. |
| Dialog | titre, corps, confirm, cancel | Focus trap, retour au déclencheur, Escape sauf phase atomique brève. |
| Drawer | titre, navigation et fermeture | Mode modal mobile, panneau adjacent desktop avec hiérarchie de titres. |
| ErrorSummary | erreurs par chemin, liens vers champs | Annonce polie, position avant formulaire et focus initial sur échec. |
| EvidenceCard | label, origine, version, valeur et couverture | Pas de citation en tooltip seul. Lien vers la preuve quand permise. |
| Diff | avant, après, version | Deux colonnes desktop, sections nommées sur mobile. |
| Toast | confirmation courte et retour | Live region polie, ne remplace pas une erreur de champ ou un dialogue. |
| Skeleton | géométrie du contenu et chargement | Masqué aux lecteurs d’écran, annonce unique. Mouvement réduit respecté. |
| OfflineBanner | pending, retry, offline et resolved | Envoi en attente identifié, reprise sans duplication. |

## Responsive et thèmes

Sous 640 px, flux une colonne, barre basse athlète, calendrier en liste. De 640 à 1023 px, sidebar pliable et aperçu sous le contenu. Dès 1024 px, sidebar 232 px, calendrier jusqu’aux sept colonnes et détails en panneau latéral selon largeur. À 320 px et zoom 200 %, assurer les actions et lire le contenu, avec défilement horizontal local seulement pour les tableaux nécessaires. Afficher les fuseaux et unités en clair.

Thème système par défaut, sélection clair/sombre/système mémorisée. Séparer thèmes des états métier, y compris erreurs et focus. Aucun clignotement au montage. Préférer le contraste et le bord visible à l’ombre en sombre. Rendu des graphiques avec légende, table équivalente et valeur formatée.

## Validation accessibilité

Cibler WCAG 2.2 AA. Contrôler contraste texte normal 4,5:1, grand texte 3:1 et composants 3:1 selon l’usage. Viser 44 x 44 en interaction tactile, respecter au minimum les exigences et exceptions du standard applicable. Vérifier focus visible et non masqué, zoom, VoiceOver, TalkBack, lecteur d’écran Web, réduction du mouvement, repli des gestes et annonce d’erreur. Une release du parcours principal exige la preuve d’exécution des scénarios clavier et lecteur d’écran. [WCAG 2.2](https://www.w3.org/TR/WCAG22/)
