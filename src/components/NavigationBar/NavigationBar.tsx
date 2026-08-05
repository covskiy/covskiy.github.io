import type { RefObject } from 'react';
import { NavList } from './components/NavList';
import styles from './NavigationBar.module.css';

export interface NavigationBarProps {
  /** Реф на `<nav>` — владелец (NavigationBarProvider) анимирует его. */
  navRef: RefObject<HTMLElement | null>;
  /** Реф на кнопку toggle — компенсация сдвига на mobile. */
  toggleRef: RefObject<HTMLButtonElement | null>;
  /** Признак свёрнутого навбара (slim/invisible). */
  isSlim: boolean;
  /** Доступна ли кнопка toggle (mobile/tablet). */
  hasToggle: boolean;
  /** Ручное переключение состояния (клик по кнопке). */
  handleToggle: () => void;
}

/**
 * NavigationBar — презентационная панель навигации.
 *
 * Вся логика состояний и анимаций живёт в `NavigationBarProvider`
 * (Context-Driven Animation Factory). Здесь только разметка:
 * логотип, список ссылок и кнопка toggle. Значения isSlim/hasToggle/
 * handleToggle и рефы прокидываются пропсами из провайдера.
 */
export function NavigationBar({
  navRef,
  toggleRef,
  isSlim,
  hasToggle,
  handleToggle,
}: NavigationBarProps) {
  return (
    <nav className={styles.nav} ref={navRef}>
      <div className={styles.navInner}>
        <div className={styles.logo}>✦ Portfolio</div>
        <NavList isSlim={isSlim} />
      </div>

      {hasToggle && (
        <button
          ref={toggleRef}
          className={styles.toggleBtn}
          onClick={handleToggle}
          aria-label={isSlim ? 'Open navigation' : 'Close navigation'}
          type="button"
        >
          {isSlim ? '☰' : '←'}
        </button>
      )}
    </nav>
  );
}
