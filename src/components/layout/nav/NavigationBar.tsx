import { useRef } from 'react';
import { useBreakpoint } from '../../../utils/breakpoints';
import { NavList } from './NavList';
import { ToggleButton } from './ToggleButton';
import { useNavPosition } from '../scenes/useNavPosition';
import styles from './NavigationBar.module.css';

export interface NavigationBarProps {
  /** Признак свёрнутого навбара (slim/invisible). */
  isSlim: boolean;
  /** Доступна ли кнопка toggle (mobile/tablet). */
  hasToggle: boolean;
}

/**
 * NavigationBar — презентационная панель навигации.
 *
 * Позицией своего `.nav` компонент владеет сам через хук-сцену
 * `useNavPosition` (единственный владелец: discrete + scrub). Здесь only
 * разметка: логотип, список ссылок и кнопка toggle (самостоятельная сцена
 * `ToggleButton`). Значения `isSlim`/`hasToggle` прокидываются пропсами из
 * `LayoutProvider` (производные от `mode`/breakpoint).
 *
 * Placement кнопки зависит от breakpoint: на mobile она fixed-сиблинг
 * навбара (вне трансформированного `.nav`, чтобы не «ехать» с его сдвигом),
 * на tablet — внутри `.nav` и «едет» с его краем.
 */
export function NavigationBar({ isSlim, hasToggle }: NavigationBarProps) {
  const isMobile = useBreakpoint() === 'mobile';
  const navRef = useRef<HTMLElement>(null);

  // Сцена-владелец позиции `.nav`: discrete + scrub (через onScrollProgress).
  useNavPosition({ navRef });

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
