// Cấu hình đọc từ biến môi trường (đọc lúc gọi để dễ kiểm thử). Khóa bí mật chỉ nằm trên máy chủ.
export function getConfig(env = process.env) {
  return {
    supabaseUrl: env.SUPABASE_URL || env.VITE_SUPABASE_URL,
    supabaseKey: env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY,
    geminiKey: env.GEMINI_API_KEY,
    geminiModel: env.GEMINI_MODEL || 'gemini-3.5-flash',
  };
}
