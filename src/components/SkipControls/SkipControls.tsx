import { useState } from 'react';
import type { SkipControlsProps } from '../../types/intro.types';
import { introStorage } from '../IntroAnimation/utils';
import SkipIcon from '../../assets/skip.svg?react';
import styles from './SkipControls.module.css';
import { SlimProgressBar } from '../SlimProgressBar';

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
      <button onClick={handleSkip} className={styles.skipButton}>
        <span className={styles.skipButtonContent}>
          <SkipIcon />
          <span>Пропустить</span>
        </span>
      </button>

      <SlimProgressBar durationInMs={4000} />

      <label className={styles.checkboxLabel}>
        <input
          type="checkbox"
          checked={neverShowAgain}
          onChange={(e) => handleChange(e.target.checked)}
        />
        <span className={styles.checkboxText}>Запомнить выбор</span>
      </label>
    </div>
  );
}
