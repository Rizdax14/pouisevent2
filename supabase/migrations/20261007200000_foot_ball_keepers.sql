-- Responsables ballons : 2 joueurs choisis par le bureau pour chaque match
alter table foot_matches add column if not exists ball_keepers integer[] not null default '{}';
