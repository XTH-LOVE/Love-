alter table public.messages add column if not exists media_path text;
alter table public.messages add column if not exists media_type text;
alter table public.messages drop constraint if exists messages_check;
alter table public.messages drop constraint if exists messages_content_or_media_check;
alter table public.messages add constraint messages_content_or_media_check check(content is not null or image_path is not null or media_path is not null);
alter table public.messages drop constraint if exists messages_media_type_check;
alter table public.messages add constraint messages_media_type_check check(media_type is null or media_type in ('image','video','audio'));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('message-media','message-media',false,41943040,array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','video/quicktime','audio/webm','audio/ogg','audio/mp4','audio/mpeg'])
on conflict(id) do update set file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "message media read by couple" on storage.objects;
drop policy if exists "message media upload by couple" on storage.objects;
drop policy if exists "message media delete by couple" on storage.objects;
create policy "message media read by couple" on storage.objects for select using(bucket_id='message-media' and (storage.foldername(name))[2]='messages' and public.is_couple_member((storage.foldername(name))[1]::uuid));
create policy "message media upload by couple" on storage.objects for insert with check(bucket_id='message-media' and (storage.foldername(name))[2]='messages' and public.is_couple_member((storage.foldername(name))[1]::uuid));
create policy "message media delete by couple" on storage.objects for delete using(bucket_id='message-media' and (storage.foldername(name))[2]='messages' and public.is_couple_member((storage.foldername(name))[1]::uuid));
