import { useEffect, useRef } from 'react';
import { NavLink } from 'react-router';
import gsap from 'gsap';
import type { NavItemConfig } from './navItems';
import { useGSAP } from '@gsap/react';
import styles from './NavItem.module.css';

export interface NavItemProps {
  item: NavItemConfig;
  isSlim: boolean;
}

export function NavItem({ item, isSlim }: NavItemProps) {
  const containerRef = useRef<HTMLLIElement>(null);
  const prevSlimRef = useRef(isSlim);
  const cssSelector = `.${styles.icon}`;

  const { contextSafe } = useGSAP({ scope: containerRef });

  const animateIcon = contextSafe(() => {
    gsap.killTweensOf(cssSelector);
    gsap.fromTo(
      cssSelector,
      { scale: 0.5, opacity: 0 },
      {
        scale: 1,
        opacity: 1,
        duration: 3,
        ease: 'back.out(1.7)',
        overwrite: 'auto',
      },
    );
  });

  useEffect(() => {
    const prev = prevSlimRef.current;
    prevSlimRef.current = isSlim;
    const enteredSlim = isSlim && !prev;
    if (enteredSlim) {
      animateIcon();
    }
  }, [isSlim, animateIcon]);

  return (
    <li className={styles.item} ref={containerRef}>
      <NavLink
        to={item.path}
        className={({ isActive }) =>
          `${styles.link}${isSlim ? ` ${styles.slim}` : ''}${isActive ? ` ${styles.active}` : ''}`
        }
        tabIndex={isSlim ? -1 : 0}
      >
        <span className={styles.icon}>{item.icon}</span>
        {!isSlim && <span className={styles.label}>{item.label}</span>}
      </NavLink>
    </li>
  );
}
