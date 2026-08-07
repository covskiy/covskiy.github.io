import type { Breakpoint } from '../../../utils/breakpoints';
import type { NavbarSource } from './navbarEventBus';

/** Возможные состояния отображения навбара. */
export type NavState = 'fullscreen' | 'standard' | 'slim' | 'invisible';

/** Ширина slim-навбара в пикселях (константа для геометрии). */
export const SLIM_WIDTH = 80;

/**
 * Является ли pathname домашней страницей (там работает scrub-спейсер).
 * Единственный источник правды для `isHome` — используется и провайдером,
 * и layout-сценой.
 */
export function isHomePath(pathname: string): boolean {
  return pathname === '/' || pathname === '/home';
}

/** Доступна ли кнопка toggle для breakpoint (скрыта только на desktop). */
export function hasToggleFor(bp: Breakpoint): boolean {
  return bp !== 'desktop';
}

/** Геометрия навбара для одного состояния (px, вычисляется на лету). */
export interface NavTransform {
  /** Сдвиг `<nav>` (окно панели). */
  navX: number;
}

/**
 * Геометрия навбара для состояния: px-значение `x` для GSAP-твинов.
 *
 * Навбар всегда занимает `100vw` в раскладке, видимая ширина достигается
 * сдвигом окна (`navX`).
 *
 * - `standard`: `navX = -0.75·vp` — окно показывает левые 25vw
 *   (обрезается `overflow: hidden` на `.nav`).
 * - `slim`: `navX = -(vp - 80)` — окно 80px у левого края.
 * - `invisible`: `navX = -vp` — окно уходит за экран.
 *
 * Кнопка toggle больше не твинится `x`: на mobile она fixed-сиблинг
 * навбара (вне трансформированного `.nav`), на tablet едет с его краем.
 */
export function getNavTransform(
  state: NavState,
  viewport: number,
): NavTransform {
  const vp = viewport;

  switch (state) {
    case 'fullscreen':
      return { navX: 0 };
    case 'standard':
      return { navX: -vp * 0.75 };
    case 'slim':
      return { navX: -(vp - SLIM_WIDTH) };
    case 'invisible':
      return { navX: -vp };
  }
}

/**
 * Отступ контентной области `<main>` для состояния (строка-единица).
 *
 * `<main>` — статичная правая колонка: `width = 100% − offset`, `margin-left = offset`.
 * Она не твинится GSAP (иначе при скролле на `/home` контент ехал бы по диагонали),
 * а получает offset через CSS-переменную `--nav-content-offset`.
 *
 * - mobile → `0` (полная ширина, контент никогда не сдвигается);
 * - `/home` tablet/desktop → `25vw` (`standard`) или `80px` (`slim`): контент
 *   сразу ориентирован на конечную ширину (состояние, в которое навбар приходит
 *   после скролла спейсера — `homeEndState`), поэтому не двигается ни на одной
 *   фазе скролла. `fullscreen` на `/home` маппится на `homeEndState`, а не на
 *   жёсткий `standard`, чтобы при ручном `slim` контент не был шире навбара
 *   всю дорогу и не расширялся в конце;
 * - `/other` → `25vw` для `standard`, `80px` для `slim`.
 */
export function getContentOffset(
  state: NavState,
  bp: Breakpoint,
  isHome: boolean,
  homeEndState?: NavState,
): string {
  if (bp === 'mobile') return '0px';

  const contentState: NavState =
    isHome && state === 'fullscreen' ? (homeEndState ?? 'standard') : state;

  switch (contentState) {
    case 'standard':
      return '25vw';
    case 'slim':
      return `${SLIM_WIDTH}px`;
    default:
      return '0px';
  }
}

/**
 * Возвращает состояние навбара по умолчанию для текущего роута и устройства.
 *
 * - `/home` → всегда `fullscreen`
 * - Другие роуты → `invisible` (mobile) / `slim` (tablet) / `standard` (desktop)
 */
export function getDefaultState(bp: Breakpoint, isHome: boolean): NavState {
  if (isHome) return 'fullscreen';
  if (bp === 'mobile') return 'invisible';
  return bp === 'tablet' ? 'slim' : 'standard';
}

/**
 * Эффективное конечное состояние навбара на `/home` (после скролла спейсера).
 *
 * На mobile — `invisible`; на tablet — ручной выбор (`slim`/`standard`), если
 * он есть, иначе `standard`; desktop — `standard`. Чистая версия логики
 * `getHomeEndState` из `useNavbarState`: используется провайдером для отступа
 * `<main>` и scrub-таймлайном как целевое состояние в конце спейсера.
 */
export function homeEndStateFor(
  bp: Breakpoint,
  preferred: NavState | null,
): NavState {
  if (bp === 'mobile') return 'invisible';
  if (bp === 'tablet' && preferred) return preferred;
  return 'standard';
}

/**
 * Признак ручного состояния на mobile (`source === 'toggle'` и состояние навбара
 * в крайних позициях). Используется в `onUpdate` ScrollTrigger: пока состояние
 * задано вручную, scrub-таймлайн «запинен» к своему крайнему положению, и скролл
 * не должен схлопывать навбар.
 */
export function isManualMobileState(
  bp: Breakpoint,
  source: NavbarSource,
  state: NavState,
): boolean {
  return (
    bp === 'mobile' &&
    source === 'toggle' &&
    (state === 'fullscreen' || state === 'invisible')
  );
}

/**
 * Валидно ли «предпочтительное» ручное состояние для breakpoint.
 *
 * Персистируем только tablet-состояния (slim/standard): на tablet есть сдвиг
 * контента (`--nav-content-offset`), из-за которого сброс состояния при смене
 * роута даёт «моргание» границы навбар/контент. На mobile отступ всегда 0,
 * на desktop toggle отсутствует — для них предпочтение не хранится.
 */
export function isPreferredStateValid(
  state: NavState | null,
  bp: Breakpoint,
): boolean {
  if (state === null) return false;
  if (bp === 'tablet') return state === 'slim' || state === 'standard';
  return false;
}

/**
 * Вычисляет следующее состояние при ручном переключении (toggle).
 *
 * - Mobile: invisible ↔ fullscreen
 * - Tablet: standard ↔ slim
 * - Desktop: всегда `null` (кнопка скрыта)
 */
export function getNextState(
  current: NavState,
  bp: Breakpoint,
): NavState | null {
  if (bp === 'desktop') return null;
  if (bp === 'mobile')
    return current === 'invisible' ? 'fullscreen' : 'invisible';
  return current === 'slim' ? 'standard' : 'slim';
}
