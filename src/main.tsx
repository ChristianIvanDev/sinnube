import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { startNetworkWatch } from './lib/network';
import './styles.css';

startNetworkWatch();

// Modo sin conexión: solo en producción, para no interferir con la recarga en caliente de Vite.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {
      /* sin modo offline, pero la app funciona igual */
    });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
