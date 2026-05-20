import type { SkipControlsProps } from '../../types/splash.types';
import styles from './SkipControls.module.css';

export function SkipControls({
  onNeverShowAgain,
  neverShowAgain,
  onSkip,
}: SkipControlsProps) {
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
          onChange={(e) => onNeverShowAgain(e.target.checked)}
        />
        <span className={styles.checkboxText}>
          Больше не показывать при запуске
        </span>
      </label>
    </div>
  );
}
