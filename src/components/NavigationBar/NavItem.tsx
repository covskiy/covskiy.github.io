import { NavLink } from 'react-router';
import type { NavItemConfig } from './navItems';
import styles from './NavItem.module.css';

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
 */
export function NavItem({ item, isSlim }: NavItemProps) {
  return (
    <li className={styles.item}>
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
