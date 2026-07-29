import type { ReactNode } from 'react';
import { routes } from '../../routes';

/** Конфигурация одного пункта навигационного меню. */
export interface NavItemConfig {
  /** Путь роута (совпадает с RouteConfig.path из routes.tsx). */
  path: string;
  /** Текстовая метка пункта. */
  label: string;
  /**
   * Иконка пункта.
   *
   * Сейчас — emoji-заглушка. Безболезненно заменяется на React-компонент
   * при появлении иконочного шрифта/sprite'а — тип ReactNode не меняется.
   */
  icon: ReactNode;
}

/**
 * Маппинг путей → иконки.
 *
 * Ключи должны совпадать с `path` в RouteConfig.
 * Если для роута нет иконки — подставляется `❓`.
 */
const routeIcons: Record<string, ReactNode> = {
  '/': '🏠',
  '/about': 'ℹ️',
  '/services': '🛠️',
  '/contact': '📬',
};

/**
 * Производный список навигационных элементов.
 *
 * Берёт `routes` из `routes.tsx` (единственный источник правды для path/label),
 * отфильтровывает NotFound (`*`) и навешивает иконку из `routeIcons`.
 */
export const navItems: NavItemConfig[] = routes
  .filter((r) => r.path !== '*')
  .map((r) => ({
    path: r.path,
    label: r.label!,
    icon: routeIcons[r.path] ?? '❓',
  }));
