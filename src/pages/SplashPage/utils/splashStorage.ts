import type { SplashStorageData } from '../../../types/splash.types';

const STORAGE_KEY = 'splash_never_show';

export const splashStorage = {
  getNeverShow: (): boolean => {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? (JSON.parse(data) as SplashStorageData).neverShow : false;
    } catch {
      return false;
    }
  },

  setNeverShow: (value: boolean): void => {
    const data: SplashStorageData = {
      neverShow: value,
      timestamp: value ? Date.now() : undefined,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  },

  clearFlag: (): void => localStorage.removeItem(STORAGE_KEY),
};
