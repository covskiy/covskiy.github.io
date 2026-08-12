import type { Breakpoint } from '../../../utils/breakpoints';
import { deriveMainOffset } from './geometry';
import { hasToggleFor, isSlimFor } from './derive';
import type { LayoutMode, MachineContext } from './layoutMode';

/**
 * CSS-переменные, которые движок публикует на корне layout-а.
 * Единственный канал сигналов (D7) — `data-*` атрибуты не используются.
 */
export type LayoutVars = Partial<Record<string, string | number>>;

/**
 * Параметры анимации перехода между snapshot-ами.
 * Применяются `useLayoutApplier`-ом через `gsap.to(root, vars, options)`.
 */
export interface LayoutTransition {
  duration: number;
  ease: string;
  onComplete?: () => void;
}

/** Параметры, передаваемые в `resolveLayout` (контекст → vars). */
export interface LayoutResolveOptions {
  viewport: number;
  transition: LayoutTransition;
}

/**
 * LayoutSnapshot — целевой контракт layout-а (см. план §1, §I.1).
 *
 * - `value` — текущее состояние машины;
 * - `context` — копия `MachineContext` последнего перехода;
 * - `vars` — CSS-переменные, которые будут анимированы на layout root;
 * - `scrollLocked` — зарезервировано (modal/immersive в будущем, см. D7/p.111);
 * - `transition` — параметры GSAP-анимации этого снимка.
 */
export interface LayoutSnapshot {
  value: LayoutMode;
  context: MachineContext;
  vars: LayoutVars;
  scrollLocked: boolean;
  transition: LayoutTransition;
  bp: Breakpoint;
  homeEndState: LayoutMode;
  hasToggle: boolean;
  isSlim: boolean;
}

export const ROOT_VAR_NAMES = {
  navPointerEvents: '--nav-pointer-events',
  navContentOffset: '--nav-content-offset',
  layoutState: '--layout-state',
} as const;

/**
 * Pointer-events навбара: окно `.nav` уезжает за экран на invisible,
 * interaction должна быть отключена — иначе клики «проваливаются» мимо
 * навбара в невидимой области.
 */
function pointerEventsFor(state: LayoutMode): 'none' | 'auto' {
  return state === 'invisible' ? 'none' : 'auto';
}

/**
 * Чистая функция: `MachineContext` + `LayoutResolveOptions` → `LayoutSnapshot`.
 *
 * Вычисляет CSS-переменные на корне на основании текущего состояния машины.
 * Никакого DOM/Animation — только расчёт значений.
 */
export function resolveLayout(
  value: LayoutMode,
  context: MachineContext,
  options: LayoutResolveOptions,
): LayoutSnapshot {
  const { bp, isHome, homeEndState } = context;
  const { transition } = options;

  const offset = deriveMainOffset(value, bp, isHome, homeEndState);

  const vars: LayoutVars = {
    [ROOT_VAR_NAMES.navPointerEvents]: pointerEventsFor(value),
    [ROOT_VAR_NAMES.navContentOffset]: offset,
    [ROOT_VAR_NAMES.layoutState]: value,
  };

  return {
    value,
    context,
    vars,
    scrollLocked: false,
    transition,
    bp,
    homeEndState,
    hasToggle: hasToggleFor(bp),
    isSlim: isSlimFor(value),
  };
}
