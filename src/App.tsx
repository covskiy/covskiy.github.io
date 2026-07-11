import { Routes, Route } from 'react-router';
import VerticalNav from './components/VerticalNav/VerticalNav';
import BurgerMenu from './components/BurgerMenu/BurgerMenu';
import PageTransition from './components/PageTransition/PageTransition';
import { routes } from './routes';
import styles from './App.module.css';
import { initGsap } from './utils/initGsap';

initGsap();

function App() {
  return (
    <div className={styles.app}>
      <VerticalNav />
      <BurgerMenu />
      <main className={styles.main}>
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
