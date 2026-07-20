create table if not exists public.albums (
  id uuid primary key default gen_random_uuid(), couple_id uuid not null references public.couples(id) on delete cascade,
  created_by uuid not null references public.profiles(id), name text not null check (char_length(name) between 1 and 40),
  description text check (description is null or char_length(description) <= 160), cover_path text, created_at timestamptz not null default now()
);
create table if not exists public.album_photos (
  id uuid primary key default gen_random_uuid(), album_id uuid not null references public.albums(id) on delete cascade,
  uploaded_by uuid not null references public.profiles(id), path text not null unique, caption text check (caption is null or char_length(caption) <= 200),
  taken_date date not null default current_date, created_at timestamptz not null default now()
);
alter table public.albums enable row level security; alter table public.album_photos enable row level security;
drop policy if exists "albums read by couple" on public.albums; drop policy if exists "albums create by couple" on public.albums; drop policy if exists "albums update by creator" on public.albums; drop policy if exists "albums delete by creator" on public.albums;
create policy "albums read by couple" on public.albums for select using (public.is_couple_member(couple_id));
create policy "albums create by couple" on public.albums for insert with check (public.is_couple_member(couple_id) and created_by = auth.uid());
create policy "albums update by creator" on public.albums for update using (created_by = auth.uid());
create policy "albums delete by creator" on public.albums for delete using (created_by = auth.uid());
drop policy if exists "album photos read by couple" on public.album_photos; drop policy if exists "album photos create by couple" on public.album_photos; drop policy if exists "album photos delete by uploader" on public.album_photos;
create policy "album photos read by couple" on public.album_photos for select using (exists(select 1 from public.albums where id = album_id and public.is_couple_member(couple_id)));
create policy "album photos create by couple" on public.album_photos for insert with check (uploaded_by = auth.uid() and exists(select 1 from public.albums where id = album_id and public.is_couple_member(couple_id)));
create policy "album photos delete by uploader" on public.album_photos for delete using (uploaded_by = auth.uid());
