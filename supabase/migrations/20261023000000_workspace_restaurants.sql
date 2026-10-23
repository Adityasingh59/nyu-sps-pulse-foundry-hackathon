-- M1 cloud vertical slice: workspaces, verified membership and restaurant
-- identities. Every tenant-owned row carries workspace_id; access is enforced by
-- RLS here, not by UI filtering. Restaurant IDs stay opaque text so a later,
-- explicit legacy import can preserve existing `restaurant_<uuid>` IDs.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now()
);
create index workspaces_created_by_idx on public.workspaces (created_by);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'editor', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create index workspace_members_user_id_idx on public.workspace_members (user_id);

create table public.restaurants (
  id text primary key check (id ~ '^restaurant_[A-Za-z0-9_-]{1,100}$'),
  workspace_id uuid not null references public.workspaces (id) on delete restrict,
  name text not null check (char_length(name) between 1 and 120),
  -- Optional: some businesses have no site. Validated as public http(s) by the API.
  website text check (website is null or char_length(website) <= 2000),
  location text not null check (char_length(location) between 1 and 300),
  cuisine text check (cuisine is null or char_length(cuisine) <= 120),
  aliases text[] not null default '{}' check (cardinality(aliases) <= 10),
  facts jsonb not null default '[]' check (jsonb_typeof(facts) = 'array'),
  -- User-entered identity is manual input, never website evidence or ownership.
  identity_source text not null default 'manual'
    check (identity_source in ('manual', 'website', 'owner', 'synthetic')),
  confirmed_at timestamptz,
  created_by uuid not null default auth.uid() references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Target for composite (workspace_id, restaurant_id) foreign keys from child rows.
  unique (workspace_id, id)
);
create index restaurants_created_by_idx on public.restaurants (created_by);

-- Membership helpers. SECURITY DEFINER avoids recursive RLS on
-- workspace_members; each checks the caller's own auth.uid(). The private
-- schema is not exposed through the Data API.
create function private.is_workspace_member(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = p_workspace_id and m.user_id = (select auth.uid())
  );
$$;

create function private.can_write_workspace(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = p_workspace_id
      and m.user_id = (select auth.uid())
      and m.role in ('owner', 'editor')
  );
$$;

revoke execute on function private.is_workspace_member(uuid) from public, anon;
revoke execute on function private.can_write_workspace(uuid) from public, anon;
grant execute on function private.is_workspace_member(uuid) to authenticated;
grant execute on function private.can_write_workspace(uuid) to authenticated;

-- Server-controlled ownership: the only way a client gains membership is this
-- idempotent function, which creates one personal workspace for the caller.
create function public.ensure_personal_workspace()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_workspace uuid;
begin
  if v_user is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  -- Serialize concurrent first sign-ins for the same user.
  perform pg_advisory_xact_lock(hashtextextended(v_user::text, 0));
  select m.workspace_id into v_workspace
  from public.workspace_members m
  join public.workspaces w on w.id = m.workspace_id
  where m.user_id = v_user and m.role = 'owner' and w.created_by = v_user
  order by m.created_at
  limit 1;
  if v_workspace is null then
    insert into public.workspaces (name, created_by)
    values ('Personal workspace', v_user)
    returning id into v_workspace;
    insert into public.workspace_members (workspace_id, user_id, role)
    values (v_workspace, v_user, 'owner');
  end if;
  return v_workspace;
end;
$$;

revoke execute on function public.ensure_personal_workspace() from public, anon;
grant execute on function public.ensure_personal_workspace() to authenticated;

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.restaurants enable row level security;

-- Least privilege: Supabase grants broad table defaults; replace them.
revoke all on public.workspaces, public.workspace_members, public.restaurants from anon, authenticated;
grant select on public.workspaces, public.workspace_members to authenticated;
grant select, insert on public.restaurants to authenticated;
-- Identity, tenant and audit columns are not client-updatable. No DELETE grant:
-- historical records are preserved.
grant update (name, website, location, cuisine, aliases, facts, confirmed_at, updated_at)
  on public.restaurants to authenticated;

create policy workspaces_select_member on public.workspaces
  for select to authenticated
  using ((select private.is_workspace_member(id)));

create policy workspace_members_select_member on public.workspace_members
  for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_workspace_member(workspace_id)));

create policy restaurants_select_member on public.restaurants
  for select to authenticated
  using ((select private.is_workspace_member(workspace_id)));

create policy restaurants_insert_writer on public.restaurants
  for insert to authenticated
  with check (
    (select private.can_write_workspace(workspace_id))
    and created_by = (select auth.uid())
  );

create policy restaurants_update_writer on public.restaurants
  for update to authenticated
  using ((select private.can_write_workspace(workspace_id)))
  with check ((select private.can_write_workspace(workspace_id)));
