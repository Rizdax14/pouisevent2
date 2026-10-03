# Module Football (Bière Leverculsec) — Design

## Intention

Ajouter un module "Foot" à l'app, façon SporEasy, pour l'équipe de foot de
Bière Leverculsec. Premier lot : administration des matchs (création +
effectif), calendrier des matchs avec présence, et le moteur de match live
(mi-temps, chrono, buts/passes décisives). Classement et Statistiques sont
scaffoldés (onglets navigables) mais leur contenu réel est différé à une
itération suivante, une fois qu'il existe de vraies données de match.

Rôle admin : réutilise `ADMIN_UID` existant (`"louis-mar"`), un seul admin
pour l'instant.

## Décisions actées pendant le brainstorming

- **Modèle de données relationnel** (pas de blob JSON comme `o2026_state`) :
  chaque but/passe D est une ligne, pour permettre un `GROUP BY player_id`
  simple quand la page Statistiques sera construite.
- **Live différé, pas temps réel** : l'admin voit tout en live pendant la
  saisie (côté client). Les autres joueurs voient l'état à jour uniquement
  en (re)chargeant la page — pas de Supabase Realtime dans ce lot.
- **Buts adverses saisis en live aussi**, au même titre que les buts BL,
  simplement sans `player_id` (l'adversaire n'a pas de compte joueur).
- **Score jamais stocké en dur** : toujours recalculé en comptant les
  événements `goal_bl` / `goal_opponent` de `foot_match_events`, pour
  éviter toute désynchronisation entre score affiché et liste des buts.
- **RLS Supabase** : même niveau de sécurité que l'existant (`players`,
  `teams` déjà en écriture libre via la clé anon). Pas de verrouillage RLS
  spécifique à ce lot.
- **Pas d'édition/suppression de match** une fois créé, dans ce lot.
- **Rôle de roster (régulier/occasionnel/invité)** : purement informatif
  pour l'instant (affiché en badge), ne restreint rien.

## Modèle de données (Supabase, nouvelles tables)

### `foot_roster`
Qui fait partie de l'équipe de foot.
- `player_id` (FK → `players.id`, PK)
- `role`: `'regulier' | 'occasionnel' | 'invite'`
- `added_at` timestamptz

### `foot_matches`
Un match.
- `id` (PK, identity)
- `opponent_name` text
- `match_datetime` timestamptz
- `address` text
- `postal_code` text
- `city` text
- `status`: `'scheduled' | 'live' | 'finished'` (default `'scheduled'`)
- `nb_halves` int, nullable (rempli au moment de "Commencer le match", 1-4)
- `half_duration_min` int, nullable
- `current_half` int, nullable (mi-temps en cours, 1-based)
- `half_started_at` timestamptz, nullable (`null` = chrono en pause)
- `half_elapsed_seconds` int, default 0 (cumulé, pour pause/reprise sans
  perte de temps)
- `created_at` timestamptz default now()

### `foot_attendance`
Présence par match. L'absence de ligne = "n'a pas répondu" (pas de valeur
explicite stockée pour cet état).
- `match_id` (FK → `foot_matches.id`)
- `player_id` (FK → `players.id`)
- `status`: `'present' | 'absent'`
- `responded_at` timestamptz
- PK composite `(match_id, player_id)`

### `foot_match_events`
Chaque but est une ligne — sert au score live ET aux futures statistiques.
- `id` (PK, identity)
- `match_id` (FK → `foot_matches.id`)
- `half` int
- `minute` int (minute écoulée dans la mi-temps au moment de la saisie —
  indicatif, pas une source de vérité horaire)
- `type`: `'goal_bl' | 'goal_opponent'`
- `player_id` (FK → `players.id`, nullable — buteur, `null` si
  `goal_opponent`)
- `assist_player_id` (FK → `players.id`, nullable — passe décisive,
  optionnel, uniquement pertinent pour `goal_bl`)
- `created_at` timestamptz default now()

## Navigation

### Point d'entrée (branchement dans l'existant)

- `MenuBL` : la carte `{id:"football", ...}` passe de `active:false` à
  `active:true`.
- `App()` : le handler passé en `onSection` à `MenuBL` gagne
  `else if(s==="football") setSection("football");`
- `App()` : nouveau rendu `if(section==="football") return <FootballApp
  currentPlayer={currentPlayer} onBack={()=>setSection("menu")}/>`

### `FootballApp` (nouveau composant racine du module)

Charge au montage : `foot_roster`, `foot_matches`, `foot_attendance`,
`foot_match_events` via Supabase (même pattern que `loadFromSupabase`
existant). Gère son propre état `page`/`sub` (comme le routeur `events`
actuel) et affiche sa propre navbar basse à 5 onglets :

1. **Accueil** 🏠 → `onBack()` (retour à `MenuBL`, comme le bouton "Menu"
   de la navbar actuelle)
2. **Calendrier** → page d'accueil du module
3. **Classement** → placeholder ("Bientôt disponible") ce lot
4. **Statistiques** → placeholder ce lot
5. **Admin** → visible seulement si `currentPlayer?.uid === ADMIN_UID`

### Pages internes

1. **`CalendarPage`** — cards cliquables, triées par `match_datetime`
   croissant. Badge de statut : À venir / En cours / Terminé (+ score si
   terminé).
2. **`MatchDetailPage`** (`sub.matchId`) — rendu conditionnel selon
   `status` :
   - `scheduled` : flèche retour, infos du match, toggle présence pour le
     joueur connecté (si présent dans `foot_roster`), liste à 3 colonnes
     (Présents / N'a pas répondu / Absents), bouton "COMMENCER LE MATCH"
     (admin uniquement)
   - `live` : score + timeline des buts visibles par tous (recalculés au
     chargement) ; console live additionnelle pour l'admin (chrono,
     saisie des buts, gestion des mi-temps, clôture)
   - `finished` : score final + timeline, lecture seule
3. **`AdminFootPage`** — formulaire "Créer un match" (adversaire,
   date/heure, adresse, code postal, ville) + gestion d'effectif (piocher
   dans tous les joueurs `PLAYERS`, assigner régulier/occasionnel/invité
   ou retirer du roster).
4. **`RankingsFootPage`**, **`StatsFootPage`** — placeholders ce lot,
   onglets navigables.

## Flows détaillés

### Créer un match (admin)
Formulaire → `insert` dans `foot_matches`, `status:'scheduled'`.

### Gérer l'effectif (admin)
Pour chaque joueur de `PLAYERS`, sélecteur
Régulier/Occasionnel/Invité/(pas dans l'équipe) → `upsert`/`delete` sur
`foot_roster`.

### Présence
Sur `MatchDetailPage` (statut `scheduled`), tout joueur du roster voit
deux boutons "Présent"/"Absent" pour lui-même → `upsert` dans
`foot_attendance`. La répartition Présents/N'a pas répondu/Absents se
déduit en comparant le roster complet aux lignes existantes pour ce match.

### Démarrer et diriger un match (admin)
1. "COMMENCER LE MATCH" → écran de config (nombre de mi-temps 1-4, durée
   par mi-temps) → `update foot_matches`:
   `status:'live', nb_halves, half_duration_min, current_half:1`.
2. Console live :
   - Chrono affiché = `now - half_started_at + half_elapsed_seconds`,
     recalculé côté client (`setInterval`), rien n'est persisté chaque
     seconde — seulement aux moments clés ci-dessous.
   - "▶ Démarrer la mi-temps" → `half_started_at = now()`
   - "⚽ But Bière Leverculsec" → sélecteur buteur (+ passeur optionnel,
     parmi le roster) → `insert foot_match_events` (`type:'goal_bl'`)
   - "⚽ But adverse" → `insert foot_match_events`
     (`type:'goal_opponent'`, pas de joueur)
   - "⏸ Terminer la mi-temps" → fige
     `half_elapsed_seconds += (now - half_started_at)`,
     `half_started_at = null`. Si `current_half < nb_halves` :
     `current_half += 1`, bouton suivant devient "▶ Démarrer la mi-temps
     suivante". Si c'était la dernière mi-temps : bouton devient
     "🏁 Clôturer le match".
   - "🏁 Clôturer le match" → `status:'finished'`.
3. Score affiché (admin et non-admin, à chaque chargement de page) =
   comptage des `goal_bl`/`goal_opponent` de `foot_match_events` pour ce
   match.
4. Timeline = liste des events triée par mi-temps puis minute (ex. *"23'
   ⚽ Alvyn (passe D: Ferdi)"*).

## Gestion d'erreurs

Même style que le reste du code existant : `try/catch` autour des appels
Supabase, `console.warn`/message discret en cas d'échec, pas de retry
automatique ni de gestion d'erreur avancée (cohérent avec
`loadFromSupabase` et `sbFetch` actuels).

## Tests

Le projet n'a aucun framework de test (pas de build, scripts chargés en
CDN). Vérification manuelle dans le navigateur avant de considérer le
travail terminé : créer un match, cocher une présence, lancer le match,
saisir des buts (BL et adverse) sur plusieurs mi-temps, clôturer le match,
vérifier le score et la timeline affichés.

## Hors scope (lots suivants)

- Contenu réel des pages Classement et Statistiques
- Édition/suppression d'un match déjà créé
- RLS Supabase dédiée à ces nouvelles tables
- Notifications / rappels de présence
- Vue multi-saisons des rosters
