import { useRef } from 'react';
import { useBreakpoint } from '../../../../utils/breakpoints';
import { useLayoutSnapshot } from '../../context/layoutContexts';
import { NavList } from '../NavList/NavList';
import { ToggleButton } from '../ToggleButton/ToggleButton';
import { useNavPosition } from './useNavPosition';
import styles from './NavigationBar.module.css';

export interface NavigationBarProps {
  isSlim: boolean;
  hasToggle: boolean;
}

export function NavigationBar({ isSlim, hasToggle }: NavigationBarProps) {
  const snapshot = useLayoutSnapshot();
  const isMobile = useBreakpoint() === 'mobile';
  const navRef = useRef<HTMLElement>(null);
  useNavPosition(navRef);

  return (
    <>
      <nav
        ref={navRef}
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
