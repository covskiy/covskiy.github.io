/**
 * Публичный API layout-модуля.
 *
 * Экспортируются только нужные наружу сущности: компонент `LayoutProvider`,
 * хук `useLayout()`, хелперы геометрии и типы. Экспортов шины событий больше
 * нет — низкоуровневые каналы инкапсулированы в `LayoutContextValue`.
 */
export { LayoutProvider } from './LayoutProvider';
export {
  useLayout,
  LayoutContext,
  type LayoutContextValue,
  type NavStateChange,
  type NavStateListener,
  type ScrollProgress,
  type ScrollProgressListener,
  type ToggleVisibilityListener,
} from './LayoutProvider/LayoutContext';
export {
  getNavTransform,
  SLIM_WIDTH,
  type NavTransform,
} from './machine/geometry';
export type { LayoutMode, LayoutChangeSource } from './machine/layoutMode';
