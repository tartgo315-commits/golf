-- Las Vegas（固拉/乱拉）扩展字段；Skins 仅使用 bet_type = 'skins'

alter table public.bets
  add column vegas_tie_rule text,
  add column eagle_multiplier integer,
  add column double_bogey_flip boolean default false;

comment on column public.bets.vegas_tie_rule is 'fixed_lasi / rotating_lasi: void | carry | double';
comment on column public.bets.eagle_multiplier is 'Las Vegas: eagle differential multiplier (1–3)';
comment on column public.bets.double_bogey_flip is 'Las Vegas: one-sided double bogey doubles pot when enabled';
