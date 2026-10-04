-- Podium cards (Notes / Classements) are framed per layout too: allow the podium_* layouts.
alter table foot_photo_framings drop constraint if exists foot_photo_framings_layout_check;
alter table foot_photo_framings add constraint foot_photo_framings_layout_check
  check (layout in ('matchday','result','groupe','render','podium_dos','podium_celebration','podium_render'));
