import {
  getDefaultState,
  homeEndStateFor,
  isPreferredStateValid,
} from './derive';
import type {
  LayoutAction,
  LayoutEvent,
  LayoutMode,
  MachineContext,
} from './layoutMode';

/**
 * Результат одного шага reducer-а `transition()`.
 *
 * Контракт «`undefined` === не трогать»: поля с суффиксом `*After`, если
 * не заданы, означают «движок сохраняет текущее значение контекста». Движок
 * резолвит их через `??` и кладёт в новый `MachineContext`.
 *
 * - `state`              — следующий режим навбара;
 * - `actions`            — сайд-эффекты, которые движок применяет после шага;
 * - `preferredAfter`     — обновление ручного tablet-выбора (`null` = сброс,
 *                          `undefined` = не трогать);
 * - `manualOverrideAfter`— обновление флага ручного состояния на mobile `/home`
 *                          (`true`/`false` = явная установка,
 *                          `undefined` = не трогать, движок резолвит в
 *                          `ctx.manualOverride`). Семантика флага: «навбар
 *                          **открыт** вручную». `true` — ручное открытие
 *                          (`TOGGLE` invisible→fullscreen) + `REACH_BOTTOM`
 *                          preserve; `false` — ручное закрытие (`TOGGLE`
 *                          fullscreen→invisible) + сброс-события (`REACH_TOP`,
 *                          `ROUTE_CHANGED`, `BREAKPOINT_CHANGED`, `REACH_BOTTOM`
 *                          без override); `INTRO_COMPLETE` / no-op → `undefined`.
 */
export interface TransitionResult {
  state: LayoutMode;
  actions: LayoutAction[];
  preferredAfter?: LayoutMode | null;
  manualOverrideAfter?: boolean;
}

function notifyActions(
  prev: LayoutMode,
  next: LayoutMode,
  source: MachineContext['source'],
): LayoutAction[] {
  return prev === next
    ? []
    : [{ type: 'NOTIFY_NAV_STATE', prev, next, source }];
}

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
      manualOverrideAfter: false,
    };
  }
  const target = getDefaultState(bp, false);
  return {
    state: target,
    actions: notifyActions(state, target, source),
    preferredAfter: null,
    manualOverrideAfter: false,
  };
}

function homeResult(
  state: LayoutMode,
  source: MachineContext['source'],
): TransitionResult {
  return {
    state: 'fullscreen',
    actions: notifyActions(state, 'fullscreen', source),
    manualOverrideAfter: false,
  };
}

export function transition(
  state: LayoutMode,
  event: LayoutEvent,
  ctx: MachineContext,
): TransitionResult {
  const { bp, isHome, preferred, source } = ctx;

  switch (event.type) {
    case 'TOGGLE': {
      if (bp === 'desktop') return { state, actions: [] };

      if (bp === 'mobile') {
        if (state === 'fullscreen') {
          return {
            state: 'invisible',
            actions: [
              ...notifyActions('fullscreen', 'invisible', source),
              ...(isHome ? ([{ type: 'SCROLL_TO_END' }] as const) : []),
            ],
            manualOverrideAfter: false,
          };
        }
        if (state === 'invisible') {
          return {
            state: 'fullscreen',
            actions: notifyActions('invisible', 'fullscreen', source),
            manualOverrideAfter: true,
          };
        }
        return { state, actions: [] };
      }

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

    case 'REACH_TOP':
      return {
        state: 'fullscreen',
        actions: notifyActions(state, 'fullscreen', source),
        manualOverrideAfter: false,
      };

    case 'REACH_BOTTOM': {
      if (ctx.manualOverride) {
        return { state, actions: [], manualOverrideAfter: true };
      }
      const end = homeEndStateFor(bp, preferred);
      return {
        state: end,
        actions: notifyActions(state, end, source),
        manualOverrideAfter: false,
      };
    }

    case 'ROUTE_CHANGED':
      return isHome
        ? homeResult(state, source)
        : nonHomeResult(state, bp, preferred, source);

    case 'BREAKPOINT_CHANGED':
      return isHome
        ? homeResult(state, source)
        : nonHomeResult(state, bp, preferred, source);

    case 'INTRO_COMPLETE':
      return { state, actions: [] };
  }
}
