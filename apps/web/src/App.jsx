import { useRoute } from './router.jsx';
import Home from './pages/Home.jsx';
import Tour from './pages/Tour.jsx';
import Admin from './pages/Admin.jsx';

/** /  giới thiệu, /tour  tham quan (công khai, không đăng nhập), /admin  quản trị (đăng nhập). */
export default function App() {
  const r = useRoute();
  if (r.path.startsWith('/admin')) return <Admin navigate={r.navigate} />;
  if (r.path.startsWith('/tour')) return <Tour search={r.search} navigate={r.navigate} />;
  return <Home navigate={r.navigate} />;
}
