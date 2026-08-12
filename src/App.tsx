import { Routes, Route } from 'react-router';
import { LayoutProvider } from './components/Layout/context/LayoutProvider';
import { GsapProvider } from './components/Layout/gsap/GsapProvider';
import { LayoutRoot } from './components/Layout/slots/LayoutRoot';
import { NavigationBar } from './components/Layout/nav/NavigationBar/NavigationBar';
import PageTransition from './components/PageTransition/PageTransition';
import { routes } from './routes';

import { initGsap } from './utils/initGsap';

initGsap();

function App() {
  return (
    <LayoutProvider>
      <GsapProvider>
        <LayoutRoot>
          <NavigationBar />
          <main className="layout-content">
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
        </LayoutRoot>
      </GsapProvider>
    </LayoutProvider>
  );
}

export default App;
