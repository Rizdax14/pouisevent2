-- Photo par défaut (« joueur inconnu ») : player_id = 0, sans joueur réel derrière.
alter table foot_player_photos drop constraint if exists foot_player_photos_player_id_fkey;
