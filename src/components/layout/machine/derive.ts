import type { Breakpoint } from '../../../utils/breakpoints';
import type { LayoutChangeSource, LayoutMode } from './layoutMode';

/**
 * Является ли pathname домашней страницей (там работает scrub-спейсер).
 * Единственный источник правды для `isHome` — используется и провайдером,
 * и state-сценой.
 */
export function isHomePath(pathname: string): boolean {
  return pathname === '/' || pathname === '/home';
}

/** Доступна ли кнопка toggle для breakpoint (скрыта только на desktop). */
export function hasToggleFor(bp: Breakpoint): boolean {
  return bp !== 'desktop';
}

/**
 * Возвращает состояние раскладки по умолчанию для текущего роута и устройства.
 *
 * - `/home` → всегда `fullscreen`
 * - Другие роуты → `invisible` (mobile) / `slim` (tablet) / `standard` (desktop)
 */
export function getDefaultState(bp: Breakpoint, isHome: boolean): LayoutMode {
  if (isHome) return 'fullscreen';
  if (bp === 'mobile') return 'invisible';
  return bp === 'tablet' ? 'slim' : 'standard';
}

/**
 * Эффективное конечное состояние навбара на `/home` (после скролла спейсера).
 *
 * На mobile — `invisible`; на tablet — ручной выбор (`slim`/`standard`), если
 * он есть, иначе `standard`; desktop — `standard`. Используется провайдером
 * для отступа `<main>` и scrub-таймлайном как целевое состояние в конце спейсера.
 */
export function homeEndStateFor(
  bp: Breakpoint,
  preferred: LayoutMode | null,
): LayoutMode {
  if (bp === 'mobile') return 'invisible';
  if (bp === 'tablet' && preferred) return preferred;
  return 'standard';
}

/**
 * Признак ручного состояния на mobile (`source === 'toggle'` и состояние в
 * крайних позициях). Используется в `onUpdate` ScrollTrigger: пока состояние
 * задано вручную, scrub-таймлайн «запинен» к своему крайнему положению, и
 * скролл не должен схлопывать навбар.
 */
export function isManualMobileState(
  bp: Breakpoint,
  source: LayoutChangeSource,
  mode: LayoutMode,
): boolean {
  return (
    bp === 'mobile' &&
    source === 'toggle' &&
    (mode === 'fullscreen' || mode === 'invisible')
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
  state: LayoutMode | null,
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
  current: LayoutMode,
  bp: Breakpoint,
): LayoutMode | null {
  if (bp === 'desktop') return null;
  if (bp === 'mobile')
    return current === 'invisible' ? 'fullscreen' : 'invisible';
  return current === 'slim' ? 'standard' : 'slim';
}
