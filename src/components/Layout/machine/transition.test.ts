/**
 * Поведение layout-машины: события навбара и их сайд-эффекты.
 *
 * Проверяет reducer `transition()` напрямую (без движка):
 * - бургер (`TOGGLE`), пересечение границ спейсера при скролле на /home
 *   (`REACH_TOP` / `REACH_BOTTOM`),
 * - смена роута (`ROUTE_CHANGED`) и брейкпоинта (`BREAKPOINT_CHANGED`),
 * - завершение intro (`INTRO_COMPLETE`),
 * - сохранение и сброс `preferred` (ручной выбор ширины на планшете),
 * - ручной override (`manualOverride`) на /home mobile.
 *
 * Термины: см. docs/Components/Layout/testing.md.
 */

import { describe, expect, it } from 'vitest';
import { transition } from './transition';
import { homeEndStateFor } from './derive';
import {
  EVENT_TO_SOURCE,
  type LayoutChangeSource,
  type LayoutEvent,
  type LayoutMode,
  type MachineContext,
} from './layoutMode';
import type { Breakpoint } from '../../../utils/breakpoints';

function makeContext(
  bp: Breakpoint,
  isHome: boolean,
  preferred: LayoutMode | null,
  source: LayoutChangeSource,
  lastSource: LayoutChangeSource,
  manualOverride = false,
): MachineContext {
  return {
    bp,
    isHome,
    preferred,
    source,
    lastSource,
    homeEndState: homeEndStateFor(bp, preferred),
    manualOverride,
  };
}

interface Step {
  event: LayoutEvent;
  expectMode: LayoutMode;
  expectActions?: readonly LayoutActionType[];
  expectPreferred?: LayoutMode | null | 'unchanged';
  expectManualOverride?: boolean;
}

type LayoutActionType =
  | 'NOTIFY_NAV_STATE'
  | 'SCROLL_TO_END'
  | 'RETARGET_SCRUB'
  | 'NOOP';

interface Case {
  name: string;
  bp: Breakpoint;
  isHome: boolean;
  initialMode: LayoutMode;
  preferred?: LayoutMode | null;
  manualOverride?: boolean;
  steps: Step[];
}

/**
 * 13 сценариев поведения навбара, перенесённые из
 * `scripts/verifyLayoutEngine.ts` (там гонялись через движок, здесь — начисто).
 *
 * Каждый шаг несёт `expectManualOverride` (D15) — ассерт resolved-final состояния
 * флага `manualOverride` после шага. Поле обязательно даже для шагов, где флаг
 * формально не меняется: это tripwire против дрейфа контракта.
 */
const cases: Case[] = [
  {
    name: 'когда на /home на mobile жмут бургер, навбар сворачивается и scroll-область доскролливается в конец',
    bp: 'mobile',
    isHome: true,
    initialMode: 'fullscreen',
    steps: [
      {
        event: { type: 'TOGGLE' },
        expectMode: 'invisible',
        expectActions: ['NOTIFY_NAV_STATE', 'SCROLL_TO_END'],
        expectManualOverride: false,
      },
    ],
  },
  {
    name: 'когда на /home на mobile навбар уже свёрнут, повторный бургер разворачивает его',
    bp: 'mobile',
    isHome: true,
    initialMode: 'fullscreen',
    steps: [
      {
        event: { type: 'TOGGLE' },
        expectMode: 'invisible',
        expectActions: ['NOTIFY_NAV_STATE', 'SCROLL_TO_END'],
        expectManualOverride: false,
      },
      {
        event: { type: 'TOGGLE' },
        expectMode: 'fullscreen',
        expectActions: ['NOTIFY_NAV_STATE'],
        expectManualOverride: true,
      },
    ],
  },
  {
    name: 'когда на mobile (не home) навбар скрыт, бургер разворачивает его',
    bp: 'mobile',
    isHome: false,
    initialMode: 'invisible',
    steps: [
      {
        event: { type: 'TOGGLE' },
        expectMode: 'fullscreen',
        expectActions: ['NOTIFY_NAV_STATE'],
        expectManualOverride: true,
      },
    ],
  },
  {
    name: 'когда на desktop кнопки бургера нет, событие TOGGLE не меняет навбар',
    bp: 'desktop',
    isHome: true,
    initialMode: 'fullscreen',
    steps: [
      {
        event: { type: 'TOGGLE' },
        expectMode: 'fullscreen',
        expectActions: [],
        expectManualOverride: false,
      },
    ],
  },
  {
    name: 'когда на tablet жмут бургер, стандартная колонка сворачивается в узкую (предпочтение сохраняется)',
    bp: 'tablet',
    isHome: false,
    initialMode: 'standard',
    steps: [
      {
        event: { type: 'TOGGLE' },
        expectMode: 'slim',
        expectActions: ['NOTIFY_NAV_STATE', 'RETARGET_SCRUB'],
        expectPreferred: 'slim',
        expectManualOverride: false,
      },
    ],
  },
  {
    name: 'когда на tablet жмут бургер в узкой полосе, навбар возвращается в стандартную колонку',
    bp: 'tablet',
    isHome: false,
    initialMode: 'slim',
    steps: [
      {
        event: { type: 'TOGGLE' },
        expectMode: 'standard',
        expectActions: ['NOTIFY_NAV_STATE', 'RETARGET_SCRUB'],
        expectPreferred: 'standard',
        expectManualOverride: false,
      },
    ],
  },
  {
    name: 'когда на /home на tablet доскролливают спейсер до верхней границы, навбар разворачивается даже после сворачивания',
    bp: 'tablet',
    isHome: true,
    initialMode: 'slim',
    steps: [
      {
        event: { type: 'REACH_TOP' },
        expectMode: 'fullscreen',
        expectActions: ['NOTIFY_NAV_STATE'],
        expectManualOverride: false,
      },
    ],
  },
  {
    name: 'когда на /home на tablet с выбором slim доскролливают спейсер до нижней границы, навбар останавливается в узкой полосе',
    bp: 'tablet',
    isHome: true,
    initialMode: 'fullscreen',
    preferred: 'slim',
    steps: [
      {
        event: { type: 'REACH_TOP' },
        expectMode: 'fullscreen',
        expectActions: [],
        expectManualOverride: false,
      },
      {
        event: { type: 'REACH_BOTTOM' },
        expectMode: 'slim',
        expectActions: ['NOTIFY_NAV_STATE'],
        expectManualOverride: false,
      },
    ],
  },
  {
    name: 'когда на /home на mobile навбар свёрнут вручную, скролл спейсера до нижней границы его не трогает',
    bp: 'mobile',
    isHome: true,
    initialMode: 'fullscreen',
    steps: [
      {
        event: { type: 'TOGGLE' },
        expectMode: 'invisible',
        expectActions: ['NOTIFY_NAV_STATE', 'SCROLL_TO_END'],
        expectManualOverride: false,
      },
      {
        event: { type: 'REACH_BOTTOM' },
        expectMode: 'invisible',
        expectActions: [],
        expectManualOverride: false,
      },
    ],
  },
  {
    name: 'когда на mobile переходят на другую страницу, навбар остаётся в default (скрыт)',
    bp: 'mobile',
    isHome: false,
    initialMode: 'invisible',
    steps: [
      {
        event: { type: 'ROUTE_CHANGED' },
        expectMode: 'invisible',
        expectActions: [],
        expectPreferred: null,
        expectManualOverride: false,
      },
    ],
  },
  {
    name: 'когда на tablet с выбранным slim меняется брейкпоинт (в пределах tablet), выбор сохраняется',
    bp: 'tablet',
    isHome: false,
    initialMode: 'slim',
    preferred: 'slim',
    steps: [
      {
        event: { type: 'BREAKPOINT_CHANGED', bp: 'tablet' },
        expectMode: 'slim',
        expectActions: [],
        expectPreferred: 'unchanged',
        expectManualOverride: false,
      },
    ],
  },
  {
    name: 'когда non-home с выбором slim переходит на mobile, предпочтение сбрасывается в default (скрыт)',
    bp: 'mobile',
    isHome: false,
    initialMode: 'slim',
    preferred: 'slim',
    steps: [
      {
        event: { type: 'BREAKPOINT_CHANGED', bp: 'mobile' },
        expectMode: 'invisible',
        expectActions: ['NOTIFY_NAV_STATE'],
        expectPreferred: null,
        expectManualOverride: false,
      },
    ],
  },
  {
    name: 'когда заканчивается intro, состояние навбара не меняется',
    bp: 'desktop',
    isHome: true,
    initialMode: 'fullscreen',
    steps: [
      {
        event: { type: 'INTRO_COMPLETE' },
        expectMode: 'fullscreen',
        expectActions: [],
        expectManualOverride: false,
      },
    ],
  },
];

/**
 * Новые кейсы (manualOverride как first-class состояние машины).
 */
const manualCases: Case[] = [
  {
    name: 'когда на /home на mobile жмут бургер из fullscreen, флаг manualOverride снимается (false)',
    bp: 'mobile',
    isHome: true,
    initialMode: 'fullscreen',
    steps: [
      {
        event: { type: 'TOGGLE' },
        expectMode: 'invisible',
        expectActions: ['NOTIFY_NAV_STATE', 'SCROLL_TO_END'],
        expectManualOverride: false,
      },
    ],
  },
  {
    name: 'когда вне /home на mobile жмут бургер из invisible, флаг manualOverride становится true',
    bp: 'mobile',
    isHome: false,
    initialMode: 'invisible',
    steps: [
      {
        event: { type: 'TOGGLE' },
        expectMode: 'fullscreen',
        expectActions: ['NOTIFY_NAV_STATE'],
        expectManualOverride: true,
      },
    ],
  },
  {
    name: 'когда на /home mobile вручную открытый навбар закрывают бургером, флаг снимается и REACH_BOTTOM ничего не меняет',
    bp: 'mobile',
    isHome: true,
    initialMode: 'fullscreen',
    manualOverride: true,
    steps: [
      {
        event: { type: 'TOGGLE' },
        expectMode: 'invisible',
        expectActions: ['NOTIFY_NAV_STATE', 'SCROLL_TO_END'],
        expectManualOverride: false,
      },
      {
        event: { type: 'REACH_BOTTOM' },
        expectMode: 'invisible',
        expectActions: [],
        expectManualOverride: false,
      },
    ],
  },
  {
    name: 'когда на /home mobile при manual invisible приходит REACH_TOP, флаг сбрасывается в false',
    bp: 'mobile',
    isHome: true,
    initialMode: 'invisible',
    manualOverride: true,
    steps: [
      {
        event: { type: 'REACH_TOP' },
        expectMode: 'fullscreen',
        expectActions: ['NOTIFY_NAV_STATE'],
        expectManualOverride: false,
      },
    ],
  },
  {
    name: 'когда при manual mobile invisible идёт ROUTE_CHANGED, флаг сбрасывается в false',
    bp: 'mobile',
    isHome: false,
    initialMode: 'invisible',
    manualOverride: true,
    steps: [
      {
        event: { type: 'ROUTE_CHANGED' },
        expectMode: 'invisible',
        expectActions: [],
        expectPreferred: null,
        expectManualOverride: false,
      },
    ],
  },
  {
    name: 'когда при manual mobile invisible идёт BREAKPOINT_CHANGED, флаг сбрасывается в false',
    bp: 'mobile',
    isHome: true,
    initialMode: 'invisible',
    manualOverride: true,
    steps: [
      {
        event: { type: 'BREAKPOINT_CHANGED', bp: 'tablet' },
        expectMode: 'fullscreen',
        expectActions: ['NOTIFY_NAV_STATE'],
        expectManualOverride: false,
      },
    ],
  },
  {
    name: 'когда при manual mobile приходит INTRO_COMPLETE, флаг сохраняется (preserve)',
    bp: 'mobile',
    isHome: true,
    initialMode: 'fullscreen',
    manualOverride: true,
    steps: [
      {
        event: { type: 'INTRO_COMPLETE' },
        expectMode: 'fullscreen',
        expectActions: [],
        expectManualOverride: true,
      },
    ],
  },
  {
    name: 'corner: manual mobile fullscreen + 2× REACH_BOTTOM — state и override сохраняются',
    bp: 'mobile',
    isHome: true,
    initialMode: 'fullscreen',
    manualOverride: true,
    steps: [
      {
        event: { type: 'REACH_BOTTOM' },
        expectMode: 'fullscreen',
        expectActions: [],
        expectManualOverride: true,
      },
      {
        event: { type: 'REACH_BOTTOM' },
        expectMode: 'fullscreen',
        expectActions: [],
        expectManualOverride: true,
      },
    ],
  },
];

function runCase(c: Case) {
  // AAA: конфиг Case (bp/isHome/initialMode/preferred) — Arrange,
  // а steps ниже — Act + Assert по каждому событию.
  let state = c.initialMode;
  let preferred = c.preferred ?? null;
  let lastSource: LayoutChangeSource = 'route';
  let manual = c.manualOverride ?? false;

  for (const step of c.steps) {
    const source = EVENT_TO_SOURCE[step.event.type];
    const result = transition(
      state,
      step.event,
      makeContext(c.bp, c.isHome, preferred, source, lastSource, manual),
    );

    expect(result.state, step.event.type).toBe(step.expectMode);

    if (step.expectActions) {
      expect(
        result.actions.map((a) => a.type),
        step.event.type,
      ).toEqual(step.expectActions);
    }

    const expected =
      step.expectPreferred === undefined ? 'unchanged' : step.expectPreferred;
    if (expected === 'unchanged') {
      expect(
        result.preferredAfter === undefined,
        `preferredAfter должен остаться без изменений (${step.event.type})`,
      ).toBe(true);
    } else {
      expect(result.preferredAfter, step.event.type).toBe(expected);
    }

    const finalManual = result.manualOverrideAfter ?? manual;
    const expectedManual = step.expectManualOverride ?? manual;
    expect(finalManual, `${step.event.type} → manualOverride`).toBe(
      expectedManual,
    );

    state = result.state;
    if (result.preferredAfter !== undefined) preferred = result.preferredAfter;
    lastSource = source;
    manual = finalManual;
  }
}

describe('поведение навбара при бургере, скролле и смене окружения', () => {
  it.each(cases.map((c) => [c.name, c] as const))('%s', (_name, c) => {
    runCase(c);
  });
});

describe('ручной override manualOverride на mobile', () => {
  it.each(manualCases.map((c) => [c.name, c] as const))('%s', (_name, c) => {
    runCase(c);
  });
});

describe('уведомление подписчиков о смене состояния', () => {
  it('когда состояние меняется, уведомление несёт prev/next/source', () => {
    const ctx = makeContext('mobile', true, null, 'toggle', 'route');
    const result = transition('fullscreen', { type: 'TOGGLE' }, ctx);
    expect(result.actions[0]).toEqual({
      type: 'NOTIFY_NAV_STATE',
      prev: 'fullscreen',
      next: 'invisible',
      source: 'toggle',
    });
  });

  it('когда приходит событие, источник в уведомлении — из EVENT_TO_SOURCE', () => {
    const result = transition(
      'standard',
      { type: 'REACH_BOTTOM' },
      makeContext('tablet', false, null, EVENT_TO_SOURCE.REACH_BOTTOM, 'route'),
    );
    const action = result.actions[0];
    expect(action.type === 'NOTIFY_NAV_STATE' && action.source).toBe('scroll');
  });
});

describe('граничные случаи: события без эффекта', () => {
  it('когда на mobile бургер жмут в недоступном состоянии, эффекта нет', () => {
    const ctx = makeContext('mobile', false, null, 'toggle', 'route');
    const result = transition('standard', { type: 'TOGGLE' }, ctx);
    expect(result).toEqual({ state: 'standard', actions: [] });
  });

  it('когда на tablet бургер жмут при развёрнутом навбаре, эффекта нет', () => {
    const ctx = makeContext('tablet', false, null, 'toggle', 'route');
    const result = transition('fullscreen', { type: 'TOGGLE' }, ctx);
    expect(result).toEqual({ state: 'fullscreen', actions: [] });
  });

  it('когда на tablet бургер жмут при скрытом навбаре, эффекта нет', () => {
    const ctx = makeContext('tablet', false, null, 'toggle', 'route');
    const result = transition('invisible', { type: 'TOGGLE' }, ctx);
    expect(result).toEqual({ state: 'invisible', actions: [] });
  });

  it('когда на mobile спейсер доскроллен до верхней границы из любого состояния, навбар разворачивается', () => {
    for (const state of ['invisible', 'standard', 'slim'] as LayoutMode[]) {
      const ctx = makeContext('mobile', true, null, 'scroll', 'route');
      const result = transition(state, { type: 'REACH_TOP' }, ctx);
      expect(result.state, state).toBe('fullscreen');
    }
  });
});

describe('сохранение предпочтения пользователя на планшете', () => {
  it('когда на tablet переключают колонку бургером, предпочтение персистит в обе стороны', () => {
    const upward = transition(
      'standard',
      { type: 'TOGGLE' },
      makeContext('tablet', false, null, 'toggle', 'route'),
    );
    expect(upward.preferredAfter).toBe('slim');

    const backward = transition(
      'slim',
      { type: 'TOGGLE' },
      makeContext('tablet', false, 'slim', 'toggle', 'route'),
    );
    expect(backward.preferredAfter).toBe('standard');
  });

  it('когда non-home на mobile меняет роут, невалидное предпочтение сбрасывается', () => {
    const result = transition(
      'slim',
      { type: 'ROUTE_CHANGED' },
      makeContext('mobile', false, 'slim', 'route', 'toggle'),
    );
    expect(result.preferredAfter).toBeNull();
  });

  it('когда на home меняют роут, предпочтение не трогается', () => {
    const result = transition(
      'fullscreen',
      { type: 'ROUTE_CHANGED' },
      makeContext('tablet', true, 'slim', 'route', 'toggle'),
    );
    expect(result.preferredAfter).toBeUndefined();
    expect(result.state).toBe('fullscreen');
  });
});
