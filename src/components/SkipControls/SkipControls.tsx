import { useState } from 'react';
import type { SkipControlsProps } from '../../types/intro.types';
import { introStorage } from '../IntroAnimation';
import styles from './SkipControls.module.css';

export function SkipControls({ onSkip }: SkipControlsProps) {
  const [neverShowAgain, setNeverShowAgain] = useState(() =>
    introStorage.getNeverShow(),
  );

  const handleChange = (checked: boolean) => {
    setNeverShowAgain(checked);
    introStorage.setNeverShow(checked);
  };

  const handleSkip = () => {
    if (!neverShowAgain) {
      introStorage.setSessionSkip();
    }
    onSkip();
  };

  return (
    <div className={styles.skipControls}>
      <button
        onClick={handleSkip}
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
