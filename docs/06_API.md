# 06 · API Design

[Contrat OpenAPI 3.1 JSON](../contracts/openapi.json). Base `/api/v1`. Web et Expo utilisent les mêmes commandes. L’Auth Supabase émet et renouvelle les jetons par son SDK. La valeur de `wid` choisit le contexte mais ne donne aucun droit. En Web, la session est du côté serveur. Un appel par cookie nécessite vérification d’origine pour les mutations.

## Conventions

U = identité vérifiée, O = propriétaire actif, C = coach (affectation obligatoire sur dossier), A = athlète de la relation, CA = C ou A, S = webhook signé. Chaque mutation vérifie le statut actuel. La lecture de dossier inaccessible répond 404.
Les champs de chemins sont des UUID, sauf vid qui est un entier positif. Les collections utilisent cursor opaque de portée limitée et limit 1–100, 30 par défaut. Fenêtre de calendrier de 42 jours. JSON strict, 64 Kio par défaut, 256 Kio pour import. Les chaînes de retour vides sont normalisées en null lorsqu’optionnelles. Date locale ISO, instant RFC 3339 et fuseau IANA.
Idempotency-Key UUID obligatoire sur les mutations, sauf webhook Stripe. Conserver empreinte et réponse pendant 24 h, refuser 409 si la même clé a un contenu différent. Garder les clés d’opérations fournisseurs via identifiants natifs. 202 lance une tâche durable.
Le plafond affiché est par identité et route sur 60 secondes. Pour Stripe, utiliser plafond d’infrastructure borné avec reprise fournisseur en cas de saturation. Signaler Retry-After sur 429. Pour IA, appliquer aussi les plafonds par espace, par jour et par mois.

| HTTP | Code | Reprise |
|---|---|---|
| 400 | MALFORMED_REQUEST | Corriger la forme, la signature ou l’entête. |
| 401 | AUTH_REQUIRED_OR_INVALID_SIGNATURE | Réauthentifier au plus une fois sur le client. |
| 403 | ACTION_FORBIDDEN_OR_FEATURE_DISABLED | Ne pas proposer l’action. |
| 404 | RESOURCE_NOT_VISIBLE | Revenir à la liste autorisée. |
| 409 | CONFLICT_OR_QUOTA | Recharger avant une nouvelle intention, traiter quota séparément. |
| 422 | INVALID_FIELDS | Afficher les erreurs par champ. |
| 429 | RATE_LIMITED | Respecter Retry-After. |
| 503 | TEMPORARILY_UNAVAILABLE | Réessayer avec la même clé. |

Contenu d’erreur `error.code`, `error.message`, `error.requestId`, `error.fields[]`. La sortie JSON JSON Schema interdit les propriétés non spécifiées pour les fixtures actuelles. Les clients tolèrent des propriétés inconnues en lecture pour permettre l’évolution. Version v2 pour suppression ou changement sémantique.

## Routes

| Version | Module | Route | Permission | Entrée | Sortie | Limite/min | Validation et cas spécial |
|---|---|---|---|---|---|---:|---|
| MVP | auth | `POST /workspaces` | U | name:s, timeZone:tz | id:u, name:s, timeZone:tz | 5 | Créer l’espace et le propriétaire dans un seul commit |
| MVP | auth | `GET /workspaces` | U | — | items:workspace[], nextCursor:?s | 60 | Renvoyer uniquement les espaces visibles et leurs rôles |
| MVP | auth | `GET /workspaces/{wid}/me` | U | — | role:role, athleteId:?u, capabilities:s[] | 60 | Vérifier appartenance par lecture actuelle |
| MVP | auth | `GET /me` | U | — | displayName:s, locale:lang | 60 | Données de l’identité courante |
| MVP | auth | `PATCH /me` | U | displayName:?s, locale:?lang | displayName:s, locale:lang | 20 | Au moins un champ et nom 100 caractères au plus |
| MVP | roster | `GET /workspaces/{wid}/athletes` | C | — | items:athlete[], nextCursor:?s | 60 | Filtrer state, search et paginateur stable |
| MVP | roster | `POST /workspaces/{wid}/athletes` | O | displayName:s, timeZone:tz | id:u, state:astate | 20 | Créer dossier invité et affecter son propriétaire |
| MVP | roster | `GET /workspaces/{wid}/athletes/{aid}` | CA | — | item:athlete | 60 | Affectation coach ou dossier propre |
| MVP | roster | `PATCH /workspaces/{wid}/athletes/{aid}` | C | displayName:?s, timeZone:?tz, archive:?b | item:athlete | 20 | Archivage irréversible par cette route avec archivage des écritures |
| MVP | roster | `POST /workspaces/{wid}/athletes/{aid}/invite` | C | email:email | invitationId:u, expiresAt:t | 5 | Remplace le lien actif. Envoi différé. |
| MVP | roster | `DELETE /workspaces/{wid}/invitations/{iid}` | O | — | revoked:b | 10 | Révocation idempotente |
| MVP | roster | `POST /invitations/accept` | U | token:s | workspaceId:u, athleteId:u | 10 | Email vérifié, secret expirant, quota et un seul lien |
| MVP | calendar | `GET /workspaces/{wid}/athletes/{aid}/calendar` | CA | — | items:workout[], nextCursor:?s | 60 | from et to inclusifs, 42 jours maximum, projection selon le rôle |
| MVP | calendar | `POST /workspaces/{wid}/athletes/{aid}/goals` | C | title:s, sport:sport, targetDate:?d | item:goal | 20 | Objectif visible à l’athlète |
| MVP | calendar | `GET /workspaces/{wid}/athletes/{aid}/goals` | CA | — | items:goal[], nextCursor:?s | 60 | Lecture dossier et pagination |
| MVP | calendar | `PATCH /workspaces/{wid}/athletes/{aid}/goals/{gid}` | C | state:gstate, targetDate:?d | item:goal | 20 | Contrôler transition et appartenance |
| MVP | calendar | `GET /workspaces/{wid}/athletes/{aid}/plans` | C | — | items:plan[], nextCursor:?s | 60 | Plans internes du coach affecté |
| MVP | calendar | `POST /workspaces/{wid}/athletes/{aid}/plans` | C | title:s, startsOn:d, endsOn:d | item:plan | 20 | Dates ISO début inférieur ou égal à fin |
| MVP | calendar | `POST /workspaces/{wid}/athletes/{aid}/plans/{pid}/blocks` | C | title:s, startsOn:d, endsOn:d | id:u | 20 | Bloc entièrement inclus dans la période |
| MVP | calendar | `POST /workspaces/{wid}/athletes/{aid}/workouts` | C | planId:?u, data:workoutInput | id:u, workingRevision:i | 30 | Écrit parent et première révision en transaction |
| MVP | calendar | `GET /workspaces/{wid}/athletes/{aid}/workouts/{sid}` | CA | — | item:workout | 60 | Coach lit travail et publié, athlète lit projection publiée |
| MVP | calendar | `PATCH /workspaces/{wid}/athletes/{aid}/workouts/{sid}` | C | expectedRevision:i, data:workoutInput | id:u, workingRevision:i | 30 | Crée une version immuable. 409 si révision périmée. |
| MVP | calendar | `POST /workspaces/{wid}/athletes/{aid}/publications` | C | changes:versionedId[] | items:versionedId[] | 10 | 1 à 50 séances, atomique, refuse les doublons |
| MVP | calendar | `POST /workspaces/{wid}/athletes/{aid}/workouts/{sid}/cancel` | C | expectedRevision:i, reason:s | id:u, publishedRevision:i | 10 | Annulation explicite, version conservée |
| MVP | feedback | `PUT /workspaces/{wid}/athletes/{aid}/workouts/{sid}/feedback` | A | publishedRevision:i, expectedRevision:?i, state:rstate, durationSeconds:?i, distanceM:?i, rpe:?i, comment:?s | item:feedback | 20 | Révision observée, RPE 0..10 et 1000 caractères au plus |
| MVP | feedback | `GET /workspaces/{wid}/athletes/{aid}/workouts/{sid}/feedback` | CA | — | item:feedback | 60 | Seul le dossier autorisé est visible |
| MVP | templates | `GET /workspaces/{wid}/templates` | C | — | items:template[], nextCursor:?s | 60 | Catalogue privé ou partagé |
| MVP | templates | `POST /workspaces/{wid}/templates` | C | title:s, kind:tkind, entries:templateEntry[] | id:u, revision:i | 20 | 1 à 50 entrées et cohérence du type |
| MVP | templates | `PATCH /workspaces/{wid}/templates/{tid}` | C | expectedRevision:i, title:?s, archive:?b, entries:?templateEntry[] | id:u, revision:i | 20 | Le propriétaire du modèle édite. Copies indépendantes. |
| MVP | templates | `POST /workspaces/{wid}/athletes/{aid}/template-applications` | C | templateId:u, templateRevision:i, startOn:d, confirm:b | items:workout[], applied:b | 10 | Aperçu si confirm faux, lot brouillon si vrai |
| MVP | messaging | `GET /workspaces/{wid}/conversations` | CA | — | items:thread[], nextCursor:?s | 60 | Uniquement les fils autorisés |
| MVP | messaging | `POST /workspaces/{wid}/athletes/{aid}/conversations` | CA | — | id:u | 10 | Créer ou obtenir le fil unique |
| MVP | messaging | `GET /workspaces/{wid}/conversations/{cid}/messages` | CA | — | items:message[], nextCursor:?s | 60 | Tri par createdAt puis id |
| MVP | messaging | `POST /workspaces/{wid}/conversations/{cid}/messages` | CA | body:s | item:message | 20 | Corps texte non vide et 4000 caractères au plus |
| MVP | messaging | `PUT /workspaces/{wid}/conversations/{cid}/receipt` | CA | messageId:u | readThroughId:u | 30 | Ne pas reculer le curseur de lecture |
| MVP | review | `GET /workspaces/{wid}/reviews` | C | — | items:review[], nextCursor:?s | 60 | Tri rang date puis id et filtre state |
| MVP | review | `PATCH /workspaces/{wid}/reviews/{rid}` | C | state:rvstate, snoozeUntil:?t | item:review | 20 | Reporter avec date future, clôture et audit |
| MVP | privacy | `GET /workspaces/{wid}/privacy/notice` | CA | — | version:s, body:s | 60 | Version dédiée à l’espace |
| MVP | privacy | `POST /workspaces/{wid}/privacy/requests` | CA | kind:pkind | id:u, state:s, dueAt:t | 4 | Demande liée à l’identité et au périmètre |
| MVP | privacy | `GET /workspaces/{wid}/privacy/requests/{qid}` | CA | — | id:u, state:s, downloadUrl:?url | 30 | Identité demandeuse et autorisation vérifiées, URL courte |
| MVP | privacy | `POST /workspaces/{wid}/athletes/{aid}/erase` | O | — | erased:b, accountDeleted:b | 4 | Effacement définitif du dossier de l’élève ; compte supprimé s’il n’est lié à aucun autre espace (D-115) |
| MVP | ai | `POST /workspaces/{wid}/athletes/{aid}/suggestions` | C | module:module, weekStart:d | jobId:u, state:s | 10 | 202, modèle et autorisation selon gate, budget atomique |
| MVP | ai | `GET /workspaces/{wid}/athletes/{aid}/suggestions` | C | — | items:suggestion[], nextCursor:?s | 60 | Brouillons du coach affecté, filtre state |
| MVP | ai | `GET /workspaces/{wid}/jobs/{jid}` | C | — | id:u, state:s, suggestionId:?u | 30 | Projecter uniquement ses jobs autorisés sans payload |
| MVP | ai | `PATCH /workspaces/{wid}/suggestions/{xid}` | C | expectedRevision:i, decision:decision, text:?s, reason:?s | item:suggestion | 20 | Revalider preuve et révision. Aucune publication depuis cette route. |
| MVP | dna | `GET /workspaces/{wid}/dna` | C | — | items:dna[], nextCursor:?s | 30 | Versions du coach connecté |
| MVP | dna | `POST /workspaces/{wid}/dna` | C | profile:profile | item:dna | 10 | Version draft, validateurs de domaine |
| MVP | dna | `POST /workspaces/{wid}/dna/{vid}/activate` | C | expectedActiveVersion:?i | item:dna | 8 | Transition atomique et comparaison de version |
| V1 | billing | `GET /workspaces/{wid}/billing` | O | — | tier:tier, status:s, activeAthletes:i, limit:i, graceUntil:?t | 30 | État local et usage du quota |
| V1 | billing | `POST /workspaces/{wid}/billing/checkout` | O | tier:tier | url:url | 5 | Choisir Stripe priceId serveur, pas du client |
| V1 | billing | `POST /workspaces/{wid}/billing/portal` | O | — | url:url | 5 | Redirection vers portail client lié |
| V1 | billing | `GET /workspaces/{wid}/billing/invoices` | O | — | items:invoice[], nextCursor:?s | 20 | Factures de l’espace, URL fournisseur résolue côté serveur |
| V1 | billing | `POST /webhooks/stripe` | S | event:stripe | received:b | 120 | Corps brut, signature et inbox durable avant 200 |
| V1 | imports | `POST /workspaces/{wid}/athletes/{aid}/imports` | C | format:fmt, content:s, origin:origin | jobId:u, state:s | 5 | 202, 256 Kio, vérifier origine et pièces, refus Strava |
| V1 | imports | `POST /workspaces/{wid}/athletes/{aid}/imports/{iid}/apply` | C | previewHash:s | jobId:u, state:s | 5 | 202, valider lignes et empreinte |
| V2 | clubs | `POST /workspaces/{wid}/teams` | O | name:s | id:u | 10 | Équipe sans effet d’autorisation |
| V2 | clubs | `PUT /workspaces/{wid}/athletes/{aid}/assignments/{uid}` | O | active:b, endsAt:?t | active:b | 20 | Coach membre, droits réévalués à la lecture et aux jobs |
| V2 | dna | `GET /workspaces/{wid}/dna/candidates` | C | — | items:candidate[], nextCursor:?s | 30 | Preuves minimisées et candidates du coach |
| V2 | dna | `PATCH /workspaces/{wid}/dna/candidates/{did}` | C | decision:binary, reason:s | item:candidate | 10 | Acceptation crée un draft, pas d’activation |
| V2 | notifications | `GET /workspaces/{wid}/notifications` | CA | — | items:notice[], nextCursor:?s | 60 | Destinataire et appartenance actuelle |
| V2 | notifications | `PUT /workspaces/{wid}/notifications/{nid}/read` | CA | — | readAt:t | 30 | Lecture répétée idempotente |
| MVP | roster | `GET /workspaces/{wid}/athletes/{aid}/notes` | C | — | items:note[], nextCursor:?s | 60 | L’auteur lit uniquement ses notes et reste affecté |
| MVP | roster | `POST /workspaces/{wid}/athletes/{aid}/notes` | C | body:s | item:note | 20 | 2000 caractères maximum. Exclue de l’assistant. |
| MVP | roster | `PATCH /workspaces/{wid}/athlete-settings` | A | timeZone:tz | timeZone:tz | 15 | Modifie la préférence de la relation sans redater les séances |
| MVP | review | `POST /workspaces/{wid}/athletes/{aid}/workouts/{sid}/feedback/review` | C | expectedRevision:i | reviewedAt:t | 20 | Marque la version courante et clôt le cas lié. Aucun avis envoyé. |
| MVP | calendar | `GET /workspaces/{wid}/athletes/{aid}/plans/{pid}/blocks` | C | — | items:block[], nextCursor:?s | 60 | Listing du plan du dossier affecté |
| MVP | calendar | `PATCH /workspaces/{wid}/athletes/{aid}/plans/{pid}/blocks/{bid}` | C | title:s | item:block | 20 | Le renommage conserve la période et les séances |
| MVP | roster | `PATCH /workspaces/{wid}/settings` | O | name:?s, timeZone:?tz | id:u, name:s, timeZone:tz | 15 | Le fuseau par défaut ne modifie pas les séances existantes |
| V1 | imports | `POST /workspaces/{wid}/athletes/{aid}/imports/{iid}/revert` | C | expectedPreviewHash:s | jobId:u, state:s | 5 | 202, préserver les lignes modifiées depuis puis expliquer les écarts |

Exemples d’erreur et repli. Pour publication périmée, retourner 409 et l’identifiant de la séance parmi les champs autorisés. Pour fournisseur IA indisponible, le job finit en abstention ou état réessayable sans modifier la planification. Pour un événement Stripe hors ordre, obtenir l’abonnement courant avant de projeter les droits. Pour absence d’activité ou quota Strava, le feedback manuel est disponible.
