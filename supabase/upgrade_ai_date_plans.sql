alter table public.ai_saved_works drop constraint if exists ai_saved_works_kind_check;
alter table public.ai_saved_works add constraint ai_saved_works_kind_check check(kind in ('date_plan','diary','love_letter'));
notify pgrst,'reload schema';
