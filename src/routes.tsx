/* eslint-disable react-refresh/only-export-components */
import { Suspense, lazy, type ReactNode } from 'react';
import { type RouteObject } from 'react-router';
import HomePage from './pages/HomePage/HomePage';

const AboutPage = lazy(() => import('./pages/AboutPage/AboutPage'));
const ServicesPage = lazy(() => import('./pages/ServicesPage/ServicesPage'));
const ContactPage = lazy(() => import('./pages/ContactPage/ContactPage'));

function LazyFallback() {
  return <div className="loading">Загрузка...</div>;
}

function withSuspense(element: ReactNode) {
  return <Suspense fallback={<LazyFallback />}>{element}</Suspense>;
}

export const routes: RouteObject[] = [
  {
    path: '/home',
    element: <HomePage />,
  },
  {
    path: '/about',
    element: withSuspense(<AboutPage />),
  },
  {
    path: '/services',
    element: withSuspense(<ServicesPage />),
  },
  {
    path: '/contact',
    element: withSuspense(<ContactPage />),
  },
  {
    path: '*',
    element: (
      <div
        style={{
          width: '100%',
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <h2 style={{ fontSize: '32px', fontWeight: 'bolder' }}>404</h2>
        <p>Route not found</p>
      </div>
    ),
  },
];
