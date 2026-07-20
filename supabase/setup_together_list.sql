create table if not exists public.together_items (
  id uuid primary key default gen_random_uuid(), couple_id uuid not null references public.couples(id) on delete cascade,
  created_by uuid not null references public.profiles(id), title text not null check(char_length(title) between 1 and 100),
  note text check(note is null or char_length(note)<=500), category text not null check(category in('wish','travel','movie','date')),
  priority text not null default 'normal' check(priority in('low','normal','high')), planned_date date,
  completed boolean not null default false, completed_by uuid references public.profiles(id), completed_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists together_items_couple_idx on public.together_items(couple_id,completed,created_at desc);
alter table public.together_items enable row level security;
drop policy if exists "list read by couple" on public.together_items;drop policy if exists "list create by couple" on public.together_items;drop policy if exists "list update by couple" on public.together_items;drop policy if exists "list delete by creator" on public.together_items;
create policy "list read by couple" on public.together_items for select using(public.is_couple_member(couple_id));
create policy "list create by couple" on public.together_items for insert with check(public.is_couple_member(couple_id) and created_by=auth.uid());
create policy "list update by couple" on public.together_items for update using(public.is_couple_member(couple_id)) with check(public.is_couple_member(couple_id) and (completed_by is null or public.is_couple_member(couple_id,completed_by)));
create policy "list delete by creator" on public.together_items for delete using(created_by=auth.uid());
