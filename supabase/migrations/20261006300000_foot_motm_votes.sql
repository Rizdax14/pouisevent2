-- Homme du match : un vote par joueur convoqué et par match
create table if not exists foot_motm_votes (
  match_id bigint not null references foot_matches(id) on delete cascade,
  voter_id integer not null references players(id) on delete cascade,
  player_id integer not null references players(id) on delete cascade,
  updated_at timestamptz not null default now(),
  primary key (match_id, voter_id),
  check (voter_id <> player_id)
);
create index if not exists foot_motm_votes_match_idx on foot_motm_votes(match_id);
