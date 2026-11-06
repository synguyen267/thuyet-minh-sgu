import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabase.js';

/** Phiên đăng nhập quản trị. isAdmin do CSDL xác nhận (hàm is_admin), không tin giao diện. */
export function useAdminAuth() {
  const [state, setState] = useState({ loading: true, session: null, isAdmin: false });

  useEffect(() => {
    if (!supabase) { setState({ loading: false, session: null, isAdmin: false }); return undefined; }
    let alive = true;
    async function evaluate(session) {
      if (!session) { if (alive) setState({ loading: false, session: null, isAdmin: false }); return; }
      const { data } = await supabase.rpc('is_admin');
      if (alive) setState({ loading: false, session, isAdmin: data === true });
    }
    supabase.auth.getSession().then(({ data }) => evaluate(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setTimeout(() => evaluate(session), 0); // tránh gọi Supabase ngay trong callback
    });
    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, []);

  const signIn = useCallback(async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error ? 'Email hoặc mật khẩu không đúng.' : null;
  }, []);
  const signOut = useCallback(() => supabase.auth.signOut(), []);

  return { ...state, signIn, signOut };
}
