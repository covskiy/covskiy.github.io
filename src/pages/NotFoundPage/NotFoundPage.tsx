import { NavLink } from 'react-router';
import styles from './NotFoundPage.module.css';

function NotFoundPage() {
  return (
    <div className={styles.notfound}>
      <h1 className={styles.code}>404</h1>
      <p className={styles.message}>Страница не найдена</p>
      <NavLink to="/" className={styles.link}>
        На главную
      </NavLink>
    </div>
  );
}

export default NotFoundPage;
