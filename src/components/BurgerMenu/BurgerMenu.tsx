import { useState } from 'react';
import { NavLink } from 'react-router';
import styles from './BurgerMenu.module.css';

const navItems = [
  { path: '/', label: 'Главная' },
  { path: '/about', label: 'О нас' },
  { path: '/services', label: 'Услуги' },
  { path: '/contact', label: 'Контакты' },
];

function BurgerMenu() {
  const [isOpen, setIsOpen] = useState(false);

  const toggleMenu = () => {
    setIsOpen((prev) => !prev);
  };

  const closeMenu = () => {
    setIsOpen(false);
  };

  return (
    <>
      <button
        className={styles.burger}
        onClick={toggleMenu}
        aria-label={isOpen ? 'Закрыть меню' : 'Открыть меню'}
        aria-expanded={isOpen}
      >
        <span className={styles.line}></span>
        <span className={styles.line}></span>
        <span className={styles.line}></span>
      </button>

      {isOpen && (
        <div className={styles.menu}>
          <button
            className={styles.close}
            onClick={closeMenu}
            aria-label="Закрыть меню"
          >
            ✕
          </button>
          <ul className={styles.list}>
            {navItems.map(({ path, label }) => (
              <li key={path} className={styles.item}>
                <NavLink
                  to={path}
                  className={({ isActive }) =>
                    isActive ? `${styles.link} ${styles.active}` : styles.link
                  }
                  onClick={closeMenu}
                >
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

export default BurgerMenu;
