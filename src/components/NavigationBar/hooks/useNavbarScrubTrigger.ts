import { useCallback, useRef, type RefObject } from 'react';
import gsap from 'gsap';
import type { ScrollTrigger } from 'gsap/ScrollTrigger';
import type { Breakpoint } from '../../../utils/breakpoints';
import { logger } from '../../../utils/logger';
import type { NavbarEventBus } from '../core/navbarEventBus';
import { isManualMobileState } from '../core/navbarStates';
import type { NavbarStateApi } from './useNavbarState';

/** Listener низкоуровневого канала прогресса скролла (см. `scrollListenersRef`). */
export type ScrollProgressListener = (p: {
  progress: number;
  direction: 1 | -1;
}) => void;

/** Listener низкоуровневого канала видимости toggle (см. `toggleVisibilityListenersRef`). */
export type ToggleVisibilityListener = (visible: boolean) => void;

/** Опции `useNavbarScrubTrigger` — сцена scrub на `/home`. */
export interface NavbarScrubTriggerOptions {
  bus: NavbarEventBus;
  bp: Breakpoint;
  /** Set слушателей низкоуровневого канала прогресса (владеет провайдер). */
  scrollListenersRef: RefObject<Set<ScrollProgressListener>>;
  /**
   * Set слушателей низкоуровневого канала видимости toggle (владеет провайдер).
   * Кнопка — самостоятельная сцена (своя нода), поэтому scrub не трогает
   * её DOM напрямую, а уведомляет подписчиков.
   */
  toggleVisibilityListenersRef: RefObject<Set<ToggleVisibilityListener>>;
  state: Pick<
    NavbarStateApi,
    'applyState' | 'getHomeEndState' | 'stateRef' | 'stateSourceRef'
  >;
}

/** Публичный API scrub-сцены — потребляется `useNavbarToggle` и композером. */
export interface NavbarScrubTriggerApi {
  /**
   * Регистрирует ScrollTrigger на элементе-триггере страницы.
   * Возвращает cleanup, убивающий триггер и таймлайн.
   */
  registerScrollTrigger: (trigger: HTMLElement) => () => void;
  /** Активный ScrollTrigger страницы (для программной прокрутки скролла). */
  scrollTriggerRef: RefObject<ScrollTrigger | null>;
}

/**
 * useNavbarScrubTrigger — сцена scrub-анимации навбара на `/home`.
 *
 * Регистрирует ScrollTrigger на элементе-триггере страницы (спейсер), обновляет
 * состояние на границах спейсера и зовёт подписчиков `scrollListenersRef`
 * напрямую (минуя bus.emit, чтобы не давить 60fps событиями в React-шину).
 *
 * Позицию `.nav` сцена больше НЕ твинит: ею владеет хук-сцена `useNavbarPosition`
 * (в `NavigationBar`), которая подписана на `onScrollProgress` и сама ведёт
 * scrubbed-твин. Здесь остаются только ScrollTrigger, дискретные границы
 * состояния, события `spacer:enter`/`spacer:leave` и публикация видимости toggle.
 */
export function useNavbarScrubTrigger({
  bus,
  bp,
  scrollListenersRef,
  toggleVisibilityListenersRef,
  state,
}: NavbarScrubTriggerOptions): NavbarScrubTriggerApi {
  const { applyState, getHomeEndState, stateRef, stateSourceRef } = state;

  /**
   * Ссылка на активный ScrollTrigger страницы (например, спейсера на /home).
   * Используется для программной прокрутки к концу спейсера при ручном скрытии навбара.
   */
  const scrollTriggerRef = useRef<ScrollTrigger | null>(null);

  /**
   * Уведомляет подписчиков канала видимости кнопки toggle на `/home`.
   *
   * На `/home` кнопка нужна только когда навбар ушёл за экран (scrub-таймлайн
   * дошёл до конца спейсера) — во время анимации она скрыта, чтобы пользователь
   * не мог сломать scrub ручным кликом. Scrub не владеет нодой кнопки, поэтому
   * просто зовёт listener-ов (их применяет `ToggleButton` через `gsap.set`),
   * без React-рендера, из `ScrollTrigger.onUpdate`.
   */
  const notifyToggleVisibility = useCallback(
    (visible: boolean) => {
      const listeners = toggleVisibilityListenersRef.current;
      listeners.forEach((l) => l(visible));
    },
    [toggleVisibilityListenersRef],
  );

  /**
   * Регистрирует ScrollTrigger на элементе-триггере страницы.
   *
   * Создаёт таймлайн с scrub, привязанный к `trigger`, и обновляет
   * состояние навбара на границах спейсера:
   * - `progress ≈ 0` → fullscreen (приоритет автоскролла над ручным toggle)
   * - `progress ≈ 1` → endState (invisible на mobile / standard на tablet/desktop)
   *
   * На mobile, пока состояние задано вручную (toggle), scrub-таймлайн
   * «запинен» к своему крайнему положению (`fullscreen` → progress 0,
   * `invisible` → progress 1): скролл не схлопывает навбар и не ведёт его
   * через scrub. Управление scrub'ом возвращается только на самом верху
   * страницы (`progress ≈ 0`), где `applyState('fullscreen', 'scroll')`
   * перезаписывает источник и снимает пин.
   *
   * Дополнительно — зовёт подписчиков `scrollListenersRef` напрямую
   * (минуя bus.emit, чтобы не давить 60fps событиями в React-шину).
   *
   * Также управляет видимостью кнопки toggle на `/home`: скрывает её во время
   * scrub-анимации и показывает, когда навбар ушёл за экран (`progress ≈ 1`)
   * или пока состояние задано вручную (ручной fullscreen → ←, ручной
   * invisible → ☰). Публикация идёт через `toggleVisibilityListenersRef` —
   * нодой кнопки владеет сама сцена `ToggleButton`.
   *
   * Возвращает cleanup, убивающий триггер и таймлайн.
   */
  const registerScrollTrigger = useCallback(
    (trigger: HTMLElement): (() => void) => {
      logger.info('NavbarLayout', 'Регистрация ScrollTrigger', {
        bp,
        endState: getHomeEndState(),
      });

      // Стартуем наверху /home: toggle не нужен, пока навбар в fullscreen.
      // onUpdate при refresh скорректирует, если пользователь загрузился внизу.
      notifyToggleVisibility(false);

      // Трекинг видимости спейсера для дискретной эмиссии 'spacer:enter'/
      // 'spacer:leave'. Локальная переменная живёт столько же, сколько
      // регистрация (намеренно НЕ ref): при перерегистрации (смена bp)
      // состояние сбрасывается, и onRefresh заново синхронизирует его.
      let spacerOff = false;
      const emitSpacerLeave = () => {
        if (spacerOff) return;
        spacerOff = true;
        logger.debug('NavbarLayout', 'Спейсер полностью ушёл за экран');
        bus.emit('spacer:leave', {});
      };
      const emitSpacerEnter = () => {
        if (!spacerOff) return;
        spacerOff = false;
        logger.debug('NavbarLayout', 'Спейсер снова появился во вьюпорте');
        bus.emit('spacer:enter', {});
      };

      // Scrubbed-таймлайн — носитель ScrollTrigger. Позицию навбара он больше
      // НЕ ведёт (владелец — useNavbarPosition через onScrollProgress);
      // таймлайн нужен только чтобы ScrollTrigger передавал progress в onUpdate,
      // а scrub гасил авто-анимации именно этого таймлайна.
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger,
          start: 'top top',
          end: 'bottom top',
          scrub: true,
          invalidateOnRefresh: true,
          // Скролл вниз: низ спейсера пересёк верх вьюпорта — спейсер ушёл
          // с экрана (progress ≈ 1). Эмитим 'spacer:leave'.
          onLeave: emitSpacerLeave,
          // Скролл вверх: низ спейсера вернулся во вьюпорт (progress < 1).
          // Эмитим 'spacer:enter'.
          onEnterBack: emitSpacerEnter,
          // Синхронизация начального состояния: если страница загружена
          // уже ниже спейсера (progress ≈ 1), ScrollTrigger может не вызвать
          // onLeave при создании — отдаём событие отсюда. Guard-функции
          // защищают от дублей (ScrollTrigger сам дёргает onLeave/onEnterBack
          // при refresh, если состояние изменилось).
          onRefresh: (self: ScrollTrigger) => {
            if (self.progress >= 0.9999) {
              emitSpacerLeave();
            } else {
              emitSpacerEnter();
            }
          },
          onUpdate: (self: ScrollTrigger) => {
            logger.trace(
              'NavbarLayout',
              `ScrollTrigger.onUpdate progress=${self.progress.toFixed(4)}, direction=${self.direction}`,
            );

            // Низкоуровневый канал: прямой вызов scrub-подписчиков
            // без прохода через bus.emit и без React-рендера. На него
            // подписана `useNavbarPosition` (ведёт позицию `.nav`).
            const listeners = scrollListenersRef.current;
            if (listeners.size > 0) {
              const snapshot = {
                progress: self.progress,
                direction: self.direction as 1 | -1,
              };
              listeners.forEach((l) => l(snapshot));
            }

            // Mobile: пока состояние задано вручную (toggle), scrub-таймлайн
            // «запинен» к своему крайнему положению (fullscreen → 0,
            // invisible → 1) — скролл не должен схлопывать навбар и вести
            // его через scrub. Управление scrub'ом возвращается только на
            // самом верху страницы (progress ≈ 0).
            const isMobilePin = isManualMobileState(
              bp,
              stateSourceRef.current,
              stateRef.current,
            );

            if (self.progress <= 0.0001) {
              logger.info(
                'NavbarLayout',
                'Скролл к началу — принудительный fullscreen',
              );
              applyState('fullscreen', 'scroll');
            } else if (self.progress >= 0.9999 && !isMobilePin) {
              logger.debug(
                'NavbarLayout',
                `Скролл к концу спейсера → ${getHomeEndState()}`,
              );
              applyState(getHomeEndState(), 'scroll');
            }

            if (isMobilePin) {
              self.animation?.progress(
                stateRef.current === 'fullscreen' ? 0 : 1,
                true,
              );
            }

            // Видимость toggle: скрыт наверху и во время scrub, виден когда
            // навбар ушёл за экран (progress ≈ 1) или пока состояние задано
            // вручную (ручной fullscreen → 0, ручной invisible → 1).
            const manualState = isManualMobileState(
              bp,
              stateSourceRef.current,
              stateRef.current,
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
      bus,
      scrollListenersRef,
      notifyToggleVisibility,
      getHomeEndState,
      stateRef,
      stateSourceRef,
    ],
  );

  return {
    registerScrollTrigger,
    scrollTriggerRef,
  };
}
