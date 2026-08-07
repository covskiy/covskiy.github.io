import type { RefObject } from 'react';
import { useBreakpoint } from '../../utils/breakpoints';
import { NavList } from './components/NavList';
import { ToggleButton } from './components/ToggleButton';
import styles from './NavigationBar.module.css';

export interface NavigationBarProps {
  /** Реф на `<nav>` — владелец (NavigationBarProvider) анимирует его. */
  navRef: RefObject<HTMLElement | null>;
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
 * список ссылок и кнопка toggle (самостоятельная сцена `ToggleButton`,
 * владеет своей нодой). Значения isSlim/hasToggle прокидываются пропсами
 * из провайдера.
 *
 * Placement кнопки зависит от breakpoint: на mobile она fixed-сиблинг
 * навбара (вне трансформированного `.nav`, чтобы не «ехать» с его сдвигом),
 * на tablet — внутри `.nav` и «едет» с его краем.
 */
export function NavigationBar({
  navRef,
  isSlim,
  hasToggle,
}: NavigationBarProps) {
  const isMobile = useBreakpoint() === 'mobile';

  return (
    <>
      <nav className={styles.nav} ref={navRef}>
        <div className={styles.navInner}>
          <div className={styles.logo}>✦ Portfolio</div>
          <NavList isSlim={isSlim} />
        </div>

        {hasToggle && !isMobile && (
          <ToggleButton isSlim={isSlim} hasToggle={hasToggle} />
        )}
      </nav>

      {hasToggle && isMobile && (
        <ToggleButton isSlim={isSlim} hasToggle={hasToggle} />
      )}
    </>
  );
}
