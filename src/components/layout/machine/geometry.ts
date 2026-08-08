import type { Breakpoint } from '../../../utils/breakpoints';
import type { LayoutMode } from './layoutMode';

/** Ширина slim-навбара в пикселях (константа для геометрии). */
export const SLIM_WIDTH = 80;

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
  state: LayoutMode,
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
export function deriveMainOffset(
  mode: LayoutMode,
  bp: Breakpoint,
  isHome: boolean,
  homeEndState?: LayoutMode,
): string {
  if (bp === 'mobile') return '0px';

  const contentMode: LayoutMode =
    isHome && mode === 'fullscreen' ? (homeEndState ?? 'standard') : mode;

  switch (contentMode) {
    case 'standard':
      return '25vw';
    case 'slim':
      return `${SLIM_WIDTH}px`;
    default:
      return '0px';
  }
}
