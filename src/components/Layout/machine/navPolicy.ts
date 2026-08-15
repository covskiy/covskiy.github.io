import type { LayoutMode } from './layoutMode';
import { getNavTransform } from './geometry';

/**
 * Политики навбара: решения/вычисления без React/GSAP/DOM.
 *
 * Извлекаются из императивной обвязки хуков (`useNavPosition`,
 * `useToggleVisibility`) — см. task/16.ReactTest-final-ver.md. Чистые функции,
 * покрываются юнит-тестами в node-окружении.
 */

export type ScrubBuildDecision =
  | { shouldBuild: false; endX: null; prevProgress: number }
  | { shouldBuild: true; endX: number; prevProgress: number };

/**
 * Решение buildScrub (`useNavPosition.ts`): строить ли scrub-твин и с каким
 * конечным x. Вне /home твин не строится (позицию держит дискретная `gsap.to`).
 */
export function decideScrubBuild(opts: {
  isHome: boolean;
  homeEndState: LayoutMode;
  viewport: number;
  existingProgress: number;
}): ScrubBuildDecision {
  if (!opts.isHome) {
    return { shouldBuild: false, endX: null, prevProgress: 0 };
  }
  return {
    shouldBuild: true,
    endX: getNavTransform(opts.homeEndState, opts.viewport).navX,
    prevProgress: opts.existingProgress,
  };
}

/**
 * Skip-решение discrete-анимации (`useNavPosition.ts` subscribe): анимировать
 * дискретно, кроме «/home без ручного управления и без ручного в прошлом»
 * (там x держит scrub-твин). `prevManualRef` обновляется только в не-skip-ветке,
 * поэтому `prevManual` передаётся входом, а не вычисляется внутри.
 */
export function shouldAnimateDiscrete(opts: {
  isHome: boolean;
  manualNow: boolean;
  prevManual: boolean;
}): boolean {
  return !(opts.isHome && !opts.manualNow && !opts.prevManual);
}

/**
 * Guard useEffect-ресинхронизации (`useNavPosition.ts`): при false хук выходит
 * из эффекта до `invalidate()`/подписки на bus.
 */
export function shouldResyncScrub(opts: {
  isHome: boolean;
  isManualToggle: boolean;
}): boolean {
  return opts.isHome && !opts.isManualToggle;
}

/**
 * Видимость кнопки toggle (`useToggleVisibility.ts`): скрыта, когда НЕ
 * (progress на дне или ручной показ). Граница `>=` включительная.
 */
export function shouldHideToggle(opts: {
  progress: number;
  isManualToggle: boolean;
  edgeEps: number;
}): boolean {
  return !(opts.progress >= 1 - opts.edgeEps || opts.isManualToggle);
}
