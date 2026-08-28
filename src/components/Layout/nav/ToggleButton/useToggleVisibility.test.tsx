// @vitest-environment jsdom
/**
 * Обвязка `useToggleVisibility`: императивная видимость кнопки toggle по
 * `scroll:progress` и ручному оверрайду. Среда jsdom, GSAP замокан.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { RefObject } from 'react';
import {
  renderHookLite,
  type RenderHookResult,
} from '../../../../test/renderHookLite';
import { resetGsapCalls } from '../../../../test/setupGsapMock';
import { makeRenderEnv } from '../../../../test/renderEngine';
import { useToggleVisibility } from './useToggleVisibility';
import styles from './ToggleButton.module.css';

const renders: RenderHookResult<void>[] = [];

function makeBtnRef(): RefObject<HTMLButtonElement | null> {
  const el = document.createElement('button');
  document.body.appendChild(el);
  return { current: el };
}

function renderToggle(
  env: ReturnType<typeof makeRenderEnv>,
  isHidden: boolean,
) {
  const btnRef = makeBtnRef();
  const r = renderHookLite(
    () =>
      useToggleVisibility(btnRef, { isHome: true, isManualToggle: isHidden }),
    { wrapper: env.Wrapper },
  );
  renders.push(r);
  return { btnRef, r };
}

beforeEach(() => {
  resetGsapCalls();
});

afterEach(() => {
  for (const r of renders.splice(0)) r.unmount();
});

describe('видимость toggle (E5)', () => {
  it('когда не /home, isHidden не ставится ни при каком progress', () => {
    const env = makeRenderEnv({ bp: 'mobile', isHome: false });
    const btnRef = makeBtnRef();
    renders.push(
      renderHookLite(
        () =>
          useToggleVisibility(btnRef, { isHome: false, isManualToggle: false }),
        { wrapper: env.Wrapper },
      ),
    );

    env.bus.emit('scroll:progress', { progress: 0, direction: 1 });
    env.bus.emit('scroll:progress', { progress: 0.5, direction: 1 });
    env.bus.emit('scroll:progress', { progress: 1, direction: 1 });

    expect(btnRef.current?.classList.contains(styles.isHidden)).toBe(false);
  });

  it('когда /home, progress=0, isHidden ставится', () => {
    const env = makeRenderEnv({ bp: 'mobile', isHome: true });
    const { btnRef } = renderToggle(env, false);

    env.bus.emit('scroll:progress', { progress: 0, direction: 1 });

    expect(btnRef.current?.classList.contains(styles.isHidden)).toBe(true);
  });

  it('когда /home, progress на границе 1 − EDGE_EPS (включительно), isHidden снимается', () => {
    const env = makeRenderEnv({ bp: 'mobile', isHome: true });
    const { btnRef } = renderToggle(env, false);

    env.bus.emit('scroll:progress', { progress: 0.99995, direction: 1 });

    expect(btnRef.current?.classList.contains(styles.isHidden)).toBe(false);
  });

  it('когда /home, isManualToggle=true, isHidden снимается даже при progress=0', () => {
    const env = makeRenderEnv({ bp: 'mobile', isHome: true });
    const { btnRef } = renderToggle(env, true);

    env.bus.emit('scroll:progress', { progress: 0, direction: 1 });

    expect(btnRef.current?.classList.contains(styles.isHidden)).toBe(false);
  });

  it('когда эффект перезапускается (deps меняются), lastProgressRef сохраняется', () => {
    const env = makeRenderEnv({ bp: 'mobile', isHome: true });
    const btnRef = makeBtnRef();
    const r = renderHookLite(
      () =>
        useToggleVisibility(btnRef, { isHome: true, isManualToggle: false }),
      { wrapper: env.Wrapper },
    );
    renders.push(r);

    env.bus.emit('scroll:progress', { progress: 0.99995, direction: 1 });
    expect(btnRef.current?.classList.contains(styles.isHidden)).toBe(false);

    r.rerender(() =>
      useToggleVisibility(btnRef, { isHome: false, isManualToggle: false }),
    );
    r.rerender(() =>
      useToggleVisibility(btnRef, { isHome: true, isManualToggle: false }),
    );

    expect(btnRef.current?.classList.contains(styles.isHidden)).toBe(false);
  });

  it('когда unmount, подписка на bus снимается и повторный emit не меняет класс', () => {
    const env = makeRenderEnv({ bp: 'mobile', isHome: true });
    const { btnRef, r } = renderToggle(env, false);

    env.bus.emit('scroll:progress', { progress: 0, direction: 1 });
    expect(btnRef.current?.classList.contains(styles.isHidden)).toBe(true);

    r.unmount();

    env.bus.emit('scroll:progress', { progress: 0.99995, direction: 1 });

    expect(btnRef.current?.classList.contains(styles.isHidden)).toBe(true);
  });
});
