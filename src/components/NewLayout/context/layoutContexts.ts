/**
 * Контексты layout-а: Engine (стабильная ссылка) + Snapshot (текущий снимок).
 *
 * EngineContext никогда не меняет value — это позволяет подписчикам
 * использовать `useLayoutEngine()` без re-render шума.
 * SnapshotContext пересоздаёт value на каждый transition — это триггерит
 * `useSyncExternalStore`-подобный механизм (через `useState` в провайдере).
 */

import { createContext, useContext } from 'react';
import type { NewLayoutEngine } from '../engine';
import type { LayoutSnapshot } from '../machine/layoutSnapshot';
import type { LayoutEvent } from '../machine/layoutMode';

const LayoutEngineContext = createContext<NewLayoutEngine | null>(null);
const LayoutSnapshotContext = createContext<LayoutSnapshot | null>(null);

export { LayoutEngineContext, LayoutSnapshotContext };

export function useLayoutEngine(): NewLayoutEngine {
  const engine = useContext(LayoutEngineContext);
  if (!engine) {
    throw new Error('useLayoutEngine must be used inside <NewLayoutProvider>');
  }
  return engine;
}

export function useLayoutSnapshot(): LayoutSnapshot {
  const snapshot = useContext(LayoutSnapshotContext);
  if (!snapshot) {
    throw new Error(
      'useLayoutSnapshot must be used inside <NewLayoutProvider>',
    );
  }
  return snapshot;
}

export function useLayoutSend(): (event: LayoutEvent) => void {
  const engine = useLayoutEngine();
  return engine.send;
}
