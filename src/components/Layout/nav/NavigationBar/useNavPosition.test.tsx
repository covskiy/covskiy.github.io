// @vitest-environment jsdom
/**
 * Обвязка `useNavPosition`: scrub-build, discrete-skip, bus-подписка и resync.
 *
 * Среда jsdom, GSAP замокан на fake-твины (`setupGsapMock`); движок — лёгкий
 * `makeRenderEnv`. Термины: см. docs/Components/Layout/testing.md.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RefObject } from 'react';
import {
  renderHookLite,
  type RenderHookResult,
} from '../../../../test/renderHookLite';
import {
  gsapCalls,
  getLastTween,
  resetGsapCalls,
} from '../../../../test/setupGsapMock';
import { makeRenderEnv } from '../../../../test/renderEngine';
import { useNavPosition } from './useNavPosition';

interface FakeTweenView {
  progress(v?: number): number;
  killed: boolean;
  _progress: number;
  toVars: Record<string, unknown>;
  fromVars?: Record<string, unknown>;
}

type AnyCall = {
  method: 'to' | 'fromTo';
  target: unknown;
  vars: Record<string, unknown>;
};

const tweens: RenderHookResult<void>[] = [];

function makeNavRef(): RefObject<HTMLElement | null> {
  const el = document.createElement('nav');
  return { current: el };
}

function currentTween(): FakeTweenView {
  return getLastTween() as unknown as FakeTweenView;
}

function callsBy(method: 'to' | 'fromTo'): AnyCall[] {
  return gsapCalls.filter((c) => c.method === method);
}

beforeEach(() => {
  resetGsapCalls();
});

afterEach(() => {
  for (const r of tweens.splice(0)) r.unmount();
});

describe('buildScrub (E1) — scrub-твин на /home', () => {
  it('когда home с homeEndState standard, при mount создаётся fromTo(0 → −768)', () => {
    const env = makeRenderEnv({ bp: 'desktop', isHome: true });
    const navRef = makeNavRef();
    const snapshot = env.engine.getSnapshot();
    tweens.push(
      renderHookLite(() => useNavPosition(navRef, snapshot), {
        wrapper: env.Wrapper,
      }),
    );

    expect(callsBy('fromTo')).toHaveLength(1);
    const call = callsBy('fromTo')[0];
    expect(call.target).toBe(navRef.current);
    const { fromVars, toVars } = call.vars as {
      fromVars: Record<string, unknown>;
      toVars: Record<string, unknown>;
    };
    expect(fromVars).toEqual({ x: 0 });
    expect(toVars.x).toBe(-768);
    expect(toVars.ease).toBe('none');
    expect(toVars.paused).toBe(true);
    expect(toVars.immediateRender).toBe(false);
  });

  it('когда homeEndState меняется standard→slim, scrub плавно перецеливается с сохранением прогресса', () => {
    const env = makeRenderEnv({ bp: 'desktop', isHome: true });
    const navRef = makeNavRef();
    let snapshot = env.engine.getSnapshot();
    const r = renderHookLite(() => useNavPosition(navRef, snapshot), {
      wrapper: env.Wrapper,
    });
    tweens.push(r);

    expect(callsBy('fromTo')).toHaveLength(1);
    const first = currentTween();
    first.progress(0.4);

    env.engine.send({ type: 'BREAKPOINT_CHANGED', bp: 'tablet' });
    snapshot = env.engine.getSnapshot();
    r.rerender(() => useNavPosition(navRef, snapshot));

    // перецеливка: плавный gsap.to к target = endX * prevProgress
    const tos = callsBy('to');
    expect(tos).toHaveLength(1);
    expect(tos[0].target).toBe(navRef.current);
    expect(tos[0].vars.x).toBe(-944 * 0.4);
    expect(tos[0].vars.duration).toBe(snapshot.transition.duration);
    expect(tos[0].vars.ease).toBe(snapshot.transition.ease);

    // завершаем анимацию — scrub пересобирается в новой геометрии
    (getLastTween() as { _onComplete?: () => void } | null)?._onComplete?.();
    expect(callsBy('fromTo')).toHaveLength(2);
    const rebuilt = currentTween();
    expect(rebuilt.toVars.x).toBe(-944);
    expect(rebuilt._progress).toBe(env.getSpacerScrollProgress());
  });

  it('когда TOGGLE внизу /home, nav-перецеливка использует snapshot.transition (синхронно с контентом)', () => {
    const env = makeRenderEnv({
      bp: 'tablet',
      isHome: true,
      initialMode: 'slim',
    });
    const navRef = makeNavRef();
    let snapshot = env.engine.getSnapshot();
    const r = renderHookLite(() => useNavPosition(navRef, snapshot), {
      wrapper: env.Wrapper,
    });
    tweens.push(r);

    // на дне спейсера: прогресс 1
    currentTween().progress(1);

    env.engine.send({ type: 'TOGGLE' });
    snapshot = env.engine.getSnapshot();
    r.rerender(() => useNavPosition(navRef, snapshot));

    const tos = callsBy('to');
    expect(tos).toHaveLength(1);
    expect(tos[0].vars.duration).toBe(snapshot.transition.duration);
    expect(tos[0].vars.ease).toBe(snapshot.transition.ease);
  });

  it('когда isHome меняется true→false, scrub-твин убивается и новый не создаётся', () => {
    const env = makeRenderEnv({ bp: 'desktop', isHome: true });
    const navRef = makeNavRef();
    let snapshot = env.engine.getSnapshot();
    const r = renderHookLite(() => useNavPosition(navRef, snapshot), {
      wrapper: env.Wrapper,
    });
    tweens.push(r);

    expect(callsBy('fromTo')).toHaveLength(1);
    const scrub = currentTween();

    env.engine.setIsHome(false);
    snapshot = env.engine.getSnapshot();
    r.rerender(() => useNavPosition(navRef, snapshot));

    expect(callsBy('fromTo')).toHaveLength(1);
    expect(scrub.killed).toBe(true);
  });

  it('когда стартовый isHome=false, scrub-твин вообще не создаётся', () => {
    const env = makeRenderEnv({ bp: 'desktop', isHome: false });
    const navRef = makeNavRef();
    const snapshot = env.engine.getSnapshot();
    tweens.push(
      renderHookLite(() => useNavPosition(navRef, snapshot), {
        wrapper: env.Wrapper,
      }),
    );

    expect(callsBy('fromTo')).toHaveLength(0);
  });
});

describe('discrete-skip (E2) — владение x через engine.subscribe', () => {
  it('когда /home без manual, новый snapshot не запускает gsap.to (scrub владеет x)', () => {
    const env = makeRenderEnv({
      bp: 'mobile',
      isHome: true,
      initialMode: 'invisible',
    });
    const navRef = makeNavRef();
    const snapshot = env.engine.getSnapshot();
    tweens.push(
      renderHookLite(() => useNavPosition(navRef, snapshot), {
        wrapper: env.Wrapper,
      }),
    );

    env.engine.setViewport(800);

    expect(callsBy('to')).toHaveLength(0);
  });

  it('когда isManualToggle=true на /home, новый snapshot запускает gsap.to с верными args', () => {
    const env = makeRenderEnv({
      bp: 'mobile',
      isHome: true,
      initialMode: 'invisible',
    });
    const navRef = makeNavRef();
    const snapshot = env.engine.getSnapshot();
    tweens.push(
      renderHookLite(() => useNavPosition(navRef, snapshot), {
        wrapper: env.Wrapper,
      }),
    );

    env.engine.send({ type: 'TOGGLE' });

    const tos = callsBy('to');
    expect(tos).toHaveLength(1);
    expect(tos[0].target).toBe(navRef.current);
    expect(tos[0].vars).toMatchObject({
      x: 0,
      duration: 0.45,
      ease: 'power3.inOut',
      overwrite: 'auto',
    });
  });

  it('когда prevManual=true → false (выход из manual), следующий /home snapshot снова skip-ится', () => {
    const env = makeRenderEnv({
      bp: 'mobile',
      isHome: true,
      initialMode: 'invisible',
    });
    const navRef = makeNavRef();
    const snapshot = env.engine.getSnapshot();
    tweens.push(
      renderHookLite(() => useNavPosition(navRef, snapshot), {
        wrapper: env.Wrapper,
      }),
    );

    env.engine.send({ type: 'TOGGLE' });
    env.engine.send({ type: 'TOGGLE' });
    const before = callsBy('to').length;
    env.engine.setViewport(800);

    expect(callsBy('to')).toHaveLength(before);
    expect(callsBy('to')).toHaveLength(2);
  });

  it('когда не /home, каждый новый snapshot запускает gsap.to', () => {
    const env = makeRenderEnv({ bp: 'desktop', isHome: false });
    const navRef = makeNavRef();
    const snapshot = env.engine.getSnapshot();
    tweens.push(
      renderHookLite(() => useNavPosition(navRef, snapshot), {
        wrapper: env.Wrapper,
      }),
    );

    env.engine.setViewport(800);
    env.engine.setViewport(900);

    expect(callsBy('to')).toHaveLength(2);
  });

  it('когда TOGGLE, nav-твин берёт duration/ease из snap.transition (единый источник с контентом)', () => {
    const env = makeRenderEnv({
      bp: 'mobile',
      isHome: true,
      initialMode: 'invisible',
    });
    const navRef = makeNavRef();
    const snapshot = env.engine.getSnapshot();
    tweens.push(
      renderHookLite(() => useNavPosition(navRef, snapshot), {
        wrapper: env.Wrapper,
      }),
    );

    env.engine.send({ type: 'TOGGLE' });

    const to = callsBy('to')[0];
    const snap = env.engine.getSnapshot();
    expect(to.vars.duration).toBe(snap.transition.duration);
    expect(to.vars.ease).toBe(snap.transition.ease);
    expect(to.vars.duration).toBe(0.45);
    expect(to.vars.ease).toBe('power3.inOut');
  });
});

describe('bus-подписка (E3) — scroll:progress', () => {
  it('когда bus эмитит scroll:progress, scrub-твин получает progress(payload.progress)', () => {
    const env = makeRenderEnv({ bp: 'desktop', isHome: true });
    const navRef = makeNavRef();
    const snapshot = env.engine.getSnapshot();
    tweens.push(
      renderHookLite(() => useNavPosition(navRef, snapshot), {
        wrapper: env.Wrapper,
      }),
    );

    env.bus.emit('scroll:progress', { progress: 0.3, direction: 1 });

    expect(currentTween()._progress).toBe(0.3);
  });

  it('когда unmount, подписка на bus снимается и повторный emit не дёргает твин', () => {
    const env = makeRenderEnv({ bp: 'desktop', isHome: true });
    const navRef = makeNavRef();
    const snapshot = env.engine.getSnapshot();
    const r = renderHookLite(() => useNavPosition(navRef, snapshot), {
      wrapper: env.Wrapper,
    });

    expect(currentTween()._progress).toBe(0);
    r.unmount();

    env.bus.emit('scroll:progress', { progress: 0.7, direction: 1 });

    expect(currentTween()._progress).toBe(0);
  });
});

describe('resync (E4) — invalidate + progress(getSpacerScrollProgress)', () => {
  it('когда isHome=true и !isManualToggle, при mount вызывается progress(getSpacerScrollProgress())', () => {
    const getSpacer = vi.fn(() => 0.5);
    const env = makeRenderEnv({
      bp: 'desktop',
      isHome: true,
      getSpacerScrollProgress: getSpacer,
    });
    const navRef = makeNavRef();
    const snapshot = env.engine.getSnapshot();
    tweens.push(
      renderHookLite(() => useNavPosition(navRef, snapshot), {
        wrapper: env.Wrapper,
      }),
    );

    expect(getSpacer).toHaveBeenCalled();
    expect(currentTween()._progress).toBe(0.5);
  });

  it('когда isHome=false, ни invalidate, ни подписка не вызываются', () => {
    const getSpacer = vi.fn(() => 0.5);
    const env = makeRenderEnv({
      bp: 'desktop',
      isHome: false,
      getSpacerScrollProgress: getSpacer,
    });
    const navRef = makeNavRef();
    const snapshot = env.engine.getSnapshot();
    tweens.push(
      renderHookLite(() => useNavPosition(navRef, snapshot), {
        wrapper: env.Wrapper,
      }),
    );

    expect(getSpacer).not.toHaveBeenCalled();
  });

  it('когда isManualToggle=true на /home, resync-эффект выходит рано (нет подписки, нет invalidate)', () => {
    const getSpacer = vi.fn(() => 0.5);
    const env = makeRenderEnv({
      bp: 'mobile',
      isHome: true,
      initialMode: 'invisible',
      getSpacerScrollProgress: getSpacer,
    });
    env.engine.send({ type: 'TOGGLE' });
    const navRef = makeNavRef();
    const snapshot = env.engine.getSnapshot();
    expect(snapshot.isManualToggle).toBe(true);
    tweens.push(
      renderHookLite(() => useNavPosition(navRef, snapshot), {
        wrapper: env.Wrapper,
      }),
    );

    expect(getSpacer).not.toHaveBeenCalled();
    expect(currentTween()._progress).toBe(0);

    env.bus.emit('scroll:progress', { progress: 0.7, direction: 1 });

    expect(currentTween()._progress).toBe(0);
  });
});
