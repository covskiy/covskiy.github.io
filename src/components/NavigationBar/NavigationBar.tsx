import type { RefObject } from 'react';
import { NavList } from './components/NavList';
import { ToggleButton } from './components/ToggleButton';
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
}

/**
 * NavigationBar — презентационная панель навигации.
 *
 * Вся логика состояний и анимаций живёт в `NavigationBarProvider`
 * (Context-Driven Animation Factory). Здесь только разметка: логотип,
 * список ссылок и кнопка toggle (дочерняя сцена `ToggleButton`).
 * Значения isSlim/hasToggle и рефы прокидываются пропсами из провайдера.
 */
export function NavigationBar({
  navRef,
  toggleRef,
  isSlim,
  hasToggle,
}: NavigationBarProps) {
  return (
    <nav className={styles.nav} ref={navRef}>
      <div className={styles.navInner}>
        <div className={styles.logo}>✦ Portfolio</div>
        <NavList isSlim={isSlim} />
      </div>

      <ToggleButton
        toggleRef={toggleRef}
        isSlim={isSlim}
        hasToggle={hasToggle}
      />
    </nav>
  );
}
