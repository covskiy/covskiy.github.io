/**
 * Чистые селекторы layout-машины — единые точки деривации.
 *
 * Заменяют разрозненные проверки в `LayoutProvider`, `useNavPosition`
 * и сценах на явные предикаты/хешuri. Реализация — тонкие обёртки над
 * существующими функциями `derive.ts` / `geometry.ts`, чтобы не дублировать
 * логику и поддерживать «единственную точку правды».
 */

import type { Breakpoint } from '../../../utils/breakpoints';
import { hasToggleFor, homeEndStateFor, isHomePath } from './derive';
import { deriveMainOffset, getNavTransform } from './geometry';
import type { LayoutMode } from './layoutMode';

/** `slim`/`invisible` — навбар свёрнут. */
export function selectIsSlim(mode: LayoutMode): boolean {
  return mode === 'slim' || mode === 'invisible';
}

/** Доступна ли кнопка toggle (не desktop). */
export function selectHasToggle(bp: Breakpoint): boolean {
  return hasToggleFor(bp);
}

/** Домашняя страница — pathname `/` или `/home`. */
export function selectIsHome(pathname: string): boolean {
  return isHomePath(pathname);
}

/** X-координата `.nav` для состояния (px-значение GSAP). */
export function selectNavX(mode: LayoutMode, viewport: number): number {
  return getNavTransform(mode, viewport).navX;
}

/** Эффективное конечное состояние на `/home` (после скролла спейсера). */
export function selectHomeEndState(
  bp: Breakpoint,
  preferred: LayoutMode | null,
): LayoutMode {
  return homeEndStateFor(bp, preferred);
}

/** CSS-строка для `--nav-content-offset`. */
export function selectContentOffset(
  mode: LayoutMode,
  bp: Breakpoint,
  isHome: boolean,
  homeEndState: LayoutMode,
): string {
  return deriveMainOffset(mode, bp, isHome, homeEndState);
}