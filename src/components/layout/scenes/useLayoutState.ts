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
import {
  getDefaultState,
  homeEndStateFor,
  isPreferredStateValid,
} from '../machine/derive';
import type { LayoutChangeSource, LayoutMode } from '../machine/layoutMode';

/** Опции `useLayoutState` — сцена управления состоянием раскладки. */
export interface LayoutStateOptions {
  /** Актуальный breakpoint (триггер пересчёта). */
  bp: Breakpoint;
  /** Признак домашней страницы (триггер пересчёта). */
  isHome: boolean;
  /**
   * Set слушателей низкоуровневого канала смены состояния для владельца
   * позиции `.nav` (владеет провайдер). `applyState` уведомляет их напрямую,
   * без React-рендера.
   */
  navStateListenersRef: RefObject<Set<NavStateListener>>;
}

/**
 * Публичный API state-сцены — потребляется `useScrollScrub`,
 * `useLayoutToggle` и композером `LayoutProvider`.
 */
export interface LayoutStateApi {
  /** React-state для проброса `mode`/`isSlim` в контекст и разметку. */
  mode: LayoutMode;
  /** Единственная точка записи состояния (см. `applyState`). */
  applyState: (next: LayoutMode, source: LayoutChangeSource) => void;
  /** Эффективное конечное состояние на `/home` (после скролла спейсера). */
  getHomeEndState: () => LayoutMode;
  /** Актуальное состояние для синхронного чтения (без stale closure). */
  modeRef: RefObject<LayoutMode>;
  /** Последний источник, записавший состояние. */
  sourceRef: RefObject<LayoutChangeSource>;
  /** Ручной tablet-выбор (`slim`/`standard`), персистируемый между роутами. */
  preferredRef: RefObject<LayoutMode | null>;
  /** Признак домашней страницы, обновляется при смене роута. */
  isHomeRef: RefObject<boolean>;
  /** Пересчёт целевого состояния (роут/breakpoint/инициализация). */
  recomputeTarget: () => void;
}

/**
 * useLayoutState — сцена состояния раскладки.
 *
 * Единственный источник состояния (`mode` в `useState`) и единая точка записи
 * `applyState`. Владеет рефами `modeRef`, `sourceRef`, `preferredRef`,
 * `isHomeRef` и пересчётом целевого состояния `recomputeTarget`.
 *
 * В отличие от прежнего диспетчера с шиной, состояние живёт прямо в `useState`,
 * а не восстанавливается из подписки на `state:change`: `applyState` вызывает
 * `setMode` напрямую и уведомляет низкоуровневый канал `onNavState` (владелец
 * позиции `.nav`). React-bridge на шину убран.
 *
 * Анимацией навбара сцена не занимается — это `scenes/useNavPosition`.
 */
export function useLayoutState({
  bp,
  isHome,
  navStateListenersRef,
}: LayoutStateOptions): LayoutStateApi {
  const modeRef = useRef<LayoutMode>('fullscreen');
  const [mode, setMode] = useState<LayoutMode>('fullscreen');

  /**
   * Ручной tablet-выбор (`slim`/`standard`), персистируемый между роутами.
   * См. `isPreferredStateValid` в `machine/derive.ts`.
   */
  const preferredRef = useRef<LayoutMode | null>(null);

  /** Последний источник, записавший состояние (см. `isManualMobileState`). */
  const sourceRef = useRef<LayoutChangeSource>('route');

  /** Признак домашней страницы (см. `isHomePath`). */
  const isHomeRef = useRef(isHome);

  /**
   * Эффективное конечное состояние навбара на `/home` (после скролла спейсера).
   * Читает `preferredRef` на лету: `mobile → invisible`; `tablet` с ручным
   * выбором → `slim`/`standard`, иначе `standard`; desktop → `standard`.
   */
  const getHomeEndState = useCallback<() => LayoutMode>(
    () => homeEndStateFor(bp, preferredRef.current),
    [bp],
  );

  /**
   * Применяет состояние: пишет рефы, обновляет React-state и уведомляет
   * низкоуровневый канал `onNavState` (владелец позиции `.nav`).
   *
   * Источник фиксируем даже при `prev === next`: повторный `applyState`
   * с `source='scroll'` на верху страницы должен снять «пин» ручного
   * состояния (иначе навбар остался бы развёрнутым после возврата).
   */
  const applyState = useCallback(
    (next: LayoutMode, source: LayoutChangeSource) => {
      sourceRef.current = source;
      const prev = modeRef.current;
      if (prev === next) return;
      modeRef.current = next;
      setMode(next);
      navStateListenersRef.current.forEach((l) => l({ prev, next, source }));
    },
    [navStateListenersRef],
  );

  /**
   * Пересчёт целевого состояния при смене роута/устройства. На `/home` всегда
   * стартует `fullscreen` (intro-позиция; восстановление ручного состояния
   * делает scrub-эффект при прокрутке вниз). На других роутах приоритет у
   * персистируемого ручного tablet-выбора (`preferredRef`) — чтобы при переходе
   * между страницами не было «моргания» границы навбар/контент. Невалидное для
   * текущего bp предпочтение чистится, и берётся роутовый дефолт.
   */
  const recomputeTarget = useCallback(() => {
    const isHomeAt = isHomeRef.current;
    let target: LayoutMode;
    if (isHomeAt) {
      target = 'fullscreen';
    } else {
      if (!isPreferredStateValid(preferredRef.current, bp)) {
        preferredRef.current = null;
      }
      target = preferredRef.current ?? getDefaultState(bp, isHomeAt);
    }
    const prev = modeRef.current;
    applyState(target, isHomeAt ? 'route' : 'breakpoint');
    if (prev !== target) {
      logger.info(
        'Layout',
        `Смена роута/устройства (${bp}): ${prev} → ${target}`,
      );
    }
  }, [bp, applyState]);

  // Триггер пересчёта: инициализация + смена роута/breakpoint. Это
  // синхронизация с внешними системами (react-router pathname + breakpoint),
  // поэтому прямое обновление состояния и всего в эффекте уместно.
  useEffect(() => {
    isHomeRef.current = isHome;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    recomputeTarget();
  }, [isHome, recomputeTarget]);

  return {
    mode,
    applyState,
    getHomeEndState,
    modeRef,
    sourceRef,
    preferredRef,
    isHomeRef,
    recomputeTarget,
  };
}
