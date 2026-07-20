alter table public.album_photos add column if not exists media_type text not null default 'image';
alter table public.album_photos drop constraint if exists album_photos_media_type_check;
alter table public.album_photos add constraint album_photos_media_type_check check(media_type in ('image','video'));
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('album-media','album-media',false,52428800,array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','video/quicktime'])
on conflict(id) do update set file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists "album media read couple" on storage.objects;drop policy if exists "album media upload couple" on storage.objects;drop policy if exists "album media delete uploader" on storage.objects;
create policy "album media read couple" on storage.objects for select using(bucket_id='album-media' and public.is_couple_member((storage.foldername(name))[1]::uuid));
create policy "album media upload couple" on storage.objects for insert with check(bucket_id='album-media' and public.is_couple_member((storage.foldername(name))[1]::uuid));
create policy "album media delete uploader" on storage.objects for delete using(bucket_id='album-media' and public.is_couple_member((storage.foldername(name))[1]::uuid));
notify pgrst,'reload schema';
