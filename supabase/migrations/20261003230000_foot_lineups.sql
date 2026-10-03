create table if not exists foot_lineups (
  match_id bigint not null references foot_matches(id) on delete cascade,
  player_id integer not null references players(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (match_id, player_id)
);

insert into foot_lineups (match_id, player_id)
select m.id, src.player_id
from foot_matches m
join (
  select match_id, player_id from foot_attendance where status = 'present'
  union
  select match_id, player_id from foot_match_events where player_id is not null
  union
  select match_id, assist_player_id from foot_match_events where assist_player_id is not null
) src on src.match_id = m.id
where m.status = 'finished'
  and not exists (select 1 from foot_lineups l where l.match_id = m.id)
on conflict do nothing;
