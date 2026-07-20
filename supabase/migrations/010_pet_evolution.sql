alter table public.couple_pets drop constraint if exists couple_pets_species_check;
alter table public.couple_pets
  add constraint couple_pets_species_check
  check (species in ('bunny','cat','puppy','bear','fox','panda','penguin','hamster'));

drop function if exists public.update_couple_pet_style(text, jsonb);

create or replace function public.update_couple_pet_style(
  p_skin text,
  p_accessories jsonb default '[]'::jsonb,
  p_species text default null
)
returns public.couple_pets
language plpgsql security definer set search_path = public
as $$
declare
  target_couple uuid;
  result public.couple_pets;
begin
  if p_skin not in ('lavender', 'pink', 'mint', 'night') then
    raise exception '不支持的宠物外观';
  end if;
  if p_species is not null and p_species not in ('bunny','cat','puppy','bear','fox','panda','penguin','hamster') then
    raise exception '不支持的宠物种类';
  end if;
  if jsonb_typeof(p_accessories) <> 'array' or jsonb_array_length(p_accessories) > 3 then
    raise exception '宠物配饰数量无效';
  end if;
  select couple_id into target_couple from public.couple_members where user_id = auth.uid();
  if target_couple is null then raise exception '请先绑定情侣空间'; end if;
  perform public.ensure_couple_pet();
  update public.couple_pets
  set skin = p_skin,
      accessories = p_accessories,
      species = coalesce(p_species, species),
      updated_at = now()
  where couple_id = target_couple
  returning * into result;
  return result;
end;
$$;

revoke all on function public.update_couple_pet_style(text, jsonb, text) from public;
grant execute on function public.update_couple_pet_style(text, jsonb, text) to authenticated;
