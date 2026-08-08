import { Routes, Route } from 'react-router';
import { LayoutProvider } from './components/layout';
import PageTransition from './components/PageTransition/PageTransition';
import { routes } from './routes';
import { initGsap } from './utils/initGsap';

initGsap();

/**
 * Корневой layout приложения.
 *
 * - `LayoutProvider` всегда в DOM (не зависит от роута). Владеет раскладкой
 *   страницы: навбар всегда присутствует, контентная область `<main>`
 *   сдвигается (margin-left на tablet/desktop) при изменении состояния
 *   раскладки. Один источник состояния (`mode`) + per-component animator.
 * - `PageTransition` оборачивает каждый роут для анимации перехода.
 */
function App() {
  return (
    <LayoutProvider>
      <Routes>
        {routes.map(({ path, element }) => (
          <Route
            key={path}
            path={path}
            element={<PageTransition>{element}</PageTransition>}
          />
        ))}
      </Routes>
    </LayoutProvider>
  );
}

export default App;
