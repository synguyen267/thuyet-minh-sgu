import { userClient } from '../lib/supabase.js';

/** Hỏi Supabase xem người giữ token có phải admin không (hàm is_admin() trong CSDL). */
export function createAuthRepository(cfg) {
  return {
    async isAdmin(token) {
      try {
        const { data, error } = await userClient(cfg, token).rpc('is_admin');
        return !error && data === true;
      } catch {
        return false;
      }
    },
  };
}
