import { useState } from 'react';
import { Routes, Route } from 'react-router';
import IntroAnimation from './components/IntroAnimation/IntroAnimation';
import VerticalNav from './components/VerticalNav/VerticalNav';
import BurgerMenu from './components/BurgerMenu/BurgerMenu';
import PageTransition from './components/PageTransition/PageTransition';
import { routes } from './routes';
import styles from './App.module.css';

function App() {
  const [introComplete, setIntroComplete] = useState(false);

  const handleIntroComplete = () => {
    setIntroComplete(true);
  };

  return (
    <div className={styles.app}>
      {!introComplete && (
        <IntroAnimation onComplete={handleIntroComplete} />
      )}

      {introComplete && (
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
