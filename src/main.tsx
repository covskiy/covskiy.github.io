import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import './index.css';
import App from './App';
import { splashStorage } from './pages/SplashPage/utils';

declare global {
  interface Window {
    hidePreloader?: () => void;
  }
}

if (typeof window.hidePreloader === 'function') {
  window.hidePreloader();
}

if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).splashDebug = {
    reset: () => {
      splashStorage.clearFlag();
      window.location.reload();
    },
    forceShow: () => {
      splashStorage.setNeverShow(false);
      window.location.reload();
    },
    forceHide: () => {
      splashStorage.setNeverShow(true);
      window.location.reload();
    },
    status: () => console.log('neverShow:', splashStorage.getNeverShow()),
  };
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
