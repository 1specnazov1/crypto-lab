update public.crypto_launch_integrity_baseline
set expected_requirement_count = 18,
    expected_weight_total = 126,
    baseline_reason = 'Includes ACCOUNT_PORTAL as a separately weighted identity control in the closed commercial candidate.',
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'previous_count', expected_requirement_count,
      'previous_weight', expected_weight_total,
      'baseline_version', coalesce((metadata->>'baseline_version')::integer, 2) + 1,
      'added_requirement', 'ACCOUNT_PORTAL',
      'account_portal_weight', 6,
      'commercial_candidate', 'v79',
      'stable_public_version', 'v78',
      'repaired_at', now()
    ),
    updated_at = now()
where singleton = true;

do $$
declare s jsonb;
begin
  s := private.crypto_launch_control_integrity_snapshot();
  if s->>'state' <> 'healthy' then
    raise exception 'LAUNCH_INTEGRITY_NOT_HEALTHY_AFTER_BASELINE_REPAIR: %', s;
  end if;
end;
$$;