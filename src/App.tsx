import { Routes, Route } from 'react-router';
import NavigationBar from './components/NavigationBar/NavigationBar';
import PageTransition from './components/PageTransition/PageTransition';
import { routes } from './routes';
import styles from './App.module.css';
import { initGsap } from './utils/initGsap';

initGsap();

function App() {
  return (
    <div className={styles.app}>
      <NavigationBar />
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
