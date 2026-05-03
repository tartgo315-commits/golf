alter table public.bets
  add column if not exists tie_rule text;

comment on column public.bets.tie_rule is 'Match / lasi per-hole tie handling: void | carry | double';
