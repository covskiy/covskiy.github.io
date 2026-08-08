/**
 * Чистая reducer-функция layout-машины — единственная точка решения о
 * переходе. Без React, GSAP и DOM.
 *
 * `transition(state, event, ctx)` возвращает:
 * - `state` — следующее состояние (`LayoutMode`);
 * - `actions` — плоские команды для executor-а (`scenes/useLayoutMachine`);
 * - `preferredAfter` — опциональное новое значение ручного tablet-выбора;
 *   `undefined` — не менять, `null` — сбросить.
 *
 * Executor собирает `MachineContext` из актуальных refs (bp, isHome, preferred,
 * lastSource) и сам решает, что источник события — `ctx.source`. Здесь — только
 * чистая таблица переходов.
 */

import {
  getDefaultState,
  homeEndStateFor,
  isManualMobileState,
  isPreferredStateValid,
} from './derive';
import type {
  LayoutAction,
  LayoutEvent,
  LayoutMode,
  MachineContext,
} from './layoutMode';

/** Результат перехода. `preferredAfter` отсутствует (undefined) — не менять. */
export interface TransitionResult {
  state: LayoutMode;
  actions: LayoutAction[];
  preferredAfter?: LayoutMode | null;
}

/**
 * No-op short-circuit: если `next === prev`, actions пустые — executor
 * не получает `NOTIFY_NAV_STATE` с `prev === next`. Источник берётся из
 * `ctx.source` (executor маппит `event.type → LayoutChangeSource`).
 */
function notifyActions(prev: LayoutMode, next: LayoutMode, source: MachineContext['source']): LayoutAction[] {
  return prev === next
    ? []
    : [{ type: 'NOTIFY_NAV_STATE', prev, next, source }];
}

/**
 * Переход на не-home роуте: приоритет у персистируемого ручного tablet-выбора
 * (`preferred`). Невалидное для текущего bp предпочтение чистится (`null`),
 * берётся роутовый дефолт.
 */
function nonHomeResult(
  state: LayoutMode,
  bp: MachineContext['bp'],
  preferred: MachineContext['preferred'],
  source: MachineContext['source'],
): TransitionResult {
  if (preferred !== null && isPreferredStateValid(preferred, bp)) {
    return {
      state: preferred,
      actions: notifyActions(state, preferred, source),
    };
  }
  const target = getDefaultState(bp, false);
  return {
    state: target,
    actions: notifyActions(state, target, source),
    preferredAfter: null,
  };
}

/** Переход на `/home`: всегда `fullscreen` (intro-позиция). */
function homeResult(
  state: LayoutMode,
  source: MachineContext['source'],
): TransitionResult {
  return {
    state: 'fullscreen',
    actions: notifyActions(state, 'fullscreen', source),
  };
}

export function transition(
  state: LayoutMode,
  event: LayoutEvent,
  ctx: MachineContext,
): TransitionResult {
  const { bp, isHome, preferred, lastSource, source } = ctx;

  switch (event.type) {
    // ─── Ручной toggle (☰ / ←) ───────────────────────────────────────────────
    case 'TOGGLE': {
      // Guard: кнопка скрыта на desktop.
      if (bp === 'desktop') return { state, actions: [] };

      if (bp === 'mobile') {
        if (state === 'fullscreen') {
          return {
            state: 'invisible',
            actions: [
              ...notifyActions('fullscreen', 'invisible', source),
              // На `/home` сворачивание прокручивает страницу к концу спейсера.
              ...(isHome ? ([{ type: 'SCROLL_TO_END' }] as const) : []),
            ],
          };
        }
        if (state === 'invisible') {
          return {
            state: 'fullscreen',
            actions: notifyActions('invisible', 'fullscreen', source),
          };
        }
        return { state, actions: [] };
      }

      // Tablet: персистентный выбор slim/standard + ретаргет scrub-твина.
      if (state === 'standard') {
        return {
          state: 'slim',
          actions: [
            ...notifyActions('standard', 'slim', source),
            { type: 'RETARGET_SCRUB' },
          ],
          preferredAfter: 'slim',
        };
      }
      if (state === 'slim') {
        return {
          state: 'standard',
          actions: [
            ...notifyActions('slim', 'standard', source),
            { type: 'RETARGET_SCRUB' },
          ],
          preferredAfter: 'standard',
        };
      }
      return { state, actions: [] };
    }

    // ─── Скролл спейсера (/home) ─────────────────────────────────────────────
    case 'REACH_TOP':
      // Автоскролл имеет приоритет над ручным: верх всегда → fullscreen.
      return {
        state: 'fullscreen',
        actions: notifyActions(state, 'fullscreen', source),
      };

    case 'REACH_BOTTOM': {
      // Mobile-пин: пока состояние задано вручную, скролл не схлопывает навбар.
      if (isManualMobileState(bp, lastSource, state)) {
        return { state, actions: [] };
      }
      const end = homeEndStateFor(bp, preferred);
      return { state: end, actions: notifyActions(state, end, source) };
    }

    // ─── Внешние триггеры (роут / breakpoint) ────────────────────────────────
    case 'ROUTE_CHANGED':
      return isHome
        ? homeResult(state, ctx.source)
        : nonHomeResult(state, bp, ctx.preferred, ctx.source);

    case 'BREAKPOINT_CHANGED':
      return isHome
        ? homeResult(state, ctx.source)
        : nonHomeResult(state, bp, ctx.preferred, ctx.source);

    // ─── Reserved (интеграция с IntroAnimation — отдельная ответственность) ──
    case 'INTRO_COMPLETE':
      return { state, actions: [] };
  }
}