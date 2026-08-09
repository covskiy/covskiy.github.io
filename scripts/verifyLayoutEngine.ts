/**
 * Smoke-test layout-движка.
 *
 * Запуск: node --experimental-strip-types scripts/verifyLayoutEngine.ts
 * (Node 22.6+ / 24.x — нативный TS без бандлеров).
 *
 * Не покрывает юнит-тестами; проверяет ключевые сценарии reducer-а
 * и поведение `createNewLayoutEngine` руками.
 */

import { createNewLayoutEngine } from '../src/components/NewLayout/engine.ts';
import type { LayoutEvent, LayoutMode } from '../src/components/NewLayout/machine/layoutMode.ts';
import type { Breakpoint } from '../src/components/NewLayout/machine/layoutMode.ts';

interface Case {
  name: string;
  bp: Breakpoint;
  isHome: boolean;
  initialMode?: LayoutMode;
  steps: Array<{ event: LayoutEvent; expectMode: LayoutMode; expectSource?: string }>;
  preferred?: LayoutMode | null;
}

const cases: Case[] = [
  {
    name: 'mobile /home: TOGGLE fullscreen → invisible (+SCROLL_TO_END)',
    bp: 'mobile',
    isHome: true,
    steps: [{ event: { type: 'TOGGLE' }, expectMode: 'invisible' }],
  },
  {
    name: 'mobile /home: TOGGLE invisible → fullscreen',
    bp: 'mobile',
    isHome: true,
    steps: [
      { event: { type: 'TOGGLE' }, expectMode: 'invisible' },
      { event: { type: 'TOGGLE' }, expectMode: 'fullscreen' },
    ],
  },
  {
    name: 'mobile /other: TOGGLE invisible → fullscreen',
    bp: 'mobile',
    isHome: false,
    steps: [{ event: { type: 'TOGGLE' }, expectMode: 'fullscreen' }],
  },
  {
    name: 'desktop /home: TOGGLE — ноп (кнопка скрыта)',
    bp: 'desktop',
    isHome: true,
    steps: [{ event: { type: 'TOGGLE' }, expectMode: 'fullscreen' }],
  },
  {
    name: 'tablet /other: TOGGLE standard → slim (preferred persists)',
    bp: 'tablet',
    isHome: false,
    initialMode: 'standard',
    steps: [{ event: { type: 'TOGGLE' }, expectMode: 'slim' }],
  },
  {
    name: 'tablet /other: TOGGLE slim → standard',
    bp: 'tablet',
    isHome: false,
    initialMode: 'slim',
    steps: [{ event: { type: 'TOGGLE' }, expectMode: 'standard' }],
  },
  {
    name: 'tablet /home: REACH_TOP → fullscreen даже после slim',
    bp: 'tablet',
    isHome: true,
    initialMode: 'slim',
    steps: [
      { event: { type: 'REACH_TOP' }, expectMode: 'fullscreen' },
    ],
  },
  {
    name: 'tablet /home: REACH_BOTTOM → homeEnd (preferred=slim)',
    bp: 'tablet',
    isHome: true,
    preferred: 'slim',
    steps: [
      { event: { type: 'REACH_TOP' }, expectMode: 'fullscreen' },
      { event: { type: 'REACH_BOTTOM' }, expectMode: 'slim' },
    ],
  },
  {
    name: 'mobile /home: REACH_BOTTOM записинен toggle-ом → noop',
    bp: 'mobile',
    isHome: true,
    steps: [
      { event: { type: 'TOGGLE' }, expectMode: 'invisible' },
      { event: { type: 'REACH_BOTTOM' }, expectMode: 'invisible' },
    ],
  },
  {
    name: 'ROUTE_CHANGED → /home форсит fullscreen',
    bp: 'mobile',
    isHome: false,
    steps: [{ event: { type: 'ROUTE_CHANGED' }, expectMode: 'invisible' }],
  },
  {
    name: 'BREAKPOINT_CHANGED → non-home с preferred=slim (tablet, валиден)',
    bp: 'tablet',
    isHome: false,
    preferred: 'slim',
    steps: [{ event: { type: 'BREAKPOINT_CHANGED', bp: 'tablet' }, expectMode: 'slim' }],
  },
  {
    name: 'BREAKPOINT_CHANGED → non-home с preferred=slim переход на mobile (сброс)',
    bp: 'mobile',
    isHome: false,
    preferred: 'slim',
    initialMode: 'slim',
    steps: [{ event: { type: 'BREAKPOINT_CHANGED', bp: 'mobile' }, expectMode: 'invisible' }],
  },
  {
    name: 'INTRO_COMPLETE — ноп',
    bp: 'desktop',
    isHome: true,
    steps: [{ event: { type: 'INTRO_COMPLETE' }, expectMode: 'fullscreen' }],
  },
];

let failed = 0;

for (const c of cases) {
  const engine = createNewLayoutEngine({
    initialContext: {
      bp: c.bp,
      isHome: c.isHome,
      preferred: c.preferred ?? null,
      lastSource: 'route',
      source: 'route',
      homeEndState: bpDefaultEnd(c.bp, c.preferred ?? null),
    },
    initialMode: c.initialMode,
    viewport: 1024,
  });

  let lastEvents: LayoutEvent[] = [];
  const events: Array<{ mode: LayoutMode; source: string }> = [];
  engine.subscribe((s) => {
    events.push({ mode: s.value, source: s.context.source });
  });

  let ok = true;
  for (const step of c.steps) {
    lastEvents = [step.event];
    engine.send(step.event);
    const actual = engine.getMode();
    if (actual !== step.expectMode) {
      console.error(
        `FAIL [${c.name}] event=${step.event.type} expect=${step.expectMode} got=${actual}`,
      );
      ok = false;
      failed++;
    }
  }

  if (ok) {
    console.log(`OK   [${c.name}]  (${events.length} notify)`);
  }
  engine.dispose();
}

if (failed > 0) {
  console.error(`\n${failed} failing case(s)`);
  process.exit(1);
}

console.log(`\nAll ${cases.length} cases passed.`);

function bpDefaultEnd(bp: Breakpoint, preferred: LayoutMode | null): LayoutMode {
  if (bp === 'mobile') return 'invisible';
  if (bp === 'tablet' && preferred) return preferred;
  return 'standard';
}
