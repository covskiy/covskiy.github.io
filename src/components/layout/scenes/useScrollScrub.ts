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
import type { LayoutStateApi } from './useLayoutState';

/** Опции `useScrollScrub` — сцена scrub на `/home`. */
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
  state: Pick<
    LayoutStateApi,
    'applyState' | 'getHomeEndState' | 'modeRef' | 'sourceRef'
  >;
}

/** Публичный API scrub-сцены — потребляется `useLayoutToggle` и провайдером. */
export interface ScrollScrubApi {
  /**
   * Регистрирует ScrollTrigger на элементе-триггере страницы.
   * Возвращает cleanup, убивающий триггер и таймлайн.
   */
  registerScrollTrigger: (trigger: HTMLElement) => () => void;
  /** Активный ScrollTrigger страницы (для программной прокрутки на `/home`). */
  scrollTriggerRef: RefObject<ScrollTrigger | null>;
}

/**
 * useScrollScrub — сцена scrub-анимации навбара на `/home`.
 *
 * Регистрирует ScrollTrigger на спейсере страницы, обновляет состояние на
 * границах спейсера и зовёт подписчиков низкоуровневых каналов
 * (`scrollListenersRef`, `toggleVisibilityListenersRef`) напрямую — без
 * pub/sub и без прохода через React-рендер.
 *
 * Позицию `.nav` сцена НЕ твинит: ею владеет `scenes/useNavPosition`, которая
 * подписана на `onScrollProgress`. Здесь остаются только ScrollTrigger,
 * дискретные границы состояния и публикация видимости toggle.
 *
 * В отличие от прежнего диспетчера не эмитит `spacer:enter`/`spacer:leave` —
 * событий с единственным владельцем позиции нет, а потребителей у них не было.
 */
export function useScrollScrub({
  bp,
  scrollListenersRef,
  toggleVisibilityListenersRef,
  state,
}: ScrollScrubOptions): ScrollScrubApi {
  const { applyState, getHomeEndState, modeRef, sourceRef } = state;

  /**
   * Ссылка на активный ScrollTrigger страницы. Используется для программной
   * прокрутки к концу спейсера при ручном скрытии навбара (mobile `/home`).
   */
  const scrollTriggerRef = useRef<ScrollTrigger | null>(null);

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
   * Регистрирует ScrollTrigger на триггере страницы.
   *
   * Создаёт scrub-таймлайн (носитель ScrollTrigger), обновляет состояние на
   * границах спейсера и зовёт подписчиков низкоуровневых каналов напрямую:
   *
   * - `progress ≈ 0` → fullscreen (приоритет автоскролла над ручным toggle);
   * - `progress ≈ 1` → endState (`getHomeEndState`: invisible на mobile /
   *   standard на tablet/desktop).
   *
   * На mobile, пока состояние задано вручную (toggle), scrub-таймлайн
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
              sourceRef.current,
              modeRef.current,
            );

            if (self.progress <= 0.0001) {
              logger.info(
                'Layout',
                'Скролл к началу — принудительный fullscreen',
              );
              applyState('fullscreen', 'scroll');
            } else if (self.progress >= 0.9999 && !isMobilePin) {
              logger.debug(
                'Layout',
                `Скролл к концу спейсера → ${getHomeEndState()}`,
              );
              applyState(getHomeEndState(), 'scroll');
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
              sourceRef.current,
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
      applyState,
      scrollListenersRef,
      notifyToggleVisibility,
      getHomeEndState,
      modeRef,
      sourceRef,
    ],
  );

  return {
    registerScrollTrigger,
    scrollTriggerRef,
  };
}
