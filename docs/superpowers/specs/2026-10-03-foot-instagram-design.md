# Module Football — Posts Instagram — Design

## Intention

Publier sur le compte Instagram de l'équipe (`biere_leverculsec`, compte
Créateur) des posts générés à partir des données de l'app, fidèles aux
maquettes Canva « 26-27 ». L'app prépare chaque post au bon moment ; l'admin
voit l'aperçu, ajuste la légende si besoin et clique **Publier**. Rien ne part
sans ce clic.

## Résultats du spike (déjà validés)

- App Meta « Leverculsec Posts » (ID 2171455723441959), cas d'usage « API
  Instagram avec connexion Instagram » : **pas de page Facebook nécessaire**.
- Permissions : `instagram_business_basic`, `instagram_business_content_publish`.
- Compte testeur `biere_leverculsec` (user id `17841470220708562`), jeton
  valide, quota 100 publications / 24 h.
- Création d'un conteneur image → statut `FINISHED` (publication non
  appelée). Images : **JPEG à URL publique**, ratio 4:5 accepté.
- Variables Vercel : `INSTAGRAM_ACCESS_TOKEN` (secret), `INSTAGRAM_USER_ID`.
  Le jeton actuel a transité dans la conversation : à remplacer par un jeton
  neuf saisi directement par l'utilisateur.

## Calendrier éditorial

| Moment | Post | Format | Disponible quand |
|---|---|---|---|
| Jeudi (jour de match) | **Match Day + Groupe** | carrousel 2 images | match `scheduled` avec une feuille de match ≥ 1 joueur |
| Après le match | **Résultat** | 1 image | match `finished` |
| Samedi | **Notes** | 1 image | notes du match validées |
| Mardi | **Classements** : Buts, Passes D, Buts+Passes D | carrousel 3 images | à tout moment (saison en cours, au moins 1 match terminé) |

Les jours sont des repères éditoriaux affichés dans l'écran Insta, pas des
déclenchements automatiques.

## Thème

- `foot_matches.venue` : `'domicile' | 'exterieur'` (défaut `domicile`).
- Domicile → fond `domicile.png` (vert/blanc), textes vert foncé ;
  Extérieur → fond `exterieur.png` (violet), textes violet.
- Classements : thème du dernier match terminé (défaut domicile).
- Polices : **Shrikhand** (titres : MATCH DAY, GROUPE, RESULTAT, BUTS…) et
  **Contrail One** (listes, bandeaux, scores), fichiers TTF embarqués.

## Photos

- Trois types par joueur : **render** (portraits ronds des classements),
  **celebration** (Match Day, Résultat), **dos** (Groupe) ; chacun en deux
  maillots : **domicile** et **exterieur**.
- Deux variantes par photo : **retouchée** (1080×1350, déjà cadrée et
  teintée, superposée telle quelle) et **brute** (détourée, recadrée
  automatiquement : ajustée en hauteur, centrée en bas). La retouchée est
  prioritaire.
- Stockage : bucket Supabase Storage public `player-photos`, chemin
  `{player_id}/{kit}/{type}{-retouche}.png` ; table `foot_player_photos`
  (player_id, kit, type, retouched, path, updated_at).
- Repli si une photo manque : même type dans l'autre maillot, puis aucune
  photo (le visuel reste lisible sans joueur) ; render manquant → initiales
  dans le rond.
- Écran admin **Photos** : par joueur de l'effectif, 3 types × 2 maillots,
  upload / remplacement / suppression.
- Import initial (script ponctuel) depuis
  `G:\My Drive\leverculsec\25 26\PHOTOS Bière Leverculsec\Canva\26 27`
  (`celebration/{domicile|extérieur}/[retouché/]Prénom.png`), avec une table
  de correspondance prénom de fichier → joueur validée par l'utilisateur
  (ex. « Juju »).

## Feuille de match = Groupe

- La section « Feuille de match » devient éditable par l'admin **dès la
  création** du match (statut `scheduled` compris).
- Au coup d'envoi, la checklist est pré-cochée avec la feuille existante si
  elle n'est pas vide, sinon avec les présents (comportement actuel).
- `foot_roster.jersey_number int` (1–99, optionnel), éditable dans la gestion
  d'effectif. Groupe affiche « 25. Thomas » (sans numéro : « Thomas »), triés
  par numéro puis prénom.

## Joueur mis en avant (rotation)

- Choisi **automatiquement**, toujours **parmi la feuille de match** du
  match concerné, et seulement parmi les joueurs qui ont la photo requise
  (type + maillot, retouchée ou brute).
- Rotation par type de photo : le joueur le moins récemment mis en avant
  pour ce type (jamais = prioritaire ; égalité → ordre aléatoire stable par
  match).
- Calculé à la préparation du post et figé dans l'historique une fois publié.

## Visuels (fidèles aux maquettes 26-27)

- **Match Day** : titre MATCH DAY, pastille « vs ADVERSAIRE » (sigle
  automatique si > 12 caractères : initiales des mots), joueur célébration,
  bandeau « JEUDI 19H30 | STADE | VILLE » (jour + heure du match, stade sinon
  adresse).
- **Groupe** : titre GROUPE, joueur de dos à gauche, panneau arrondi avec la
  liste (jusqu'à 18 lignes ; police réduite au-delà de 10).
- **Résultat** : titre RESULTAT, « LEVERCULSEC / X - Y / ADVERSAIRE »,
  joueur célébration à gauche, panneau « buts : » listant `minute' Buteur
  (Passeur)` (« CSC/adverse » non listés ; « Aucun but » si 0).
- **Notes** (nouveau, même charte) : titre NOTES, adversaire + score, liste
  des joueurs de la feuille triée par note du match : prénom, note du match,
  moyenne saison. Maquette soumise à l'utilisateur avant intégration.
- **Classements** (×3) : titre BUTS / PASSES D / BUTS + PASSES D, grille
  de portraits ronds (render) avec la valeur dessous, top 14 de la saison en
  cours parmi réguliers/occasionnels, joueurs à 0 exclus ; égalités →
  ordre alphabétique.

## Écran admin « Insta »

- Nouvel onglet de la navbar foot (admin uniquement).
- Liste des posts disponibles (calendrier ci-dessus) avec statut « À
  publier » / « Publié le … » (lien vers le post Instagram).
- Ouvrir un post : aperçu des images (rendues par le serveur), légende
  pré-remplie modifiable, bouton **Publier** (confirmation), retour d'erreur
  lisible.
- Un post publié ne peut pas être republié (bouton remplacé par le lien).

## Légendes (pré-remplies, modifiables)

- Match Day : « MATCH DAY ⚽ Bière Leverculsec vs {adversaire} — {jour}
  {heure} — {stade}, {ville} »
- Résultat : « {victoire/nul/défaite} {bl}-{adv} contre {adversaire} » +
  buteurs.
- Notes : « Les notes du match contre {adversaire} » + top 3.
- Classements : « Classements de la saison {saison} ».
- Hashtags fixes configurables plus tard (hors scope).

## Architecture serveur (Vercel Functions, Node)

- `api/insta/render` (GET) : `type`, `match_id` (ou `season`), `page` →
  JPEG 1080×1350. Rendu : Satori (JSX → SVG) + resvg (→ PNG) + sharp (→
  JPEG q90). Données lues dans Supabase côté serveur.
- `api/insta/prepare` (POST, admin) : calcule le post (images, joueur mis en
  avant, légende par défaut), rend les JPEG, les dépose dans le bucket
  public `insta-posts`, enregistre une ligne `foot_insta_posts` en
  `draft`, renvoie les URLs et la légende.
- `api/insta/publish` (POST, admin) : relit la ligne `draft`, crée le(s)
  conteneur(s) (carrousel : enfants puis conteneur CAROUSEL), attend
  `FINISHED`, appelle `media_publish`, enregistre `ig_media_id`, permalink,
  `published_at`, statut `published`. Idempotent : refuse si déjà publié.
- `api/insta/refresh-token` (Vercel Cron hebdomadaire) : rafraîchit le jeton
  long (`refresh_access_token`) et le stocke.

### Données

- `foot_insta_posts` : id, kind (`matchday`, `result`, `ratings`,
  `rankings`), match_id (null pour classements), season, featured_player_id,
  image_paths (text[]), caption, status (`draft`|`published`|`failed`),
  ig_media_id, permalink, error, created_at, published_at. Unicité :
  un seul `published` par (kind, match_id) ; classements : un par semaine
  ISO.
- `app_secrets` (key, value, updated_at) avec **RLS activée et aucune
  policy** : illisible par la clé anon ; lu/écrit uniquement par le serveur
  via la clé `service_role`. Contient le jeton Instagram courant.

### Sécurité

- Les endpoints `prepare` et `publish` exigent l'en-tête
  `X-Insta-Admin-Key` égal à la variable Vercel `INSTA_ADMIN_KEY`.
  L'admin saisit cette clé une fois dans l'écran Insta (stockée en
  `localStorage` de son appareil).
- `render` est public (même contenu que les posts) mais ne rend que des
  données déjà visibles dans l'app.
- `SUPABASE_SERVICE_ROLE_KEY` : variable Vercel saisie par l'utilisateur,
  jamais dans le front ni dans la conversation.
- Le Cron vérifie l'en-tête `Authorization: Bearer ${CRON_SECRET}` fourni
  par Vercel.

## Gestion d'erreurs

- Erreur Instagram → statut `failed` + message affiché, bouton « Réessayer ».
- Photo manquante → repli (voir Photos), jamais d'échec de rendu.
- Jeton expiré / invalide → message clair « Reconnecte le compte Instagram »
  dans l'écran Insta.

## Tests

- Unitaires `node:test` : rotation, sigle adversaire, légendes, listes
  (buts, groupe triés), classements top 14, sélection de photo avec replis,
  unicité de publication, logique de carrousel (ordre des appels avec un faux
  client Instagram).
- Rendu : génération des JPEG de chaque type avec des données de test,
  inspection visuelle côte à côte avec les miniatures Canva.
- Intégration Instagram : création de conteneurs sans `media_publish` en
  test ; la première vraie publication est faite par l'utilisateur depuis
  l'écran Insta.

## Hors scope

Publication automatique sans clic, Stories/Reels, statistiques Instagram,
hashtags configurables, posts Olympiades/Events, retouche automatique des
photos brutes.

## Limites acceptées

- Les buckets `player-photos` et `insta-posts` sont publics : une photo
  d'un joueur est accessible à qui connaît son URL (contenu destiné à
  Instagram de toute façon).
- Les photos brutes recadrées automatiquement n'ont pas la retouche Canva ;
  la qualité finale dépend des versions retouchées fournies.
