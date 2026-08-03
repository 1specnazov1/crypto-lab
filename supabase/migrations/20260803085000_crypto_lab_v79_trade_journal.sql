create table if not exists public.crypto_trade_journal (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  symbol text not null,
  timeframe text not null default '1H',
  direction text not null,
  status text not null default 'OPEN',
  strategy text,
  setup text,
  entry_time timestamptz not null default now(),
  exit_time timestamptz,
  entry_price numeric not null,
  exit_price numeric,
  stop_price numeric,
  take_profit_price numeric,
  quantity numeric not null default 1,
  leverage numeric not null default 1,
  fees numeric not null default 0,
  notes text,
  tags text[] not null default '{}',
  source text not null default 'manual',
  source_signal_id uuid,
  realized_pnl numeric generated always as (
    case
      when status = 'CLOSED' and exit_price is not null then
        (case when direction = 'LONG' then (exit_price - entry_price) else (entry_price - exit_price) end) * quantity - fees
      else null
    end
  ) stored,
  risk_amount numeric generated always as (
    case when stop_price is not null then abs(entry_price - stop_price) * quantity else null end
  ) stored,
  r_multiple numeric generated always as (
    case
      when status = 'CLOSED' and exit_price is not null and stop_price is not null and abs(entry_price - stop_price) * quantity > 0 then
        ((case when direction = 'LONG' then (exit_price - entry_price) else (entry_price - exit_price) end) * quantity - fees)
        / (abs(entry_price - stop_price) * quantity)
      else null
    end
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crypto_trade_journal_symbol_check check (symbol ~ '^[A-Z0-9]{2,20}$'),
  constraint crypto_trade_journal_timeframe_check check (timeframe in ('1M','3M','5M','15M','30M','1H','2H','4H','6H','8H','12H','1D','3D','1W','1MO')),
  constraint crypto_trade_journal_direction_check check (direction in ('LONG','SHORT')),
  constraint crypto_trade_journal_status_check check (status in ('OPEN','CLOSED','CANCELLED')),
  constraint crypto_trade_journal_source_check check (source in ('manual','scanner','import')),
  constraint crypto_trade_journal_entry_price_check check (entry_price > 0),
  constraint crypto_trade_journal_exit_price_check check (exit_price is null or exit_price > 0),
  constraint crypto_trade_journal_stop_price_check check (stop_price is null or stop_price > 0),
  constraint crypto_trade_journal_take_profit_check check (take_profit_price is null or take_profit_price > 0),
  constraint crypto_trade_journal_quantity_check check (quantity > 0),
  constraint crypto_trade_journal_leverage_check check (leverage >= 1 and leverage <= 125),
  constraint crypto_trade_journal_fees_check check (fees >= 0),
  constraint crypto_trade_journal_closed_check check (status <> 'CLOSED' or (exit_price is not null and exit_time is not null)),
  constraint crypto_trade_journal_time_order_check check (exit_time is null or exit_time >= entry_time)
);

create index if not exists crypto_trade_journal_user_entry_idx on public.crypto_trade_journal(user_id, entry_time desc);
create index if not exists crypto_trade_journal_user_status_idx on public.crypto_trade_journal(user_id, status);
create index if not exists crypto_trade_journal_user_symbol_idx on public.crypto_trade_journal(user_id, symbol);

create or replace function public.set_crypto_trade_journal_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists crypto_trade_journal_updated_at on public.crypto_trade_journal;
create trigger crypto_trade_journal_updated_at
before update on public.crypto_trade_journal
for each row execute function public.set_crypto_trade_journal_updated_at();

alter table public.crypto_trade_journal enable row level security;

drop policy if exists crypto_trade_journal_select_own on public.crypto_trade_journal;
create policy crypto_trade_journal_select_own on public.crypto_trade_journal
for select to authenticated using (user_id = auth.uid());

drop policy if exists crypto_trade_journal_insert_own on public.crypto_trade_journal;
create policy crypto_trade_journal_insert_own on public.crypto_trade_journal
for insert to authenticated with check (user_id = auth.uid());

drop policy if exists crypto_trade_journal_update_own on public.crypto_trade_journal;
create policy crypto_trade_journal_update_own on public.crypto_trade_journal
for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists crypto_trade_journal_delete_own on public.crypto_trade_journal;
create policy crypto_trade_journal_delete_own on public.crypto_trade_journal
for delete to authenticated using (user_id = auth.uid());

revoke all on table public.crypto_trade_journal from anon;
grant select, insert, update, delete on table public.crypto_trade_journal to authenticated;
revoke all on function public.set_crypto_trade_journal_updated_at() from public, anon, authenticated;