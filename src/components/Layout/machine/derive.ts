import type { Breakpoint } from '../../../utils/breakpoints';
import type { LayoutChangeSource, LayoutMode } from './layoutMode';

export function isHomePath(pathname: string): boolean {
  return pathname === '/' || pathname === '/home';
}

export function hasToggleFor(bp: Breakpoint): boolean {
  return bp !== 'desktop';
}

export function isSlimFor(mode: LayoutMode): boolean {
  return mode === 'slim' || mode === 'invisible';
}

export function getDefaultState(bp: Breakpoint, isHome: boolean): LayoutMode {
  if (isHome) return 'fullscreen';
  if (bp === 'mobile') return 'invisible';
  return bp === 'tablet' ? 'slim' : 'standard';
}

export function homeEndStateFor(
  bp: Breakpoint,
  preferred: LayoutMode | null,
): LayoutMode {
  if (bp === 'mobile') return 'invisible';
  if (bp === 'tablet' && preferred) return preferred;
  return 'standard';
}

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

export function isPreferredStateValid(
  state: LayoutMode | null,
  bp: Breakpoint,
): boolean {
  if (state === null) return false;
  if (bp === 'tablet') return state === 'slim' || state === 'standard';
  return false;
}

export function getNextState(
  current: LayoutMode,
  bp: Breakpoint,
): LayoutMode | null {
  if (bp === 'desktop') return null;
  if (bp === 'mobile')
    return current === 'invisible' ? 'fullscreen' : 'invisible';
  return current === 'slim' ? 'standard' : 'slim';
}
