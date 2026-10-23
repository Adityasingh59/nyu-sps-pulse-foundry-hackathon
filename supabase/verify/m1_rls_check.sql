-- M1 isolation check for a real Supabase project. Paste into the SQL editor
-- after applying supabase/migrations/20261023000000_workspace_restaurants.sql.
--
-- Creates two throwaway users, exercises RLS as `authenticated` and `anon`,
-- then deletes everything it created. Any failed check raises an error and the
-- whole block is rolled back, so no test data remains either way.
-- Success: the final query returns "M1 RLS check passed".

do $$
declare
  alice uuid := gen_random_uuid();
  bob uuid := gen_random_uuid();
  alice_ws uuid;
  bob_ws uuid;
  n int;
  rid text := 'restaurant_' || gen_random_uuid();
begin
  insert into auth.users (id) values (alice), (bob);

  -- Alice: personal workspace (idempotent) and her own restaurant.
  perform set_config('request.jwt.claims', json_build_object('sub', alice, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  alice_ws := public.ensure_personal_workspace();
  if public.ensure_personal_workspace() <> alice_ws then
    raise exception 'FAIL: personal workspace is not idempotent';
  end if;
  insert into public.restaurants (id, workspace_id, name, location)
    values (rid, alice_ws, 'RLS check cafe', 'Nowhere');
  select count(*) into n from public.restaurants where id = rid;
  if n <> 1 then raise exception 'FAIL: owner cannot read own restaurant'; end if;

  -- Bob: another tenant.
  perform set_config('request.jwt.claims', json_build_object('sub', bob, 'role', 'authenticated')::text, true);
  bob_ws := public.ensure_personal_workspace();
  if bob_ws = alice_ws then raise exception 'FAIL: tenants share a workspace'; end if;
  select count(*) into n from public.restaurants where id = rid;
  if n <> 0 then raise exception 'FAIL: other tenant can read the restaurant'; end if;
  select count(*) into n from public.workspaces where id = alice_ws;
  if n <> 0 then raise exception 'FAIL: other tenant can read the workspace'; end if;
  update public.restaurants set name = 'Hijacked' where id = rid;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: other tenant can update the restaurant'; end if;
  begin
    insert into public.restaurants (id, workspace_id, name, location)
      values ('restaurant_' || gen_random_uuid(), alice_ws, 'Injected', 'Elsewhere');
    raise exception 'FAIL: other tenant can insert into the workspace';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.workspace_members (workspace_id, user_id, role) values (alice_ws, bob, 'owner');
    raise exception 'FAIL: a user can grant themselves membership';
  exception when insufficient_privilege then null;
  end;

  -- Alice cannot delete or move her row to another tenant.
  perform set_config('request.jwt.claims', json_build_object('sub', alice, 'role', 'authenticated')::text, true);
  begin
    delete from public.restaurants where id = rid;
    raise exception 'FAIL: restaurants can be deleted by clients';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.restaurants set workspace_id = bob_ws where id = rid;
    raise exception 'FAIL: a restaurant can be moved between workspaces';
  exception when insufficient_privilege then null;
  end;

  -- Anonymous callers.
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  perform set_config('role', 'anon', true);
  begin
    perform 1 from public.restaurants;
    raise exception 'FAIL: anon can query restaurants';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.ensure_personal_workspace();
    raise exception 'FAIL: anon can create a workspace';
  exception when insufficient_privilege then null;
  end;

  -- Clean up as the session user.
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', '', true);
  select count(*) into n from public.restaurants where id = rid and name = 'RLS check cafe';
  if n <> 1 then raise exception 'FAIL: restaurant changed during rejected mutations'; end if;
  delete from public.restaurants where id = rid;
  delete from public.workspaces where id in (alice_ws, bob_ws);
  delete from auth.users where id in (alice, bob);
end;
$$;

select 'M1 RLS check passed' as result;
