import { useState } from 'react';
import { Routes, Route, useLocation, useNavigate } from 'react-router';
import SplashPage from './pages/SplashPage/SplashPage';
import VerticalNav from './components/VerticalNav/VerticalNav';
import BurgerMenu from './components/BurgerMenu/BurgerMenu';
import PageTransition from './components/PageTransition/PageTransition';
import { routes } from './routes';
import styles from './App.module.css';
import { initGsap } from './utils/initGsap';

import { Intro } from './components/Intro/Intro';

initGsap();

function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const [splashComplete] = useState(() => location.pathname === '/home');

  const handleSplashComplete = () => {
    void navigate('/home', { replace: true });
  };

  const showSplash = location.pathname === '/' && !splashComplete;

  return <Intro />;

  return <SplashPage onComplete={handleSplashComplete} />;

  return (
    <div className={styles.app}>
      {showSplash ? (
        <SplashPage onComplete={handleSplashComplete} />
      ) : (
        <>
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
        </>
      )}
    </div>
  );
}

export default App;
