create table if not exists public.crypto_owner_decision_supersessions(
  decision_id uuid primary key references public.crypto_owner_decision_records(id) on delete restrict,
  superseded_reason text not null,
  superseded_by_migration text not null,
  superseded_at timestamptz not null default now(),
  evidence jsonb not null default '{}'::jsonb,
  constraint crypto_owner_decision_supersession_reason_check check(char_length(superseded_reason) between 1 and 1000),
  constraint crypto_owner_decision_supersession_migration_check check(superseded_by_migration ~ '^[a-z0-9_]{3,120}$'),
  constraint crypto_owner_decision_supersession_evidence_check check(jsonb_typeof(evidence)='object')
);

insert into public.crypto_owner_decision_supersessions(decision_id,superseded_reason,superseded_by_migration,evidence)
select id,
  'Invalid reconstructed owner decision; retained for audit only and excluded from launch state.',
  'add_owner_decision_supersession_audit',
  jsonb_build_object('classification','invalid_reconstructed_owner_decision','preserve_for_audit_only',true,'activation_authorized',false)
from public.crypto_owner_decision_records
where decision_code='ONCHAIN_THREE_NETWORK_SELECTION'
on conflict(decision_id) do nothing;

alter table public.crypto_owner_decision_supersessions enable row level security;
revoke all on table public.crypto_owner_decision_supersessions from public,anon,authenticated;
grant select on table public.crypto_owner_decision_supersessions to service_role;
drop policy if exists crypto_owner_decision_supersessions_direct_deny on public.crypto_owner_decision_supersessions;
create policy crypto_owner_decision_supersessions_direct_deny on public.crypto_owner_decision_supersessions as restrictive for all to anon,authenticated using(false) with check(false);
