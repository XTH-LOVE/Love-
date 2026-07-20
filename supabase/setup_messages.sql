create table if not exists public.messages(
 id uuid primary key default gen_random_uuid(),couple_id uuid not null references public.couples(id) on delete cascade,
 sender_id uuid not null references public.profiles(id),content text check(content is null or char_length(content)<=2000),
 image_path text,read_at timestamptz,created_at timestamptz not null default now(),
 check(content is not null or image_path is not null)
);
create index if not exists messages_couple_created_idx on public.messages(couple_id,created_at desc);
alter table public.messages enable row level security;
drop policy if exists "messages read by couple" on public.messages;drop policy if exists "messages create by couple" on public.messages;drop policy if exists "messages update recipient" on public.messages;drop policy if exists "messages delete sender" on public.messages;
create policy "messages read by couple" on public.messages for select using(public.is_couple_member(couple_id));
create policy "messages create by couple" on public.messages for insert with check(public.is_couple_member(couple_id) and sender_id=auth.uid());
create policy "messages update recipient" on public.messages for update using(public.is_couple_member(couple_id) and sender_id<>auth.uid()) with check(public.is_couple_member(couple_id));
create policy "messages delete sender" on public.messages for delete using(sender_id=auth.uid());
drop policy if exists "message images read by couple" on storage.objects;drop policy if exists "message images upload by couple" on storage.objects;
create policy "message images read by couple" on storage.objects for select using(bucket_id='memory-photos' and (storage.foldername(name))[2]='messages' and public.is_couple_member((storage.foldername(name))[1]::uuid));
create policy "message images upload by couple" on storage.objects for insert with check(bucket_id='memory-photos' and (storage.foldername(name))[2]='messages' and public.is_couple_member((storage.foldername(name))[1]::uuid));
do $$ begin
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='messages') then
  alter publication supabase_realtime add table public.messages;
 end if;
end $$;
