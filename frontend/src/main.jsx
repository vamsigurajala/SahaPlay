import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './i18n'
import App from './App.jsx'

// Global Fetch Interceptor to elegantly handle expired/invalid JWT tokens app-wide
const originalFetch = window.fetch;
window.fetch = async (...args) => {
  const response = await originalFetch(...args);
  if (response.status === 401 || response.status === 403) {
    const url = typeof args[0] === 'string' ? args[0] : (args[0]?.url || '');
    if (!url.includes('/api/chat-lock/')) {
      if (localStorage.getItem('watch_token')) {
        localStorage.removeItem('watch_token');
        localStorage.removeItem('watch_username');
        window.location.href = '/login';
      }
    }
  }
  return response;
};

createRoot(document.getElementById('root')).render(
  <App />
)





