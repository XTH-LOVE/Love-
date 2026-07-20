create table if not exists public.anniversaries(
 id uuid primary key default gen_random_uuid(),couple_id uuid not null references public.couples(id) on delete cascade,
 created_by uuid not null references public.profiles(id),title text not null check(char_length(title) between 1 and 80),
 event_date date not null,kind text not null default 'custom' check(kind in('anniversary','birthday','travel','custom')),
 recurring boolean not null default true,note text check(note is null or char_length(note)<=300),created_at timestamptz not null default now()
);
create index if not exists anniversaries_couple_idx on public.anniversaries(couple_id,event_date);
alter table public.anniversaries enable row level security;
drop policy if exists "anniversaries read by couple" on public.anniversaries;drop policy if exists "anniversaries create by couple" on public.anniversaries;drop policy if exists "anniversaries update by couple" on public.anniversaries;drop policy if exists "anniversaries delete by creator" on public.anniversaries;
create policy "anniversaries read by couple" on public.anniversaries for select using(public.is_couple_member(couple_id));
create policy "anniversaries create by couple" on public.anniversaries for insert with check(public.is_couple_member(couple_id) and created_by=auth.uid());
create policy "anniversaries update by couple" on public.anniversaries for update using(public.is_couple_member(couple_id)) with check(public.is_couple_member(couple_id));
create policy "anniversaries delete by creator" on public.anniversaries for delete using(created_by=auth.uid());
