import type { IntroStorageData } from '../../../types/intro.types';

const STORAGE_KEY = 'intro_never_show';
const SESSION_SKIP_KEY = 'intro_session_skip';

export const introStorage = {
  getNeverShow: (): boolean => {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? (JSON.parse(data) as IntroStorageData).neverShow : false;
    } catch {
      return false;
    }
  },

  setNeverShow: (value: boolean): void => {
    const data: IntroStorageData = {
      neverShow: value,
      timestamp: value ? Date.now() : undefined,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  },

  clearFlag: (): void => localStorage.removeItem(STORAGE_KEY),

  getSessionSkip: (): boolean => {
    try {
      return sessionStorage.getItem(SESSION_SKIP_KEY) === 'true';
    } catch {
      return false;
    }
  },

  setSessionSkip: (): void => {
    try {
      sessionStorage.setItem(SESSION_SKIP_KEY, 'true');
    } catch {
      /* sessionStorage not available */
    }
  },

  clearSessionSkip: (): void => {
    try {
      sessionStorage.removeItem(SESSION_SKIP_KEY);
    } catch {
      /* sessionStorage not available */
    }
  },
};
