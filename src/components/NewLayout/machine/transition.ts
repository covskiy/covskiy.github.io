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

export interface TransitionResult {
  state: LayoutMode;
  actions: LayoutAction[];
  preferredAfter?: LayoutMode | null;
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
    };
  }
  const target = getDefaultState(bp, false);
  return {
    state: target,
    actions: notifyActions(state, target, source),
    preferredAfter: null,
  };
}

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
      };

    case 'REACH_BOTTOM': {
      if (isManualMobileState(bp, lastSource, state)) {
        return { state, actions: [] };
      }
      const end = homeEndStateFor(bp, preferred);
      return { state: end, actions: notifyActions(state, end, source) };
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
