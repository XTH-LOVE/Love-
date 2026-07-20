create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  avatar_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.couples (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 40),
  relationship_start date not null,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.couple_members (
  couple_id uuid not null references public.couples(id) on delete cascade,
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (couple_id, user_id)
);

create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  code text not null unique,
  created_by uuid not null references public.profiles(id),
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_by uuid references public.profiles(id),
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(new.email, '@', 1)));
  return new;
end;
$$;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'on_auth_user_created') then
    create trigger on_auth_user_created after insert on auth.users
    for each row execute function public.handle_new_user();
  end if;
end $$;

create or replace function public.create_couple_with_invitation(couple_name text, relationship_start date)
returns text language plpgsql security definer set search_path = public as $$
declare
  new_couple_id uuid;
  new_code text;
begin
  if exists (select 1 from couple_members where user_id = auth.uid()) then
    raise exception '你已经加入了一个情侣空间';
  end if;
  insert into couples (name, relationship_start, created_by)
  values (couple_name, relationship_start, auth.uid()) returning id into new_couple_id;
  insert into couple_members (couple_id, user_id) values (new_couple_id, auth.uid());
  new_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  insert into invitations (couple_id, code, created_by) values (new_couple_id, new_code, auth.uid());
  return new_code;
end;
$$;

create or replace function public.accept_couple_invitation(invitation_code text)
returns void language plpgsql security definer set search_path = public as $$
declare target invitations%rowtype;
begin
  if exists (select 1 from couple_members where user_id = auth.uid()) then
    raise exception '你已经加入了一个情侣空间';
  end if;
  select * into target from invitations
  where code = upper(invitation_code) and accepted_at is null and expires_at > now()
  for update;
  if target.id is null then raise exception '邀请码无效或已过期'; end if;
  if (select count(*) from couple_members where couple_id = target.couple_id) >= 2 then
    raise exception '这个空间已经有两位成员';
  end if;
  insert into couple_members (couple_id, user_id) values (target.couple_id, auth.uid());
  update invitations set accepted_by = auth.uid(), accepted_at = now() where id = target.id;
end;
$$;

alter table profiles enable row level security;
alter table couples enable row level security;
alter table couple_members enable row level security;
alter table invitations enable row level security;

create or replace function public.is_couple_member(target_couple_id uuid, target_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.couple_members
    where couple_id = target_couple_id and user_id = target_user_id
  );
$$;

drop policy if exists "profiles read self" on profiles;
drop policy if exists "profiles update self" on profiles;
drop policy if exists "members read own couple" on couple_members;
drop policy if exists "couples read as member" on couples;
drop policy if exists "couples update as member" on couples;
drop policy if exists "invitations read creator" on invitations;
create policy "profiles read self" on profiles for select using (id = auth.uid());
create policy "profiles update self" on profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy "members read own couple" on couple_members for select using (public.is_couple_member(couple_id));
create policy "couples read as member" on couples for select using (
  public.is_couple_member(id)
);
create policy "couples update as member" on couples for update using (
  public.is_couple_member(id)
);
create policy "invitations read creator" on invitations for select using (created_by = auth.uid());

revoke all on function public.create_couple_with_invitation(text, date) from public;
revoke all on function public.accept_couple_invitation(text) from public;
grant execute on function public.create_couple_with_invitation(text, date) to authenticated;
grant execute on function public.accept_couple_invitation(text) to authenticated;
