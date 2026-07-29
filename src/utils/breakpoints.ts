import { useEffect, useRef, useState } from 'react';
import { logger } from './logger';

/**
 * Пороговые значения ширины вьюпорта для переключения между типами устройств.
 *
 * - `< 768` → `mobile`
 * - `768–1023` → `tablet`
 * - `>= 1024` → `desktop`
 */
export const BREAKPOINTS = {
  tablet: 768,
  desktop: 1024,
} as const;

/** Тип устройства на основе ширины вьюпорта. */
export type Breakpoint = 'mobile' | 'tablet' | 'desktop';

const queries = [
  `(max-width: ${BREAKPOINTS.tablet - 1}px)`,
  `(min-width: ${BREAKPOINTS.tablet}px) and (max-width: ${BREAKPOINTS.desktop - 1}px)`,
  `(min-width: ${BREAKPOINTS.desktop}px)`,
] as const;

/**
 * Определяет тип устройства по переданной ширине.
 * Чистая функция без сайд-эффектов.
 */
export function getBreakpoint(width: number): Breakpoint {
  if (width < BREAKPOINTS.tablet) return 'mobile';
  if (width < BREAKPOINTS.desktop) return 'tablet';
  return 'desktop';
}

/**
 * Хук, следящий за изменением breakpoint через `window.matchMedia`.
 *
 * В отличие от `resize`, `matchMedia` не срабатывает на каждом пикселе
 * и корректно реагирует на поворот экрана на планшетах.
 */
export function useBreakpoint(): Breakpoint {
  const [bp, setBp] = useState<Breakpoint>(() =>
    getBreakpoint(window.innerWidth),
  );

  const prevRef = useRef(bp);

  useEffect(() => {
    const mqlList = queries.map((q) => window.matchMedia(q));

    const handler = () => {
      const width = window.innerWidth;
      const next = getBreakpoint(width);
      const prev = prevRef.current;

      if (next !== prev) {
        logger.info(
          'breakpoints',
          `Вьюпорт ${width}px → "${next}" (было "${prev}")`,
        );
        prevRef.current = next;
      }

      setBp(next);
    };

    mqlList.forEach((mql) => mql.addEventListener('change', handler));

    return () =>
      mqlList.forEach((mql) => mql.removeEventListener('change', handler));
  }, []);

  return bp;
}
