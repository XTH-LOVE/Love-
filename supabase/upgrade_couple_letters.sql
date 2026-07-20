create table if not exists public.couple_letters(
 id uuid primary key default gen_random_uuid(),couple_id uuid not null references public.couples(id) on delete cascade,
 sender_id uuid not null references public.profiles(id),recipient_id uuid not null references public.profiles(id),
 content text not null check(char_length(content) between 1 and 1200),created_at timestamptz not null default now(),
 check(sender_id<>recipient_id)
);
create index if not exists couple_letters_recipient_idx on public.couple_letters(couple_id,recipient_id,created_at desc);
alter table public.couple_letters enable row level security;
drop policy if exists "letters read couple" on public.couple_letters;drop policy if exists "letters send to partner" on public.couple_letters;drop policy if exists "letters delete sender" on public.couple_letters;
create policy "letters read couple" on public.couple_letters for select using(public.is_couple_member(couple_id) and (sender_id=auth.uid() or recipient_id=auth.uid()));
create policy "letters send to partner" on public.couple_letters for insert with check(sender_id=auth.uid() and public.is_couple_member(couple_id) and exists(select 1 from public.couple_members cm where cm.couple_id=couple_letters.couple_id and cm.user_id=recipient_id));
create policy "letters delete sender" on public.couple_letters for delete using(sender_id=auth.uid());
notify pgrst,'reload schema';
