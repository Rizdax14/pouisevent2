-- Heure du rendez-vous (le coup d'envoi reste match_datetime)
alter table foot_matches add column if not exists meeting_at timestamptz;
-- But contre son camp (CSC) : un but pour nous sans buteur
alter table foot_match_events add column if not exists own_goal boolean not null default false;
