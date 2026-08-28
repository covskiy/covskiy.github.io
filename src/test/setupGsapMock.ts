/**
 * Глобальный mock-инфраструктура GSAP для тестов обвязки хуков (jsdom).
 *
 * Единый setup-файл (подключается через `vitest.config.ts setupFiles`):
 * - `gsap` / `gsap/ScrollTrigger` / `@gsap/react` заменяются фейками;
 * - `window.innerWidth` = 1024 (по умолчанию), переопределяется в Arrange;
 * - экспортирует рекордер `gsapCalls` и аксессоры для проверки аргументов.
 *
 * Чистые тесты (`machine/`, `engine.test.ts`) gsap не импортируют — мок их
 * не задевает. `window`-мок обёрнут в guard, чтобы node-сьют не падал.
 */

import { vi } from 'vitest';

const mockState = vi.hoisted(() => ({
  __cleanup: null as null | (() => void),
  __getLastTween: null as null | (() => unknown),
}));

export function getLastTween() {
  return mockState.__getLastTween?.() ?? null;
}

interface FakeTween {
  fromVars?: Record<string, unknown>;
  toVars: Record<string, unknown>;
  killed: boolean;
  _progress: number;
  _onComplete?: () => void;
  pause(): this;
  resume(): this;
  kill(): this;
  progress(value?: number): number;
  invalidate(): this;
}

function createFakeTween(
  fromVars: Record<string, unknown> | undefined,
  toVars: Record<string, unknown>,
): FakeTween {
  const t: FakeTween = {
    fromVars,
    toVars,
    killed: false,
    _progress: 0,
    pause() {
      return this;
    },
    resume() {
      return this;
    },
    kill() {
      this.killed = true;
      return this;
    },
    progress(value?: number) {
      if (typeof value === 'number') this._progress = value;
      return this._progress;
    },
    invalidate() {
      return this;
    },
  };
  if (typeof toVars.onComplete === 'function') {
    t._onComplete = toVars.onComplete as () => void;
  }
  return t;
}

export interface GsapCall {
  method: 'to' | 'fromTo';
  target: unknown;
  vars: Record<string, unknown>;
}

export const gsapCalls: GsapCall[] = [];

export function resetGsapCalls(): void {
  gsapCalls.length = 0;
}

let lastTween: FakeTween | null = null;
mockState.__getLastTween = () => lastTween;

const mockedGsap = {
  killTweensOf: vi.fn(),
  to(target: unknown, vars: Record<string, unknown>): FakeTween {
    gsapCalls.push({ method: 'to', target, vars });
    lastTween = createFakeTween(undefined, vars);
    return lastTween;
  },
  fromTo(
    target: unknown,
    fromVars: Record<string, unknown>,
    toVars: Record<string, unknown>,
  ): FakeTween {
    gsapCalls.push({ method: 'fromTo', target, vars: { fromVars, toVars } });
    lastTween = createFakeTween(fromVars, toVars);
    return lastTween;
  },
  ticker: { add: vi.fn(), remove: vi.fn(), lagSmoothing: vi.fn(), time: 0 },
  core: { Tween: class {} },
};

vi.mock('gsap', () => ({ gsap: mockedGsap, default: mockedGsap }));

vi.mock('gsap/ScrollTrigger', () => ({
  ScrollTrigger: {
    refresh: vi.fn(),
    create: vi.fn(() => ({ kill: vi.fn(), progress: 0, end: 0 })),
  },
}));

vi.mock('@gsap/react', async () => {
  const { useLayoutEffect } = await import('react');
  return {
    useGSAP: (
      callback: (
        root: HTMLElement | null,
        ctxSafe: <T extends (...args: unknown[]) => unknown>(f: T) => T,
      ) => void | (() => void),
      config?: { dependencies?: unknown[]; scope?: unknown },
    ) => {
      // Реальная семантика useGSAP (v2.1.2): с непустыми `dependencies`
      // (deferCleanup=true) на смену deps колбэк перезапускается в том же
      // контексте БЕЗ вызова предыдущего cleanup — поэтому `scrubTweenRef`
      // живёт и progress сохраняется через `existingProgress`. cleanup
      // вызывается только при unmount (context.revert). Воспроизводим это.
      useLayoutEffect(() => {
        mockState.__cleanup =
          callback(
            null,
            <T extends (...args: unknown[]) => unknown>(f: T) => f,
          ) ?? null;
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, config?.dependencies ?? []);
      useLayoutEffect(() => {
        return () => {
          mockState.__cleanup?.();
          mockState.__cleanup = null;
        };
      }, []);
    },
  };
});

if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'innerWidth', {
    value: 1024,
    configurable: true,
  });
}
