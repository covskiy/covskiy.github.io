import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from 'react';
import type { Breakpoint } from '../../../utils/breakpoints';
import { logger } from '../../../utils/logger';
import type { NavStateListener } from '../LayoutProvider/LayoutContext';
import { getDefaultState, homeEndStateFor } from '../machine/derive';
import type {
  LayoutChangeSource,
  LayoutEvent,
  LayoutMode,
  MachineContext,
} from '../machine/layoutMode';
import { transition } from '../machine/transition';

/** Опции `useLayoutMachine` — executor-сцена машины раскладки. */
export interface LayoutMachineOptions {
  /** Начальные значения; актуальные живут в `bpRef`/`isHomeRef`. */
  bp: Breakpoint;
  isHome: boolean;
  /** Set слушателей канала смены состояния для владельца позиции `.nav`. */
  navStateListenersRef: RefObject<Set<NavStateListener>>;
  /**
   * Ref на колбэк владельца ScrollTrigger (`useScrollScrub`), выполняющий
   * `SCROLL_TO_END`. Машина НЕ получает его при создании — через ref,
   * чтобы не было цикла scrub ↔ machine (см. п.9.1 задачи v2).
   */
  scrollToRef: RefObject<(() => void) | null>;
  /** Ref на функцию ретаргета scrub-твина `.nav` (владеет провайдер). */
  retargetScrubRef: RefObject<(() => void) | null>;
}

/** Публичный API машины — потребляется scrub-сценой и композером `LayoutProvider`. */
export interface LayoutMachineApi {
  /** React-state для `mode`/`isSlim` в контекст и разметку. */
  mode: LayoutMode;
  /** Актуальное состояние для синхронного чтения (без stale closure). */
  modeRef: RefObject<LayoutMode>;
  /** Диспатч события (стабилен между рендерами). */
  dispatch: (event: LayoutEvent) => void;
  /** Эффективное конечное состояние на `/home` (после скролла спейсера). */
  getHomeEndState: () => LayoutMode;
  /** Ручной tablet-выбор, персистируемый между роутами. */
  preferredRef: RefObject<LayoutMode | null>;
  /** Последний источник события (см. `isManualMobileState`). */
  lastSourceRef: RefObject<LayoutChangeSource>;
}

/** Маппинг события → источник, статичен (модульный уровень). */
const EVENT_TO_SOURCE: Record<LayoutEvent['type'], LayoutChangeSource> = {
  TOGGLE: 'toggle',
  ROUTE_CHANGED: 'route',
  BREAKPOINT_CHANGED: 'breakpoint',
  REACH_TOP: 'scroll',
  REACH_BOTTOM: 'scroll',
  INTRO_COMPLETE: 'route', // не используется (NOOP)
};

/**
 * useLayoutMachine — executor-сцена layout-машины.
 *
 * Владеет `mode` в `useState`, стабильным `dispatch` и применяет результат
 * `transition()`: preferred-решение (`preferredAfter`) и actions к refs-каналам
 * (NOTIFY_NAV_STATE / SCROLL_TO_END / RETARGET_SCRUB). Логирует переходы.
 *
 * `bp`/`isHome` читаются на лету из refs (стабильный dispatch без stale
 * closure); триггеры-эффекты разделены по отдельным зависимостям `[bp]` /
 * `[isHome]`, поэтому смена breakpoint не диспатчит лишний `ROUTE_CHANGED`.
 *
 * Настоящая машина — чистая `transition()`; здесь — тонкая React-обёртка.
 */
export function useLayoutMachine({
  bp,
  isHome,
  navStateListenersRef,
  scrollToRef,
  retargetScrubRef,
}: LayoutMachineOptions): LayoutMachineApi {
  const [mode, setMode] = useState<LayoutMode>(() =>
    getDefaultState(bp, isHome),
  );
  const modeRef = useRef<LayoutMode>(mode);
  const bpRef = useRef(bp);
  const isHomeRef = useRef<boolean>(isHome);
  const preferredRef = useRef<LayoutMode | null>(null);
  const lastSourceRef = useRef<LayoutChangeSource>('route');

  // Актуальные внешние значения для стабильного dispatch.
  useEffect(() => {
    bpRef.current = bp;
  }, [bp]);
  useEffect(() => {
    isHomeRef.current = isHome;
  }, [isHome]);

  /**
   * Диспатч события в машину: собирает контекст, прогоняет `transition()`,
   * применяет `preferredAfter` и actions (executor), обновляет `lastSource`
   * ВСЕГДА (даже при no-op — иначе повторный REACH_TOP не снял бы
   * mobile-«пин» ручного состояния) и обновляет React-state только на
   * реальной смене `mode` (нет лишних re-render).
   */
  const dispatch = useCallback(
    (event: LayoutEvent) => {
      const ctx: MachineContext = {
        bp: bpRef.current,
        isHome: isHomeRef.current,
        preferred: preferredRef.current,
        lastSource: lastSourceRef.current,
        source: EVENT_TO_SOURCE[event.type],
      };

      const prev = modeRef.current;
      const result = transition(prev, event, ctx);

      // Применить preferred-решение из transition.
      if (result.preferredAfter !== undefined) {
        preferredRef.current = result.preferredAfter;
      }

      // Actions применяются здесь же (executor). Эффект-канал не вводится.
      for (const action of result.actions) {
        switch (action.type) {
          case 'NOTIFY_NAV_STATE':
            if (action.prev !== action.next) {
              navStateListenersRef.current.forEach((l) =>
                l({
                  prev: action.prev,
                  next: action.next,
                  source: action.source,
                }),
              );
            }
            break;
          case 'SCROLL_TO_END':
            scrollToRef.current?.();
            break;
          case 'RETARGET_SCRUB':
            retargetScrubRef.current?.();
            break;
          case 'NOOP':
            break;
        }
      }

      lastSourceRef.current = ctx.source;

      if (result.state !== prev) {
        modeRef.current = result.state;
        setMode(result.state);
        logger.info(
          'Layout',
          `Transition: ${event.type} → ${result.state} (${ctx.source})`,
          { prev, next: result.state },
        );
      } else {
        logger.debug('Layout', `No-op: ${event.type} (${ctx.source})`);
      }
    },
    [navStateListenersRef, scrollToRef, retargetScrubRef],
  );

  // Триггеры внешних систем: отдельные deps — НЕ общий [bp,isHome,dispatch],
  // иначе смена bp диспатчила бы и ROUTE_CHANGED тоже.
  useEffect(() => {
    dispatch({ type: 'BREAKPOINT_CHANGED' });
  }, [bp, dispatch]);
  useEffect(() => {
    dispatch({ type: 'ROUTE_CHANGED' });
  }, [isHome, dispatch]);

  const getHomeEndState = useCallback<() => LayoutMode>(
    () => homeEndStateFor(bpRef.current, preferredRef.current),
    [],
  );

  return {
    mode,
    modeRef,
    dispatch,
    getHomeEndState,
    preferredRef,
    lastSourceRef,
  };
}