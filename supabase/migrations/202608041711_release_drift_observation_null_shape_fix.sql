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
  if jsonb_typeof(p_edges) is distinct from 'array' then
    raise exception 'Edge observation array required' using errcode='22023';
  end if;
  v_count:=jsonb_array_length(p_edges);
  if v_count<1 or v_count>50 then
    raise exception 'Edge observation count out of bounds' using errcode='22023';
  end if;
  for v_item in select value from jsonb_array_elements(p_edges)
  loop
    if jsonb_typeof(v_item) is distinct from 'object'
      or coalesce(v_item->>'slug','') !~ '^[a-z0-9][a-z0-9-]{1,99}$'
      or jsonb_typeof(v_item->'version') is distinct from 'number'
      or coalesce(v_item->>'version','') !~ '^[0-9]+$'
      or coalesce((v_item->>'version')::integer,0)<1
      or coalesce((v_item->>'version')::integer,100001)>100000
      or jsonb_typeof(v_item->'verify_jwt') is distinct from 'boolean'
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
  if jsonb_typeof(p_assets) is distinct from 'array' then
    raise exception 'Asset observation array required' using errcode='22023';
  end if;
  v_count:=jsonb_array_length(p_assets);
  if v_count<1 or v_count>100 then
    raise exception 'Asset observation count out of bounds' using errcode='22023';
  end if;
  for v_item in select value from jsonb_array_elements(p_assets)
  loop
    if jsonb_typeof(v_item) is distinct from 'object'
      or coalesce(v_item->>'path','') !~ '^v79/[A-Za-z0-9._/-]{1,180}$'
      or coalesce(v_item->>'sha','') !~ '^[0-9a-f]{40}$'
      or jsonb_typeof(v_item->'marker_ok') is distinct from 'boolean'
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

revoke all on function private.assert_crypto_release_drift_edges(jsonb) from public,anon,authenticated;
revoke all on function private.assert_crypto_release_drift_assets(jsonb) from public,anon,authenticated;
grant execute on function private.assert_crypto_release_drift_edges(jsonb) to service_role;
grant execute on function private.assert_crypto_release_drift_assets(jsonb) to service_role;
