-- =====================================================================
-- Vùng kích hoạt phụ cho điểm dài (ví dụ Khu A).
-- Chạy MỘT LẦN trong SQL Editor, SAU 0001_init.sql. Chạy lại không sao.
-- extra_zones là mảng JSON: [{"lat":10.76,"lng":106.68,"radius_m":20}, ...]
-- =====================================================================

alter table public.poi
  add column if not exists extra_zones jsonb not null default '[]'::jsonb;

create or replace function public.validate_poi_zones()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  z jsonb;
  la numeric;
  ln numeric;
  r numeric;
begin
  if jsonb_typeof(new.extra_zones) is distinct from 'array' then
    raise exception 'extra_zones phải là một mảng';
  end if;
  if jsonb_array_length(new.extra_zones) > 12 then
    raise exception 'Mỗi điểm có tối đa 12 vùng phụ';
  end if;
  for z in select * from jsonb_array_elements(new.extra_zones) loop
    if jsonb_typeof(z -> 'lat') is distinct from 'number'
       or jsonb_typeof(z -> 'lng') is distinct from 'number'
       or jsonb_typeof(z -> 'radius_m') is distinct from 'number' then
      raise exception 'Mỗi vùng phụ cần lat, lng, radius_m là số';
    end if;
    la := (z ->> 'lat')::numeric;
    ln := (z ->> 'lng')::numeric;
    r  := (z ->> 'radius_m')::numeric;
    if la not between -90 and 90 or ln not between -180 and 180 then
      raise exception 'Tọa độ vùng phụ không hợp lệ';
    end if;
    if r not between 5 and 200 then
      raise exception 'Bán kính vùng phụ phải từ 5 đến 200 mét';
    end if;
  end loop;
  return new;
end;
$$;

drop trigger if exists poi_zones_valid on public.poi;
create trigger poi_zones_valid
  before insert or update on public.poi
  for each row execute function public.validate_poi_zones();
