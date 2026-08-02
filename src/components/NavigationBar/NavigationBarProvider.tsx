import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router';
import gsap from 'gsap';
import type { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { useBreakpoint } from '../../utils/breakpoints';
import { logger } from '../../utils/logger';
import { NavigationBar } from './NavigationBar';
import { NavbarContext, type NavbarAPI } from './navbarContext';
import {
  getContentOffset,
  getDefaultState,
  getNavTransform,
  getNextState,
  type NavState,
} from './navbarStates';
import styles from './NavigationBarProvider.module.css';

/**
 * NavigationBarProvider — владелец анимации навбара.
 *
 * Полностью инкапсулирует DOM-ноды (`<nav data-navbar>`, `.navInner`,
 * `<main data-content>`) и знает, как их анимировать, но не знает, когда.
 * Контроль над запуском делегируется страницам через Context: страница
 * вызывает `registerScrollTrigger` со своим элементом-триггером, а провайдер
 * на лету создаёт ScrollTrigger, привязанный к собственному таймлайну.
 *
 * ## Анимация через transforms
 * Навбар всегда занимает `100vw` в раскладке; видимая ширина достигается
 * трансформациями, а не `width`, чтобы ScrollTrigger-scrub не вызывал
 * reflow при каждом обновлении (до 60 раз в секунду):
 * - `nav.x` — сдвиг окна панели влево;
 * - `navInner.x` — контр-сдвиг контента (остаётся привязан к левому краю);
 * - `toggle.x` — компенсация кнопки на mobile (`.nav` там `overflow: visible`).
 *
 * Контентная область `<main data-content>` НЕ твинится: она — статичная
 * правая колонка, отступ задаётся CSS-переменной `--nav-content-offset`
 * (см. `getContentOffset`). Это исключает диагональное движение контента
 * при скролле на `/home`.
 *
 * ## Поведение
 * - **Автоматическое** — ScrollTrigger, зарегистрированный страницей,
 *   меняет ширину при скролле (scrub).
 * - **Ручное** — кнопка toggle (☰ / ←) для mobile и tablet.
 * - **Приоритет**: автоскролл > ручное переключение. При скролле к началу
 *   ScrollTrigger принудительно разворачивает в fullscreen.
 * - **Жизненный цикл** — за создание и уничтожение триггера отвечает страница
 *   (cleanup, возвращённый из `registerScrollTrigger`).
 *
 * Презентационные значения (`isSlim`, `hasToggle`, `handleToggle`) прокидываются
 * пропсами в `NavigationBar` — через контекст они страницам не нужны.
 */
export function NavigationBarProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const bp = useBreakpoint();
  const navRef = useRef<HTMLElement>(null);
  const navInnerRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const stateRef = useRef<NavState>('fullscreen');
  const [currentState, setCurrentState] = useState<NavState>('fullscreen');

  const isHome = location.pathname === '/' || location.pathname === '/home';
  const hasToggle = bp !== 'desktop';

  /**
   * Применяет состояние: обновляет ref и React State.
   * Возвращает предыдущее состояние (для логов и сравнений).
   */
  const applyState = useCallback((next: NavState): NavState => {
    const prev = stateRef.current;
    if (prev === next) return prev;
    stateRef.current = next;
    setCurrentState(next);
    return prev;
  }, []);

  /**
   * Прямая GSAP-анимация трансформаций навбара.
   *
   * Твинит `x` на `nav` и `.navInner` (и toggle на mobile) — всё на
   * композиторе, без изменения раскладки. Отступ контента `<main>` не
   * трогаем: он задаётся статично через `--nav-content-offset`.
   * Все твины используют `overwrite: 'auto'` для корректной обработки
   * конфликтов с ScrollTrigger.
   */
  const animateNavbar = useCallback(
    (state: NavState) => {
      const isMobile = bp === 'mobile';
      const t = getNavTransform(state, bp, window.innerWidth);

      logger.trace('NavigationBar', `animateNavbar → ${state}`, {
        isMobile,
        ...t,
      });

      if (navRef.current) {
        gsap.to(navRef.current, {
          x: t.navX,
          duration: 0.6,
          ease: 'power2.inOut',
          overwrite: 'auto',
        });
      }

      if (navInnerRef.current) {
        gsap.to(navInnerRef.current, {
          x: t.innerX,
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
    [bp],
  );

  /**
   * Регистрирует ScrollTrigger на элементе-триггере страницы.
   *
   * Создаёт таймлайн с scrub, привязанный к `trigger`, и сам обновляет
   * React-состояние навбара на границах спейсера:
   * - `progress === 0` → fullscreen (приоритет автоскролла над ручным toggle)
   * - `progress >= 1` → endState (invisible на mobile / standard на tablet/desktop)
   *
   * Таймлайн твинит только композитные трансформации (`x`), поэтому scrub
   * не вызывает reflow на каждом кадре. Возвращает cleanup, убивающий триггер
   * и таймлайн — вызывающая сторона вызывает его при размонтировании.
   */
  const registerScrollTrigger = useCallback(
    (trigger: HTMLElement): (() => void) => {
      const isMobile = bp === 'mobile';
      const endState: NavState = isMobile ? 'invisible' : 'standard';
      const t = getNavTransform(endState, bp, window.innerWidth);

      logger.info('NavigationBar', 'Регистрация ScrollTrigger', {
        bp,
        endState,
        ...t,
      });

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger,
          start: 'top top',
          end: 'bottom top',
          scrub: true,
          invalidateOnRefresh: true,
          onUpdate: (self: ScrollTrigger) => {
            logger.trace(
              'NavigationBar',
              `ScrollTrigger.onUpdate progress=${self.progress.toFixed(4)}, direction=${self.direction}`,
            );

            if (self.progress === 0) {
              logger.info(
                'NavigationBar',
                'Скролл к началу — принудительный fullscreen',
              );
              applyState('fullscreen');
            } else if (self.progress >= 1) {
              logger.debug(
                'NavigationBar',
                `Скролл к концу спейсера → ${endState}`,
              );
              applyState(endState);
            }
          },
        },
      });

      if (navRef.current) {
        tl.to(navRef.current, { x: t.navX, ease: 'none' }, 0);
      }

      if (navInnerRef.current) {
        tl.to(navInnerRef.current, { x: t.innerX, ease: 'none' }, 0);
      }

      if (isMobile && t.toggleX !== null && toggleRef.current) {
        tl.to(toggleRef.current, { x: t.toggleX, ease: 'none' }, 0);
      }

      return () => {
        tl.scrollTrigger?.kill();
        tl.kill();
      };
    },
    [bp, applyState],
  );

  /**
   * Реакция на смену роута или breakpoint.
   *
   * Пересчитывает целевое состояние и запускает анимацию.
   * При переходе на `/home` всегда сбрасывает в fullscreen.
   */
  useGSAP(
    () => {
      const target = getDefaultState(bp, isHome);
      const prev = applyState(target);

      if (prev !== target) {
        logger.info(
          'NavigationBar',
          `Смена роута "${location.pathname}" (${bp}): ${prev} → ${target}`,
        );
      }

      animateNavbar(target);
    },
    { dependencies: [location.pathname, bp] },
  );

  /** Ручное переключение: клик по ☰ / ←. */
  const handleToggle = useCallback(() => {
    if (!hasToggle) {
      logger.warn(
        'NavigationBar',
        'Toggle вызван на desktop — кнопка скрыта, игнорируем',
      );
      return;
    }

    const next = getNextState(stateRef.current, bp);
    if (!next) {
      logger.warn(
        'NavigationBar',
        `getNextState вернул null при current=${stateRef.current}, bp=${bp}`,
      );
      return;
    }

    const prev = applyState(next);
    logger.info('NavigationBar', `Toggle: ${prev} → ${next} (${bp})`);
    animateNavbar(next);
  }, [bp, hasToggle, applyState, animateNavbar]);

  const isSlim = currentState === 'slim' || currentState === 'invisible';
  const contentOffset = getContentOffset(currentState, bp, isHome);

  const api = useMemo<NavbarAPI>(
    () => ({ registerScrollTrigger }),
    [registerScrollTrigger],
  );

  return (
    <NavbarContext.Provider value={api}>
      <div
        className={styles.app}
        style={{ '--nav-content-offset': contentOffset } as React.CSSProperties}
      >
        <NavigationBar
          navRef={navRef}
          navInnerRef={navInnerRef}
          toggleRef={toggleRef}
          isSlim={isSlim}
          hasToggle={hasToggle}
          handleToggle={handleToggle}
        />
        <main className={styles.main} data-content>
          {children}
        </main>
      </div>
    </NavbarContext.Provider>
  );
}
