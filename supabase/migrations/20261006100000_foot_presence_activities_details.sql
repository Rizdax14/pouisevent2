-- Nombre minimum de joueurs par match (liste d'attente au-delà)
alter table foot_matches add column if not exists min_players integer check (min_players is null or (min_players between 1 and 50));

-- Activités libres (hors match) avec réponses de présence
create table if not exists foot_activities (
  id bigint generated always as identity primary key,
  title text not null,
  description text,
  starts_at timestamptz not null,
  location text,
  min_players integer check (min_players is null or (min_players between 1 and 200)),
  created_at timestamptz not null default now()
);
create table if not exists foot_activity_attendance (
  activity_id bigint not null references foot_activities(id) on delete cascade,
  player_id integer not null references players(id) on delete cascade,
  status text not null check (status in ('present','absent')),
  responded_at timestamptz not null default now(),
  primary key (activity_id, player_id)
);
create index if not exists foot_activity_attendance_activity_idx on foot_activity_attendance(activity_id);

-- Infos personnelles des joueurs : lues et écrites uniquement par le serveur (clé de service), jamais par le navigateur
create table if not exists foot_player_details (
  player_id integer primary key references players(id) on delete cascade,
  birth_date date,
  phone text,
  email text,
  updated_at timestamptz not null default now()
);
alter table foot_player_details enable row level security;
