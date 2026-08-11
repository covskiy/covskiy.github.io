/**
 * gsapBus — типизированная 60fps-шина на `gsap.ticker`.
 *
 * Единственная задача: отдавать кадровые события (`scroll:frame`, `frame`)
 * подписчикам. Не знает про layout, navbar, state-machine.
 * Добавление новых каналов — расширением `GsapChannel` и `ChannelPayloads`.
 */

import { gsap } from 'gsap';

export type GsapChannel = 'scroll:frame' | 'frame' | 'scroll:progress';

export interface ScrollFrame {
  y: number;
  delta: number;
  time: number;
  direction: 1 | -1 | 0;
}

export interface ScrollProgress {
  progress: number;
  direction: 1 | -1;
}

interface ChannelPayloads {
  'scroll:frame': ScrollFrame;
  frame: ScrollFrame;
  'scroll:progress': ScrollProgress;
}

type Listener<P> = (payload: P) => void;

export interface CreateGsapBusOptions {
  lagSmoothing?: boolean;
}

export interface GsapBus {
  on: <C extends GsapChannel>(
    channel: C,
    fn: Listener<ChannelPayloads[C]>,
  ) => () => void;
  emit: <C extends GsapChannel>(
    channel: C,
    payload: ChannelPayloads[C],
  ) => void;
  dispose: () => void;
}

export function createGsapBus(options: CreateGsapBusOptions = {}): GsapBus {
  const listeners = new Map<GsapChannel, Set<Listener<ScrollFrame>>>();
  let lastY = 0;

  if (options.lagSmoothing !== undefined) {
    gsap.ticker.lagSmoothing(options.lagSmoothing);
  }

  function on<C extends GsapChannel>(
    channel: C,
    fn: Listener<ChannelPayloads[C]>,
  ): () => void {
    let set = listeners.get(channel);
    if (!set) {
      set = new Set();
      listeners.set(channel, set);
    }
    set.add(fn as Listener<ScrollFrame>);
    return () => {
      set?.delete(fn as Listener<ScrollFrame>);
    };
  }

  function emit<C extends GsapChannel>(
    channel: C,
    payload: ChannelPayloads[C],
  ): void {
    const set = listeners.get(channel);
    if (!set) return;
    for (const fn of set) fn(payload as ScrollFrame);
  }

  function tick() {
    const y = typeof window !== 'undefined' ? window.scrollY : 0;
    const time = gsap.ticker.time;
    const delta = y - lastY;
    lastY = y;
    const direction: ScrollFrame['direction'] =
      delta > 0 ? 1 : delta < 0 ? -1 : 0;
    emit('scroll:frame', { y, delta, time, direction });
    emit('frame', { y, delta, time, direction });
  }

  const tickerHandler = () => {
    tick();
  };

  gsap.ticker.add(tickerHandler);

  function dispose() {
    gsap.ticker.remove(tickerHandler);
    listeners.clear();
  }

  return { on, emit, dispose };
}
