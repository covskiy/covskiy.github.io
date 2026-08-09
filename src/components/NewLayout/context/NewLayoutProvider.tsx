/**
 * NewLayoutProvider — React-обёртка над `createNewLayoutEngine`.
 *
 * Реакции (см. план §II.1):
 * - `useBreakpoint()` → `BREAKPOINT_CHANGED { bp }`;
 * - `useLocation().pathname` → `ROUTE_CHANGED`;
 * - window resize → `setViewport(px)` (обновляет vars без transition).
 *
 * Содержит `LayoutEngineContext` + `LayoutSnapshotContext`, отдаёт
 * `NewLayoutProvider`-children. Не знает про navbar (D8).
 */

import {
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import { useLocation } from 'react-router';
import { useBreakpoint } from '../../../utils/breakpoints';
import { createNewLayoutEngine, type NewLayoutEngine } from '../engine';
import {
  LayoutEngineContext,
  LayoutSnapshotContext,
} from './layoutContexts';
import { isHomePath } from '../machine/derive';
import { homeEndStateFor } from '../machine/derive';
import type { LayoutSnapshot } from '../machine/layoutSnapshot';
import type { LayoutMode } from '../machine/layoutMode';

export function NewLayoutProvider({ children }: PropsWithChildren) {
  const location = useLocation();
  const bp = useBreakpoint();

  const engineRef = useRef<NewLayoutEngine | null>(null);
  if (engineRef.current === null) {
    engineRef.current = createNewLayoutEngine({
      initialContext: {
        bp,
        isHome: isHomePath(location.pathname),
        preferred: null,
        lastSource: 'route',
        source: 'route',
        homeEndState: homeEndStateFor(bp, null),
      },
      viewport: typeof window !== 'undefined' ? window.innerWidth : 1024,
    });
  }
  const engine = engineRef.current;

  const [snapshot, setSnapshot] = useState<LayoutSnapshot>(() =>
    engine.getSnapshot(),
  );

  useEffect(() => {
    return engine.subscribe(setSnapshot);
  }, [engine]);

  // Реакция на pathname: синхронизируем isHome и отправляем ROUTE_CHANGED.
  useEffect(() => {
    const isHome = isHomePath(location.pathname);
    engine.setIsHome(isHome);
    engine.send({ type: 'ROUTE_CHANGED' });
  }, [engine, location.pathname]);

  // Реакция на breakpoint
  useEffect(() => {
    engine.send({ type: 'BREAKPOINT_CHANGED', bp });
  }, [engine, bp]);

  // Реакция на resize (setViewport не меняет mode, только пересчитывает vars)
  useEffect(() => {
    function handle() {
      engine.setViewport(window.innerWidth);
    }
    window.addEventListener('resize', handle);
    return () => window.removeEventListener('resize', handle);
  }, [engine]);

  return (
    <LayoutEngineContext.Provider value={engine}>
      <LayoutSnapshotContext.Provider value={snapshot}>
        {children}
      </LayoutSnapshotContext.Provider>
    </LayoutEngineContext.Provider>
  );
}

export type { LayoutMode };
