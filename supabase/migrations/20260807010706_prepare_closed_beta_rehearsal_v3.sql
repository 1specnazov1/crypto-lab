create table if not exists public.crypto_closed_beta_config (
  singleton boolean primary key default true check (singleton),
  mode text not null default 'prepared_inactive' check (mode in ('prepared_inactive','owner_authorized_closed_beta','completed')),
  target_min_users smallint not null default 10 check (target_min_users between 10 and 20),
  target_max_users smallint not null default 20 check (target_max_users between 10 and 20 and target_max_users >= target_min_users),
  invitations_enabled boolean not null default false,
  auth_accounts_enabled boolean not null default false,
  real_payments_enabled boolean not null default false,
  mainnet_enabled boolean not null default false,
  owner_approval_required boolean not null default true,
  prepared_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.crypto_closed_beta_test_personas (
  slot smallint primary key check (slot between 1 and 20),
  persona_key text not null unique,
  synthetic_email text not null unique,
  target_plan text not null check (target_plan in ('FREE','BASIC','PRO')),
  auth_user_id uuid null,
  state text not null default 'prepared_not_created' check (state in ('prepared_not_created','created_after_owner_approval','retired')),
  invitation_sent boolean not null default false,
  real_person boolean not null default false,
  wallet_signature_required boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (right(lower(synthetic_email),19) = '@crypto-lab.invalid'),
  check (not real_person),
  check (not invitation_sent or state = 'created_after_owner_approval')
);

create table if not exists public.crypto_closed_beta_scenarios (
  code text primary key,
  area text not null,
  title text not null,
  execution_mode text not null check (execution_mode in ('offline_contract','sandbox_after_owner_approval','real_user_after_owner_approval')),
  status text not null default 'prepared' check (status in ('prepared','blocked_external','ready_for_execution','passed','failed')),
  requires_auth_activation boolean not null default false,
  requires_wallet_signature boolean not null default false,
  requires_real_user boolean not null default false,
  destructive boolean not null default false,
  steps jsonb not null,
  expected_result text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.crypto_closed_beta_checklist (
  persona_slot smallint not null references public.crypto_closed_beta_test_personas(slot) on delete restrict,
  scenario_code text not null references public.crypto_closed_beta_scenarios(code) on delete restrict,
  status text not null default 'pending' check (status in ('pending','blocked_external','passed','failed','not_applicable')),
  evidence jsonb not null default '{}'::jsonb,
  checked_at timestamptz null,
  primary key (persona_slot, scenario_code)
);

alter table public.crypto_closed_beta_config enable row level security;
alter table public.crypto_closed_beta_test_personas enable row level security;
alter table public.crypto_closed_beta_scenarios enable row level security;
alter table public.crypto_closed_beta_checklist enable row level security;

revoke all on table public.crypto_closed_beta_config from public, anon, authenticated;
revoke all on table public.crypto_closed_beta_test_personas from public, anon, authenticated;
revoke all on table public.crypto_closed_beta_scenarios from public, anon, authenticated;
revoke all on table public.crypto_closed_beta_checklist from public, anon, authenticated;

grant select, insert, update on table public.crypto_closed_beta_config to service_role;
grant select, insert, update on table public.crypto_closed_beta_test_personas to service_role;
grant select, insert, update on table public.crypto_closed_beta_scenarios to service_role;
grant select, insert, update on table public.crypto_closed_beta_checklist to service_role;

insert into public.crypto_closed_beta_config (
  singleton, mode, target_min_users, target_max_users,
  invitations_enabled, auth_accounts_enabled, real_payments_enabled, mainnet_enabled,
  owner_approval_required, metadata
) values (
  true, 'prepared_inactive', 10, 20,
  false, false, false, false,
  true,
  jsonb_build_object(
    'candidate','v79',
    'stable_public_version','v78',
    'real_users_invited',false,
    'synthetic_personas_only',true,
    'purpose','Prepare closed commercial beta without activating auth, billing, mainnet, refunds, or publication.'
  )
)
on conflict (singleton) do update set
  mode='prepared_inactive',
  target_min_users=excluded.target_min_users,
  target_max_users=excluded.target_max_users,
  invitations_enabled=false,
  auth_accounts_enabled=false,
  real_payments_enabled=false,
  mainnet_enabled=false,
  owner_approval_required=true,
  prepared_at=now(),
  metadata=excluded.metadata;

insert into public.crypto_closed_beta_test_personas (
  slot, persona_key, synthetic_email, target_plan, state, invitation_sent, real_person, wallet_signature_required, metadata
)
select gs,
       format('beta-%s', lpad(gs::text,2,'0')),
       format('beta%s@crypto-lab.invalid', lpad(gs::text,2,'0')),
       case when gs <= 6 then 'FREE' when gs <= 13 then 'BASIC' else 'PRO' end,
       'prepared_not_created', false, false, false,
       jsonb_build_object(
         'synthetic',true,
         'auth_account_created',false,
         'invitation_allowed',false,
         'notes','Reserved non-deliverable persona. Not an auth.users account and not a real person.'
       )
from generate_series(1,20) gs
on conflict (slot) do update set
  persona_key=excluded.persona_key,
  synthetic_email=excluded.synthetic_email,
  target_plan=excluded.target_plan,
  auth_user_id=null,
  state='prepared_not_created',
  invitation_sent=false,
  real_person=false,
  wallet_signature_required=false,
  metadata=excluded.metadata;

insert into public.crypto_closed_beta_scenarios (
  code, area, title, execution_mode, status,
  requires_auth_activation, requires_wallet_signature, requires_real_user, destructive,
  steps, expected_result
) values
('BETA-AUTH-01','auth','Registration gate remains closed before owner approval','offline_contract','prepared',false,false,false,false,'["Read commercial flags","Read account portal config","Verify public_registration_enabled=false and registration_enabled=false"]'::jsonb,'Registration cannot be activated by beta preparation.'),
('BETA-AUTH-02','auth','Signup/login/recovery closed-mode contract','sandbox_after_owner_approval','prepared',true,false,false,false,'["Use isolated beta account only after owner approval","Exercise signup/login/recovery","Verify rate limits and audit trail"]'::jsonb,'Auth flows work only after explicit closed-beta activation and remain unavailable publicly.'),
('BETA-ACCT-01','account','Account snapshot and plan display','sandbox_after_owner_approval','prepared',true,false,false,false,'["Open authenticated account snapshot","Verify effective plan","Verify access end timestamp and cancellation state"]'::jsonb,'Account data is scoped to the authenticated beta user and plan state is internally consistent.'),
('BETA-BILL-01','billing','BASIC $20 invoice lifecycle in sandbox','sandbox_after_owner_approval','prepared',true,true,false,false,'["Create sandbox BASIC invoice","Confirm amount_minor=2000","Observe one testnet payment","Verify one entitlement transition"]'::jsonb,'Exactly one sandbox payment produces exactly one BASIC entitlement after verifier finality.'),
('BETA-BILL-02','billing','PRO $49 invoice lifecycle in sandbox','sandbox_after_owner_approval','prepared',true,true,false,false,'["Create sandbox PRO invoice","Confirm amount_minor=4900","Observe one testnet payment","Verify one entitlement transition"]'::jsonb,'Exactly one sandbox payment produces exactly one PRO entitlement after verifier finality.'),
('BETA-BILL-03','billing','Duplicate payment protection','sandbox_after_owner_approval','prepared',true,true,false,false,'["Replay previously observed testnet transaction","Re-run verifier","Inspect billing events and subscription history"]'::jsonb,'Duplicate observation does not create a second credit, invoice settlement, or entitlement extension.'),
('BETA-SIG-01','signals','Signal registration and lifecycle','sandbox_after_owner_approval','prepared',true,false,false,false,'["Register eligible test signal","Verify monitor row","Simulate lifecycle update","Verify no duplicate monitor"]'::jsonb,'Signal is registered once and lifecycle state advances idempotently.'),
('BETA-NOTIFY-01','notifications','Notification outbox contract','sandbox_after_owner_approval','prepared',true,false,false,false,'["Create eligible beta notification event","Inspect outbox","Verify deduplication flags","Do not contact real recipients"]'::jsonb,'One eligible event creates at most one deliverable notification record; no real recipient is contacted during rehearsal.'),
('BETA-SUPPORT-01','support','Support ticket ownership and visibility','sandbox_after_owner_approval','prepared',true,false,false,false,'["Create synthetic support ticket","Read from same beta identity","Attempt cross-user access","Verify denial"]'::jsonb,'Ticket is visible only to its owner and authorized administration.'),
('BETA-CANCEL-01','subscription','Period-end cancellation contract','sandbox_after_owner_approval','prepared',true,false,false,false,'["Mark synthetic paid subscription cancel_at_period_end","Verify access remains until period end","Verify no recurring debit is created"]'::jsonb,'Cancellation preserves paid access until period end and does not initiate an automatic debit.'),
('BETA-SEC-01','security','Anonymous commercial surface denial','offline_contract','prepared',false,false,false,false,'["Inspect grants/RLS","Verify service-only beta tables","Verify admin RPCs unavailable to anon/authenticated"]'::jsonb,'Anonymous and normal authenticated roles cannot read or mutate service-only beta control data.'),
('BETA-REL-01','release','Stable v78 preservation and v79 non-publication','offline_contract','prepared',false,false,false,false,'["Verify production root SHA","Verify v79 publication flag=false","Verify production_launch_authorized=false"]'::jsonb,'Stable v78 remains unchanged and v79 is not promoted without owner approval.')
on conflict (code) do update set
  area=excluded.area,
  title=excluded.title,
  execution_mode=excluded.execution_mode,
  status='prepared',
  requires_auth_activation=excluded.requires_auth_activation,
  requires_wallet_signature=excluded.requires_wallet_signature,
  requires_real_user=excluded.requires_real_user,
  destructive=excluded.destructive,
  steps=excluded.steps,
  expected_result=excluded.expected_result;

insert into public.crypto_closed_beta_checklist (persona_slot, scenario_code, status, evidence)
select p.slot, s.code,
       case when s.execution_mode='real_user_after_owner_approval' then 'blocked_external' else 'pending' end,
       jsonb_build_object('prepared_only',true,'executed',false)
from public.crypto_closed_beta_test_personas p
cross join public.crypto_closed_beta_scenarios s
on conflict (persona_slot, scenario_code) do update set
  status=excluded.status,
  evidence=excluded.evidence,
  checked_at=null;

create or replace function public.crypto_closed_beta_readiness()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'mode', c.mode,
    'target_min_users', c.target_min_users,
    'target_max_users', c.target_max_users,
    'invitations_enabled', c.invitations_enabled,
    'auth_accounts_enabled', c.auth_accounts_enabled,
    'real_payments_enabled', c.real_payments_enabled,
    'mainnet_enabled', c.mainnet_enabled,
    'owner_approval_required', c.owner_approval_required,
    'synthetic_personas', (select count(*) from public.crypto_closed_beta_test_personas where real_person=false and auth_user_id is null and invitation_sent=false),
    'prepared_scenarios', (select count(*) from public.crypto_closed_beta_scenarios where status='prepared'),
    'checklist_items', (select count(*) from public.crypto_closed_beta_checklist),
    'executed_checklist_items', (select count(*) from public.crypto_closed_beta_checklist where status in ('passed','failed')),
    'auth_users_total', (select count(*) from auth.users),
    'production_flags', (select jsonb_build_object(
       'paid_checkout_enabled',paid_checkout_enabled,
       'paid_entitlement_enabled',paid_entitlement_enabled,
       'public_registration_enabled',public_registration_enabled,
       'recurring_billing_enabled',recurring_billing_enabled,
       'refund_execution_enabled',refund_execution_enabled,
       'production_launch_authorized',production_launch_authorized
     ) from public.crypto_commercial_runtime_flags where singleton=true),
    'safe_to_prepare', not c.invitations_enabled and not c.auth_accounts_enabled and not c.real_payments_enabled and not c.mainnet_enabled
  )
  from public.crypto_closed_beta_config c
  where c.singleton=true;
$$;

revoke all on function public.crypto_closed_beta_readiness() from public, anon, authenticated;
grant execute on function public.crypto_closed_beta_readiness() to service_role;

comment on table public.crypto_closed_beta_test_personas is 'Synthetic, non-deliverable closed-beta persona reservations only. They are not auth users and are not real people.';
comment on table public.crypto_closed_beta_checklist is 'Prepared closed-beta execution matrix. Pending rows are not evidence that a scenario was executed.';
comment on function public.crypto_closed_beta_readiness() is 'Service-role-only readiness snapshot; has no activation or payment side effects.';
