/**
 * makeRenderEnv — общий хелпер провайдеров для тестов обвязки хуков
 * layout-движка (jsdom). Собирает лёгкий движок + gsapBus + провайдеры
 * контекстов в один Wrapper.
 */

import type { ReactNode } from 'react';
import { GsapContext } from '../components/Layout/gsap/gsapContext';
import { RegisterSpacerScrollTriggerContext } from '../components/Layout/gsap/useRegisterSpacerScrollTrigger';
import { createGsapBus, type GsapBus } from '../components/Layout/gsap/gsapBus';
import {
  createLayoutEngine,
  type LayoutEngine,
} from '../components/Layout/engine';
import {
  LayoutEngineContext,
  LayoutSnapshotContext,
} from '../components/Layout/context/layoutContexts';
import type { LayoutMode } from '../components/Layout/machine/layoutMode';
import type { Breakpoint } from '../utils/breakpoints';

export interface RenderEnvOptions {
  bp?: Breakpoint;
  isHome?: boolean;
  initialMode?: LayoutMode;
  getSpacerScrollProgress?: () => number;
}

export interface RenderEnv {
  engine: LayoutEngine;
  bus: GsapBus;
  getSpacerScrollProgress: () => number;
  Wrapper: React.ComponentType<{ children: ReactNode }>;
}

export function makeRenderEnv(opts: RenderEnvOptions = {}): RenderEnv {
  const engine = createLayoutEngine({
    initialContext: {
      bp: opts.bp ?? 'desktop',
      isHome: opts.isHome ?? true,
      manualOverride: false,
      preferred: null,
    },
    initialMode: opts.initialMode ?? 'fullscreen',
    viewport: 1024,
  });
  const bus = createGsapBus();
  const getSpacerScrollProgress = opts.getSpacerScrollProgress ?? (() => 0);
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <LayoutEngineContext.Provider value={engine}>
      <LayoutSnapshotContext.Provider value={engine.getSnapshot()}>
        <GsapContext.Provider value={bus}>
          <RegisterSpacerScrollTriggerContext.Provider
            value={{
              registerSpacerScrollTrigger: () => () => undefined,
              getSpacerScrollProgress,
            }}
          >
            {children}
          </RegisterSpacerScrollTriggerContext.Provider>
        </GsapContext.Provider>
      </LayoutSnapshotContext.Provider>
    </LayoutEngineContext.Provider>
  );
  return { engine, bus, getSpacerScrollProgress, Wrapper };
}
