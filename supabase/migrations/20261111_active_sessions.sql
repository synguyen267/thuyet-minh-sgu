-- Ghi nhận thiết bị/tài khoản đang hoạt động
-- Lưu ý: file này chỉ để lưu lại trong repo. Bạn đã chạy nội dung này trên Supabase rồi,
-- không cần chạy lại (các lệnh create đều có "if not exists" hoặc "or replace" nên chạy lại cũng an toàn,
-- riêng policy ở bước 3 sẽ báo lỗi trùng tên nếu đã tồn tại).

-- 1. Bảng ghi nhận
create table if not exists public.active_sessions (
  device_id    uuid primary key,
  user_id      uuid references auth.users(id) on delete set null,
  current_path text,
  first_seen   timestamptz not null default now(),
  last_seen    timestamptz not null default now()
);

create index if not exists active_sessions_last_seen_idx
  on public.active_sessions (last_seen desc);

alter table public.active_sessions enable row level security;

-- 2. Hàm báo "còn hoạt động" (khách chỉ được gọi hàm, không ghi trực tiếp vào bảng)
create or replace function public.heartbeat(p_device uuid, p_path text default null)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.active_sessions (device_id, user_id, current_path)
  values (p_device, auth.uid(), p_path)
  on conflict (device_id) do update
    set last_seen    = now(),
        user_id      = coalesce(auth.uid(), public.active_sessions.user_id),
        current_path = excluded.current_path;
$$;

grant execute on function public.heartbeat(uuid, text) to anon, authenticated;

-- 3. Chỉ người đăng nhập xem được danh sách
create policy "admin xem active_sessions"
  on public.active_sessions for select
  to authenticated
  using (true);

-- 4. View: thiết bị hoạt động trong 2 phút gần nhất
create or replace view public.active_now
with (security_invoker = true) as
select device_id, user_id, current_path, first_seen, last_seen
from public.active_sessions
where last_seen > now() - interval '2 minutes';

-- 5. Dọn dữ liệu cũ
create or replace function public.cleanup_active_sessions()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.active_sessions where last_seen < now() - interval '7 days';
$$;
revoke execute on function public.cleanup_active_sessions() from public, anon, authenticated;
