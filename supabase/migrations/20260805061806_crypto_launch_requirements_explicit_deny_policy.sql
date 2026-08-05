drop policy if exists crypto_launch_requirements_no_direct_access on public.crypto_launch_requirements;
create policy crypto_launch_requirements_no_direct_access
on public.crypto_launch_requirements
as restrictive
for all
to public
using (false)
with check (false);
