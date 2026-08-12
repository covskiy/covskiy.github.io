import { useRef } from 'react';
import { useBreakpoint } from '../../../../utils/breakpoints';
import { useLayoutSnapshot } from '../../context/layoutContexts';
import { NavList } from '../NavList/NavList';
import { ToggleButton } from '../ToggleButton/ToggleButton';
import { useNavPosition } from './useNavPosition';
import styles from './NavigationBar.module.css';

export function NavigationBar() {
  const snapshot = useLayoutSnapshot();
  const { isSlim, hasToggle, isManualToggle } = snapshot;
  const isMobile = useBreakpoint() === 'mobile';
  const isHome = snapshot.context.isHome;
  const navRef = useRef<HTMLElement>(null);
  useNavPosition(navRef, snapshot);

  return (
    <>
      <nav ref={navRef} className={styles.nav}>
        <div className={styles.navInner}>
          <div className={styles.logo}>✦ Portfolio</div>
          <NavList isSlim={isSlim} />
        </div>

        {hasToggle && !isMobile && (
          <ToggleButton
            isSlim={isSlim}
            hasToggle={hasToggle}
            isHome={isHome}
            isManualToggle={isManualToggle}
          />
        )}
      </nav>

      {hasToggle && isMobile && (
        <ToggleButton
          isSlim={isSlim}
          hasToggle={hasToggle}
          isHome={isHome}
          isManualToggle={isManualToggle}
        />
      )}
    </>
  );
}
