alter table public.couples add column if not exists love_letter text check(love_letter is null or char_length(love_letter) <= 1200);
