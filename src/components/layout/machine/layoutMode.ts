/**
 * Чистый слой layout-машины — без React, GSAP и Context.
 *
 * `layoutMode.ts` описывает тип состояния раскладки, событие-первопричину
 * изменения (`LayoutEvent`), плоскую команду для executor-а (`LayoutAction`)
 * и контекст, в котором `transition()` принимает решение.
 *
 * Источник (`LayoutChangeSource`) используется, чтобы отличить автоматическое
 * переключение (скролл, роут, breakpoint) от ручного (toggle) — в первую
 * очередь для владельца позиции `.nav` (`scenes/useNavPosition`), который
 * ведёт scrub только по `source === 'scroll'`, а дискретную анимацию
 * запускает для остальных источников.
 */

import type { Breakpoint } from '../../../utils/breakpoints';

/** Возможные состояния раскладки. */
export type LayoutMode = 'fullscreen' | 'standard' | 'slim' | 'invisible';

/**
 * Источник изменения состояния раскладки (post-factum, для владельца `.nav`).
 *
 * - `scroll`     — ScrollTrigger на спейсере страницы достиг границы
 *                  (progress 0 / 1);
 * - `toggle`     — клик по кнопке toggle (☰ / ←);
 * - `route`      — смена pathname через react-router;
 * - `breakpoint` — смена breakpoint (mobile / tablet / desktop).
 */
export type LayoutChangeSource = 'toggle' | 'route' | 'breakpoint' | 'scroll';

/**
 * Событие — первопричина изменения состояния. XState-style, КАПСОМ.
 *
 * Маппинг `event.type → LayoutChangeSource` живёт в executor-е
 * (`EVENT_TO_SOURCE` в `scenes/useLayoutMachine`).
 */
export type LayoutEvent =
  | { type: 'TOGGLE' }
  | { type: 'ROUTE_CHANGED' }
  | { type: 'BREAKPOINT_CHANGED' }
  | { type: 'REACH_TOP' }
  | { type: 'REACH_BOTTOM' }
  | { type: 'INTRO_COMPLETE' };

/** Плоская команда, выполняемая executor-ом. См. `machine/transition.ts`. */
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

/**
 * Контекст машины — собирается в executor-е (`scenes/useLayoutMachine`)
 * из актуальных refs и передаётся в `transition()`. Никаких refs/DOM нижнего
 * уровня здесь нет — слой остаётся чистым.
 */
export interface MachineContext {
  bp: Breakpoint;
  isHome: boolean;
  /** Текущее значение preferred (ручной tablet-выбор slim/standard). */
  preferred: LayoutMode | null;
  /** Источник, записавший ТЕКУЩЕЕ состояние (для isManualMobileState). */
  lastSource: LayoutChangeSource;
  /** Источник текущего события (маппинг event.type → source в executor-е). */
  source: LayoutChangeSource;
}
