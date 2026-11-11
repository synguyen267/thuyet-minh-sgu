import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import NamePrompt from './components/NamePrompt.jsx';
import './styles.css';
import { startHeartbeat } from './hooks/useHeartbeat.js';
startHeartbeat();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
    <NamePrompt />
  </StrictMode>
);
