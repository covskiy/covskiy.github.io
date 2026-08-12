import type { Breakpoint } from '../../../utils/breakpoints';

export type { Breakpoint };

/**
 * Состояния навбара. Переходы между ними описываются чистым reducer-ом
 * `transition()`; владелец режима — `engine.ts`.
 */
export type LayoutMode = 'fullscreen' | 'standard' | 'slim' | 'invisible';

/**
 * Канал, которым событие пришло в машину. Используется для атрибуции
 * сайд-эффектов (`NOTIFY_NAV_STATE.source`) и логики `manualOverride`.
 *   - `toggle`     — пользовательский клик по кнопке
 *   - `route`      — смена pathname
 *   - `breakpoint` — пересечение границы вьюпорта
 *   - `scroll`     — пересечение границы scrub-зоны / завершение intro
 */
export type LayoutChangeSource = 'toggle' | 'route' | 'breakpoint' | 'scroll';

/**
 * Дискриминируемое объединение входных событий машины.
 * Маппинг `event.type → LayoutChangeSource` см. в `EVENT_TO_SOURCE`.
 *
 *   - `TOGGLE`              — клик по бургеру (mobile/tablet)
 *   - `ROUTE_CHANGED`       — смена pathname (`LayoutProvider`)
 *   - `BREAKPOINT_CHANGED`  — смена ширины вьюпорта (`LayoutProvider`)
 *   - `REACH_TOP`           — спейсер `/home` доскроллен до верхней границы
 *   - `REACH_BOTTOM`        — спейсер `/home` доскроллен до нижней границы
 *   - `INTRO_COMPLETE`      — завершение intro-анимации (no-op для машины)
 */
export type LayoutEvent =
  | { type: 'TOGGLE' }
  | { type: 'ROUTE_CHANGED' }
  | { type: 'BREAKPOINT_CHANGED'; bp: Breakpoint }
  | { type: 'REACH_TOP' }
  | { type: 'REACH_BOTTOM' }
  | { type: 'INTRO_COMPLETE' };

/**
 * Сайд-эффекты, которые `transition()` декларирует, а движок применяет.
 *
 *   - `NOTIFY_NAV_STATE` — публикация смены режима подписчикам
 *   - `SCROLL_TO_END`    — программный доскролл спейсера (после TOGGLE на /home)
 *   - `RETARGET_SCRUB`   — перенастройка scrub-твина (после TOGGLE на tablet)
 *   - `NOOP`             — зарезервировано
 */
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
 * Контекст layout-машины.
 *
 * Контракт:
 * - владелец — `engine.ts`; `transition()` только читает, движок собирает
 *   новый объект на каждом шаге;
 * - публикуется в `LayoutSnapshot.context` для read-only-доступа;
 * - `lastSource` хранит источник предыдущего шага (для diff-нотификаций
 *   и редких логик, завязанных на источник);
 * - `source` — источник текущего шага (см. `EVENT_TO_SOURCE`);
 * - `manualOverride` — first-class флаг «открыт вручную» на mobile `/home`,
 *   ставится при ручном открытии, снимается при ручном закрытии и
 *   reset-событиях; см. JSDoc поля.
 */
export interface MachineContext {
  /** Текущий breakpoint вьюпорта. */
  bp: Breakpoint;
  /** Признак «домашней» страницы (`/` или `/home`). */
  isHome: boolean;
  /** Ручной выбор ширины навбара на tablet (`slim`/`standard`); иначе `null`. */
  preferred: LayoutMode | null;
  /** Источник события предыдущего шага. */
  lastSource: LayoutChangeSource;
  /** Источник события текущего шага. */
  source: LayoutChangeSource;
  /** Целевой режим навбара на дне спейсера `/home` (вычисляется через `homeEndStateFor`). */
  homeEndState: LayoutMode;
  /**
   * Флаг ручного состояния навбара на mobile `/home`.
   *
   * Семантика: «навбар **открыт** вручную и удерживается в этом состоянии».
   * Ставится при ручном **открытии** (`TOGGLE` invisible→fullscreen),
   * снимается при ручном **закрытии** (`TOGGLE` fullscreen→invisible) и
   * reset-событиях (`REACH_TOP` / `ROUTE_CHANGED` / `BREAKPOINT_CHANGED` /
   * `REACH_BOTTOM` без override). Флаг переживает `REACH_BOTTOM` (preserve),
   * поэтому комбинация `invisible + manualOverride` недостижима — после ручного
   * закрытия навбар возвращается в авто-режим scrub. Публикуется в снапшоте
   * как `isManualToggle`.
   */
  manualOverride: boolean;
}

/**
 * Маппинг `event.type → LayoutChangeSource`.
 * Единый источник правды: движок и тесты резолвят источник через него.
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
