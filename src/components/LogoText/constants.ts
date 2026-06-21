/**
 * Общие константы LogoText: viewBox, границы букв, идентификаторы.
 * Единый источник истины для LogoText.tsx, useSparkCanvas.ts, timelines.ts, sparks.ts.
 */

/** viewBox LogoText.svg — для пересчёта Path2D (в SVG-юнитах) → CSS-пиксели канваса. */
export const SVG_VIEW_W = 200;
export const SVG_VIEW_H = 150;

/**
 * Bounding box букв в координатах viewBox (для cull-отсечки искр в sparks.ts).
 * X: 18..186, Y: 94..140 — зона, где буквы видны на канвасе.
 */
export const LETTER_BOUNDS = {
  xMin: 18,
  xMax: 186,
  yMin: 94,
  yMax: 140,
} as const;

/** Все буквы слова COVSKIY (порядок = порядок в слове). */
export const LETTER_IDS = ['C', 'O', 'V', 'S', 'K', 'I', 'Y'] as const;
export type LetterId = (typeof LETTER_IDS)[number];

/** Буквы после C — обрабатываются единообразно (phaseDash + phaseLetter). */
export const OVSKIY_IDS = ['O', 'V', 'S', 'K', 'I', 'Y'] as const;
export type OvskiyId = (typeof OVSKIY_IDS)[number];

/** CSS-селектор элемента буквы в SVG: C → .img-c, O → .img-o, ... */
export const selectorFor = (id: LetterId): string => `.img-${id.toLowerCase()}`;

/** id SVG-<path> финального контура буквы (без #): C → morphPath-C. */
export const pathIdFor = (id: LetterId): string => `morphPath-${id}`;

/** GSAP/morphSVG-селектор финального контура (с #): C → #morphPath-C. */
export const morphSelectorFor = (id: LetterId): string => `#${pathIdFor(id)}`;
