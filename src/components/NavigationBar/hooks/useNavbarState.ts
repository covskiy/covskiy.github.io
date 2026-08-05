import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from 'react';
import type { Breakpoint } from '../../../utils/breakpoints';
import { logger } from '../../../utils/logger';
import type { NavbarEventBus, NavbarSource } from '../core/navbarEventBus';
import {
  getDefaultState,
  homeEndStateFor,
  isHomePath,
  isPreferredStateValid,
  type NavState,
} from '../core/navbarStates';

/**
 * Опции `useNavbarState` — сцена управления состоянием раскладки навбара.
 *
 * Сцена чистая (без GSAP/ScrollTrigger): владеет рефами состояния, единой
 * точкой записи `applyState`, пересчётом целевого состояния и подписками
 * на дискретные события шины (`state:change`/`route:change`/`breakpoint:change`).
 */
export interface NavbarStateOptions {
  bus: NavbarEventBus;
  bp: Breakpoint;
  /** IsHome на момент первого рендера (без него сцена не знает роута, пока шина не заэмитит route:change). */
  initialIsHome: boolean;
}

/**
 * Публичный API state-сцены — потребляется `useNavbarScrubTrigger`,
 * `useNavbarToggle` и композером `useNavbarLayout`.
 */
export interface NavbarStateApi {
  /** React-state для проброса `isSlim`/`contentOffset` в провайдер. */
  currentState: NavState;
  /** Единственная точка изменения состояния (см. `applyState`). */
  applyState: (next: NavState, source: NavbarSource) => NavState;
  /** Эффективное конечное состояние на `/home` (после скролла спейсера). */
  getHomeEndState: () => NavState;
  /** Актуальное состояние для синхронного чтения (без stale closure). */
  stateRef: RefObject<NavState>;
  /** Последний источник, записавший состояние. */
  stateSourceRef: RefObject<NavbarSource>;
  /** Ручной tablet-выбор (`slim`/`standard`), персистируемый между роутами. */
  preferredRef: RefObject<NavState | null>;
  /** Признак домашней страницы, обновляется из `route:change`. */
  isHomeRef: RefObject<boolean>;
}

/**
 * useNavbarState — сцена состояния раскладки навбара.
 *
 * Владеет рефами состояния (`stateRef`, `stateSourceRef`, `preferredRef`,
 * `isHomeRef`) и React-state `currentState`, единой точкой записи `applyState`,
 * пересчётом целевого состояния `recomputeTarget` (роут/breakpoint/инициализация)
 * и подписками на дискретные события шины.
 *
 * Реактивный мост для провайдера: `currentState` синхронизируется из подписки
 * на `state:change` (которую публикует `applyState`) — единый конвейер
 * «publish → react» для всех источников (toggle/route/breakpoint/scroll).
 *
 * Анимацией навбара сцена НЕ занимается — это `useNavbarAnimation`.
 */
export function useNavbarState({
  bus,
  bp,
  initialIsHome,
}: NavbarStateOptions): NavbarStateApi {
  const stateRef = useRef<NavState>('fullscreen');
  const [currentState, setCurrentState] = useState<NavState>('fullscreen');

  /**
   * Ручной tablet-выбор (`slim`/`standard`), персистируемый между роутами.
   *
   * Запоминается в `handleToggle` на tablet. Используется:
   * - как целевое состояние при смене роута/breakpoint на не-home страницах
   *   (защита от «моргания» границы навбар/контент: без него ручной `standard`
   *   сбрасывался бы в дефолтный `slim`);
   * - как состояние восстановления после принудительного fullscreen на верху
   *   `/home` (вместо жёсткого `standard` скролл к низу возвращает ручной `slim`).
   *
   * Хранится только для tablet: на mobile отступ контента всегда 0 (моргания нет),
   * на desktop кнопка toggle отсутствует. Невалидные для bp значения чистятся
   * в `recomputeTarget`.
   */
  const preferredRef = useRef<NavState | null>(null);

  /**
   * Последний источник, записавший состояние. Позволяет отличить ручное
   * состояние (toggle) от скроллового: пока состояние задано вручную на
   * mobile, scrub-таймлайн «запинен» к своему крайнему положению, и скролл
   * не двигает навбар, пока не будет достигнут верх страницы.
   */
  const stateSourceRef = useRef<NavbarSource>('route');

  /**
   * Признак домашней страницы. Обновляется из события `route:change` шины
   * (единственный источник триггера смены роута), инициализируется значением
   * от провайдера. Используется в `handleToggle` (автоскролл на /home)
   * и при пересчёте целевого состояния.
   */
  const isHomeRef = useRef(initialIsHome);

  /**
   * Эффективное конечное состояние навбара на `/home` (после скролла спейсера).
   *
   * На mobile — `invisible`; на tablet — ручной выбор (`slim`/`standard`), если
   * он есть в `preferredRef`, иначе `standard`; desktop — `standard`. Читает
   * ref на лету (без пересоздания колбэка), поэтому провайдер использует его
   * для отступа `<main>`, а scrub-таймлайн — как целевое состояние в конце
   * спейсера.
   */
  const getHomeEndState = useCallback<() => NavState>(
    () => homeEndStateFor(bp, preferredRef.current),
    [bp],
  );

  /**
   * Применяет состояние: обновляет ref и публикует `state:change` в шину.
   * Возвращает предыдущее состояние (для логов и сравнений).
   *
   * React State (`currentState`) синхронизируется через подписку на то же
   * событие `state:change` (см. ниже) — setState выполняется в колбэке
   * подписчика, а не синхронно в эффекте. Это сохраняет единый путь
   * «publish → react» для всех источников (toggle/route/breakpoint/scroll).
   */
  const applyState = useCallback(
    (next: NavState, source: NavbarSource): NavState => {
      // Источник фиксируем даже при prev === next: повторный applyState
      // с source='scroll' на верху страницы должен снять «пин» ручного
      // состояния (иначе навбар остался бы развёрнутым после возврата).
      stateSourceRef.current = source;
      const prev = stateRef.current;
      if (prev === next) return prev;
      stateRef.current = next;
      bus.emit('state:change', { state: next, prev, source });
      return prev;
    },
    [bus],
  );

  /**
   * Пересчёт целевого состояния навбара при смене роута/устройства.
   *
   * Вызывается из подписок шины `route:change` / `breakpoint:change` и один раз
   * на монтировании (провайдер не эмитит события на первом рендере). На `/home`
   * всегда стартует `fullscreen` (intro-позиция; восстановление ручного состояния
   * делает scrub-эффект при прокрутке вниз). На других роутах приоритет у
   * персистируемого ручного tablet-выбора (`preferredRef`) — чтобы при переходе
   * между страницами не было «моргания» границы навбар/контент. Невалидное для
   * текущего bp предпочтение чистится, и берётся роутовый дефолт.
   */
  const recomputeTarget = useCallback(() => {
    const isHome = isHomeRef.current;
    let target: NavState;
    if (isHome) {
      target = 'fullscreen';
    } else {
      if (!isPreferredStateValid(preferredRef.current, bp)) {
        preferredRef.current = null;
      }
      target = preferredRef.current ?? getDefaultState(bp, isHome);
    }
    const prev = applyState(target, isHome ? 'route' : 'breakpoint');

    if (prev !== target) {
      logger.info(
        'NavbarLayout',
        `Смена роута/устройства (${bp}): ${prev} → ${target}`,
      );
    }
  }, [bp, applyState]);

  /**
   * Подписки на дискретные события шины — шина является единственным
   * источником триггеров смены роута/устройства. State-сцена НЕ читает
   * react-router/breakpoint напрямую для пересчёта состояния.
   *
   * Начальный `recomputeTarget()` вызывается здесь же (провайдер не эмитит
   * route:change/breakpoint:change на первом рендере). Важно: этот пассивный
   * эффект выполняется ПОСЛЕ layout-эффекта `useGSAP` в `useNavbarAnimation`,
   * поэтому подписка на `state:change` (animateNavbar) уже зарегистрирована,
   * когда сцена публикует первое состояние.
   */
  useEffect(() => {
    const offState = bus.on('state:change', ({ state, prev }) => {
      if (state === prev) return;
      setCurrentState(state);
    });

    const offRoute = bus.on('route:change', ({ pathname }) => {
      isHomeRef.current = isHomePath(pathname);
      recomputeTarget();
    });

    const offBreakpoint = bus.on('breakpoint:change', () => {
      recomputeTarget();
    });

    recomputeTarget();

    return () => {
      offState();
      offRoute();
      offBreakpoint();
    };
  }, [bus, recomputeTarget]);

  return {
    currentState,
    applyState,
    getHomeEndState,
    stateRef,
    stateSourceRef,
    preferredRef,
    isHomeRef,
  };
}
