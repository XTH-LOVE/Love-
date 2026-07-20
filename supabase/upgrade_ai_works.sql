create table if not exists public.ai_saved_works(
 id uuid primary key default gen_random_uuid(),couple_id uuid not null references public.couples(id) on delete cascade,
 user_id uuid not null references public.profiles(id),kind text not null check(kind in ('diary','love_letter')),
 work_date date not null default current_date,title text not null,content text not null check(char_length(content) between 1 and 5000),
 memory_id uuid references public.memories(id) on delete set null,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
);
create unique index if not exists ai_saved_diary_per_day on public.ai_saved_works(couple_id,kind,work_date) where kind='diary';
alter table public.ai_saved_works enable row level security;
drop policy if exists "ai works read couple" on public.ai_saved_works;drop policy if exists "ai works write couple" on public.ai_saved_works;drop policy if exists "ai works update couple" on public.ai_saved_works;drop policy if exists "ai works delete couple" on public.ai_saved_works;
create policy "ai works read couple" on public.ai_saved_works for select using(public.is_couple_member(couple_id));
create policy "ai works write couple" on public.ai_saved_works for insert with check(user_id=auth.uid() and public.is_couple_member(couple_id));
create policy "ai works update couple" on public.ai_saved_works for update using(public.is_couple_member(couple_id)) with check(public.is_couple_member(couple_id));
create policy "ai works delete couple" on public.ai_saved_works for delete using(public.is_couple_member(couple_id));
notify pgrst,'reload schema';
