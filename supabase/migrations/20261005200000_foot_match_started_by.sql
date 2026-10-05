-- Compte qui a lancé le match (seul lui peut le modifier tant qu'il est en cours)
alter table foot_matches add column if not exists started_by integer references players(id) on delete set null;
