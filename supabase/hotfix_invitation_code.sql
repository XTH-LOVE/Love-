create or replace function public.create_couple_with_invitation(couple_name text, relationship_start date)
returns text language plpgsql security definer set search_path = public as $$
declare
  new_couple_id uuid;
  new_code text;
begin
  if auth.uid() is null then
    raise exception '请先登录';
  end if;
  if exists (select 1 from couple_members where user_id = auth.uid()) then
    raise exception '你已经加入了一个情侣空间';
  end if;
  insert into couples (name, relationship_start, created_by)
  values (couple_name, relationship_start, auth.uid()) returning id into new_couple_id;
  insert into couple_members (couple_id, user_id) values (new_couple_id, auth.uid());
  new_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  insert into invitations (couple_id, code, created_by) values (new_couple_id, new_code, auth.uid());
  return new_code;
end;
$$;

revoke all on function public.create_couple_with_invitation(text, date) from public;
grant execute on function public.create_couple_with_invitation(text, date) to authenticated;
