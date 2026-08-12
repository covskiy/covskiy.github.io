/**
 * Снапшот layout-движка (`resolveLayout`): отображение контекста в
 * CSS-переменные на корне layout-а и производные поля снапшота.
 *
 * Термины: см. docs/Components/Layout/testing.md.
 */

import { describe, expect, it } from 'vitest';
import { resolveLayout, ROOT_VAR_NAMES } from './layoutSnapshot';
import { homeEndStateFor } from './derive';
import type { LayoutMode, MachineContext } from './layoutMode';
import type { Breakpoint } from '../../../utils/breakpoints';

const TS = { duration: 0.45, ease: 'power3.inOut' } as const;

function makeContext(
  bp: Breakpoint,
  isHome: boolean,
  preferred: LayoutMode | null,
): MachineContext {
  return {
    bp,
    isHome,
    preferred,
    source: 'route',
    lastSource: 'route',
    homeEndState: homeEndStateFor(bp, preferred),
  };
}

const ctx = makeContext('tablet', false, null);

describe('иммутабельность контекста', () => {
  it('когда строится снапшот, входной контекст не мутирует', () => {
    // Arrange: снимок входного контекста.
    const state = { ...ctx };

    // Act: расчёт снапшота.
    resolveLayout('standard', ctx, {
      viewport: 1024,
      transition: { duration: 0.45, ease: 'power3.inOut' },
    });

    // Assert: контекст не изменился.
    expect(ctx).toEqual(state);
  });
});

describe('CSS-переменные снапшота', () => {
  it('когда режим invisible, клики в зоне навбара отключаются (pointer-events: none)', () => {
    const pointers: Record<LayoutMode, string> = {
      fullscreen: 'auto',
      standard: 'auto',
      slim: 'auto',
      invisible: 'none',
    };
    for (const mode of Object.keys(pointers) as LayoutMode[]) {
      const snap = resolveLayout(mode, ctx, { viewport: 1024, transition: TS });
      expect(snap.vars[ROOT_VAR_NAMES.navPointerEvents], mode).toBe(
        pointers[mode],
      );
    }
  });

  it('когда строится снапшот, переменная layoutState равна текущему режиму', () => {
    const snap = resolveLayout('slim', ctx, { viewport: 1024, transition: TS });
    expect(snap.vars[ROOT_VAR_NAMES.layoutState]).toBe('slim');
  });

  it('когда строится снапшот, сдвиг контента берётся от deriveMainOffset', () => {
    // Arrange: tablet без /home + вариант c /home и homeEndState=slim.
    const slim = resolveLayout('slim', ctx, { viewport: 1024, transition: TS });
    expect(slim.vars[ROOT_VAR_NAMES.navContentOffset]).toBe('80px');

    const homeCtx = makeContext('tablet', true, 'slim');
    const home = resolveLayout('fullscreen', homeCtx, {
      viewport: 1024,
      transition: TS,
    });
    expect(home.vars[ROOT_VAR_NAMES.navContentOffset]).toBe('80px');
  });
});

describe('производные поля снапшота', () => {
  it('когда breakpoint desktop, бургер не показывается; на tablet — показывается', () => {
    expect(
      resolveLayout('standard', makeContext('desktop', false, null), {
        viewport: 1024,
        transition: TS,
      }).hasToggle,
    ).toBe(false);
    expect(
      resolveLayout('standard', makeContext('tablet', false, null), {
        viewport: 1024,
        transition: TS,
      }).hasToggle,
    ).toBe(true);
  });

  it('когда режим slim или invisible, снапшот помечен как узкий', () => {
    for (const mode of ['slim', 'invisible'] as LayoutMode[]) {
      expect(
        resolveLayout(mode, ctx, { viewport: 1024, transition: TS }).isSlim,
      ).toBe(true);
    }
    for (const mode of ['fullscreen', 'standard'] as LayoutMode[]) {
      expect(
        resolveLayout(mode, ctx, { viewport: 1024, transition: TS }).isSlim,
      ).toBe(false);
    }
  });

  it('scrollLocked пока всегда false (зарезервировано на будущее)', () => {
    expect(
      resolveLayout('invisible', ctx, { viewport: 1024, transition: TS })
        .scrollLocked,
    ).toBe(false);
  });

  it('когда строится снапшот, параметры перехода и контекст пробрасываются', () => {
    const snap = resolveLayout('standard', ctx, {
      viewport: 1024,
      transition: TS,
    });
    expect(snap.transition).toEqual(TS);
    expect(snap.context).toBe(ctx);
    expect(snap.bp).toBe('tablet');
    expect(snap.homeEndState).toBe(ctx.homeEndState);
    expect(snap.value).toBe('standard');
  });
});
