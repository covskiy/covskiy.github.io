/**
 * Политики навбара (`navPolicy.ts`): решения и вычисления, извлечённые из
 * императивной обвязки хуков `useNavPosition` / `useToggleVisibility`.
 *
 * Термины: см. docs/Components/Layout/testing.md.
 */

import { describe, expect, it } from 'vitest';
import {
  decideScrubBuild,
  shouldAnimateDiscrete,
  shouldHideToggle,
  shouldResyncScrub,
} from './navPolicy';

const EPS = 0.0001;

describe('decideScrubBuild — строить ли scrub-твин', () => {
  it('когда не home, scrub-твин не строится (shouldBuild=false, endX=null)', () => {
    const d = decideScrubBuild({
      isHome: false,
      homeEndState: 'standard',
      viewport: 1024,
      existingProgress: 0.5,
    });
    expect(d).toEqual({ shouldBuild: false, endX: null, prevProgress: 0 });
  });

  it('когда home и homeEndState standard, endX = −0.75 × viewport', () => {
    const d = decideScrubBuild({
      isHome: true,
      homeEndState: 'standard',
      viewport: 1024,
      existingProgress: 0,
    });
    expect(d).toEqual({ shouldBuild: true, endX: -768, prevProgress: 0 });
  });

  it('когда home и homeEndState slim, endX оставляет узкую полосу', () => {
    const d = decideScrubBuild({
      isHome: true,
      homeEndState: 'slim',
      viewport: 1024,
      existingProgress: 0,
    });
    expect(d).toEqual({ shouldBuild: true, endX: -944, prevProgress: 0 });
  });

  it('когда вьюпорт другой, endX масштабируется', () => {
    const d = decideScrubBuild({
      isHome: true,
      homeEndState: 'standard',
      viewport: 2000,
      existingProgress: 0,
    });
    expect(d.endX).toBe(-1500);
  });

  it('когда у существующего твина прогресс 0.4, prevProgress сохраняется', () => {
    const d = decideScrubBuild({
      isHome: true,
      homeEndState: 'slim',
      viewport: 1024,
      existingProgress: 0.4,
    });
    expect(d.prevProgress).toBe(0.4);
  });

  it('когда твина нет (existingProgress=0), prevProgress=0', () => {
    const d = decideScrubBuild({
      isHome: true,
      homeEndState: 'standard',
      viewport: 1024,
      existingProgress: 0,
    });
    expect(d.prevProgress).toBe(0);
  });
});

describe('shouldAnimateDiscrete — skip discrete-анимации', () => {
  it.each([
    {
      name: 'когда /home без ручного и ручного не было, анимация пропускается (scrub владеет x)',
      isHome: true,
      manualNow: false,
      prevManual: false,
      expected: false,
    },
    {
      name: 'когда /home с ручным сейчас, анимация выполняется',
      isHome: true,
      manualNow: true,
      prevManual: false,
      expected: true,
    },
    {
      name: 'когда /home и ручное было ранее, анимация выполняется',
      isHome: true,
      manualNow: false,
      prevManual: true,
      expected: true,
    },
    {
      name: 'когда /home и ручное было и есть, анимация выполняется',
      isHome: true,
      manualNow: true,
      prevManual: true,
      expected: true,
    },
    {
      name: 'когда не /home, анимация выполняется всегда',
      isHome: false,
      manualNow: false,
      prevManual: false,
      expected: true,
    },
    {
      name: 'когда не /home с ручным, анимация выполняется',
      isHome: false,
      manualNow: true,
      prevManual: false,
      expected: true,
    },
  ])('$name', ({ isHome, manualNow, prevManual, expected }) => {
    expect(shouldAnimateDiscrete({ isHome, manualNow, prevManual })).toBe(
      expected,
    );
  });
});

describe('shouldResyncScrub — guard ресинхронизации', () => {
  it('когда /home без manual, ресинхронизация разрешена', () => {
    expect(shouldResyncScrub({ isHome: true, isManualToggle: false })).toBe(
      true,
    );
  });

  it('когда /home с manual, ресинхронизация запрещена', () => {
    expect(shouldResyncScrub({ isHome: true, isManualToggle: true })).toBe(
      false,
    );
  });

  it('когда не /home, ресинхронизация запрещена', () => {
    expect(shouldResyncScrub({ isHome: false, isManualToggle: false })).toBe(
      false,
    );
  });
});

describe('shouldHideToggle — видимость кнопки toggle', () => {
  it('когда progress=1 (дно), кнопка видна', () => {
    expect(
      shouldHideToggle({ progress: 1, isManualToggle: false, edgeEps: EPS }),
    ).toBe(false);
  });

  it('когда progress=0.5 (середина scrub-зоны), кнопка скрыта', () => {
    expect(
      shouldHideToggle({ progress: 0.5, isManualToggle: false, edgeEps: EPS }),
    ).toBe(true);
  });

  it('когда progress=1−eps (граница включительно), кнопка видна', () => {
    expect(
      shouldHideToggle({
        progress: 1 - EPS,
        isManualToggle: false,
        edgeEps: EPS,
      }),
    ).toBe(false);
  });

  it('когда progress чуть меньше 1−eps, кнопка скрыта', () => {
    expect(
      shouldHideToggle({
        progress: 1 - EPS - 0.00001,
        isManualToggle: false,
        edgeEps: EPS,
      }),
    ).toBe(true);
  });

  it('когда ручной показ (isManualToggle), кнопка видна при любом progress', () => {
    expect(
      shouldHideToggle({ progress: 0, isManualToggle: true, edgeEps: EPS }),
    ).toBe(false);
    expect(
      shouldHideToggle({ progress: 0.3, isManualToggle: true, edgeEps: EPS }),
    ).toBe(false);
  });
});
