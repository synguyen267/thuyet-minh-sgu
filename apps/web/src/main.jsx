import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import NamePrompt from './components/NamePrompt.jsx';
import './styles.css';
import { startHeartbeat } from './hooks/useHeartbeat.js';
startHeartbeat();

// Đăng ký Service Worker (chỉ ở bản build, để khi chạy npm run dev không bị lưu bộ nhớ đệm gây khó chịu)
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
    <NamePrompt />
  </StrictMode>
);
