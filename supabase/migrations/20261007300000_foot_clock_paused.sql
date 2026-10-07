-- The referee can pause the match clock mid-half; it resumes from the frozen time.
alter table public.foot_matches add column if not exists clock_paused boolean not null default false;
