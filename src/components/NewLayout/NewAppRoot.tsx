/**
 * NewAppRoot — корень с подключённым NewLayout.
 *
 * Структура (план §2.6):
 *   <NewLayoutProvider>
 *     <GsapProvider>
 *       <GsapLayoutBridge />
 *       <LayoutRoot>
 *         <VerticalNavigationBar ... />
 *         <main>...routes...</main>
 *       </LayoutRoot>
 *     </GsapProvider>
 *   </NewLayoutProvider>
 *
 * Размещение навбара: фиксированная панель + контентная область `<main>`
 * с `margin-left` через CSS-переменную `--nav-content-offset`.
 */

import { Routes, Route } from 'react-router';
import { NewLayoutProvider } from './context/NewLayoutProvider';
import { GsapProvider } from './gsap/GsapProvider';
import { GsapLayoutBridge } from './gsap/GsapLayoutBridge';
import { LayoutRoot } from './slots/LayoutRoot';
import { VerticalNavigationBar } from './nav/VerticalNavigationBar';
import { useLayoutSnapshot } from './context/layoutContexts';
import PageTransition from '../PageTransition/PageTransition';
import { routes } from '../../routes';
import { hasToggleFor } from './machine/derive';

function NavbarSlot() {
  const snapshot = useLayoutSnapshot();
  const isSlim = snapshot.value === 'slim' || snapshot.value === 'invisible';
  const hasToggle = hasToggleFor(snapshot.bp);

  return <VerticalNavigationBar isSlim={isSlim} hasToggle={hasToggle} />;
}

export function NewAppRoot() {
  return (
    <NewLayoutProvider>
      <GsapProvider>
        <GsapLayoutBridge />
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
    </NewLayoutProvider>
  );
}
