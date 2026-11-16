import { createClient } from '@supabase/supabase-js';
import { HttpError } from '../errors.js';

/** Client Supabase mang token của chính người gọi, nên RLS vẫn là lớp bảo vệ cuối cùng dù đi qua backend. */
export function userClient(cfg, token) {
  if (!cfg.supabaseUrl || !cfg.supabaseKey) throw new HttpError(500, 'Chưa cấu hình Supabase cho máy chủ.');
  return createClient(cfg.supabaseUrl, cfg.supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}
