-- Groupe is now its own post (separate from Match Day), and a post can only be published once.
alter table foot_insta_posts drop constraint if exists foot_insta_posts_kind_check;
alter table foot_insta_posts add constraint foot_insta_posts_kind_check
  check (kind in ('matchday','groupe','result','ratings','rankings'));

create unique index if not exists foot_insta_posts_one_published_per_match
  on foot_insta_posts (kind, match_id) where status = 'published' and match_id is not null;
create unique index if not exists foot_insta_posts_one_published_per_week
  on foot_insta_posts (kind, week_key) where status = 'published' and week_key is not null;
