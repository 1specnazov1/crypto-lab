alter table public.crypto_smart_money_snapshots
  drop constraint if exists crypto_smart_money_score_chk;

alter table public.crypto_smart_money_snapshots
  add constraint crypto_smart_money_score_chk
  check (smart_score is null or (smart_score >= -100 and smart_score <= 100));
