import { useCallback, useEffect, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { routes } from '../../routes';
import { useBreakpoint } from '../../utils/breakpoints';
import { logger } from '../../utils/logger';
import styles from './NavigationBar.module.css';

/** Возможные состояния отображения навбара. */
type NavState = 'fullscreen' | 'standard' | 'slim';

/**
 * Имя кастомного события, которое HomePage кидает из ScrollTrigger
 * для синхронизации состояния навбара при авто-скролле.
 *
 * @see {@link import('../../pages/HomePage/HomePage').default}
 */
const STATE_EVENT = 'navbar:setstate';

const navItems = routes
  .filter((r) => r.path !== '*')
  .map(({ path, label }) => ({ path, label: label! }));

/**
 * Возвращает состояние навбара по умолчанию для текущего роута и устройства.
 *
 * - `/home` → всегда `fullscreen`
 * - Другие роуты → `slim` (mobile) или `standard` (tablet/desktop)
 */
function getDefaultState(
  bp: ReturnType<typeof useBreakpoint>,
  isHome: boolean,
): NavState {
  if (isHome) return 'fullscreen';
  return bp === 'mobile' ? 'slim' : 'standard';
}

/**
 * Вычисляет следующее состояние при ручном переключении (toggle).
 *
 * - Mobile: slim ↔ fullscreen
 * - Tablet: standard ↔ slim
 * - Desktop: всегда `null` (кнопка скрыта)
 */
function getNextState(
  current: NavState,
  bp: ReturnType<typeof useBreakpoint>,
): NavState | null {
  if (bp === 'desktop') return null;
  if (bp === 'mobile') return current === 'slim' ? 'fullscreen' : 'slim';
  return current === 'slim' ? 'standard' : 'slim';
}

/** Маппинг состояния → ширина навбара. */
function getWidth(state: NavState): string {
  if (state === 'fullscreen') return '100vw';
  if (state === 'standard') return '25vw';
  return '80px';
}

/** Маппинг состояния → отступ контента (только tablet/desktop). */
function getContentMargin(state: NavState): string {
  if (state === 'fullscreen') return '0px';
  if (state === 'standard') return '25vw';
  return '80px';
}

/**
 * Прямая GSAP-анимация ширины навбара и отступа контента.
 *
 * На mobile отступ контента не трогаем — он принудительно `0` через CSS.
 * Все твины используют `overwrite: 'auto'` для корректной обработки
 * конфликтов с ScrollTrigger из HomePage.
 */
function animateNavbar(state: NavState) {
  const isMobile = window.innerWidth < 768;

  logger.trace('NavigationBar', `animateNavbar → ${state}`, {
    width: getWidth(state),
    isMobile,
  });

  gsap.to('[data-navbar]', {
    width: getWidth(state),
    duration: 0.6,
    ease: 'power2.inOut',
    overwrite: 'auto',
  });

  if (!isMobile) {
    gsap.to('[data-content]', {
      marginLeft: getContentMargin(state),
      duration: 0.6,
      ease: 'power2.inOut',
      overwrite: 'auto',
    });
  }
}

/**
 * NavigationBar — многофункциональная навигационная панель.
 *
 * ## Состояния
 *
 * | Состояние    | Ширина    | Где используется                |
 * |--------------|-----------|---------------------------------|
 * | `fullscreen` | 100vw     | `/home` в начале страницы       |
 * | `standard`   | 25vw      | tablet/desktop после скролла    |
 * | `slim`       | 80px      | mobile по умолчанию, tablet при toggle |
 *
 * ## Управление
 * - **Автоматическое** — ScrollTrigger в HomePage меняет ширину при скролле.
 * - **Ручное** — кнопка toggle (☰ / ←) для mobile и tablet.
 * - **Приоритет**: автоскролл > ручное переключение.
 *   ScrollTrigger принудительно разворачивает в fullscreen при скролле к началу.
 */
function NavigationBar() {
  const location = useLocation();
  const bp = useBreakpoint();
  const stateRef = useRef<NavState>('fullscreen');
  const [currentState, setCurrentState] = useState<NavState>('fullscreen');

  const isHome = location.pathname === '/' || location.pathname === '/home';
  const hasToggle = bp !== 'desktop';

  /**
   * Слушает кастомные события от ScrollTrigger в HomePage.
   *
   * Срабатывает при:
   * - Скролле к началу страницы (progress = 0) → принудительный fullscreen
   * - Скролле к концу спейсера (progress = 1) → slim / standard
   *
   * Затем вызывает animateNavbar для плавного перехода, так как
   * ScrollTrigger к этому моменту мог быть убит ручным toggle.
   */
  useEffect(() => {
    const handler = (e: CustomEvent<NavState>) => {
      const newState = e.detail;
      const prev = stateRef.current;
      stateRef.current = newState;
      setCurrentState(newState);

      logger.debug(
        'NavigationBar',
        `Событие "${STATE_EVENT}": ${prev} → ${newState}`,
      );
      animateNavbar(newState);
    };
    window.addEventListener(STATE_EVENT, handler as EventListener);
    return () =>
      window.removeEventListener(STATE_EVENT, handler as EventListener);
  }, []);

  /**
   * Реакция на смену роута или breakpoint.
   *
   * Пересчитывает целевое состояние и запускает анимацию.
   * При переходе на `/home` всегда сбрасывает в fullscreen.
   */
  useGSAP(
    () => {
      const target = getDefaultState(bp, isHome);
      const prev = stateRef.current;
      stateRef.current = target;
      setCurrentState(target);

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

    const prev = stateRef.current;
    stateRef.current = next;
    setCurrentState(next);

    logger.info('NavigationBar', `Toggle: ${prev} → ${next} (${bp})`);
    animateNavbar(next);
  }, [bp, hasToggle]);

  return (
    <nav className={styles.nav} data-navbar>
      <div className={styles.navInner}>
        <div className={styles.logo}>✦ Portfolio</div>
        <ul className={styles.list}>
          {navItems.map(({ path, label }) => (
            <li key={path} className={styles.item}>
              <NavLink
                to={path}
                className={({ isActive }) =>
                  isActive ? `${styles.link} ${styles.active}` : styles.link
                }
                tabIndex={currentState === 'slim' ? -1 : 0}
              >
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </div>

      {hasToggle && (
        <button
          className={styles.toggleBtn}
          onClick={handleToggle}
          aria-label={
            currentState === 'slim' ? 'Open navigation' : 'Close navigation'
          }
          type="button"
        >
          {currentState === 'slim' ? '☰' : '←'}
        </button>
      )}
    </nav>
  );
}

export default NavigationBar;
