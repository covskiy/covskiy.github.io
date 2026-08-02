import type { Breakpoint } from '../../utils/breakpoints';

/** Возможные состояния отображения навбара. */
export type NavState = 'fullscreen' | 'standard' | 'slim' | 'invisible';

/** Ширина slim-навбара в пикселях (константа для геометрии). */
export const SLIM_WIDTH = 80;

/** Геометрия навбара для одного состояния (px, вычисляется на лету). */
export interface NavTransform {
  /** Сдвиг `<nav>` (окно панели). */
  navX: number;
  /** Сдвиг `.navInner` — контр-сдвиг контента относительно окна. */
  innerX: number;
  /**
   * Сдвиг кнопки toggle. `null` — кнопка не твинится напрямую
   * (tablet/desktop: едет вместе с навбаром как его дочерний элемент).
   */
  toggleX: number | null;
}

/**
 * Геометрия навбара для состояния: px-значения `x` для GSAP-твинов.
 *
 * Навбар всегда занимает `100vw` в раскладке, видимая ширина достигается
 * сдвигом окна (`navX`), контент `.navInner` компенсируется `innerX`
 * (counter-translate), чтобы оставаться привязанным к левому краю экрана.
 *
 * - `standard`: `navX = -0.75·vp`, `innerX = +0.75·vp` — контент экран-закреплён,
 *   окно показывает левые 25vw (обрезается `overflow: hidden` на `.nav`).
 * - `slim`: `innerX = vp/2 - 40` — иконки, центрированные на 50vw в 100vw-раскладке,
 *   попадают в центр окна 80px.
 * - mobile `invisible`: `innerX = 0` (слайд без контр-сдвига), потому что `.nav`
 *   имеет `overflow: visible` ради кнопки toggle — контент уезжает вместе с окном,
 *   а toggle компенсируется `toggleX`.
 */
export function getNavTransform(
  state: NavState,
  bp: Breakpoint,
  viewport: number,
): NavTransform {
  const vp = viewport;

  switch (state) {
    case 'fullscreen':
      return {
        navX: 0,
        innerX: 0,
        toggleX: bp === 'mobile' ? 0 : null,
      };
    case 'standard':
      return {
        navX: -vp * 0.75,
        innerX: vp * 0.75,
        toggleX: null,
      };
    case 'slim':
      return {
        navX: -(vp - SLIM_WIDTH),
        innerX: vp / 2 - SLIM_WIDTH / 2,
        toggleX: null,
      };
    case 'invisible':
      return { navX: -vp, innerX: 0, toggleX: vp };
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
 * - `/home` tablet/desktop → `25vw`, кроме `slim` → `80px`: контент сразу
 *   ориентирован на конечную ширину (после скролла спейсера навбар = `standard`),
 *   поэтому не двигается ни на одной фазе скролла;
 * - `/other` → `25vw` для `standard`, `80px` для `slim`.
 */
export function getContentOffset(
  state: NavState,
  bp: Breakpoint,
  isHome: boolean,
): string {
  if (bp === 'mobile') return '0px';

  const contentState: NavState =
    isHome && state === 'fullscreen' ? 'standard' : state;

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
