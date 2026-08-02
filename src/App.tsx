import { Routes, Route } from 'react-router';
import { NavigationBarProvider } from './components/NavigationBar';
import PageTransition from './components/PageTransition/PageTransition';
import { routes } from './routes';
import { initGsap } from './utils/initGsap';

initGsap();

/**
 * Корневой layout приложения.
 *
 * - `NavigationBarProvider` всегда в DOM (не зависит от роута). Владеет
 *   навбаром и контентной областью `<main>`: навбар всегда присутствует,
 *   контентная область сдвигается GSAP (margin-left на tablet/desktop)
 *   при изменении состояния навбара.
 * - `PageTransition` оборачивает каждый роут для анимации перехода.
 */
function App() {
  return (
    <NavigationBarProvider>
      <Routes>
        {routes.map(({ path, element }) => (
          <Route
            key={path}
            path={path}
            element={<PageTransition>{element}</PageTransition>}
          />
        ))}
      </Routes>
    </NavigationBarProvider>
  );
}

export default App;
