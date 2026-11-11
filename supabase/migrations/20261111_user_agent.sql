-- Thêm cột user_agent và bắt buộc có tên mới được ghi nhận
-- CHẠY FILE NÀY TRÊN SUPABASE (SQL Editor) TRƯỚC KHI DEPLOY CODE WEB MỚI.
-- (Giả định bạn đã chạy 20261111_device_name.sql trước đó.)

-- 1. Cột lưu loại thiết bị/trình duyệt
alter table public.active_sessions
  add column if not exists user_agent text;

-- 2. Thay hàm heartbeat bằng bản có tham số p_agent.
--    Xóa bản 3 tham số cũ để tránh trùng hàm.
drop function if exists public.heartbeat(uuid, text, text);

create or replace function public.heartbeat(
  p_device uuid,
  p_path   text default null,
  p_name   text default null,
  p_agent  text default null
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.active_sessions (device_id, user_id, current_path, display_name, user_agent)
  select
    p_device,
    auth.uid(),
    p_path,
    nullif(left(btrim(coalesce(p_name, '')), 40), ''),
    nullif(left(coalesce(p_agent, ''), 300), '')
  -- Chỉ ghi nhận khách đã nhập tên (ít nhất 2 ký tự) hoặc người đã đăng nhập (admin).
  -- Bot và thiết bị chưa nhập tên sẽ bị bỏ qua.
  where char_length(btrim(coalesce(p_name, ''))) >= 2
     or auth.uid() is not null
  on conflict (device_id) do update
    set last_seen    = now(),
        user_id      = coalesce(auth.uid(), public.active_sessions.user_id),
        current_path = excluded.current_path,
        display_name = coalesce(excluded.display_name, public.active_sessions.display_name),
        user_agent   = coalesce(excluded.user_agent, public.active_sessions.user_agent);
$$;

grant execute on function public.heartbeat(uuid, text, text, text) to anon, authenticated;

-- 3. View: thêm cột user_agent Ở CUỐI
create or replace view public.active_now
with (security_invoker = true) as
select device_id, user_id, current_path, first_seen, last_seen, display_name, user_agent
from public.active_sessions
where last_seen > now() - interval '2 minutes';

-- 4. Xóa các dòng khách chưa có tên (bot và tab cũ) để bảng sạch từ đầu
delete from public.active_sessions
where display_name is null
  and user_id is null;
