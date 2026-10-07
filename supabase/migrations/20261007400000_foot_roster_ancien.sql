-- Former regulars keep a roster line (their history stays attached) without a shirt on the rack.
alter table public.foot_roster drop constraint if exists foot_roster_role_check;
alter table public.foot_roster add constraint foot_roster_role_check check (role = any (array['regulier', 'occasionnel', 'invite', 'ancien']));
