create extension if not exists pgcrypto;

create table if not exists public.couple_pets (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null unique references public.couples(id) on delete cascade,
  name text not null default '小爱',
  species text not null default 'bunny' check (species in ('bunny','cat','puppy','bear')),
  level integer not null default 1 check (level between 1 and 100),
  experience integer not null default 0 check (experience >= 0),
  mood integer not null default 82 check (mood between 0 and 100),
  hunger integer not null default 78 check (hunger between 0 and 100),
  skin text not null default 'lavender',
  accessories jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.couple_streaks (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null unique references public.couples(id) on delete cascade,
  current_days integer not null default 0 check (current_days >= 0),
  longest_days integer not null default 0 check (longest_days >= 0),
  last_completed_date date,
  protection_count integer not null default 0 check (protection_count >= 0),
  level integer not null default 1 check (level between 1 and 100),
  updated_at timestamptz not null default now()
);

create table if not exists public.streak_day_actions (
  couple_id uuid not null references public.couples(id) on delete cascade,
  activity_date date not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (couple_id, activity_date, user_id)
);

create index if not exists streak_day_actions_lookup_idx on public.streak_day_actions (couple_id, activity_date);

alter table public.couple_pets enable row level security;
alter table public.couple_streaks enable row level security;
alter table public.streak_day_actions enable row level security;

drop policy if exists "pets read by couple" on public.couple_pets;
create policy "pets read by couple" on public.couple_pets for select using (public.is_couple_member(couple_id));

drop policy if exists "streaks read by couple" on public.couple_streaks;
create policy "streaks read by couple" on public.couple_streaks for select using (public.is_couple_member(couple_id));

drop policy if exists "streak actions read by couple" on public.streak_day_actions;
create policy "streak actions read by couple" on public.streak_day_actions for select using (public.is_couple_member(couple_id));

do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'couple_pets') then
    alter publication supabase_realtime add table public.couple_pets;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'couple_streaks') then
    alter publication supabase_realtime add table public.couple_streaks;
  end if;
end $$;

create or replace function public.ensure_couple_pet()
returns public.couple_pets
language plpgsql security definer set search_path = public
as $$
declare
  target_couple uuid;
  result public.couple_pets;
begin
  select couple_id into target_couple from public.couple_members where user_id = auth.uid();
  if target_couple is null then raise exception '请先绑定情侣空间'; end if;
  insert into public.couple_pets (couple_id) values (target_couple) on conflict (couple_id) do nothing;
  insert into public.couple_streaks (couple_id) values (target_couple) on conflict (couple_id) do nothing;
  select * into result from public.couple_pets where couple_id = target_couple;
  return result;
end;
$$;

create or replace function public.record_couple_activity(p_activity_date date default current_date)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  target_couple uuid;
  streak public.couple_streaks;
  pet public.couple_pets;
  completed_count integer;
  newly_completed boolean := false;
begin
  if p_activity_date <> current_date then raise exception '只能记录今天的情侣互动'; end if;
  select couple_id into target_couple from public.couple_members where user_id = auth.uid();
  if target_couple is null then raise exception '请先绑定情侣空间'; end if;
  perform public.ensure_couple_pet();
  insert into public.streak_day_actions (couple_id, activity_date, user_id)
  values (target_couple, p_activity_date, auth.uid()) on conflict do nothing;
  select count(*) into completed_count from public.streak_day_actions where couple_id = target_couple and activity_date = p_activity_date;
  select * into streak from public.couple_streaks where couple_id = target_couple for update;
  if completed_count >= 2 and streak.last_completed_date is distinct from p_activity_date then
    newly_completed := true;
    update public.couple_streaks
    set current_days = case when streak.last_completed_date = p_activity_date - 1 then streak.current_days + 1 else 1 end,
        longest_days = greatest(streak.longest_days, case when streak.last_completed_date = p_activity_date - 1 then streak.current_days + 1 else 1 end),
        last_completed_date = p_activity_date,
        level = least(100, greatest(1, floor((case when streak.last_completed_date = p_activity_date - 1 then streak.current_days + 1 else 1 end - 1) / 7) + 1)::integer),
        updated_at = now()
    where couple_id = target_couple
    returning * into streak;
    update public.couple_pets
    set experience = experience + 5,
        level = least(100, floor((experience + 5) / 50) + 1),
        mood = least(100, mood + 8),
        hunger = greatest(0, hunger - 3),
        updated_at = now()
    where couple_id = target_couple
    returning * into pet;
  else
    select * into pet from public.couple_pets where couple_id = target_couple;
  end if;
  return jsonb_build_object('streak', to_jsonb(streak), 'pet', to_jsonb(pet), 'today_completed', completed_count >= 2, 'newly_completed', newly_completed);
end;
$$;

create or replace function public.interact_with_couple_pet(p_action text)
returns public.couple_pets
language plpgsql security definer set search_path = public
as $$
declare
  target_couple uuid;
  result public.couple_pets;
begin
  if p_action not in ('feed', 'play', 'pet') then raise exception '不支持的宠物互动'; end if;
  select couple_id into target_couple from public.couple_members where user_id = auth.uid();
  if target_couple is null then raise exception '请先绑定情侣空间'; end if;
  perform public.ensure_couple_pet();
  update public.couple_pets
  set hunger = case when p_action = 'feed' then least(100, hunger + 16) else hunger end,
      mood = case when p_action = 'play' then least(100, mood + 14) when p_action = 'pet' then least(100, mood + 7) else mood end,
      experience = experience + case when p_action = 'play' then 3 else 1 end,
      level = least(100, floor((experience + case when p_action = 'play' then 3 else 1 end) / 50) + 1),
      updated_at = now()
  where couple_id = target_couple
  returning * into result;
  return result;
end;
$$;

revoke all on function public.ensure_couple_pet() from public;
revoke all on function public.record_couple_activity(date) from public;
revoke all on function public.interact_with_couple_pet(text) from public;
grant execute on function public.ensure_couple_pet() to authenticated;
grant execute on function public.record_couple_activity(date) to authenticated;
grant execute on function public.interact_with_couple_pet(text) to authenticated;
