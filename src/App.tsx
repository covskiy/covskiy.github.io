import { Routes, Route } from 'react-router';
import NavigationBar from './components/NavigationBar/NavigationBar';
import PageTransition from './components/PageTransition/PageTransition';
import { routes } from './routes';
import styles from './App.module.css';
import { initGsap } from './utils/initGsap';

initGsap();

/**
 * Корневой layout приложения.
 *
 * - `NavigationBar` всегда присутствует в DOM (не зависит от роута)
 * - `<main data-content>` — контентная область, сдвигаемая GSAP
 *   при изменении состояния навбара (margin-left на tablet/desktop)
 * - `PageTransition` оборачивает каждый роут для анимации перехода
 */
function App() {
  return (
    <div className={styles.app}>
      <NavigationBar />
      <main className={styles.main} data-content>
        <Routes>
          {routes.map(({ path, element }) => (
            <Route
              key={path}
              path={path}
              element={<PageTransition>{element}</PageTransition>}
            />
          ))}
        </Routes>
      </main>
    </div>
  );
}

export default App;
