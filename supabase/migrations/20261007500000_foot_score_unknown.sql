-- A finished match whose score was never found: shown as "? - ?" and left out of wins / draws / losses.
alter table public.foot_matches add column if not exists score_unknown boolean not null default false;
