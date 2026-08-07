import { useRef } from 'react';
import { NavLink } from 'react-router';
import gsap from 'gsap';
import type { NavItemConfig } from './navItems';
import { useNavbarEvent } from '../core/navbarContext';
import styles from './NavItem.module.css';
import { useGSAP } from '@gsap/react';

export interface NavItemProps {
  /** Конфиг пункта: path, label, icon. */
  item: NavItemConfig;
  /** Признак slim-режима: иконка вместо текста, tabIndex={-1}. */
  isSlim: boolean;
}

/**
 * Один пункт навигационного меню.
 *
 * В slim-режиме (isSlim === true):
 * - Текстовая метка не рендерится
 * - Иконка центрируется (класс styles.slim)
 * - Ссылка получает tabIndex={-1} (исключение из Tab-навигации)
 *
 * ## Демо-сцена (фаза 1)
 * Подписана на `'state:change'` шины навбара: при первом переходе навбара
 * в `slim` (или `invisible`) делает fade-in иконки с лёгким подскоком.
 * Это end-to-end проверка пайплайна шины: NavItem сам реагирует на
 * изменение состояния, не получая его через проп `isSlim`.
 *
 * Существующее поведение (`isSlim` пропом) не заменяется — демо лишь
 * ДОПОЛНЯЕТ визуал, легко откатывается удалением хука.
 */
export function NavItem({ item, isSlim }: NavItemProps) {
  const containerRef = useRef<HTMLLIElement>(null);
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

  useNavbarEvent('state:change', ({ state, prev }) => {
    if (state === prev) return;
    const enteredSlim =
      (state === 'slim' || state === 'invisible') &&
      prev !== 'slim' &&
      prev !== 'invisible';
    if (enteredSlim) {
      animateIcon();
    }
  });

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
