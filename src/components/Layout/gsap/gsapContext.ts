import { createContext, useContext } from 'react';
import type { GsapBus } from './gsapBus';

const GsapContext = createContext<GsapBus | null>(null);

export function useGsapBus(): GsapBus {
  const bus = useContext(GsapContext);
  if (!bus) {
    throw new Error('useGsapBus must be used inside <GsapProvider>');
  }
  return bus;
}

export { GsapContext };
