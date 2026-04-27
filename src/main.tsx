import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import './index.css';
import App from './App';

// Declare global window type for hidePreloader
declare global {
  interface Window {
    hidePreloader?: () => void;
  }
}

// Hide preloader after React starts rendering
if (typeof window.hidePreloader === 'function') {
  window.hidePreloader();
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
