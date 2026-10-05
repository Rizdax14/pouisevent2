-- Notes finales fixées à la main par le bureau : { "<player_id>": note }
alter table foot_matches add column if not exists rating_overrides jsonb not null default '{}'::jsonb;
