import { useRef } from 'react';
import gsap from 'gsap';
import { useBreakpoint } from '../../../utils/breakpoints';
import { useNavbar, useNavbarToggleVisibility } from '../core/navbarContext';
import styles from './ToggleButton.module.css';

export interface ToggleButtonProps {
  /** Признак свёрнутого навбара (slim/invisible): глиф и aria-label. */
  isSlim: boolean;
  /** Доступна ли кнопка toggle (mobile/tablet). */
  hasToggle: boolean;
}

/**
 * ToggleButton — самостоятельная сцена переключения состояний навбара (☰ / ←).
 *
 * Полностью владеет своей DOM-нодой: держит собственный `ref` и сам
 * применяет `gsap.set` (видимость на `/home` через `useNavbarToggleVisibility`,
 * позиция — модификатором по breakpoint). Провайдер/layout/scrub-сцены
 * не держат `toggleRef` и не анимируют кнопку напрямую.
 *
 * Клик публикует системный интент `toggle:request` в шину навбара,
 * обработчик состояния живёт в `useNavbarToggle` (корневая layout-сцена).
 * Рендер (глиф/aria) остаётся на React-пропе `isSlim` — по правилу сцен
 * «проп вместо шины для условного рендера».
 */
export function ToggleButton({ isSlim, hasToggle }: ToggleButtonProps) {
  const { events } = useNavbar();
  const ref = useRef<HTMLButtonElement>(null);
  const bp = useBreakpoint();

  useNavbarToggleVisibility((visible) => {
    if (!ref.current) return;
    gsap.set(ref.current, {
      autoAlpha: visible ? 1 : 0,
      pointerEvents: visible ? 'auto' : 'none',
    });
  });

  if (!hasToggle) return null;

  const positionClass =
    bp === 'mobile' ? styles.toggleBtnFixed : styles.toggleBtnAbsolute;

  return (
    <button
      ref={ref}
      className={`${styles.toggleBtn} ${positionClass}`}
      onClick={() => events.emit('toggle:request', {})}
      aria-label={isSlim ? 'Open navigation' : 'Close navigation'}
      type="button"
    >
      {isSlim ? '☰' : '←'}
    </button>
  );
}
