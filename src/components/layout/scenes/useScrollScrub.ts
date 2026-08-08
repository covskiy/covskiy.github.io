import { useCallback, useRef, type RefObject } from 'react';
import gsap from 'gsap';
import type { ScrollTrigger } from 'gsap/ScrollTrigger';
import type { Breakpoint } from '../../../utils/breakpoints';
import { logger } from '../../../utils/logger';
import type {
  ScrollProgressListener,
  ToggleVisibilityListener,
} from '../LayoutProvider/LayoutContext';
import { isManualMobileState } from '../machine/derive';
import type {
  LayoutChangeSource,
  LayoutEvent,
  LayoutMode,
} from '../machine/layoutMode';

/** Опции `useScrollScrub` — сенсор scrub на `/home`. */
export interface ScrollScrubOptions {
  bp: Breakpoint;
  /** Set слушателей низкоуровневого канала прогресса (владеет провайдер). */
  scrollListenersRef: RefObject<Set<ScrollProgressListener>>;
  /**
   * Set слушателей низкоуровневого канала видимости toggle (владеет провайдер).
   * Кнопка — самостоятельная сцена (своя нода), поэтому scrub не трогает её DOM
   * напрямую, а уведомляет подписчиков.
   */
  toggleVisibilityListenersRef: RefObject<Set<ToggleVisibilityListener>>;
  /** Диспатч событий в машину (из `useLayoutMachine`). */
  dispatch: (event: LayoutEvent) => void;
  /** Актуальное состояние машины (для `isManualMobileState`). */
  modeRef: RefObject<LayoutMode>;
  /** Последний источник события (для `isManualMobileState`). */
  lastSourceRef: RefObject<LayoutChangeSource>;
  /** Чтение эффективного конечного состояния `/home`. */
  getHomeEndState: () => LayoutMode;
}

/** Публичный API scrub-сцены — потребляется провайдером. */
export interface ScrollScrubApi {
  /**
   * Регистрирует ScrollTrigger на элементе-триггере страницы.
   * Возвращает cleanup, убивающий триггер и таймлайн.
   */
  registerScrollTrigger: (trigger: HTMLElement) => () => void;
  /** Активный ScrollTrigger страницы (для программной прокрутки на `/home`). */
  scrollTriggerRef: RefObject<ScrollTrigger | null>;
  /** Программная прокрутка к концу спейсера (автоскролл при ручном скрытии). */
  scrollTo: () => void;
}

/**
 * useScrollScrub — сенсор scrub-анимации навбара на `/home`.
 *
 * Регистрирует ScrollTrigger на спейсере страницы, на границах диспатчит
 * события `REACH_TOP` / `REACH_BOTTOM` в машину (не каждый кадр, а только
 * при пересечении границы) и зовёт подписчиков низкоуровневых каналов
 * (`scrollListenersRef` — 60fps, `toggleVisibilityListenersRef`) напрямую —
 * без pub/sub и без прохода через React-рендер.
 *
 * Машина владеет только сменой `mode`. Видимость кнопки toggle — производный
 * сигнал геометрии скролла (зависит от *любой* точки прогресса, а не только
 * от переходов), поэтому остаётся здесь. `scrollTo` — колбэк владельца
 * ScrollTrigger, выполняющий action `SCROLL_TO_END` машины через `scrollToRef`.
 *
 * Позицию `.nav` сцена НЕ твинит: ею владеет `scenes/useNavPosition`, которая
 * подписана на `onScrollProgress`.
 */
export function useScrollScrub({
  bp,
  scrollListenersRef,
  toggleVisibilityListenersRef,
  dispatch,
  modeRef,
  lastSourceRef,
  getHomeEndState,
}: ScrollScrubOptions): ScrollScrubApi {
  /**
   * Ссылка на активный ScrollTrigger страницы. Используется для программной
   * прокрутки к концу спейсера при ручном скрытии навбара (mobile `/home`).
   */
  const scrollTriggerRef = useRef<ScrollTrigger | null>(null);

  /** Последняя пересечённая граница спейсера (чтобы не диспатчить на кадр). */
  const lastBoundaryRef = useRef<'top' | 'mid' | 'bottom'>('mid');

  /**
   * Уведомляет подписчиков канала видимости кнопки toggle на `/home`.
   * На `/home` кнопка нужна только когда навбар ушёл за экран (scrub дошёл до
   * конца спейсера) — во время анимации она скрыта, чтобы пользователь не мог
   * сломать scrub ручным кликом. Scrub не владеет нодой кнопки, поэтому просто
   * зовёт listener-ов (их применяет `ToggleButton` через `gsap.set`).
   */
  const notifyToggleVisibility = useCallback(
    (visible: boolean) => {
      toggleVisibilityListenersRef.current.forEach((l) => l(visible));
    },
    [toggleVisibilityListenersRef],
  );

  /**
   * Программная прокрутка к концу спейсера (action `SCROLL_TO_END` машины).
   * Guard `window.scrollY < st.end` живёт здесь — колбэк владеет
   * `scrollTriggerRef`. Перенесено из удалённой `useLayoutToggle`.
   */
  const scrollTo = useCallback(() => {
    const st = scrollTriggerRef.current;
    if (!st) return;
    if (window.scrollY < st.end) {
      gsap.to(window, {
        scrollTo: { y: st.end, autoKill: false },
        duration: 0.6,
        ease: 'power2.inOut',
        overwrite: 'auto',
      });
    }
  }, []);

  /**
   * Регистрирует ScrollTrigger на триггере страницы.
   *
   * Создаёт scrub-таймлайн (носитель ScrollTrigger), на границах спейсера
   * диспатчит события в машину и зовёт подписчиков низкоуровневых каналов
   * напрямую. На mobile, пока состояние задано вручную (toggle), scrub-таймлайн
   * «запинен» к своему (fullscreen → progress 0, invisible → progress 1).
   *
   * Возвращает cleanup, убивающий триггер и таймлайн.
   */
  const registerScrollTrigger = useCallback(
    (trigger: HTMLElement): (() => void) => {
      logger.info('Layout', 'Регистрация ScrollTrigger', {
        bp,
        endState: getHomeEndState(),
      });

      // Стартуем наверху /home: toggle не нужен, пока навбар в fullscreen.
      // onUpdate при refresh скорректирует, если пользователь загрузился внизу.
      notifyToggleVisibility(false);
      lastBoundaryRef.current = 'mid';

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger,
          start: 'top top',
          end: 'bottom top',
          scrub: true,
          invalidateOnRefresh: true,
          onUpdate: (self: ScrollTrigger) => {
            logger.trace(
              'Layout',
              `ScrollTrigger.onUpdate progress=${self.progress.toFixed(4)}, direction=${self.direction}`,
            );

            // Низкоуровневый канал: прямой вызов scrub-подписчиков без
            // React-рендера. На него подписана `useNavPosition` (ведёт `.nav`).
            const listeners = scrollListenersRef.current;
            if (listeners.size > 0) {
              const snapshot = {
                progress: self.progress,
                direction: self.direction as 1 | -1,
              };
              listeners.forEach((l) => l(snapshot));
            }

            // Mobile: пока состояние задано вручную (toggle), scrub-таймлайн
            // «запинен» к своему крайнему положению — скролл не должен
            // схлопывать навбар и вести его через scrub.
            const isMobilePin = isManualMobileState(
              bp,
              lastSourceRef.current,
              modeRef.current,
            );

            // Границы спейсера → события машины. Диспатч только при
            // пересечении границы (не на каждый кадр).
            if (self.progress <= 0.0001) {
              if (lastBoundaryRef.current !== 'top') {
                lastBoundaryRef.current = 'top';
                logger.info(
                  'Layout',
                  'Скролл к началу — принудительный fullscreen',
                );
                dispatch({ type: 'REACH_TOP' });
              }
            } else if (self.progress >= 0.9999) {
              if (lastBoundaryRef.current !== 'bottom') {
                lastBoundaryRef.current = 'bottom';
                logger.debug(
                  'Layout',
                  `Скролл к концу спейсера → ${getHomeEndState()}`,
                );
                dispatch({ type: 'REACH_BOTTOM' });
              }
            } else {
              lastBoundaryRef.current = 'mid';
            }

            if (isMobilePin) {
              self.animation?.progress(
                modeRef.current === 'fullscreen' ? 0 : 1,
                true,
              );
            }

            // Видимость toggle: скрыт наверху и во время scrub, виден когда
            // навбар ушёл за экран (progress ≈ 1) или пока состояние задано
            // вручную (ручной fullscreen → 0, ручной invisible → 1).
            const manualState = isManualMobileState(
              bp,
              lastSourceRef.current,
              modeRef.current,
            );

            notifyToggleVisibility(self.progress >= 0.9999 || manualState);
          },
        },
      });

      scrollTriggerRef.current = tl.scrollTrigger ?? null;

      return () => {
        tl.scrollTrigger?.kill();
        tl.kill();
        scrollTriggerRef.current = null;
        // Сброс видимости toggle при уходе с /home (смена роута/breakpoint),
        // чтобы кнопка не осталась скрытой на других роутах.
        notifyToggleVisibility(true);
      };
    },
    [
      bp,
      dispatch,
      scrollListenersRef,
      notifyToggleVisibility,
      getHomeEndState,
      modeRef,
      lastSourceRef,
    ],
  );

  return {
    registerScrollTrigger,
    scrollTriggerRef,
    scrollTo,
  };
}