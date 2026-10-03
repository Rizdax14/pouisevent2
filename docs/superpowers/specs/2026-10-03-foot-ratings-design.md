# Module Football — Notes de match, filtres de stats, type de match — Design

## Intention

Après chaque match clôturé, les joueurs de la feuille se notent entre eux sur
10. Une fois validées, ces notes alimentent une nouvelle stat « Note » et une
card « Mon évolution » dans les Statistiques. En parallèle : un type de match
(amical / championnat), des filtres Saison / Type sur les Statistiques, des
stats limitées à l'effectif régulier et occasionnel, et pas de présence pour
les invités.

## Décisions actées pendant le brainstorming

- Chaque joueur de la feuille note **tous les autres**, pas lui-même.
- Notes de **1 à 10 par demi-points**.
- Validation **automatique** quand tous les joueurs de la feuille ont voté ;
  sinon l'admin peut **forcer** la validation avec les votes existants.
- Avant d'avoir voté, un joueur de la feuille **ne voit pas** les moyennes.
  Après son vote, il voit les moyennes provisoires. Votes individuels
  anonymes dans l'interface.
- **Saison = septembre → août**.
- Stats : tous les **réguliers et occasionnels** (même à 0 match, avec des 0) ;
  **invités exclus** du tableau et des rangs.
- Type de match : **badge + filtre** Tous / Championnat / Amical.
- Les invités **ne peuvent pas se mettre présents**.

## Modèle de données (migration unique)

- `foot_matches.match_type text not null default 'championnat'
  check (match_type in ('amical','championnat'))`
- `foot_matches.ratings_validated_at timestamptz` (null = notes ouvertes)
- Nouvelle table `foot_ratings` :
  - `match_id bigint` → `foot_matches.id` on delete cascade
  - `rater_id integer` → `players.id` on delete cascade
  - `ratee_id integer` → `players.id` on delete cascade
  - `score numeric(3,1) not null check (score between 1 and 10 and score * 2 = floor(score * 2))`
  - `updated_at timestamptz not null default now()`
  - PK `(match_id, rater_id, ratee_id)`, `check (rater_id <> ratee_id)`

## Règles (fonctions pures, `foot-logic.js`)

- `seasonOf(dateIso) -> "2026-2027"` : un match de septembre 2026 à août 2027
  appartient à « 2026-2027 ».
- `filterMatchesForStats(matches, { season, type })` : `season` = libellé ou
  `"all"`, `type` = `"all" | "amical" | "championnat"`.
- `ratingProgress(sheetIds, matchRatings)` : pour un match, retourne
  `{ doneIds, pendingIds, complete }`. Un votant est « fait » quand il a noté
  **chacun** des autres joueurs de la feuille. `complete` = tous faits (et au
  moins 2 joueurs sur la feuille).
- `matchAverages(sheetIds, matchRatings) -> { [playerId]: number|null }` :
  moyenne des notes reçues par chaque joueur de la feuille (null si aucune).
- `playerRatingSeries(matches, ratings, playerId)` : pour les matchs **validés**
  (`ratings_validated_at` non nul) passés en argument, liste
  `{ matchId, date, opponent, rating }` triée par date, où `rating` = moyenne
  des notes reçues par le joueur dans ce match (matchs sans note reçue exclus).
- `averageRating(series) -> number|null` : moyenne des `rating` de la série
  (moyenne des moyennes par match).
- `buildRatingPayload(raterId, scoresByRatee)` : valide chaque note (1–10,
  pas de 0,5) et refuse l'auto-notation ; renvoie les lignes à upserter.
- `statsRoster(roster)` : ids des joueurs `regulier` + `occasionnel`.

## Flux « Notes du match »

- Sur la page d'un match `finished`, deux onglets : **Résumé** (contenu
  actuel) et **Notes du match**.
- **Joueur de la feuille, notes ouvertes** :
  - formulaire listant les autres joueurs de la feuille, un sélecteur de
    1 à 10 par demi-points pour chacun ; « Enregistrer mes notes » exige une
    note pour chacun ;
  - après enregistrement, il voit les moyennes provisoires de tous les
    joueurs ; il peut modifier ses notes tant que ce n'est pas validé.
- **Joueur hors feuille (ou admin hors feuille)** : voit l'avancement
  « X / Y ont voté » et la liste de ceux qui n'ont pas encore voté. L'admin
  voit aussi les moyennes provisoires.
- **Liste « Pas encore voté »** visible par tous tant que c'est ouvert.
- **Validation** :
  - après chaque enregistrement de notes, si `ratingProgress(...).complete`,
    on écrit `ratings_validated_at = now()` ;
  - l'admin dispose d'un bouton « Valider les notes » (avec confirmation)
    utilisable à tout moment tant que c'est ouvert.
- **Après validation** : formulaire masqué, votes figés, moyennes visibles
  par tous, badge « Notes validées ».

## Statistiques

- **Filtres** en haut : Saison (liste des saisons ayant des matchs, saison en
  cours par défaut, plus « Toutes ») et Type (Tous / Championnat / Amical).
  Mémorisés en `localStorage` (`foot_stats_season`, `foot_stats_type`).
  Ils s'appliquent aux cards, au tableau, aux rangs et au graphique.
- **Population** : `statsRoster(roster)`. Les joueurs à 0 match apparaissent
  avec des 0 et « — » pour la note. Les rangs ne comptent que les joueurs de
  la population ayant au moins 1 match (au moins 1 note validée pour le rang
  « Note »). Un joueur connecté hors population voit ses tuiles à « — » et le
  message « Les statistiques concernent l'effectif régulier et occasionnel ».
- **Stat « Note »** : `averageRating` sur les matchs filtrés ; colonne
  « Note » du tableau (triable, affichée avec 1 décimale, non concernée par le
  mode %), tuile dans « Mes matchs » avec son rang (décroissant).
- **Card « Mon évolution »** : courbe des notes du joueur connecté sur ses
  10 derniers matchs notés dans le filtre courant (axe Y 1–10, un point par
  match, libellé adversaire au survol). Message si moins de 2 notes.

## Gestion d'erreurs

Style du module : `try/catch` + message visible dans les formulaires,
`assertUpsertOk` sur les upserts supabase-js.

## Tests

- Unitaires `node:test` pour toutes les fonctions pures ci-dessus.
- Rendu serveur (scratch) : onglet Notes dans chaque état (votant avant/après
  vote, hors feuille, admin, validé), Statistiques avec filtres et invités.
- Parcours Chrome en prod après déploiement, en lecture seule sur les vraies
  données (aucun vote réel déposé sans l'accord de l'utilisateur).

## Limites acceptées

- Sans RLS, les votes individuels restent lisibles via l'API par quelqu'un de
  technique : l'anonymat n'est garanti que dans l'interface.
- Modifier la feuille après des votes change la liste attendue (un nouveau
  joueur doit être noté) ; après validation, rien ne change.

## Hors scope

Onglet Classement, fiche joueur, notes pondérées, commentaires sur les notes.
