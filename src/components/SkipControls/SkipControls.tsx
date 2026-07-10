import { useState } from 'react';
import type { SkipControlsProps } from '../../types/splash.types';
import { splashStorage } from '../../pages/SplashPage';
import styles from './SkipControls.module.css';

export function SkipControls({ onSkip }: SkipControlsProps) {
  const [neverShowAgain, setNeverShowAgain] = useState(() =>
    splashStorage.getNeverShow(),
  );

  const handleChange = (checked: boolean) => {
    setNeverShowAgain(checked);
    splashStorage.setNeverShow(checked);
  };

  return (
    <div className={styles.skipControls}>
      <button
        onClick={onSkip}
        className={styles.skipButton}
        aria-label="Пропустить анимацию"
      >
        Пропустить →
      </button>

      <label className={styles.checkboxLabel}>
        <input
          type="checkbox"
          checked={neverShowAgain}
          onChange={(e) => handleChange(e.target.checked)}
        />
        <span className={styles.checkboxText}>
          Больше не показывать при запуске
        </span>
      </label>
    </div>
  );
}
