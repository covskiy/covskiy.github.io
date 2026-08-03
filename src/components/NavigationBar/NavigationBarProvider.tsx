import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useLocation } from 'react-router';
import { useBreakpoint } from '../../utils/breakpoints';
import { NavigationBar } from './NavigationBar';
import { NavbarContext, type NavbarAPI } from './navbarContext';
import { createNavbarEventBus } from './navbarEventBus';
import { useNavbarLayout } from './useNavbarLayout';
import { getContentOffset } from './navbarStates';
import styles from './NavigationBarProvider.module.css';

/**
 * NavigationBarProvider — диспетчер сцен навбара.
 *
 * Сам не владеет анимациями: создаёт шину событий (`createNavbarEventBus`),
 * держит рефы корневых DOM-нод (`<nav>`, кнопка toggle) и
 * подключает корневую сцену раскладки `useNavbarLayout`, которая
 * единственная знает о геометрии навбара (видимая ширина, позиция toggle
 * на mobile).
 *
 * Дочерние сцены (NavItem, логотип, будущие расширения) подписываются
 * на шину через `useNavbarEvent` / `useNavbarScrollProgress` и сами
 * анимируют свои DOM-ноды, не уведомляя провайдер.
 *
 * Контракт со страницами сохраняется: `registerScrollTrigger(trigger)`
 * (фасад над layout-сценой) — единственная публичная точка для
 * подключения ScrollTrigger.
 *
 * Слои API:
 * - `registerScrollTrigger` — для страниц (контракт);
 * - `getState` — синхронный snapshot текущего состояния;
 * - `events` — типизированная шина для дискретных событий;
 * - `onScrollProgress` — низкоуровневый канал для 60fps scrub-подписчиков.
 */
export function NavigationBarProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const bp = useBreakpoint();
  const navRef = useRef<HTMLElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  /**
   * Set слушателей низкоуровневого канала прогресса скролла. Хранится
   * в ref, потому что listener-ы добавляются/удаляются в 60fps-сценариях
   * без ререндера. Провайдер передаёт ref в layout-сцену, layout-сцена
   * дёргает listener-ов напрямую из ScrollTrigger.onUpdate.
   */
  const scrollListenersRef = useRef<
    Set<(p: { progress: number; direction: 1 | -1 }) => void>
  >(new Set());

  /**
   * Scoped шина событий — переживает ререндеры (useMemo с пустым deps).
   * Если в будущем потребуется интеграция с IntroAnimation через
   * singleton — переход на module-level instance без изменения
   * потребителей (они получают `events` через context).
   */
  const bus = useMemo(() => createNavbarEventBus(), []);

  /**
   * Корневая сцена раскладки. Публикует `state:change`, реагирует на
   * него сама (animateNavbar), регистрирует ScrollTrigger и зовёт
   * подписчиков `scrollListenersRef` напрямую.
   */
  const layout = useNavbarLayout(
    bus,
    { navRef, toggleRef },
    { scrollListenersRef },
  );

  const { currentState, registerScrollTrigger, handleToggle } = layout;

  const isHome = location.pathname === '/' || location.pathname === '/home';
  const hasToggle = bp !== 'desktop';

  /**
   * Публикация смены роута в шину. Дочерние сцены, зависящие от pathname
   * (например, бегущая подсветка активной ссылки), подписываются на
   * `'route:change'` и обновляются БЕЗ перерендера провайдера.
   *
   * Ref на prev нужен, чтобы payload содержал корректное предыдущее
   * значение, а не литерал — иначе подписчики не смогут отличить
   * «реальную смену» от первого рендера.
   */
  const pathnameRef = useRef(location.pathname);
  useEffect(() => {
    const prev = pathnameRef.current;
    if (prev === location.pathname) return;
    pathnameRef.current = location.pathname;
    bus.emit('route:change', { pathname: location.pathname, prev });
  }, [bus, location.pathname]);

  /**
   * Публикация смены breakpoint в шину. Аналогично route:change —
   * помогает сценам, которым нужен именно bp (например, переключение
   * внутренней геометрии иконок на mobile vs tablet).
   */
  const bpRef = useRef(bp);
  useEffect(() => {
    const prev = bpRef.current;
    if (prev === bp) return;
    bpRef.current = bp;
    bus.emit('breakpoint:change', { bp, prev });
  }, [bp, bus]);

  /**
   * Cleanup низкоуровневого канала при размонтировании провайдера
   * (на практике — никогда, App.tsx не размонтирует NavigationBarProvider,
   * но страховка от утечек в HMR/StrictMode).
   */
  useEffect(() => {
    const listeners = scrollListenersRef.current;
    return () => {
      listeners.clear();
    };
  }, []);

  /**
   * Прокидывание API в context. Мемоизация по `layout` — `layout`
   * пересоздаётся при изменении зависимостей внутри `useNavbarLayout`,
   * но не на каждый ререндер провайдера.
   */
  const api = useMemo<NavbarAPI>(
    () => ({
      registerScrollTrigger,
      getState: () => layout.currentState,
      events: bus,
      onScrollProgress: (listener) => {
        scrollListenersRef.current.add(listener);
        return () => {
          scrollListenersRef.current.delete(listener);
        };
      },
    }),
    [registerScrollTrigger, bus, layout],
  );

  const isSlim = currentState === 'slim' || currentState === 'invisible';
  const contentOffset = getContentOffset(currentState, bp, isHome);

  return (
    <NavbarContext.Provider value={api}>
      <div
        className={styles.app}
        style={{ '--nav-content-offset': contentOffset } as React.CSSProperties}
      >
        <NavigationBar
          navRef={navRef}
          toggleRef={toggleRef}
          isSlim={isSlim}
          hasToggle={hasToggle}
          handleToggle={handleToggle}
        />
        <main className={styles.main}>{children}</main>
      </div>
    </NavbarContext.Provider>
  );
}
