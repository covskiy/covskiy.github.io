import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from 'react';
import { useLocation } from 'react-router';
import gsap from 'gsap';
import type { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { useBreakpoint } from '../../utils/breakpoints';
import { logger } from '../../utils/logger';
import type { NavbarEventBus, NavbarSource } from './navbarEventBus';
import {
  getDefaultState,
  getNavTransform,
  getNextState,
  type NavState,
} from './navbarStates';

/** Рефы на корневые DOM-ноды навбара, которыми владеет провайдер. */
export interface NavbarLayoutRefs {
  navRef: RefObject<HTMLElement | null>;
  toggleRef: RefObject<HTMLButtonElement | null>;
}

/**
 * Публичный API layout-сцены — возвращается из `useNavbarLayout`.
 *
 * - `currentState` — синхронный React-state для проброса `isSlim` в NavigationBar
 *   (рендер зависит от него). Обновляется из подписки на `state:change`,
 *   которую публикует `applyState`, — единый конвейер для всех источников.
 * - `applyState(next, source)` — единственная точка изменения состояния.
 *   Публикует `state:change` в шину, чтобы дочерние сцены узнали о смене.
 * - `registerScrollTrigger(trigger)` — фасад для страниц: создаёт scrub-таймлайн
 *   и публикует прогресс через низкоуровневый канал (см. `scrollListenersRef`).
 * - `scrollListenersRef` — Set, через который `ScrollTrigger.onUpdate` зовёт
 *   подписчиков напрямую (без bus.emit и без React-рендера).
 * - `handleToggle()` — клик по кнопке toggle (☰ / ←). Использует
 *   `getNextState(current, bp)` для вычисления следующего состояния.
 */
export interface NavbarLayout {
  currentState: NavState;
  applyState: (next: NavState, source: NavbarSource) => NavState;
  registerScrollTrigger: (trigger: HTMLElement) => () => void;
  scrollListenersRef: RefObject<
    Set<(p: { progress: number; direction: 1 | -1 }) => void>
  >;
  handleToggle: () => void;
}

/**
 * useNavbarLayout — корневая сцена раскладки навбара.
 *
 * Единственная сцена, которая знает о геометрии раскладки навбара
 * (видимая ширина, позиция toggle на mobile). Владеет рефами корневых
 * DOM-нод (`<nav>`, кнопка toggle) и подписывается на шину событий:
 *
 * - `'state:change'` → animateNavbar: прямые `gsap.to()` на nav/toggle.
 *   На шаге 1 layout-сцена сама себе подписчик: она публикует событие в bus,
 *   а затем сама на него реагирует — это даёт единый путь для всех источников
 *   (toggle, route, breakpoint, scroll). Внешние подписчики (NavItem и т. д.)
 *   фильтруют события по `source` при необходимости.
 * - `'route:change'` / `'breakpoint:change'` → целевое состояние пересчитывается
 *   через `getDefaultState(bp, isHome)`, layout реагирует на новое currentState.
 * - `'scroll:progress'` (через низкоуровневый канал) → scrub-таймлайн, ведущий
 *   к границам спейсера страницы (см. `registerScrollTrigger`).
 *
 * Дочерние сцены (NavItem, логотип и т. д.) НЕ подписаны на layout —
 * они реагируют только на дискретные `state:change` (или `scroll:progress`,
 * если им нужна scrub-привязка через `useNavbarScrollProgress`).
 */
export function useNavbarLayout(
  bus: NavbarEventBus,
  refs: NavbarLayoutRefs,
  options: { scrollListenersRef: NavbarLayout['scrollListenersRef'] },
): NavbarLayout {
  const location = useLocation();
  const bp = useBreakpoint();
  const { navRef, toggleRef } = refs;
  const { scrollListenersRef } = options;

  const stateRef = useRef<NavState>('fullscreen');
  const [currentState, setCurrentState] = useState<NavState>('fullscreen');

  /**
   * Последний источник, записавший состояние. Позволяет отличить ручное
   * состояние (toggle) от скроллового: пока состояние задано вручную на
   * mobile, scrub-таймлайн «запинен» к своему крайнему положению, и скролл
   * не двигает навбар, пока не будет достигнут верх страницы.
   */
  const stateSourceRef = useRef<NavbarSource>('route');

  const isHome = location.pathname === '/' || location.pathname === '/home';
  const hasToggle = bp !== 'desktop';

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
   * Прямая GSAP-анимация трансформаций навбара и синхронизация React-state —
   * реакция на `state:change`.
   *
   * Твинит `x` на `nav` (и toggle на mobile) — всё на композиторе, без
   * изменения раскладки. Отступ контента `<main>` не трогаем: он задаётся
   * статично через `--nav-content-offset`.
   *
   * Твины создаются через `contextSafe` и регистрируются в контексте
   * `useGSAP`, поэтому при размонтировании или смене зависимостей они
   * автоматически убиваются (`revertOnUpdate`) — без «висящих» твинов
   * на отмонтированных нодах. Подписка на bus отписывается через
   * cleanup-функцию, возвращаемую из callback-а.
   *
   * Подписка на собственный bus нужна, чтобы единый путь «publish → react»
   * работал для всех источников. Если событие вылетело из нашего же
   * `applyState`, мы реагируем — это аналог `dispatch` → listener.
   */
  useGSAP(
    (_ctx, contextSafe) => {
      // В callback-форме useGSAP всегда передаёт contextSafe; тип помечает
      // его optional из-за config-only оверлоада.
      const animateNavbar = contextSafe!(
        (state: NavState, source: NavbarSource) => {
          // При source === 'scroll' позиции уже задаёт scrub-таймлайн:
          // отдельный tween с overwrite:'auto' убил бы его активные твины
          // на тех же таргетах (scrub-твин погибает на первом рендере
          // нового твина), и скролл перестал бы двигать навбар. Поэтому
          // скролл-источник здесь НЕ анимируется.
          if (source === 'scroll') return;

          const isMobile = bp === 'mobile';
          const t = getNavTransform(state, bp, window.innerWidth);

          logger.trace(
            'NavbarLayout',
            `animate → ${state} (source=${source})`,
            { isMobile, ...t },
          );

          if (navRef.current) {
            gsap.to(navRef.current, {
              x: t.navX,
              duration: 0.6,
              ease: 'power2.inOut',
              overwrite: 'auto',
            });
          }

          if (isMobile && t.toggleX !== null && toggleRef.current) {
            gsap.to(toggleRef.current, {
              x: t.toggleX,
              duration: 0.6,
              ease: 'power2.inOut',
              overwrite: 'auto',
            });
          }
        },
      );

      return bus.on('state:change', ({ state, prev, source }) => {
        if (state === prev) return;
        // React-state синхронизируется здесь (в колбэке подписчика), а не
        // синхронно в эффекте — это и есть реактивный мост для `isSlim`/
        // `contentOffset` в провайдере.
        setCurrentState(state);
        animateNavbar(state, source);
      });
    },
    {
      dependencies: [bus, bp, navRef, toggleRef],
      revertOnUpdate: true,
    },
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
      const endState: NavState = isMobile ? 'invisible' : 'standard';
      const navTransform = () =>
        getNavTransform(endState, bp, window.innerWidth);
      const t = navTransform();

      logger.info('NavbarLayout', 'Регистрация ScrollTrigger', {
        bp,
        endState,
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
            const isMobilePin =
              isMobile &&
              stateSourceRef.current === 'toggle' &&
              (stateRef.current === 'fullscreen' ||
                stateRef.current === 'invisible');

            if (self.progress <= 0.0001) {
              logger.info(
                'NavbarLayout',
                'Скролл к началу — принудительный fullscreen',
              );
              applyState('fullscreen', 'scroll');
            } else if (self.progress >= 0.9999 && !isMobilePin) {
              logger.debug(
                'NavbarLayout',
                `Скролл к концу спейсера → ${endState}`,
              );
              applyState(endState, 'scroll');
            }

            if (isMobilePin) {
              self.animation?.progress(
                stateRef.current === 'fullscreen' ? 0 : 1,
                true,
              );
            }

            // Видимость toggle: скрыт наверху и во время scrub, виден когда
            // навбар ушёл за экран (progress ≈ 1) или пока состояние задано
            // вручную (ручной fullscreen → ←, ручной invisible → ☰).
            const manualState =
              isMobile &&
              stateSourceRef.current === 'toggle' &&
              (stateRef.current === 'fullscreen' ||
                stateRef.current === 'invisible');

            if (toggleRef.current) {
              setToggleVisibility(self.progress >= 0.9999 || manualState);
            }
          },
        },
      });

      if (navRef.current) {
        tl.to(
          navRef.current,
          { x: () => navTransform().navX, ease: 'none' },
          0,
        );
      }

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
        // Сброс видимости toggle при уходе с /home (смена роута/breakpoint),
        // чтобы кнопка не осталась скрытой на других роутах.
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
    ],
  );

  /**
   * Реакция на смену роута или breakpoint.
   *
   * Пересчитывает целевое состояние через `getDefaultState` и публикует
   * `state:change` через `applyState`. Layout-анимация (animateNavbar)
   * срабатывает на опубликованном событии через подписку bus.on выше.
   */
  useEffect(() => {
    const target = getDefaultState(bp, isHome);
    const prev = applyState(target, isHome ? 'route' : 'breakpoint');

    if (prev !== target) {
      logger.info(
        'NavbarLayout',
        `Смена роута "${location.pathname}" (${bp}): ${prev} → ${target}`,
      );
    }
  }, [location.pathname, bp, isHome, applyState]);

  /** Ручное переключение: клик по ☰ / ←. */
  const handleToggle = useCallback(() => {
    if (!hasToggle) {
      logger.warn(
        'NavbarLayout',
        'Toggle вызван на desktop — кнопка скрыта, игнорируем',
      );
      return;
    }

    const next = getNextState(stateRef.current, bp);
    if (!next) {
      logger.warn(
        'NavbarLayout',
        `getNextState вернул null при current=${stateRef.current}, bp=${bp}`,
      );
      return;
    }

    const prev = applyState(next, 'toggle');
    logger.info('NavbarLayout', `Toggle: ${prev} → ${next} (${bp})`);
  }, [bp, hasToggle, applyState]);

  return {
    currentState,
    applyState,
    registerScrollTrigger,
    scrollListenersRef,
    handleToggle,
  };
}
