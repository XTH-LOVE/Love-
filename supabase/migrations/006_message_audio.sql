alter table public.messages drop constraint if exists messages_media_type_check;
alter table public.messages add constraint messages_media_type_check
  check (media_type is null or media_type in ('image', 'video', 'audio'));

update storage.buckets
set allowed_mime_types = array[
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'video/mp4', 'video/webm', 'video/quicktime',
  'audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg'
]
where id = 'message-media';
