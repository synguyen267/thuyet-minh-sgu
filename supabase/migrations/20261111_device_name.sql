-- Thêm tên khách vào bảng active_sessions
-- CHẠY FILE NÀY TRÊN SUPABASE (SQL Editor) TRƯỚC KHI DEPLOY CODE WEB MỚI.

-- 1. Cột lưu tên
alter table public.active_sessions
  add column if not exists display_name text;

-- 2. Thay hàm heartbeat bằng bản có tham số tên.
--    Phải xóa bản cũ (2 tham số), nếu để cả hai thì Supabase báo trùng hàm.
drop function if exists public.heartbeat(uuid, text);

create or replace function public.heartbeat(
  p_device uuid,
  p_path   text default null,
  p_name   text default null
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.active_sessions (device_id, user_id, current_path, display_name)
  values (
    p_device,
    auth.uid(),
    p_path,
    nullif(left(btrim(coalesce(p_name, '')), 40), '')
  )
  on conflict (device_id) do update
    set last_seen    = now(),
        user_id      = coalesce(auth.uid(), public.active_sessions.user_id),
        current_path = excluded.current_path,
        display_name = coalesce(excluded.display_name, public.active_sessions.display_name);
$$;

grant execute on function public.heartbeat(uuid, text, text) to anon, authenticated;

-- 3. View: thêm cột display_name Ở CUỐI (Postgres không cho chèn cột vào giữa view cũ)
create or replace view public.active_now
with (security_invoker = true) as
select device_id, user_id, current_path, first_seen, last_seen, display_name
from public.active_sessions
where last_seen > now() - interval '2 minutes';
