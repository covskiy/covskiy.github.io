import { useState } from 'react';
import { Routes, Route, useLocation, useNavigate } from 'react-router';
import { SplashPage, splashStorage } from './pages/SplashPage';
import VerticalNav from './components/VerticalNav/VerticalNav';
import BurgerMenu from './components/BurgerMenu/BurgerMenu';
import PageTransition from './components/PageTransition/PageTransition';
import { routes } from './routes';
import styles from './App.module.css';
import { initGsap } from './utils/initGsap';

initGsap();

function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const [showSplash, setShowSplash] = useState(
    () => location.pathname === '/' && !splashStorage.getNeverShow(),
  );

  const handleSplashComplete = () => {
    console.log(`setShowSplash(false);`);
    // TODO dev return;
    return;
    setShowSplash(false);
    void navigate('/home', { replace: true });
  };

  return <SplashPage onComplete={handleSplashComplete} skipDelay={800} />;

  return (
    <div className={styles.app}>
      {showSplash ? (
        <SplashPage onComplete={handleSplashComplete} skipDelay={800} />
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
