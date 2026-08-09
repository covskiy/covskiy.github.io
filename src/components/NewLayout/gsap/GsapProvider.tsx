/**
 * GsapProvider — GSAP-инфраструктура для layout-а (см. план §I.3, §D8).
 *
 * Ответственность:
 * - создаёт `gsapBus` (60fps-шина на `gsap.ticker`);
 * - регистрирует один ticker-handler;
 * - отдаёт `bus` через `GsapContext`;
 * - cleanup при размонтировании.
 *
 * НЕ знает про: navbar, content, state-machine, layout-events.
 * Layout-логика строится в `GsapLayoutBridge` (Часть II).
 */

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  type PropsWithChildren,
} from 'react';
import { createGsapBus, type GsapBus } from './gsapBus';

const GsapContext = createContext<GsapBus | null>(null);

export function GsapProvider({ children }: PropsWithChildren) {
  const busRef = useRef<GsapBus | null>(null);
  if (busRef.current === null) {
    busRef.current = createGsapBus();
  }

  useEffect(() => {
    const bus = busRef.current;
    if (!bus) return;
    return () => {
      bus.dispose();
    };
  }, []);

  return (
    <GsapContext.Provider value={busRef.current}>
      {children}
    </GsapContext.Provider>
  );
}

export function useGsapBus(): GsapBus {
  const bus = useContext(GsapContext);
  if (!bus) {
    throw new Error('useGsapBus must be used inside <GsapProvider>');
  }
  return bus;
}
