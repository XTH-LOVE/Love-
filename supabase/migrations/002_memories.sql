create table if not exists public.memories (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  author_id uuid not null references public.profiles(id),
  content text not null check (char_length(content) between 1 and 1000),
  memory_date date not null,
  location text check (location is null or char_length(location) <= 80),
  photos jsonb not null default '[]'::jsonb check (jsonb_typeof(photos) = 'array' and jsonb_array_length(photos) <= 6),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists memories_couple_date_idx on public.memories (couple_id, memory_date desc);
alter table public.memories enable row level security;
drop policy if exists "memories read by couple" on public.memories;
drop policy if exists "memories create by couple" on public.memories;
drop policy if exists "memories update by author" on public.memories;
drop policy if exists "memories delete by author" on public.memories;
create policy "memories read by couple" on public.memories for select using (public.is_couple_member(couple_id));
create policy "memories create by couple" on public.memories for insert with check (public.is_couple_member(couple_id) and author_id = auth.uid());
create policy "memories update by author" on public.memories for update using (author_id = auth.uid() and public.is_couple_member(couple_id)) with check (author_id = auth.uid() and public.is_couple_member(couple_id));
create policy "memories delete by author" on public.memories for delete using (author_id = auth.uid() and public.is_couple_member(couple_id));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('memory-photos', 'memory-photos', false, 8388608, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

drop policy if exists "memory photos read by couple" on storage.objects;
drop policy if exists "memory photos upload by couple" on storage.objects;
drop policy if exists "memory photos delete by couple" on storage.objects;
create policy "memory photos read by couple" on storage.objects for select using (
  bucket_id = 'memory-photos' and public.is_couple_member((storage.foldername(name))[1]::uuid)
);
create policy "memory photos upload by couple" on storage.objects for insert with check (
  bucket_id = 'memory-photos' and public.is_couple_member((storage.foldername(name))[1]::uuid)
);
create policy "memory photos delete by couple" on storage.objects for delete using (
  bucket_id = 'memory-photos' and public.is_couple_member((storage.foldername(name))[1]::uuid)
);
