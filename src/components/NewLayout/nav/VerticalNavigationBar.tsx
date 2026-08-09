/**
 * VerticalNavigationBar — презентационная панель вертикального навбара (см. D5).
 *
 * Позиция `.nav` НЕ управляется напрямую: её твинит `useLayoutApplier`
 * на root через CSS-переменную `--nav-x`. Компонент только:
 * - читает `useLayoutSnapshot()` для `data-layout-state` (для CSS/DevTools);
 * - принимает производные пропы `isSlim`/`hasToggle` от родителя;
 * - рендерит разметку: nav + navInner + NavList;
 * - опционально: ToggleButton (внутри на tablet, сиблингом на mobile).
 *
 * Размещение ToggleButton:
 * - mobile: fixed-сиблинг навбара (вне трансформированного окна .nav).
 * - tablet: absolute внутри .nav, едет с краем.
 */

import { useBreakpoint } from '../../../utils/breakpoints';
import { useLayoutSnapshot } from '../context/layoutContexts';
import { NavList } from './NavList';
import { ToggleButton } from './ToggleButton';
import styles from './VerticalNavigationBar.module.css';

export interface VerticalNavigationBarProps {
  isSlim: boolean;
  hasToggle: boolean;
}

export function VerticalNavigationBar({
  isSlim,
  hasToggle,
}: VerticalNavigationBarProps) {
  const snapshot = useLayoutSnapshot();
  const isMobile = useBreakpoint() === 'mobile';

  return (
    <>
      <nav
        className={styles.nav}
        data-layout-state={snapshot.value}
      >
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
