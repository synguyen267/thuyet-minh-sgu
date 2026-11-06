import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** Khách không đăng nhập: dùng khóa công khai, quyền do RLS trong CSDL quyết định. */
export const supabase = url && key ? createClient(url, key) : null;
export const hasSupabase = Boolean(supabase);
