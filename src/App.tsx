import { Routes, Route } from 'react-router';
import { LayoutProvider } from './components/Layout/context/LayoutProvider';
import { GsapProvider } from './components/Layout/gsap/GsapProvider';
import { LayoutRoot } from './components/Layout/slots/LayoutRoot';
import { NavigationBar } from './components/Layout/nav/NavigationBar/NavigationBar';
import { useLayoutSnapshot } from './components/Layout/context/layoutContexts';
import PageTransition from './components/PageTransition/PageTransition';
import { routes } from './routes';
import { hasToggleFor } from './components/Layout/machine/derive';

import { initGsap } from './utils/initGsap';

initGsap();

function App() {
  return (
    <LayoutProvider>
      <GsapProvider>
        <LayoutRoot>
          <NavbarSlot />
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

function NavbarSlot() {
  const snapshot = useLayoutSnapshot();
  const isSlim = snapshot.value === 'slim' || snapshot.value === 'invisible';
  const hasToggle = hasToggleFor(snapshot.bp);

  return <NavigationBar isSlim={isSlim} hasToggle={hasToggle} />;
}

export default App;
