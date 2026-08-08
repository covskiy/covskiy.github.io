import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { useBreakpoint } from '../../../utils/breakpoints';
import { useLayout } from '../LayoutProvider/LayoutContext';
import styles from './ToggleButton.module.css';

export interface ToggleButtonProps {
  /** Признак свёрнутого навбара (slim/invisible): глиф и aria-label. */
  isSlim: boolean;
  /** Доступна ли кнопка toggle (mobile/tablet). */
  hasToggle: boolean;
}

/**
 * ToggleButton — самостоятельная сцена переключения состояний раскладки (☰ / ←).
 *
 * Полностью владеет своей DOM-нодой: держит собственный `ref` и сам применяет
 * `gsap.set` (видимость на `/home` через `useLayout().onToggleVisibility`).
 * Клик напрямую вызывает `useLayout().toggle()` — без шины событий.
 * Рендер (глиф/aria) остаётся на React-пропе `isSlim`.
 */
export function ToggleButton({ isSlim, hasToggle }: ToggleButtonProps) {
  const { onToggleVisibility, toggle } = useLayout();
  const ref = useRef<HTMLButtonElement>(null);
  const bp = useBreakpoint();

  useEffect(() => {
    return onToggleVisibility((visible) => {
      if (!ref.current) return;
      gsap.set(ref.current, {
        autoAlpha: visible ? 1 : 0,
        pointerEvents: visible ? 'auto' : 'none',
      });
    });
  }, [onToggleVisibility]);

  if (!hasToggle) return null;

  const positionClass =
    bp === 'mobile' ? styles.toggleBtnFixed : styles.toggleBtnAbsolute;

  return (
    <button
      ref={ref}
      className={`${styles.toggleBtn} ${positionClass}`}
      onClick={toggle}
      aria-label={isSlim ? 'Open navigation' : 'Close navigation'}
      type="button"
    >
      {isSlim ? '☰' : '←'}
    </button>
  );
}
