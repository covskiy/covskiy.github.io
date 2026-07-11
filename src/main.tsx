import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import './index.css';
import App from './App';
import { logger, LOG_LEVELS, type LogLevel } from './utils/logger';
import { introStorage } from './components/IntroAnimation';

declare global {
  interface Window {
    hidePreloader?: () => void;
  }
}

if (typeof window.hidePreloader === 'function') {
  window.hidePreloader();
}

if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).introDebug = {
    reset: () => {
      introStorage.clearFlag();
      introStorage.clearSessionSkip();
      window.location.reload();
    },
    forceShow: () => {
      introStorage.setNeverShow(false);
      window.location.reload();
    },
    forceHide: () => {
      introStorage.setNeverShow(true);
      window.location.reload();
    },
    status: () => console.log('neverShow:', introStorage.getNeverShow()),
  };

  (window as unknown as Record<string, unknown>).loggerDebug = {
    setLevel: (level: string) => {
      if (LOG_LEVELS.includes(level as LogLevel)) {
        localStorage.setItem('loggerLevel', level);
        logger.setLevel(level as LogLevel);
        console.log(
          `%c[logger] Level set to ${level}`,
          'color:#888;font-weight:bold',
        );
      } else {
        console.warn(
          `Invalid level "${level}". Use one of: ${LOG_LEVELS.join(', ')}`,
        );
      }
    },
    reset: () => {
      localStorage.removeItem('loggerLevel');
      logger.setLevel('debug');
      console.log(
        '%c[logger] Reset to default level (debug)',
        'color:#888;font-weight:bold',
      );
    },
    status: () => {
      console.log(
        `Level: ${logger.getLevel()} | localStorage: ${localStorage.getItem('loggerLevel') ?? 'not set'}`,
      );
    },
    levels: () => {
      console.table(
        LOG_LEVELS.map((l) => ({
          level: l,
          weight: ['error', 'warn', 'info', 'debug', 'trace'].indexOf(l),
        })),
      );
    },
  };
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
