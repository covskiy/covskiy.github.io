# machine — чистая логика раскладки

`src/components/layout/machine/` — слой **без React и GSAP**: только типы и
хелперы. НЕ импортирует React/GSAP/Context. Импортируется любым слоем.

## `layoutMode.ts`

- `LayoutMode` — `'fullscreen' | 'standard' | 'slim' | 'invisible'`.
- `LayoutChangeSource` — `'toggle' | 'route' | 'breakpoint' | 'scroll'`.
  Источник позволяет отличить автоматическое переключение (скролл, роут,
  breakpoint) от ручного (toggle) — в первую очередь для сцены-владельца
  позиции `.nav`.
- `LayoutEvent` — событие-первопричина (XState-style, КАПСОМ):
  `TOGGLE`, `ROUTE_CHANGED`, `BREAKPOINT_CHANGED`, `REACH_TOP`,
  `REACH_BOTTOM`, `INTRO_COMPLETE`. Маппинг `event.type → LayoutChangeSource`
  живёт в executor-е (`EVENT_TO_SOURCE`).
- `LayoutAction` — плоская команда для executor-а:
  `NOTIFY_NAV_STATE(prev,next,source)`, `SCROLL_TO_END`, `RETARGET_SCRUB`,
  `NOOP`.
- `MachineContext` — контекст для `transition()`: `bp`, `isHome`, `preferred`,
  `lastSource`, `source`. Собирается в executor-е из актуальных refs.

## `geometry.ts`

- `SLIM_WIDTH = 80` — ширина slim-навбара (px).
- `getNavTransform(mode, viewport): NavTransform` — `navX` для GSAP-твинов:
  навбар всегда `100vw`, видимая ширина достигается сдвигом окна.
- `deriveMainOffset(mode, bp, isHome, homeEndState?): string` — отступ
  контентной области `<main>` (CSS-единица). `mobile → 0`, `/home`
  fullscreen маппится на `homeEndState`, иначе `25vw`/`80px`/`0px`.

## `derive.ts`

- `isHomePath(pathname)` — `/` или `/home`.
- `hasToggleFor(bp)` — toggle есть везде кроме desktop.
- `getDefaultState(bp, isHome)` — `/home` → fullscreen; иначе invisible/slim/standard.
- `getNextState(current, bp)` — ручное переключение (mobile invisible↔fullscreen,
  tablet standard↔slim, desktop → null).
- `homeEndStateFor(bp, preferred)` — конечное состояние на `/home` после скролла.
- `isManualMobileState(bp, source, mode)` — признак ручного mobile-состояния
  («пин» scrub-таймлайна).
- `isPreferredStateValid(state, bp)` — персистируем только tablet slim/standard.

## `selectors.ts` — селекторы поверх derive/geometry

- `selectIsSlim(mode)` — `slim`/`invisible`.
- `selectHasToggle(bp)` — `bp !== 'desktop'`.
- `selectIsHome(pathname)` — `/` или `/home`.
- `selectNavX(mode, viewport)` — `getNavTransform(...).navX`.
- `selectHomeEndState(bp, preferred)` — `homeEndStateFor(...)`.
- `selectContentOffset(mode, bp, isHome, homeEndState)` — `deriveMainOffset(...)`.

Используются в `LayoutProvider` и консьюмерах; старые имена в `derive.ts`/
`geometry.ts` остаются для внутренней миграции.

## `transition.ts` — единственный решатель переходов

`transition(state, event, ctx): TransitionResult` — чистая reducer-функция.
`TransitionResult = { state, actions, preferredAfter? }`, где `preferredAfter`
`undefined` — не менять ручной tablet-выбор, `null` — сбросить.

Правила (таблица переходов, полная версия — `task/12.LayoutRefactoring-v2.md` §5):

| Event | Условие | Следующее | Actions | `preferredAfter` |
| --- | --- | --- | --- | --- |
| `TOGGLE` | desktop (guard) | `state` | — | — |
| `TOGGLE` | mobile `fullscreen` | `invisible` | `NOTIFY_NAV_STATE`, `SCROLL_TO_END` (если `/home`) | — |
| `TOGGLE` | mobile `invisible` | `fullscreen` | `NOTIFY_NAV_STATE` | — |
| `TOGGLE` | tablet `standard` | `slim` | `NOTIFY_NAV_STATE`, `RETARGET_SCRUB` | `slim` |
| `TOGGLE` | tablet `slim` | `standard` | `NOTIFY_NAV_STATE`, `RETARGET_SCRUB` | `standard` |
| `REACH_TOP` | — | `fullscreen` | `NOTIFY_NAV_STATE` (если изменился) | — |
| `REACH_BOTTOM` | mobile-pin (`isManualMobileState(bp,lastSource,state)`) | `state` | — | — |
| `REACH_BOTTOM` | иначе | `homeEndStateFor(bp,preferred)` | `NOTIFY_NAV_STATE` (если изменился) | — |
| `ROUTE_CHANGED` | `/home` | `fullscreen` | `NOTIFY_NAV_STATE` (если изменился) | — |
| `ROUTE_CHANGED` | не `/home`, preferred валиден | `preferred` | `NOTIFY_NAV_STATE` (если изменился) | — |
| `ROUTE_CHANGED` | не `/home`, preferred невалиден | `getDefaultState(bp,false)` | `NOTIFY_NAV_STATE` (если изменился) | `null` |
| `BREAKPOINT_CHANGED` | (как `ROUTE_CHANGED`, bp текущий) | — | — | — |
| `INTRO_COMPLETE` | placeholder | `state` | — | — |

Нюансы:

- Источник в `NOTIFY_NAV_STATE` берётся из `ctx.source` (executor маппит
  `event.type → LayoutChangeSource`); `transition` источник сама НЕ выводит.
- **No-op short-circuit**: если `next === state` — actions пустые (без
  `NOTIFY_NAV_STATE` с `prev === next`). Executor при этом ВСЕГДА обновляет
  `lastSourceRef` — повторный `REACH_TOP` на верху после ручного fullscreen
  обязан снять mobile-«пин».
- `isManualMobileState` внутри `REACH_BOTTOM` смотрит `ctx.lastSource`, НЕ
  `ctx.source`.