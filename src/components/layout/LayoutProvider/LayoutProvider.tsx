import { useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useLocation } from 'react-router';
import { useBreakpoint } from '../../../utils/breakpoints';
import {
  selectContentOffset,
  selectHasToggle,
  selectIsHome,
  selectIsSlim,
} from '../machine/selectors';
import { useLayoutMachine } from '../scenes/useLayoutMachine';
import { useScrollScrub } from '../scenes/useScrollScrub';
import { NavigationBar } from '../nav/NavigationBar';
import {
  LayoutContext,
  type LayoutContextValue,
  type NavStateListener,
  type ScrollProgressListener,
  type ToggleVisibilityListener,
} from './LayoutContext';
import styles from './LayoutProvider.module.css';

/**
 * LayoutProvider — машина состояния раскладки + композер сцен.
 *
 * Образец «единственный источник состояния + per-component animator»:
 * - `useLayoutMachine` держит `mode` в `useState` (single source of truth),
 *   диспатчит события и применяет результат чистой `transition()` (executor);
 * - `useScrollScrub` — сенсор `/home`: регистрирует ScrollTrigger, диспатчит
 *   `REACH_TOP`/`REACH_BOTTOM`, публикует видимость toggle и `scrollTo`.
 *
 * Провайдер — единственное место, которое знает обе стороны (машину и панель):
 * держит низкоуровневые каналы (`onScrollProgress`, `onToggleVisibility`,
 * `onNavState`), рефы `retargetScrubRef`/`scrollToRef` и прокидывает в контекст
 * API. Рендерит `<nav>` + контентную область `<main>` с `--nav-content-offset`.
 *
 * Никакой шины событий / pub-sub / центрального аниматора нет.
 */
export function LayoutProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const bp = useBreakpoint();
  const isHome = selectIsHome(location.pathname);

  /**
   * Set-слушатели низкоуровневых каналов. Хранятся в ref, потому что подписки
   * добавляются/удаляются в 60fps-сценариях без ререндера провайдера.
   */
  const scrollListenersRef = useRef<Set<ScrollProgressListener>>(new Set());
  const toggleVisibilityListenersRef = useRef<Set<ToggleVisibilityListener>>(
    new Set(),
  );
  const navStateListenersRef = useRef<Set<NavStateListener>>(new Set());

  /** Реф на функцию пересоздания scrub-твина позиции `.nav`. */
  const retargetScrubRef = useRef<(() => void) | null>(null);
  /** Реф на колбэк `scrollTo` scrub-сцены (выполняет action SCROLL_TO_END). */
  const scrollToRef = useRef<(() => void) | null>(null);

  // Executor-сцена машины: единственный источник `mode` + применение actions.
  // Объявляется ПЕРВОЙ — scrub диспатчит события в `dispatch`. `scrollToRef`
  // и `retargetScrubRef` — чистые refs, поэтому цикла в объявлении хуков нет.
  const machine = useLayoutMachine({
    bp,
    isHome,
    navStateListenersRef,
    scrollToRef,
    retargetScrubRef,
  });

  // Scrub-сцена `/home` (сенсор): регистрирует ScrollTrigger и диспатчит
  // REACH_TOP/REACH_BOTTOM в машину.
  const scrub = useScrollScrub({
    bp,
    scrollListenersRef,
    toggleVisibilityListenersRef,
    dispatch: machine.dispatch,
    modeRef: machine.modeRef,
    lastSourceRef: machine.lastSourceRef,
    getHomeEndState: machine.getHomeEndState,
  });

  /**
   * Регистрация `scrollTo` в машине (паттерн `registerRetargetScrub`): машина
   * получает не колбэк, а ref, поэтому цикла scrub ↔ machine в объявлении хуков
   * нет — значение пишется сюда эффектом после обоих хуков. Executor вызывает
   * `scrollToRef.current?.()` по action `SCROLL_TO_END`.
   */
  useEffect(() => {
    scrollToRef.current = scrub.scrollTo;
    return () => {
      scrollToRef.current = null;
    };
  }, [scrub.scrollTo]);

  /**
   * Регистрация `buildScrub` из `useNavPosition` (cleanup — отмена).
   * Executor машины дёргает `retargetScrubRef` по action `RETARGET_SCRUB`.
   */
  const registerRetargetScrub = useCallback((fn: (() => void) | null) => {
    retargetScrubRef.current = fn;
    return () => {
      if (retargetScrubRef.current === fn) retargetScrubRef.current = null;
    };
  }, []);

  // Очистка каналов при размонтировании (страховка от утечек в HMR/StrictMode).
  useEffect(
    () => () => {
      scrollListenersRef.current.clear();
      toggleVisibilityListenersRef.current.clear();
      navStateListenersRef.current.clear();
    },
    [],
  );

  // Публичный API в context.
  const contextValue = useMemo<LayoutContextValue>(
    () => ({
      mode: machine.mode,
      isSlim: selectIsSlim(machine.mode),
      hasToggle: selectHasToggle(bp),
      toggle: () => machine.dispatch({ type: 'TOGGLE' }),
      registerScrollTrigger: scrub.registerScrollTrigger,
      onScrollProgress: (l) => {
        scrollListenersRef.current.add(l);
        return () => {
          scrollListenersRef.current.delete(l);
        };
      },
      onToggleVisibility: (l) => {
        toggleVisibilityListenersRef.current.add(l);
        return () => {
          toggleVisibilityListenersRef.current.delete(l);
        };
      },
      onNavState: (l) => {
        navStateListenersRef.current.add(l);
        return () => {
          navStateListenersRef.current.delete(l);
        };
      },
      getHomeEndState: machine.getHomeEndState,
      registerRetargetScrub,
    }),
    [
      machine.mode,
      machine.dispatch,
      machine.getHomeEndState,
      bp,
      scrub.registerScrollTrigger,
      registerRetargetScrub,
    ],
  );

  const contentOffset = selectContentOffset(
    machine.mode,
    bp,
    isHome,
    machine.getHomeEndState(),
  );

  return (
    <LayoutContext.Provider value={contextValue}>
      <div
        className={styles.app}
        style={{ '--nav-content-offset': contentOffset } as React.CSSProperties}
      >
        <NavigationBar
          isSlim={selectIsSlim(machine.mode)}
          hasToggle={selectHasToggle(bp)}
        />
        <main className={styles.main}>{children}</main>
      </div>
    </LayoutContext.Provider>
  );
}