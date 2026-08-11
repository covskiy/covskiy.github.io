import type { ReactNode } from 'react';
import { routes } from '../../../../routes';

export interface NavItemConfig {
  path: string;
  label: string;
  icon: ReactNode;
}

const routeIcons: Record<string, ReactNode> = {
  '/': '🏠',
  '/about': 'ℹ️',
  '/services': '🛠️',
  '/contact': '📬',
};

export const navItems: NavItemConfig[] = routes
  .filter(
    (r): r is (typeof routes)[number] & { label: string } =>
      r.path !== '*' && typeof r.label === 'string',
  )
  .map((r) => ({
    path: r.path,
    label: r.label,
    icon: routeIcons[r.path] ?? '❓',
  }));
