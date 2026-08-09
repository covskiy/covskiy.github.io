import type { Breakpoint } from '../../../utils/breakpoints';

export type { Breakpoint };

export type LayoutMode = 'fullscreen' | 'standard' | 'slim' | 'invisible';

export type LayoutChangeSource = 'toggle' | 'route' | 'breakpoint' | 'scroll';

export type LayoutEvent =
  | { type: 'TOGGLE' }
  | { type: 'ROUTE_CHANGED' }
  | { type: 'BREAKPOINT_CHANGED'; bp: Breakpoint }
  | { type: 'REACH_TOP' }
  | { type: 'REACH_BOTTOM' }
  | { type: 'INTRO_COMPLETE' };

export type LayoutAction =
  | {
      type: 'NOTIFY_NAV_STATE';
      prev: LayoutMode;
      next: LayoutMode;
      source: LayoutChangeSource;
    }
  | { type: 'SCROLL_TO_END' }
  | { type: 'RETARGET_SCRUB' }
  | { type: 'NOOP' };

export interface MachineContext {
  bp: Breakpoint;
  isHome: boolean;
  preferred: LayoutMode | null;
  lastSource: LayoutChangeSource;
  source: LayoutChangeSource;
  homeEndState: LayoutMode;
}

/**
 * Маппинг `event.type → LayoutChangeSource`.
 * Живёт здесь, чтобы движок (P2) и тесты могли ссылаться на единый источник.
 */
export const EVENT_TO_SOURCE: Readonly<
  Record<LayoutEvent['type'], LayoutChangeSource>
> = {
  TOGGLE: 'toggle',
  ROUTE_CHANGED: 'route',
  BREAKPOINT_CHANGED: 'breakpoint',
  REACH_TOP: 'scroll',
  REACH_BOTTOM: 'scroll',
  INTRO_COMPLETE: 'scroll',
} as const;
