-- Substitutions during the live: player_id = the player coming on, assist_player_id = the one going off.
alter table public.foot_match_events drop constraint if exists foot_match_events_type_check;
alter table public.foot_match_events add constraint foot_match_events_type_check
  check (type in ('goal_bl', 'goal_opponent', 'shot_on', 'shot_off', 'save', 'foul', 'yellow', 'red', 'sub'));
