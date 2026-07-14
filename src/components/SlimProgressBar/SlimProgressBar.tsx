import styles from './SlimProgressBar.module.css';

type SlimProgressBarProps = {
  durationInMs: number;
  className?: string;
};

export function SlimProgressBar({
  durationInMs,
  className = '',
}: SlimProgressBarProps) {
  const combinedClassName = `${styles.timeline} ${className}`.trim();
  return (
    <div className={combinedClassName}>
      <div className={styles.track}>
        <div
          className={styles.fill}
          style={{ '--duration': `${durationInMs}ms` } as React.CSSProperties}
        />
      </div>
    </div>
  );
}
