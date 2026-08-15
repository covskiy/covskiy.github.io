import type { Breakpoint } from '../../../utils/breakpoints';
import type { LayoutMode } from './layoutMode';

export const SLIM_WIDTH = 80;

export interface NavTransform {
  navX: number;
}

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
