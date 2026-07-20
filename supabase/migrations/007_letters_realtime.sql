do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'couple_letters'
  ) then
    alter publication supabase_realtime add table public.couple_letters;
  end if;
end $$;
