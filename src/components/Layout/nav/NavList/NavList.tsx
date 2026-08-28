import { navItems } from './navItems';
import { NavItem } from './NavItem';
import styles from './NavList.module.css';

export interface NavListProps {
  isSlim: boolean;
}

export function NavList({ isSlim }: NavListProps) {
  return (
    <ul className={styles.list}>
      {navItems.map((item) => (
        <NavItem key={item.path} item={item} isSlim={isSlim} />
      ))}
    </ul>
  );
}
