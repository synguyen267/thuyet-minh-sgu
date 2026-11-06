-- =====================================================================
-- Thuyết minh Đại học Sài Gòn: cấu trúc CSDL ban đầu (Supabase / Postgres)
-- Chạy MỘT LẦN trong Supabase: SQL Editor > New query > dán toàn bộ > Run.
-- An toàn khi chạy lại nhiều lần (không mất dữ liệu).
-- =====================================================================

-- ---------- Hàm tiện ích ----------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------- Quản trị viên ----------
-- Chỉ người có tên trong bảng này mới được sửa nội dung và xem thống kê.
create table if not exists public.admin_user (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admin_user enable row level security;
-- Không tạo policy nào: không ai đọc/ghi bảng này qua API. Chỉ thêm admin bằng SQL Editor.

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admin_user where user_id = (select auth.uid())
  );
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- ---------- Điểm quan tâm (POI) ----------
create table if not exists public.poi (
  id          text primary key check (id ~ '^[a-z0-9-]{1,60}$'),
  tour_order  int,
  lat         double precision check (lat between -90 and 90),
  lng         double precision check (lng between -180 and 180),
  radius_m    int not null default 20 check (radius_m between 5 and 200),
  priority    int not null default 1 check (priority between 0 and 10),
  image_url   text,
  map_url     text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint poi_coords_both check ((lat is null) = (lng is null))
);
drop trigger if exists poi_updated_at on public.poi;
create trigger poi_updated_at before update on public.poi
  for each row execute function public.set_updated_at();

-- ---------- Bản dịch / nội dung thuyết minh ----------
create table if not exists public.poi_translation (
  poi_id      text not null references public.poi (id) on delete cascade,
  lang        text not null check (lang in ('vi','en','zh','ja','ko')),
  name        text not null,
  description text,
  tts_script  text,
  audio_url   text,
  status      text not null default 'draft' check (status in ('draft','approved')),
  source      text not null default 'human' check (source in ('human','ai')),
  updated_at  timestamptz not null default now(),
  primary key (poi_id, lang)
);
drop trigger if exists poi_translation_updated_at on public.poi_translation;
create trigger poi_translation_updated_at before update on public.poi_translation
  for each row execute function public.set_updated_at();

-- ---------- Nhật ký nghe (ẩn danh) ----------
create table if not exists public.play_log (
  id             bigint generated always as identity primary key,
  session_id     text not null check (session_id ~ '^[A-Za-z0-9-]{8,64}$'),
  poi_id         text not null references public.poi (id) on delete cascade,
  lang           text not null check (lang in ('vi','en','zh','ja','ko')),
  trigger_source text not null check (trigger_source in ('gps','qr','manual')),
  lat            double precision check (lat between -90 and 90),
  lng            double precision check (lng between -180 and 180),
  started_at     timestamptz not null default now(),
  duration_s     int check (duration_s between 0 and 3600),
  completed      boolean not null default false
);
create index if not exists play_log_poi_idx on public.play_log (poi_id, started_at);
create index if not exists play_log_session_idx on public.play_log (session_id);

-- ---------- Vết di chuyển (ẩn danh) ----------
-- Chỉ lưu session_id ngẫu nhiên, không lưu tài khoản hay thông tin cá nhân.
create table if not exists public.location_track (
  id          bigint generated always as identity primary key,
  session_id  text not null check (session_id ~ '^[A-Za-z0-9-]{8,64}$'),
  lat         double precision not null check (lat between -90 and 90),
  lng         double precision not null check (lng between -180 and 180),
  accuracy_m  real check (accuracy_m between 0 and 5000),
  recorded_at timestamptz not null default now()
);
create index if not exists location_track_time_idx on public.location_track (recorded_at);

-- ---------- Quyền (grants) ----------
revoke all on public.poi, public.poi_translation, public.play_log, public.location_track from anon, authenticated;
grant select on public.poi, public.poi_translation to anon, authenticated;
grant insert, update, delete on public.poi, public.poi_translation to authenticated;
grant insert on public.play_log, public.location_track to anon, authenticated;
grant select, delete on public.play_log, public.location_track to authenticated;

-- ---------- Row Level Security ----------
alter table public.poi enable row level security;
alter table public.poi_translation enable row level security;
alter table public.play_log enable row level security;
alter table public.location_track enable row level security;

-- POI: ai cũng đọc được điểm đang bật; admin thấy cả điểm đã ẩn và được ghi.
drop policy if exists poi_select on public.poi;
create policy poi_select on public.poi
  for select to anon, authenticated
  using (is_active or (select public.is_admin()));
drop policy if exists poi_insert on public.poi;
create policy poi_insert on public.poi
  for insert to authenticated with check ((select public.is_admin()));
drop policy if exists poi_update on public.poi;
create policy poi_update on public.poi
  for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists poi_delete on public.poi;
create policy poi_delete on public.poi
  for delete to authenticated using ((select public.is_admin()));

-- Bản dịch: người nghe chỉ thấy bản ĐÃ DUYỆT của điểm đang bật (human-in-the-loop).
drop policy if exists translation_select on public.poi_translation;
create policy translation_select on public.poi_translation
  for select to anon, authenticated
  using (
    (select public.is_admin())
    or (status = 'approved'
        and exists (select 1 from public.poi p where p.id = poi_id and p.is_active))
  );
drop policy if exists translation_insert on public.poi_translation;
create policy translation_insert on public.poi_translation
  for insert to authenticated with check ((select public.is_admin()));
drop policy if exists translation_update on public.poi_translation;
create policy translation_update on public.poi_translation
  for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists translation_delete on public.poi_translation;
create policy translation_delete on public.poi_translation
  for delete to authenticated using ((select public.is_admin()));

-- Nhật ký và vết di chuyển: ai cũng GHI được (khi điểm hợp lệ), chỉ admin ĐỌC/XÓA.
drop policy if exists play_log_insert on public.play_log;
create policy play_log_insert on public.play_log
  for insert to anon, authenticated
  with check (exists (select 1 from public.poi p where p.id = poi_id and p.is_active));
drop policy if exists play_log_select on public.play_log;
create policy play_log_select on public.play_log
  for select to authenticated using ((select public.is_admin()));
drop policy if exists play_log_delete on public.play_log;
create policy play_log_delete on public.play_log
  for delete to authenticated using ((select public.is_admin()));

drop policy if exists track_insert on public.location_track;
create policy track_insert on public.location_track
  for insert to anon, authenticated with check (true);
drop policy if exists track_select on public.location_track;
create policy track_select on public.location_track
  for select to authenticated using ((select public.is_admin()));
drop policy if exists track_delete on public.location_track;
create policy track_delete on public.location_track
  for delete to authenticated using ((select public.is_admin()));

-- ---------- Thống kê cho trang quản trị (chỉ admin xem được) ----------
create or replace view public.v_top_pois with (security_invoker = true) as
  select poi_id, count(*) as plays, count(*) filter (where completed) as completed_plays
  from public.play_log
  group by poi_id
  order by plays desc;

create or replace view public.v_avg_listen with (security_invoker = true) as
  select poi_id, round(avg(duration_s))::int as avg_seconds, count(*) as plays
  from public.play_log
  where duration_s is not null
  group by poi_id;

create or replace view public.v_heat with (security_invoker = true) as
  select round(lat::numeric, 5) as lat, round(lng::numeric, 5) as lng, count(*) as hits
  from public.location_track
  group by 1, 2;

revoke all on public.v_top_pois, public.v_avg_listen, public.v_heat from anon, authenticated;
grant select on public.v_top_pois, public.v_avg_listen, public.v_heat to authenticated;

-- ---------- Kho ảnh và audio ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'poi-media', 'poi-media', true, 10485760,
  array['image/jpeg','image/png','image/webp','audio/mpeg','audio/mp4','audio/wav']
)
on conflict (id) do nothing;

-- Bucket công khai nên ai cũng xem được qua đường dẫn; chỉ admin được tải lên, sửa, xóa.
drop policy if exists poi_media_insert on storage.objects;
create policy poi_media_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'poi-media' and (select public.is_admin()));
drop policy if exists poi_media_update on storage.objects;
create policy poi_media_update on storage.objects
  for update to authenticated
  using (bucket_id = 'poi-media' and (select public.is_admin()));
drop policy if exists poi_media_delete on storage.objects;
create policy poi_media_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'poi-media' and (select public.is_admin()));
