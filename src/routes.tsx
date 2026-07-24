/* eslint-disable react-refresh/only-export-components */
import { Suspense, lazy, type ReactNode } from 'react';
import HomePage from './pages/HomePage/HomePage';
import NotFoundPage from './pages/NotFoundPage/NotFoundPage';

const AboutPage = lazy(() => import('./pages/AboutPage/AboutPage'));
const ServicesPage = lazy(() => import('./pages/ServicesPage/ServicesPage'));
const ContactPage = lazy(() => import('./pages/ContactPage/ContactPage'));

interface RouteConfig {
  path: string;
  label?: string;
  element: ReactNode;
}

function LazyFallback() {
  return <div className="loading">Загрузка...</div>;
}

function withSuspense(element: ReactNode) {
  return <Suspense fallback={<LazyFallback />}>{element}</Suspense>;
}

export const routes: RouteConfig[] = [
  {
    path: '/',
    label: 'Главная',
    element: <HomePage />,
  },
  {
    path: '/about',
    label: 'О нас',
    element: withSuspense(<AboutPage />),
  },
  {
    path: '/services',
    label: 'Услуги',
    element: withSuspense(<ServicesPage />),
  },
  {
    path: '/contact',
    label: 'Контакты',
    element: withSuspense(<ContactPage />),
  },
  {
    path: '*',
    element: <NotFoundPage />,
  },
];
