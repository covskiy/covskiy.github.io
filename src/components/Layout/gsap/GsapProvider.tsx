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

import { useEffect, useRef, type PropsWithChildren } from 'react';
import { createGsapBus, type GsapBus } from './gsapBus';
import { GsapContext } from './gsapContext';
import { GsapLayoutBridge } from './GsapLayoutBridge';

export function GsapProvider({ children }: PropsWithChildren) {
  const busRef = useRef<GsapBus | null>(null);
  busRef.current ??= createGsapBus();

  useEffect(() => {
    const bus = busRef.current;
    if (!bus) return;
    return () => {
      bus.dispose();
    };
  }, []);

  return (
    <GsapContext.Provider value={busRef.current}>
      <GsapLayoutBridge />
      {children}
    </GsapContext.Provider>
  );
}
