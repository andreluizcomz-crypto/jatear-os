import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/variaveis.css';
import './styles/globais.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// Service worker do app shell só em produção; em desenvolvimento remove
// qualquer service worker antigo desta origem (lição do cache do LMS).
if ('serviceWorker' in navigator) {
  if (import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    });
  } else {
    navigator.serviceWorker.getRegistrations().then((registros) => {
      registros.forEach((registro) => registro.unregister());
    });
  }
}
