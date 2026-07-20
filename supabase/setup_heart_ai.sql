create table if not exists public.daily_questions(
 id uuid primary key default gen_random_uuid(),couple_id uuid not null references public.couples(id) on delete cascade,
 question_date date not null default current_date,question text not null,category text not null default 'daily',
 created_at timestamptz not null default now(),unique(couple_id,question_date)
);
create table if not exists public.daily_answers(
 id uuid primary key default gen_random_uuid(),question_id uuid not null references public.daily_questions(id) on delete cascade,
 user_id uuid not null references public.profiles(id),answer text not null check(char_length(answer) between 1 and 1000),
 created_at timestamptz not null default now(),unique(question_id,user_id)
);
create table if not exists public.ai_generations(
 id uuid primary key default gen_random_uuid(),couple_id uuid not null references public.couples(id) on delete cascade,
 user_id uuid not null references public.profiles(id),feature text not null,input_summary text,output text not null,
 provider text not null default 'xiaomi-mimo',model text,created_at timestamptz not null default now()
);
alter table public.daily_questions enable row level security;alter table public.daily_answers enable row level security;alter table public.ai_generations enable row level security;
create or replace function public.daily_answer_count(target_question_id uuid) returns bigint language sql stable security definer set search_path=public as $$select count(*) from public.daily_answers where question_id=target_question_id$$;
drop policy if exists "questions read couple" on public.daily_questions;drop policy if exists "questions create couple" on public.daily_questions;
create policy "questions read couple" on public.daily_questions for select using(public.is_couple_member(couple_id));
create policy "questions create couple" on public.daily_questions for insert with check(public.is_couple_member(couple_id));
drop policy if exists "answers read after both" on public.daily_answers;drop policy if exists "answers create self" on public.daily_answers;drop policy if exists "answers update self" on public.daily_answers;
create policy "answers read after both" on public.daily_answers for select using(user_id=auth.uid() or public.daily_answer_count(question_id)>=2);
create policy "answers create self" on public.daily_answers for insert with check(user_id=auth.uid() and exists(select 1 from public.daily_questions q where q.id=question_id and public.is_couple_member(q.couple_id)));
create policy "answers update self" on public.daily_answers for update using(user_id=auth.uid()) with check(user_id=auth.uid());
drop policy if exists "ai history read couple" on public.ai_generations;drop policy if exists "ai history create self" on public.ai_generations;
create policy "ai history read couple" on public.ai_generations for select using(public.is_couple_member(couple_id));
create policy "ai history create self" on public.ai_generations for insert with check(user_id=auth.uid() and public.is_couple_member(couple_id));
notify pgrst,'reload schema';
