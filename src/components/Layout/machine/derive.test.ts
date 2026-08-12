/**
 * Чистые хелперы layout-машины (`derive.ts`): дефолтные состояния,
 * валидность предпочтений, распознавание домашних путей и режимов.
 *
 * Термины: см. docs/Components/Layout/testing.md.
 */

import { describe, expect, it } from 'vitest';
import {
  getDefaultState,
  getNextState,
  hasToggleFor,
  homeEndStateFor,
  isHomePath,
  isManualMobileState,
  isPreferredStateValid,
  isSlimFor,
} from './derive';
import type { Breakpoint } from '../../../utils/breakpoints';

describe('распознавание домашних путей', () => {
  it('когда путь — корень или /home, страница считается домашней', () => {
    expect(isHomePath('/')).toBe(true);
    expect(isHomePath('/home')).toBe(true);
  });

  it('когда путь не корневой, страница не домашняя', () => {
    expect(isHomePath('/about')).toBe(false);
    expect(isHomePath('/services')).toBe(false);
    expect(isHomePath('')).toBe(false);
  });
});

describe('наличие кнопки-бургера', () => {
  it('когда breakpoint не desktop, бургер есть', () => {
    expect(hasToggleFor('mobile')).toBe(true);
    expect(hasToggleFor('tablet')).toBe(true);
    expect(hasToggleFor('desktop')).toBe(false);
  });
});

describe('распознавание узких состояний', () => {
  it('когда режим slim или invisible, он считается узким', () => {
    expect(isSlimFor('slim')).toBe(true);
    expect(isSlimFor('invisible')).toBe(true);
  });

  it('когда режим fullscreen или standard, он не узкий', () => {
    expect(isSlimFor('fullscreen')).toBe(false);
    expect(isSlimFor('standard')).toBe(false);
  });
});

describe('состояние навбара по умолчанию', () => {
  it('когда страница домашняя, дефолт — развёрнутый навбар', () => {
    expect(getDefaultState('mobile', true)).toBe('fullscreen');
    expect(getDefaultState('tablet', true)).toBe('fullscreen');
    expect(getDefaultState('desktop', true)).toBe('fullscreen');
  });

  it('когда страница не домашняя, дефолт зависит от breakpoint (mobile скрыт / tablet узкая полоса / desktop колонка)', () => {
    expect(getDefaultState('mobile', false)).toBe('invisible');
    expect(getDefaultState('tablet', false)).toBe('slim');
    expect(getDefaultState('desktop', false)).toBe('standard');
  });
});

describe('состояние навбара в конце /home', () => {
  it('когда /home на mobile, в конце всегда скрыто (предпочтение не влияет)', () => {
    expect(homeEndStateFor('mobile', null)).toBe('invisible');
    expect(homeEndStateFor('mobile', 'slim')).toBe('invisible');
  });

  it('когда /home на tablet и предпочтение задано, в конце оно применяется', () => {
    expect(homeEndStateFor('tablet', 'slim')).toBe('slim');
    expect(homeEndStateFor('tablet', 'standard')).toBe('standard');
  });

  it('когда предпочтения нет, в конце — стандартная колонка', () => {
    expect(homeEndStateFor('tablet', null)).toBe('standard');
    expect(homeEndStateFor('desktop', null)).toBe('standard');
    expect(homeEndStateFor('desktop', 'slim')).toBe('standard');
  });
});

describe('ручное состояние навбара на mobile', () => {
  const bp: Breakpoint = 'mobile';

  it('когда навбар в fullscreen/invisible из-за бургера, состояние ручное', () => {
    expect(isManualMobileState(bp, 'toggle', 'fullscreen')).toBe(true);
    expect(isManualMobileState(bp, 'toggle', 'invisible')).toBe(true);
  });

  it('когда режим иной, состояние не ручное', () => {
    expect(isManualMobileState(bp, 'toggle', 'standard')).toBe(false);
    expect(isManualMobileState(bp, 'toggle', 'slim')).toBe(false);
  });

  it('когда breakpoint или источник события другие, состояние не ручное', () => {
    expect(isManualMobileState('tablet', 'toggle', 'fullscreen')).toBe(false);
    expect(isManualMobileState('desktop', 'toggle', 'invisible')).toBe(false);
    expect(isManualMobileState(bp, 'scroll', 'invisible')).toBe(false);
    expect(isManualMobileState(bp, 'route', 'fullscreen')).toBe(false);
  });
});

describe('валидность предпочтения ширины', () => {
  it('когда предпочтения нет, оно невалидно', () => {
    expect(isPreferredStateValid(null, 'tablet')).toBe(false);
  });

  it('когда на tablet предпочтение slim или standard, оно валидно', () => {
    expect(isPreferredStateValid('slim', 'tablet')).toBe(true);
    expect(isPreferredStateValid('standard', 'tablet')).toBe(true);
    expect(isPreferredStateValid('fullscreen', 'tablet')).toBe(false);
    expect(isPreferredStateValid('invisible', 'tablet')).toBe(false);
  });

  it('когда breakpoint mobile или desktop, предпочтение невалидно', () => {
    expect(isPreferredStateValid('slim', 'mobile')).toBe(false);
    expect(isPreferredStateValid('standard', 'mobile')).toBe(false);
    expect(isPreferredStateValid('standard', 'desktop')).toBe(false);
  });
});

describe('следующее состояние при toggle', () => {
  it('когда breakpoint desktop, следующего состояния нет', () => {
    expect(getNextState('standard', 'desktop')).toBeNull();
  });

  it('когда breakpoint mobile, toggle переключает fullscreen/invisible', () => {
    expect(getNextState('invisible', 'mobile')).toBe('fullscreen');
    expect(getNextState('fullscreen', 'mobile')).toBe('invisible');
  });

  it('когда breakpoint tablet, toggle переключает slim/standard', () => {
    expect(getNextState('slim', 'tablet')).toBe('standard');
    expect(getNextState('standard', 'tablet')).toBe('slim');
  });
});
