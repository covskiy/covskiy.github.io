/**
 * Чистый слой layout-машины — без React, GSAP и Context.
 *
 * `layoutMode.ts` описывает сам тип состояния раскладки и источник его
 * изменения. Источник используется, чтобы отличить автоматическое
 * переключение (скролл, смена роута/breakpoint) от ручного (toggle) —
 * в первую очередь для владельца позиции `.nav` (`scenes/useNavPosition`),
 * который ведёт scrub только по `source === 'scroll'`, а дискретную
 * анимацию запускает для остальных источников.
 */

/** Возможные состояния раскладки. */
export type LayoutMode = 'fullscreen' | 'standard' | 'slim' | 'invisible';

/**
 * Источник изменения состояния раскладки.
 *
 * - `scroll`     — ScrollTrigger на спейсере страницы достиг границы
 *                  (progress 0 / 1);
 * - `toggle`     — клик по кнопке toggle (☰ / ←);
 * - `route`      — смена pathname через react-router;
 * - `breakpoint` — смена breakpoint (mobile / tablet / desktop).
 */
export type LayoutChangeSource = 'toggle' | 'route' | 'breakpoint' | 'scroll';
