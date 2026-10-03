alter table foot_matches add column if not exists venue text not null default 'domicile';
alter table foot_matches drop constraint if exists foot_matches_venue_check;
alter table foot_matches add constraint foot_matches_venue_check check (venue in ('domicile','exterieur'));

alter table foot_roster add column if not exists jersey_number text;
alter table foot_roster drop constraint if exists foot_roster_jersey_number_check;
alter table foot_roster add constraint foot_roster_jersey_number_check check (jersey_number is null or jersey_number ~ '^[0-9]{1,3}$');

create table if not exists foot_player_photos (
  id bigint generated always as identity primary key,
  player_id integer not null references players(id) on delete cascade,
  kit text not null check (kit in ('domicile','exterieur')),
  kind text not null check (kind in ('render','celebration','dos')),
  retouched boolean not null default false,
  path text not null,
  width integer not null,
  height integer not null,
  updated_at timestamptz not null default now(),
  unique (player_id, kit, kind, retouched)
);

create table if not exists foot_photo_framings (
  photo_id bigint not null references foot_player_photos(id) on delete cascade,
  layout text not null check (layout in ('matchday','result','groupe','render')),
  x real not null,
  y real not null,
  width real not null check (width > 0),
  updated_at timestamptz not null default now(),
  primary key (photo_id, layout)
);

create table if not exists foot_insta_posts (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('matchday','result','ratings','rankings')),
  match_id bigint references foot_matches(id) on delete set null,
  season text,
  week_key text,
  featured jsonb not null default '{}'::jsonb,
  image_paths text[] not null default '{}',
  caption text,
  status text not null default 'draft' check (status in ('draft','published','failed')),
  ig_media_id text,
  permalink text,
  error text,
  created_at timestamptz not null default now(),
  published_at timestamptz
);

create table if not exists app_secrets (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
alter table app_secrets enable row level security;

insert into storage.buckets (id, name, public) values ('player-photos','player-photos', true) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('insta-posts','insta-posts', true) on conflict (id) do nothing;
