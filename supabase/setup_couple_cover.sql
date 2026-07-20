alter table public.couples add column if not exists cover_path text;
notify pgrst, 'reload schema';
