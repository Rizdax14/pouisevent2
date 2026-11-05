-- Live "soundboard": besides goals, actions of one of our players (shots on/off target, saves, fouls, cards).
-- The score still only counts goal_bl / goal_opponent.
alter table public.foot_match_events drop constraint if exists foot_match_events_type_check;
alter table public.foot_match_events add constraint foot_match_events_type_check
  check (type in ('goal_bl', 'goal_opponent', 'shot_on', 'shot_off', 'save', 'foul', 'yellow', 'red'));
