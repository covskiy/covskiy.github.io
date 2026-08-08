import { useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useLocation } from 'react-router';
import { useBreakpoint } from '../../../utils/breakpoints';
import { hasToggleFor, isHomePath } from '../machine/derive';
import { deriveMainOffset } from '../machine/geometry';
import { useLayoutState } from '../scenes/useLayoutState';
import { useLayoutToggle } from '../scenes/useLayoutToggle';
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
 * - `useLayoutState` держит `mode` в React Context (single source of truth);
 * - `useScrollScrub` регистрирует ScrollTrigger страницы (`/home`);
 * - `useLayoutToggle` возвращает колбэк `toggle()` для кнопки ☰ / ←.
 *
 * Провайдер — единственное место, которое знает обе стороны (машину и панель):
 * держит низкоуровневые каналы (`onScrollProgress`, `onToggleVisibility`,
 * `onNavState`), реф ретаргета scrub-твина и прокидывает в контекст API.
 * Рендерит `<nav>` + контентную область `<main>` с `--nav-content-offset`.
 *
 * Никакой шины событий / pub-sub / центрального аниматора нет.
 */
export function LayoutProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const bp = useBreakpoint();

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

  // Сцена состояния: единственный источник `mode`.
  const state = useLayoutState({
    bp,
    isHome: isHomePath(location.pathname),
    navStateListenersRef,
  });

  // Scrub-сцена `/home`.
  const scrub = useScrollScrub({
    bp,
    scrollListenersRef,
    toggleVisibilityListenersRef,
    state,
  });

  /** Ретаргет scrub-позиции при смене ручного tablet-выбора. */
  const retargetScrub = useCallback(() => retargetScrubRef.current?.(), []);

  /** Регистрация `buildScrub` из `useNavPosition` (cleanup — отмена). */
  const registerRetargetScrub = useCallback((fn: (() => void) | null) => {
    retargetScrubRef.current = fn;
    return () => {
      if (retargetScrubRef.current === fn) retargetScrubRef.current = null;
    };
  }, []);

  // Сцена ручного переключения: колбэк `toggle()`.
  const toggle = useLayoutToggle({
    bp,
    state,
    scrollTriggerRef: scrub.scrollTriggerRef,
    retargetScrub,
  });

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
  const contextValue = useMemo<LayoutContextValue>(() => {
    const isSlim = state.mode === 'slim' || state.mode === 'invisible';
    return {
      mode: state.mode,
      isSlim,
      hasToggle: hasToggleFor(bp),
      toggle,
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
      getHomeEndState: state.getHomeEndState,
      registerRetargetScrub,
    };
  }, [
    state.mode,
    state.getHomeEndState,
    bp,
    toggle,
    scrub.registerScrollTrigger,
    registerRetargetScrub,
  ]);

  const contentOffset = deriveMainOffset(
    state.mode,
    bp,
    isHomePath(location.pathname),
    state.getHomeEndState(),
  );

  return (
    <LayoutContext.Provider value={contextValue}>
      <div
        className={styles.app}
        style={{ '--nav-content-offset': contentOffset } as React.CSSProperties}
      >
        <NavigationBar
          isSlim={contextValue.isSlim}
          hasToggle={contextValue.hasToggle}
        />
        <main className={styles.main}>{children}</main>
      </div>
    </LayoutContext.Provider>
  );
}
