# Module Football — Feuille de match & page Statistiques — Design

## Intention

Donner à chaque joueur de Bière Leverculsec ses statistiques de foot
personnelles (matchs joués, résultats, buts, passes décisives) et son rang
dans chaque stat, plus un tableau comparatif de toute l'équipe, triable
comme les tableaux de ratings de la section Events.

Pour que « match joué » soit fiable, on introduit une vraie **feuille de
match** (qui a réellement joué), distincte de la présence.

## Décisions actées pendant le brainstorming

- **Feuille de match explicite** plutôt que « présent = a joué ».
- **Calcul côté navigateur** via des fonctions pures dans `foot-logic.js`
  (approche A) — pas de vue SQL. Volume minuscule, 100 % testable en Node.
- **Seuls les matchs `finished`** comptent dans les statistiques.
- **Bouton global `Valeurs | %`** sur la page, mémorisé en `localStorage`.
- **Trois rangs** pour la card offensive : buts, passes D, décisifs.
- **Un rang par stat** sous chaque valeur des cards : « 2ème / 13 ».

## Modèle de données

### Nouvelle table `foot_lineups`
- `match_id` (FK → `foot_matches.id`, `on delete cascade`)
- `player_id` (FK → `players.id`, `integer`, `on delete cascade`)
- `added_at` timestamptz default now()
- PK composite `(match_id, player_id)`

### Reprise de l'existant (dans la même migration)
Pour chaque match déjà `finished` sans aucune ligne de feuille : insérer
dans `foot_lineups` l'union de
- ses lignes `foot_attendance` au statut `present`,
- les `player_id` et `assist_player_id` non nuls de ses `foot_match_events`.

## Flux

### Saisie de la feuille
- **Au démarrage** : `FootStartMatchConfig` ajoute une liste à cocher de
  l'effectif, les joueurs `present` pré-cochés. « Démarrer le match » écrit
  les lignes `foot_lineups` cochées puis passe le match en `live`.
- **Après coup** : sur `FootMatchDetailPage`, l'admin dispose d'une section
  « Feuille de match » (statuts `live` et `finished`) pour cocher/décocher
  des joueurs de l'effectif à tout moment. Un joueur déjà sur la feuille
  mais retiré de l'effectif depuis reste affiché et décochable.
- **Cohérence automatique** : quand un but BL est créé ou modifié (console
  live ou éditeur de timeline), le buteur et le passeur sont ajoutés à la
  feuille s'ils n'y sont pas (upsert idempotent).
- Les non-admins voient la feuille en lecture seule (liste des noms).

## Règles de calcul (fonctions pures, `foot-logic.js`)

### `computePlayerStats(matches, lineups, events)`
Retourne une liste `{ playerId, played, wins, draws, losses, goals, assists, decisive }`
pour chaque joueur ayant `played ≥ 1`.
- Ne considère que les matchs `status === "finished"`.
- `played` / `wins` / `draws` / `losses` : matchs terminés où le joueur est
  sur la feuille ; résultat via `computeFootScore` des événements du match
  (`bl > opponent` victoire, égalité nul, sinon défaite).
- `goals` / `assists` : événements `goal_bl` des matchs terminés où il est
  buteur / passeur. `decisive = goals + assists`.

### `statValue(stat, key, mode)`
- `mode === "abs"` : valeur brute.
- `mode === "pct"` : `wins`/`draws`/`losses` → pourcentage de `played`
  (0–100) ; `goals`/`assists`/`decisive` → moyenne par match ;
  `played` reste brut.

### `rankPlayers(statsList, key, mode)`
- Rang « compétition » : égalités partagées, rang suivant sauté (1, 2, 2, 4).
- Sens décroissant pour toutes les stats sauf `losses` (croissant).
- Retourne `{ [playerId]: { rank, total, tied } }`, `total` = taille de la liste.

## Page Statistiques (`FootStatsPage`)

- Remplace le placeholder de l'onglet Statistiques.
- **En-tête** : bouton bascule `Valeurs | %`.
- **Card 1 — Mes matchs** : 4 tuiles Joués · Victoires · Nuls · Défaites.
  Valeur en gros, « Xème / N » en petit dessous (« Xème ex æquo » si
  égalité).
- **Card 2 — Mes stats offensives** : 3 tuiles Buts · Passes D · Décisifs,
  même format.
- Si le joueur connecté n'a aucun match terminé : tuiles « — » et message
  « Pas encore de match terminé sur une feuille de match ».
- **Tableau** : une ligne par joueur de `computePlayerStats`, colonnes
  Joueur · MJ · V · N · D · Buts · PD · Déc. Clic sur un en-tête : tri
  décroissant, second clic croissant (▲▼). Tri par défaut : MJ décroissant.
  Ligne du joueur connecté surlignée. Défilement horizontal sur mobile.
  Les valeurs suivent le mode `Valeurs | %`.

## Gestion d'erreurs

Même style que le module : `try/catch` + `console.warn`, `assertUpsertOk`
sur les `upsert` supabase-js.

## Tests

- Unitaires `node:test` : `computePlayerStats`, `statValue`, `rankPlayers`
  (égalités, défaites croissantes, matchs non terminés ignorés, joueur hors
  feuille ignoré).
- Rendu serveur (scratch) de `FootStatsPage` et de la feuille de match.
- Parcours réel dans Chrome sur leverculsec.com après déploiement : feuille
  de match, stats affichées, bascule %, tri du tableau.

## Hors scope

- Fiche joueur foot dédiée (clic sur un nom).
- Contenu de l'onglet Classement.
- Statistiques par saison / filtre de période.
- Feuille de match côté adversaire.
