create or replace function private.assert_crypto_release_drift_edges(p_edges jsonb)
returns void
language plpgsql
immutable
set search_path to 'pg_catalog','pg_temp'
as $$
declare
  v_item jsonb;
  v_count integer;
  v_distinct integer;
begin
  if jsonb_typeof(p_edges) <> 'array' then
    raise exception 'Edge observation array required' using errcode='22023';
  end if;
  v_count:=jsonb_array_length(p_edges);
  if v_count<1 or v_count>50 then
    raise exception 'Edge observation count out of bounds' using errcode='22023';
  end if;
  for v_item in select value from jsonb_array_elements(p_edges)
  loop
    if jsonb_typeof(v_item) <> 'object'
      or coalesce(v_item->>'slug','') !~ '^[a-z0-9][a-z0-9-]{1,99}$'
      or jsonb_typeof(v_item->'version') <> 'number'
      or coalesce(v_item->>'version','') !~ '^[0-9]+$'
      or coalesce((v_item->>'version')::integer,0)<1
      or coalesce((v_item->>'version')::integer,100001)>100000
      or jsonb_typeof(v_item->'verify_jwt') <> 'boolean'
      or coalesce(v_item->>'status','') not in('ACTIVE','INACTIVE')
    then
      raise exception 'Malformed Edge observation item' using errcode='22023';
    end if;
  end loop;
  select count(distinct value->>'slug') into v_distinct from jsonb_array_elements(p_edges);
  if v_distinct<>v_count then
    raise exception 'Duplicate Edge observation slug' using errcode='22023';
  end if;
end;
$$;

create or replace function private.assert_crypto_release_drift_assets(p_assets jsonb)
returns void
language plpgsql
immutable
set search_path to 'pg_catalog','pg_temp'
as $$
declare
  v_item jsonb;
  v_count integer;
  v_distinct integer;
begin
  if jsonb_typeof(p_assets) <> 'array' then
    raise exception 'Asset observation array required' using errcode='22023';
  end if;
  v_count:=jsonb_array_length(p_assets);
  if v_count<1 or v_count>100 then
    raise exception 'Asset observation count out of bounds' using errcode='22023';
  end if;
  for v_item in select value from jsonb_array_elements(p_assets)
  loop
    if jsonb_typeof(v_item) <> 'object'
      or coalesce(v_item->>'path','') !~ '^v79/[A-Za-z0-9._/-]{1,180}$'
      or coalesce(v_item->>'sha','') !~ '^[0-9a-f]{40}$'
      or jsonb_typeof(v_item->'marker_ok') <> 'boolean'
    then
      raise exception 'Malformed asset observation item' using errcode='22023';
    end if;
  end loop;
  select count(distinct value->>'path') into v_distinct from jsonb_array_elements(p_assets);
  if v_distinct<>v_count then
    raise exception 'Duplicate asset observation path' using errcode='22023';
  end if;
end;
$$;

create or replace function private.service_record_crypto_release_drift_observation(
  p_manifest_key text,
  p_repository_head_sha text,
  p_application_commit text,
  p_root_v78_sha text,
  p_pwa_cache text,
  p_edge_functions jsonb,
  p_assets jsonb,
  p_source text default 'automation',
  p_note text default null
)
returns bigint
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $$
declare
  v_manifest_id bigint;
  v_id bigint;
begin
  select id into v_manifest_id
  from public.crypto_release_manifests
  where manifest_key=p_manifest_key and active;
  if v_manifest_id is null then
    raise exception 'Active release manifest not found' using errcode='22023';
  end if;
  if p_source not in('automation','operator','release') then
    raise exception 'Invalid observation source' using errcode='22023';
  end if;
  if p_application_commit !~ '^[0-9a-f]{40}$'
    or p_root_v78_sha !~ '^[0-9a-f]{40}$'
    or (p_repository_head_sha is not null and p_repository_head_sha !~ '^[0-9a-f]{40}$')
  then
    raise exception 'Invalid SHA' using errcode='22023';
  end if;
  if coalesce(p_pwa_cache,'') !~ '^crypto-lab-v79-[A-Za-z0-9._-]{1,80}$' then
    raise exception 'Invalid PWA cache marker' using errcode='22023';
  end if;
  if p_note is not null and char_length(p_note)>500 then
    raise exception 'Observation note too long' using errcode='22023';
  end if;
  perform private.assert_crypto_release_drift_edges(p_edge_functions);
  perform private.assert_crypto_release_drift_assets(p_assets);
  insert into public.crypto_release_drift_observations(
    manifest_id,source,repository_head_sha,application_commit,root_v78_sha,pwa_cache,edge_functions,assets,note
  ) values(
    v_manifest_id,p_source,p_repository_head_sha,p_application_commit,p_root_v78_sha,p_pwa_cache,p_edge_functions,p_assets,p_note
  ) returning id into v_id;
  return v_id;
end;
$$;

revoke all on function private.assert_crypto_release_drift_edges(jsonb) from public,anon,authenticated;
revoke all on function private.assert_crypto_release_drift_assets(jsonb) from public,anon,authenticated;
revoke all on function private.service_record_crypto_release_drift_observation(text,text,text,text,text,jsonb,jsonb,text,text) from public,anon,authenticated;
grant execute on function private.assert_crypto_release_drift_edges(jsonb) to service_role;
grant execute on function private.assert_crypto_release_drift_assets(jsonb) to service_role;
grant execute on function private.service_record_crypto_release_drift_observation(text,text,text,text,text,jsonb,jsonb,text,text) to service_role;
