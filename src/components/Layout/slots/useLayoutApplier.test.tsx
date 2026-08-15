// @vitest-environment jsdom
/**
 * Обвязка `useLayoutApplier`: gsap.to CSS-переменных на root, scroll-lock на
 * documentElement и ScrollTrigger.refresh в onComplete. Среда jsdom, GSAP замокан.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import {
  renderHookLite,
  type RenderHookResult,
} from '../../../test/renderHookLite';
import {
  gsapCalls,
  getLastTween,
  resetGsapCalls,
} from '../../../test/setupGsapMock';
import { makeRenderEnv } from '../../../test/renderEngine';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { LayoutEngineContext } from '../context/layoutContexts';
import type { LayoutEngine } from '../engine';
import type { LayoutSnapshot } from '../machine/layoutSnapshot';
import { useLayoutApplier } from './useLayoutApplier';

interface FakeTweenView {
  killed: boolean;
  _progress: number;
  _onComplete?: () => void;
  toVars: Record<string, unknown>;
}

const renders: RenderHookResult<void>[] = [];

function makeRootRef() {
  const el = document.createElement('div');
  document.body.appendChild(el);
  return { current: el };
}

function currentTween(): FakeTweenView {
  return getLastTween() as unknown as FakeTweenView;
}

function toCalls() {
  return gsapCalls.filter((c) => c.method === 'to');
}

function snapshotWith(
  engine: LayoutEngine,
  scrollLocked: boolean,
): LayoutSnapshot {
  return { ...engine.getSnapshot(), scrollLocked };
}

function applierWrapper(engine: LayoutEngine) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <LayoutEngineContext.Provider value={engine}>
        {children}
      </LayoutEngineContext.Provider>
    );
  };
}

/** Движок, который на subscribe сразу эмитит все снапшоты (для scroll-lock кейсов). */
function makeSnapshotEngine(snapshots: LayoutSnapshot[]): LayoutEngine {
  return {
    getSnapshot: () => snapshots[snapshots.length - 1],
    subscribe: (fn) => {
      for (const s of snapshots) fn(s);
      return () => undefined;
    },
    send: () => undefined,
    subscribeActions: () => () => undefined,
    getMode: () => 'fullscreen',
    setViewport: () => undefined,
    setIsHome: () => undefined,
    dispose: () => undefined,
  };
}

beforeEach(() => {
  resetGsapCalls();
  vi.clearAllMocks();
});

afterEach(() => {
  for (const r of renders.splice(0)) r.unmount();
  document.documentElement.style.overflow = '';
});

describe('apply снапшотов (E6)', () => {
  it('когда mount, стартовый apply запускает gsap.to с INITIAL_TRANSITION (duration=0)', () => {
    const env = makeRenderEnv({ bp: 'desktop', isHome: true });
    const rootRef = makeRootRef();
    renders.push(
      renderHookLite(() => useLayoutApplier(rootRef), { wrapper: env.Wrapper }),
    );

    const calls = toCalls();
    expect(calls).toHaveLength(1);
    expect(calls[0].target).toBe(rootRef.current);
    expect(calls[0].vars['--nav-pointer-events']).toBe('auto');
    expect(calls[0].vars).toHaveProperty('--nav-content-offset');
    expect(calls[0].vars.duration).toBe(0);
    expect(calls[0].vars.ease).toBe('none');
    expect(calls[0].vars.overwrite).toBe('auto');
  });

  it('когда приходит новый snapshot, старый твин kill-ится, новый создаётся с duration=0.45', () => {
    const env = makeRenderEnv({ bp: 'desktop', isHome: true });
    const rootRef = makeRootRef();
    renders.push(
      renderHookLite(() => useLayoutApplier(rootRef), { wrapper: env.Wrapper }),
    );

    const first = currentTween();
    expect(toCalls()).toHaveLength(1);

    env.engine.send({ type: 'REACH_BOTTOM' });

    const calls = toCalls();
    expect(calls).toHaveLength(2);
    expect(first.killed).toBe(true);
    expect(calls[1].vars.duration).toBe(0.45);
    expect(calls[1].vars.ease).toBe('power3.inOut');
  });

  it('когда snapshot.scrollLocked=true, overflow на documentElement становится hidden', () => {
    const engine = makeSnapshotEngine([
      snapshotWith(makeRenderEnv().engine, true),
    ]);
    const rootRef = makeRootRef();
    renders.push(
      renderHookLite(() => useLayoutApplier(rootRef), {
        wrapper: applierWrapper(engine),
      }),
    );

    expect(document.documentElement.style.overflow).toBe('hidden');
  });

  it('когда snapshot.scrollLocked=false, overflow сбрасывается в пустую строку', () => {
    const base = makeRenderEnv().engine;
    const engine = makeSnapshotEngine([
      snapshotWith(base, true),
      snapshotWith(base, false),
    ]);
    const rootRef = makeRootRef();
    renders.push(
      renderHookLite(() => useLayoutApplier(rootRef), {
        wrapper: applierWrapper(engine),
      }),
    );

    expect(document.documentElement.style.overflow).toBe('');
  });

  it('когда onComplete gsap.to срабатывает, вызывается ScrollTrigger.refresh', () => {
    const env = makeRenderEnv({ bp: 'desktop', isHome: true });
    const rootRef = makeRootRef();
    renders.push(
      renderHookLite(() => useLayoutApplier(rootRef), { wrapper: env.Wrapper }),
    );

    // eslint-disable-next-line @typescript-eslint/unbound-method
    const refresh = ScrollTrigger.refresh as ReturnType<typeof vi.fn>;
    expect(refresh).not.toHaveBeenCalled();
    currentTween()._onComplete?.();

    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('когда unmount, твин kill-ится и overflow сбрасывается в пустую строку', () => {
    const env = makeRenderEnv({ bp: 'desktop', isHome: true });
    const rootRef = makeRootRef();
    const r = renderHookLite(() => useLayoutApplier(rootRef), {
      wrapper: env.Wrapper,
    });

    env.engine.send({ type: 'REACH_BOTTOM' });
    const tween = currentTween();

    r.unmount();

    expect(tween.killed).toBe(true);
    expect(document.documentElement.style.overflow).toBe('');
  });
});
