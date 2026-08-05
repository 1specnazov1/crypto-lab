-- CRYPTO LAB v79
-- A decision_required payment provider record must not retain an owner decision timestamp.

update public.crypto_launch_requirements
set decided_at=null,
    verified_at=null,
    updated_at=now()
where code='PAYMENT_PROVIDER'
  and status='decision_required'
  and coalesce((decision_summary->>'owner_approval_recorded')::boolean,false)=false;
