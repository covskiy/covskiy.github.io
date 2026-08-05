import { useCallback, useRef, type RefObject } from 'react';
import gsap from 'gsap';
import type { ScrollTrigger } from 'gsap/ScrollTrigger';
import type { Breakpoint } from '../../../utils/breakpoints';
import { logger } from '../../../utils/logger';
import type { NavbarEventBus } from '../core/navbarEventBus';
import { getNavTransform, isManualMobileState } from '../core/navbarStates';
import type { NavbarStateApi } from './useNavbarState';

/** Listener низкоуровневого канала прогресса скролла (см. `scrollListenersRef`). */
export type ScrollProgressListener = (p: {
  progress: number;
  direction: 1 | -1;
}) => void;

/** Опции `useNavbarScrubTrigger` — сцена scrub-анимации навбара на `/home`. */
export interface NavbarScrubTriggerOptions {
  bus: NavbarEventBus;
  bp: Breakpoint;
  navRef: RefObject<HTMLElement | null>;
  toggleRef: RefObject<HTMLButtonElement | null>;
  /** Set слушателей низкоуровневого канала прогресса (владеет провайдер). */
  scrollListenersRef: RefObject<Set<ScrollProgressListener>>;
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
  /** Пересборка nav-твина scrub-таймлайна при смене ручного tablet-выбора. */
  retargetScrub: () => void;
}

/**
 * useNavbarScrubTrigger — сцена scrub-анимации навбара на `/home`.
 *
 * Регистрирует ScrollTrigger на элементе-триггере страницы (спейсер), создаёт
 * scrubbed-таймлайн, ведущий навбар от `fullscreen` к `homeEndState`, обновляет
 * состояние на границах спейсера и зовёт подписчиков `scrollListenersRef`
 * напрямую (минуя bus.emit, чтобы не давить 60fps событиями в React-шину).
 *
 * Также управляет видимостью кнопки toggle на `/home` (`setToggleVisibility`)
 * и эмитит дискретные события `spacer:enter`/`spacer:leave`.
 */
export function useNavbarScrubTrigger({
  bus,
  bp,
  navRef,
  toggleRef,
  scrollListenersRef,
  state,
}: NavbarScrubTriggerOptions): NavbarScrubTriggerApi {
  const { applyState, getHomeEndState, stateRef, stateSourceRef } = state;

  /**
   * Ссылка на активный ScrollTrigger страницы (например, спейсера на /home).
   * Используется для программной прокрутки к концу спейсера при ручном скрытии навбара.
   */
  const scrollTriggerRef = useRef<ScrollTrigger | null>(null);

  /**
   * Ссылка на nav-твин scrub-таймлайна `/home`.
   *
   * GSAP оценивает function-based (и вообще) значения твина один раз при первом
   * рендере и НЕ пересчитывает их при последующем скролле. Целевое состояние
   * таймлайна зависит от `preferredRef` (slim/standard), который меняется ручным
   * toggle в любой момент жизни триггера. Поэтому при смене предпочтения nav-твин
   * пересоздаётся через `retargetScrubRef` с зафиксированным стартом `x: 0`
   * (fullscreen) и свежим целевым `x`.
   */
  const navScrubTweenRef = useRef<gsap.core.Tween | null>(null);
  const retargetScrubRef = useRef<(() => void) | null>(null);

  /**
   * Управляет видимостью кнопки toggle на `/home`.
   *
   * На `/home` кнопка нужна только когда навбар ушёл за экран (scrub-таймлайн
   * дошёл до конца спейсера) — во время анимации она скрыта, чтобы пользователь
   * не мог сломать scrub ручным кликом. Управление идёт напрямую через GSAP
   * (`autoAlpha` + `pointerEvents`), без React-рендера, из `ScrollTrigger.onUpdate`.
   */
  const setToggleVisibility = useCallback(
    (visible: boolean) => {
      if (!toggleRef.current) return;
      gsap.set(toggleRef.current, {
        autoAlpha: visible ? 1 : 0,
        pointerEvents: visible ? 'auto' : 'none',
      });
    },
    [toggleRef],
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
   * invisible → ☰).
   *
   * Возвращает cleanup, убивающий триггер и таймлайн.
   */
  const registerScrollTrigger = useCallback(
    (trigger: HTMLElement): (() => void) => {
      const isMobile = bp === 'mobile';
      // Целевое состояние в конце спейсера (progress ≈ 1) — общая логика
      // с `getHomeEndState`: mobile → invisible, tablet → ручной выбор или
      // standard, desktop → standard. preferredRef меняется ручным toggle
      // в любой момент жизни триггера, поэтому таргет читается на лету.
      const navTransform = () =>
        getNavTransform(getHomeEndState(), bp, window.innerWidth);
      const t = navTransform();

      logger.info('NavbarLayout', 'Регистрация ScrollTrigger', {
        bp,
        endState: getHomeEndState(),
        ...t,
      });

      // Стартуем наверху /home: toggle не нужен, пока навбар в fullscreen.
      // onUpdate при refresh скорректирует, если пользователь загрузился внизу.
      setToggleVisibility(false);

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
            // без прохода через bus.emit и без React-рендера.
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

            if (toggleRef.current) {
              setToggleVisibility(self.progress >= 0.9999 || manualState);
            }
          },
        },
      });

      scrollTriggerRef.current = tl.scrollTrigger ?? null;

      // Пересоздание nav-твина scrub-таймлайна. GSAP берёт значение твина один
      // раз при первом рендере, поэтому при смене `preferredRef` таргет был бы
      // устаревшим. `fromTo` с фиксированным стартом `x: 0` (fullscreen) и свежим
      // целевым `x` пересоздаётся каждый раз, когда цель меняется (см.
      // `retargetScrub` в useNavbarToggle).
      const buildNavTween = () => {
        if (!navRef.current) return;
        // Timeline.fromTo типизирован как возвращающий `this` (Timeline), хотя
        // в рантайме возвращает добавленный `Tween`; каст через `unknown`.
        navScrubTweenRef.current?.kill();
        navScrubTweenRef.current = tl.fromTo(
          navRef.current,
          { x: 0 },
          {
            x: navTransform().navX,
            ease: 'none',
            // `immediateRender: false` — иначе добавление fromTo в живой
            // scrub-таймлайн мгновенно выставляет навбар в `x: 0` (fullscreen)
            // в момент toggle, рассогласуя позицию DOM с playhead'ом ScrollTrigger.
            immediateRender: false,
          },
          0,
        ) as unknown as gsap.core.Tween;
      };

      /**
       * Пересборка nav-твина при смене ручного выбора (силами первичной
       * сборки). kill + re-add меняет `tl.duration()` (например, 0.5 → 0 →
       * 0.5), что рассогласует scroll-маппинг ScrollTrigger — он перестаёт
       * корректно вести навбар. Поэтому после пересоздания таймлайн возвращается
       * в согласованное состояние через `refresh()` (при `invalidateOnRefresh`
       * заодно перечитываются позиции и текущий playhead).
       */
      const retargetScrub = () => {
        buildNavTween();
        tl.scrollTrigger?.refresh();
      };
      retargetScrubRef.current = retargetScrub;
      buildNavTween();

      if (isMobile && t.toggleX !== null && toggleRef.current) {
        tl.to(
          toggleRef.current,
          { x: () => navTransform().toggleX ?? 0, ease: 'none' },
          0,
        );
      }

      return () => {
        tl.scrollTrigger?.kill();
        tl.kill();
        navScrubTweenRef.current = null;
        retargetScrubRef.current = null;
        scrollTriggerRef.current = null;
        // Сброс видимости toggle при уходе с /home (смена роута/breakpoint),
        // чтобы кнопка не осталось скрытой на других роутах.
        setToggleVisibility(true);
      };
    },
    [
      bp,
      navRef,
      toggleRef,
      applyState,
      bus,
      scrollListenersRef,
      setToggleVisibility,
      getHomeEndState,
      stateRef,
      stateSourceRef,
    ],
  );

  /**
   * Стабильный фасад над `retargetScrubRef`: возвращает актуальную функцию
   * пересоздания nav-твина (если триггер ещё жив). Используется `useNavbarToggle`
   * при смене ручного tablet-выбора.
   */
  const retargetScrub = useCallback(() => {
    retargetScrubRef.current?.();
  }, []);

  return {
    registerScrollTrigger,
    scrollTriggerRef,
    retargetScrub,
  };
}
