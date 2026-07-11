import { NavLink } from 'react-router';
import { routes } from '../../routes';
import styles from './VerticalNav.module.css';

const navItems = routes
  .filter((r) => r.path !== '*')
  .map(({ path, label }) => ({ path, label: label! }));

function VerticalNav() {
  return (
    <nav className={styles.nav}>
      <div className={styles.logo}>✦ Portfolio</div>
      <ul className={styles.list}>
        {navItems.map(({ path, label }) => (
          <li key={path} className={styles.item}>
            <NavLink
              to={path}
              className={({ isActive }) =>
                isActive ? `${styles.link} ${styles.active}` : styles.link
              }
            >
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export default VerticalNav;
