/**
 * Числовая геометрия навбара (`geometry.ts`): сдвиг навбара по состояниям
 * и отступ контента под него.
 *
 * Термины: см. docs/Components/Layout/testing.md.
 */

import { describe, expect, it } from 'vitest';
import { deriveMainOffset, getNavTransform, SLIM_WIDTH } from './geometry';

describe('сдвиг навбара (getNavTransform)', () => {
  const vp = 1024;

  it('когда режим fullscreen, навбар на месте', () => {
    expect(getNavTransform('fullscreen', vp)).toEqual({ navX: 0 });
  });

  it('когда режим standard, навбар сдвинут на 75% ширины', () => {
    expect(getNavTransform('standard', vp)).toEqual({ navX: -vp * 0.75 });
  });

  it('когда режим slim, навбар оставляет узкую полосу', () => {
    expect(getNavTransform('slim', vp)).toEqual({ navX: -(vp - SLIM_WIDTH) });
  });

  it('когда режим invisible, навбар полностью за экраном', () => {
    expect(getNavTransform('invisible', vp)).toEqual({ navX: -vp });
  });

  it('когда вьюпорт другой, сдвиг масштабируется вместе с ним', () => {
    expect(getNavTransform('invisible', 800)).toEqual({ navX: -800 });
    expect(getNavTransform('standard', 2000)).toEqual({ navX: -1500 });
  });
});

describe('отступ контента под навбар (deriveMainOffset)', () => {
  it('когда breakpoint mobile, контент без отступа', () => {
    expect(deriveMainOffset('standard', 'mobile', false)).toBe('0px');
    expect(deriveMainOffset('fullscreen', 'mobile', true, 'slim')).toBe('0px');
    expect(deriveMainOffset('invisible', 'mobile', false)).toBe('0px');
  });

  it('когда режим standard, контент сдвинут на четверть ширины (25vw)', () => {
    expect(deriveMainOffset('standard', 'tablet', false)).toBe('25vw');
  });

  it('когда режим slim, контент сдвинут под узкую полосу (80px)', () => {
    expect(deriveMainOffset('slim', 'tablet', false)).toBe('80px');
  });

  it('когда навбар развёрнут или скрыт вне /home, отступ контента нулевой', () => {
    expect(deriveMainOffset('fullscreen', 'tablet', false)).toBe('0px');
    expect(deriveMainOffset('invisible', 'tablet', false)).toBe('0px');
  });

  it('когда навбар развёрнут на /home, отступ контента — по состоянию в конце scroll-области', () => {
    expect(deriveMainOffset('fullscreen', 'tablet', true, 'slim')).toBe('80px');
    expect(deriveMainOffset('fullscreen', 'tablet', true, 'standard')).toBe(
      '25vw',
    );
  });

  it('когда состояние в конце не задано, отступ по умолчанию — колонка (25vw)', () => {
    expect(deriveMainOffset('fullscreen', 'tablet', true)).toBe('25vw');
  });

  it('когда состояние в конце не узкое и не колонка, отступ обнуляется', () => {
    expect(deriveMainOffset('fullscreen', 'tablet', true, 'fullscreen')).toBe(
      '0px',
    );
    expect(deriveMainOffset('fullscreen', 'tablet', true, 'invisible')).toBe(
      '0px',
    );
  });
});
