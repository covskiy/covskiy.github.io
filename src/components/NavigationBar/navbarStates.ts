import type { Breakpoint } from '../../utils/breakpoints';

/** Возможные состояния отображения навбара. */
export type NavState = 'fullscreen' | 'standard' | 'slim' | 'invisible';

/**
 * Конфиг состояний навбара: ширина навбара и отступ контента.
 *
 * Единственный источник правды для GSAP-анимаций (animateNavbar и
 * scrub-таймлайн из registerScrollTrigger).
 */
export const NAV_STATES = {
  fullscreen: { width: '100vw', margin: '0px' },
  standard: { width: '25vw', margin: '25vw' },
  slim: { width: '80px', margin: '0px' },
  invisible: { width: '0px', margin: '0px' },
} as const satisfies Record<NavState, { width: string; margin: string }>;

/** Маппинг состояния → ширина навбара. */
export function getWidth(state: NavState): string {
  return NAV_STATES[state].width;
}

/** Маппинг состояния → отступ контента (только tablet/desktop). */
export function getContentMargin(state: NavState): string {
  return NAV_STATES[state].margin;
}

/**
 * Возвращает состояние навбара по умолчанию для текущего роута и устройства.
 *
 * - `/home` → всегда `fullscreen`
 * - Другие роуты → `invisible` (mobile) / `slim` (tablet) / `standard` (desktop)
 */
export function getDefaultState(bp: Breakpoint, isHome: boolean): NavState {
  if (isHome) return 'fullscreen';
  if (bp === 'mobile') return 'invisible';
  return bp === 'tablet' ? 'slim' : 'standard';
}

/**
 * Вычисляет следующее состояние при ручном переключении (toggle).
 *
 * - Mobile: invisible ↔ fullscreen
 * - Tablet: standard ↔ slim
 * - Desktop: всегда `null` (кнопка скрыта)
 */
export function getNextState(
  current: NavState,
  bp: Breakpoint,
): NavState | null {
  if (bp === 'desktop') return null;
  if (bp === 'mobile')
    return current === 'invisible' ? 'fullscreen' : 'invisible';
  return current === 'slim' ? 'standard' : 'slim';
}
