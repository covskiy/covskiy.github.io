import type { RefObject } from 'react';
import { useNavbar } from '../core/navbarContext';
import styles from './ToggleButton.module.css';

export interface ToggleButtonProps {
  /** Реф на кнопку — владелец (NavigationBarProvider) анимирует её (Фаза 1). */
  toggleRef: RefObject<HTMLButtonElement | null>;
  /** Признак свёрнутого навбара (slim/invisible): глиф и aria-label. */
  isSlim: boolean;
  /** Доступна ли кнопка toggle (mobile/tablet). */
  hasToggle: boolean;
}

/**
 * ToggleButton — дочерняя сцена ручного переключения состояний навбара (☰ / ←).
 *
 * Классическая сцена: клик публикует системный интент `toggle:request`
 * в шину навбара, обработчик состояния живёт в `useNavbarToggle`
 * (корневая layout-сцена). Рендер (глиф/aria) остаётся на React-пропе
 * `isSlim` — по правилу сцен «проп вместо шины для условного рендера».
 *
 * Владелец DOM-ноды — по-прежнему NavigationBarProvider (`toggleRef`):
 * ноду анимируют layout/scrub-сцены (`toggleX` на mobile, видимость на
 * `/home`). Полная декомпозиция ноды — задел Фазы 2.
 */
export function ToggleButton({
  toggleRef,
  isSlim,
  hasToggle,
}: ToggleButtonProps) {
  const { events } = useNavbar();

  if (!hasToggle) return null;

  return (
    <button
      ref={toggleRef}
      className={styles.toggleBtn}
      onClick={() => events.emit('toggle:request', {})}
      aria-label={isSlim ? 'Open navigation' : 'Close navigation'}
      type="button"
    >
      {isSlim ? '☰' : '←'}
    </button>
  );
}
