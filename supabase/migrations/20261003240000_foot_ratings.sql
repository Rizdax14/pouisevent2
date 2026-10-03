alter table foot_matches add column if not exists match_type text not null default 'championnat';
alter table foot_matches drop constraint if exists foot_matches_match_type_check;
alter table foot_matches add constraint foot_matches_match_type_check check (match_type in ('amical','championnat'));
alter table foot_matches add column if not exists ratings_validated_at timestamptz;

create table if not exists foot_ratings (
  match_id bigint not null references foot_matches(id) on delete cascade,
  rater_id integer not null references players(id) on delete cascade,
  ratee_id integer not null references players(id) on delete cascade,
  score numeric(3,1) not null check (score between 1 and 10 and score * 2 = floor(score * 2)),
  updated_at timestamptz not null default now(),
  primary key (match_id, rater_id, ratee_id),
  check (rater_id <> ratee_id)
);
