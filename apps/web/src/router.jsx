import { useCallback, useEffect, useState } from 'react';

/** Bộ định tuyến tối giản theo đường dẫn: /, /tour, /admin. */
export function useRoute() {
  const [loc, setLoc] = useState(() => ({ path: window.location.pathname, search: window.location.search }));

  useEffect(() => {
    const onPop = () => setLoc({ path: window.location.pathname, search: window.location.search });
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const navigate = useCallback((to) => {
    window.history.pushState({}, '', to);
    const u = new URL(to, window.location.origin);
    setLoc({ path: u.pathname, search: u.search });
    window.scrollTo(0, 0);
  }, []);

  return { ...loc, navigate };
}

/** Liên kết nội bộ không tải lại trang. */
export function Link({ to, navigate, children, ...rest }) {
  return (
    <a
      href={to}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        navigate(to);
      }}
      {...rest}
    >
      {children}
    </a>
  );
}
