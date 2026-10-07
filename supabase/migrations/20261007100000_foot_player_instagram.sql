-- Pseudo Instagram du joueur (pour l'identifier sur les posts)
alter table foot_player_details add column if not exists instagram text check (instagram is null or instagram ~ '^[A-Za-z0-9._]{1,30}$');
