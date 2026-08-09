/**
 * NewLayoutEngine — внешний (не-React) layout-движок.
 *
 * Контракт (см. план §I.2):
 * - `send(event)` — отправка дискретного события; маппит `event.type → source`,
 *   делегирует чистому `transition`, при реальном переходе строит новый
 *   `LayoutSnapshot` и уведомляет listeners.
 * - `subscribe(fn)` — подписка на snapshot-ы; возврат unsubscribe.
 * - `getSnapshot()` — синхронный текущий снимок.
 * - `setViewport(px)` — обновление ширины вьюпорта для пересчёта vars
 *   (без перехода состояния машины — `_resolve` без notify).
 * - `getMode()` — текущий `LayoutMode` (для хуков и dev-отладки).
 * - `dispose()` — освобождение listeners.
 *
 * Чистый слой: без React, GSAP, DOM. Использует pure `transition` + `resolveLayout`.
 */

import { resolveLayout, type LayoutSnapshot } from './machine/layoutSnapshot';
import {
  EVENT_TO_SOURCE,
  type LayoutEvent,
  type LayoutMode,
  type MachineContext,
} from './machine/layoutMode';
import { homeEndStateFor } from './machine/derive';
import { transition, type TransitionResult } from './machine/transition';

export interface NewLayoutEngine {
  send: (event: LayoutEvent) => void;
  subscribe: (fn: (snapshot: LayoutSnapshot) => void) => () => void;
  getSnapshot: () => LayoutSnapshot;
  getMode: () => LayoutMode;
  setViewport: (px: number) => void;
  setIsHome: (isHome: boolean) => void;
  registerSlot: (id: string, el: HTMLElement | null) => void;
  dispose: () => void;
}

export interface CreateEngineOptions {
  initialContext?: Partial<MachineContext>;
  initialMode?: LayoutMode;
  transitionDuration?: number;
  transitionEase?: string;
  viewport?: number;
}

const DEFAULT_TRANSITION = {
  duration: 0.45,
  ease: 'power3.inOut',
} as const;

const INITIAL_TRANSITION = { duration: 0, ease: 'none' } as const;

export function createNewLayoutEngine(
  options: CreateEngineOptions = {},
): NewLayoutEngine {
  const listeners = new Set<(snapshot: LayoutSnapshot) => void>();
  const transitionDuration = options.transitionDuration ?? DEFAULT_TRANSITION.duration;
  const transitionEase = options.transitionEase ?? DEFAULT_TRANSITION.ease;

  let viewport = options.viewport ?? 1024;
  let mode: LayoutMode = options.initialMode ?? deriveInitialMode(options.initialContext);

  const initialBp = options.initialContext?.bp ?? 'desktop';
  const initialPreferred = options.initialContext?.preferred ?? null;

  let context: MachineContext = {
    bp: initialBp,
    isHome: options.initialContext?.isHome ?? false,
    preferred: initialPreferred,
    lastSource: options.initialContext?.lastSource ?? 'route',
    source: options.initialContext?.source ?? 'route',
    homeEndState:
      options.initialContext?.homeEndState ??
      homeEndStateFor(initialBp, initialPreferred),
  };

  let snapshot: LayoutSnapshot = resolveLayout(mode, context, {
    viewport,
    transition: { ...INITIAL_TRANSITION },
  });

  function notify() {
    for (const listener of listeners) listener(snapshot);
  }

  function rebuildSnapshot(transitionOptions: { duration: number; ease: string }) {
    snapshot = resolveLayout(mode, context, {
      viewport,
      transition: transitionOptions,
    });
  }

  function send(event: LayoutEvent) {
    const source = EVENT_TO_SOURCE[event.type];
    const nextBp =
      event.type === 'BREAKPOINT_CHANGED' ? event.bp : context.bp;
    const fullCtx: MachineContext = {
      ...context,
      bp: nextBp,
      source,
    };
    const result: TransitionResult = transition(mode, event, fullCtx);
    const finalPreferred =
      result.preferredAfter === undefined
        ? context.preferred
        : result.preferredAfter;
    const finalHomeEnd = homeEndStateFor(nextBp, finalPreferred);

    const nextMode = result.state;

    const changed =
      nextMode !== mode ||
      finalPreferred !== context.preferred ||
      context.source !== source ||
      nextBp !== context.bp ||
      finalHomeEnd !== context.homeEndState;

    context = {
      ...context,
      bp: nextBp,
      preferred: finalPreferred,
      homeEndState: finalHomeEnd,
      lastSource: source,
      source,
    };

    if (changed) {
      mode = nextMode;
      rebuildSnapshot({ duration: transitionDuration, ease: transitionEase });
      notify();
    }
  }

  function setViewport(px: number) {
    if (px === viewport) return;
    viewport = px;
    rebuildSnapshot({ duration: 0, ease: 'none' });
    notify();
  }

  const slots = new Map<string, HTMLElement>();

  function registerSlot(id: string, el: HTMLElement | null) {
    if (el) {
      slots.set(id, el);
    } else {
      slots.delete(id);
    }
  }

  function setIsHome(isHome: boolean) {
    if (context.isHome === isHome) return;
    context = { ...context, isHome };
    rebuildSnapshot({ duration: 0, ease: 'none' });
    notify();
  }

  return {
    send,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot() {
      return snapshot;
    },
    getMode() {
      return mode;
    },
    setViewport,
    setIsHome,
    registerSlot,
    dispose() {
      listeners.clear();
      slots.clear();
    },
  };
}

function deriveInitialMode(ctx: Partial<MachineContext> | undefined): LayoutMode {
  if (ctx?.isHome) return 'fullscreen';
  const bp = ctx?.bp ?? 'desktop';
  if (bp === 'mobile') return 'invisible';
  if (bp === 'tablet') return 'slim';
  return 'standard';
}
