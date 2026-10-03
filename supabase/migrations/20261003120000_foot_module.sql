-- supabase/migrations/20261003120000_foot_module.sql

create table if not exists foot_roster (
  player_id integer primary key references players(id) on delete cascade,
  role text not null check (role in ('regulier','occasionnel','invite')),
  added_at timestamptz not null default now()
);

create table if not exists foot_matches (
  id bigint generated always as identity primary key,
  opponent_name text not null,
  match_datetime timestamptz not null,
  address text,
  postal_code text,
  city text,
  status text not null default 'scheduled' check (status in ('scheduled','live','finished')),
  nb_halves int check (nb_halves between 1 and 4),
  half_duration_min int,
  current_half int,
  half_started_at timestamptz,
  half_elapsed_seconds int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists foot_attendance (
  match_id bigint not null references foot_matches(id) on delete cascade,
  player_id integer not null references players(id) on delete cascade,
  status text not null check (status in ('present','absent')),
  responded_at timestamptz not null default now(),
  primary key (match_id, player_id)
);

create table if not exists foot_match_events (
  id bigint generated always as identity primary key,
  match_id bigint not null references foot_matches(id) on delete cascade,
  half int not null,
  minute int not null,
  type text not null check (type in ('goal_bl','goal_opponent')),
  player_id integer references players(id),
  assist_player_id integer references players(id),
  created_at timestamptz not null default now()
);

create index if not exists foot_match_events_match_id_idx on foot_match_events(match_id);
create index if not exists foot_attendance_match_id_idx on foot_attendance(match_id);
