# Layout — layout-движок

Замена старого `src/components/layout/` на `src/components/Layout/`,
построенный с нуля. Направление — **state machine → LayoutSnapshot →
GSAP анимирует CSS-переменные на root → CSS задаёт размеры/позиции
слотов**.

## Файлы

```
src/components/Layout/
├── machine/
│   ├── layoutMode.ts        # типы: LayoutMode, LayoutEvent, MachineContext,
│   │                        #   LayoutAction, EVENT_TO_SOURCE
│   ├── transition.ts        # чистый reducer (transition(state, event, ctx))
│   ├── derive.ts            # getDefaultState, homeEndStateFor, isManualMobileState,
│   │                        #   isPreferredStateValid, isHomePath, hasToggleFor
│   ├── geometry.ts          # SLIM_WIDTH, getNavTransform(state, viewport),
│   │                        #   deriveMainOffset
│   └── layoutSnapshot.ts    # LayoutSnapshot, LayoutVars, LayoutTransition,
│                            #   ROOT_VAR_NAMES, resolveLayout (ctx → snapshot)
├── engine.ts                # createLayoutEngine (внешний движок)
├── gsap/
│   ├── gsapBus.ts           # 60fps-шина на gsap.ticker (каналы: scroll:frame, frame)
│   ├── gsapContext.ts       # контекст шины + useGsapBus
│   ├── GsapProvider.tsx     # инфраструктура (bus, ticker, cleanup)
│   ├── GsapLayoutBridge.tsx # адаптер: edge-detection на /home,
│   │                        #   хук useRegisterHomeSpacer для страниц
│   └── useRegisterHomeSpacer.ts # регистрация spacer-элемента /home
├── context/
│   ├── layoutContexts.ts    # LayoutEngineContext + LayoutSnapshotContext,
│   │                        #   useLayoutEngine/Snapshot/Send
│   └── LayoutProvider.tsx   # реакция на bp/route/resize, владеет движком
├── slots/
│   ├── LayoutRoot.tsx       # корневая нода с CSS-переменными
│   ├── LayoutSlot.tsx       # navbar/content слот (через engine.registerSlot)
│   └── useLayoutApplier.ts  # snapshot → gsap.to(root, vars)
├── nav/
│   ├── VerticalNavigationBar.tsx
│   ├── ToggleButton.tsx
│   ├── NavList.tsx
│   ├── NavItem.tsx
│   ├── navItems.ts
│   └── *.module.css
└── styles/
    └── layout.css           # vars → геометрия слотов (без data-*)
```

## Зафиксированные решения

| #   | Решение                                                                                                                                                                   |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Чистый с нуля. `src/components/Layout/` строится пустым; существующий `LayoutState.ts` удаляется. Переноса кода из старого движка нет.                                    |
| D2  | Старый движок `src/components/layout/` удалён полностью.                                                                                                                  |
| D3  | State machine — чистая TS-функция (`transition(state, event, ctx)`), без XState/внешних библиотек.                                                                        |
| D4  | Новый контракт API контекста (см. `context/layoutContexts.ts`): `useLayoutEngine` / `useLayoutSnapshot` / `useLayoutSend`. Старый `useLayout()` заменён на их комбинацию. |
| D5  | Navbar остаётся вертикальным (окно `100vw` + `translateX`, отступ контента через `margin-left` у `<main>`).                                                               |
| D5a | States: `fullscreen \| standard \| slim \| invisible`; `SLIM_WIDTH = 80`.                                                                                                 |
| D6  | `bp` в snapshot: через событие `{ type: 'BREAKPOINT_CHANGED'; bp: Breakpoint }`.                                                                                          |
| D7  | Вместо `data-*` атрибутов — только CSS-переменные (вариант A). Поведенческие сигналы через vars (`--nav-pointer-events`, `--layout-state`).                               |
| D8  | GSAP-слой в `Layout/gsap/`: `gsapBus.ts` (60fps-шина), `GsapProvider.tsx` (инфраструктура), `GsapLayoutBridge.tsx` (адаптер 60fps → дискретные события).                  |
| D10 | Реализация в 8 фазах (P1–P8).                                                                                                                                             |

## Поток данных

```text
GSAP 60fps events (scroll:frame, frame)
  → GsapLayoutBridge (edge-detection, throttle)
  → LayoutEngine (state machine + LayoutSnapshot)
  → useLayoutApplier (gsap.to на CSS-переменных root)
  → layout.css (vars → размеры/позиции слотов)
```

## Роли

| Сущность           | Ответственность                                                                             |
| ------------------ | ------------------------------------------------------------------------------------------- |
| `machine/`         | Чистый TS-слой. Никаких React/GSAP/DOM.                                                     |
| `engine.ts`        | Внешний (не-React) движок. `send/subscribe/getSnapshot/setViewport/setIsHome/registerSlot`. |
| `GsapProvider`     | GSAP-инфраструктура: bus + ticker + cleanup. Не знает про layout.                           |
| `GsapLayoutBridge` | Адаптер: слушает 60fps-шину, edge-detection, шлёт редкие события в engine.                  |
| `LayoutProvider`   | React-обёртка движка; реакция на `useBreakpoint`/`useLocation`/resize.                      |
| `useLayoutApplier` | snapshot → `gsap.to(root, vars)` + scrollLock + `ScrollTrigger.refresh` после дискретных.   |
| `layout.css`       | Превращает `--vars` в геометрию слотов.                                                     |

## Публичный API (контракт страниц)

```ts
import {
  useLayoutEngine,
  useLayoutSnapshot,
  useLayoutSend,
} from 'src/components/Layout/context/layoutContexts';
import { useRegisterHomeSpacer } from 'src/components/Layout/gsap/GsapLayoutBridge';

// Для HomePage:
useRegisterHomeSpacer(spacerRef);

// Для произвольной кнопки toggle:
const send = useLayoutSend();
const snapshot = useLayoutSnapshot();
<button onClick={() => send({ type: 'TOGGLE' })}>{snapshot.value}</button>;
```

## LayoutVars (root)

| Var                      | Назначение                                                   |
| ------------------------ | ------------------------------------------------------------ |
| `--nav-x`                | px-сдвиг окна `.nav` (`getNavTransform`).                    |
| `--nav-pointer-events`   | `none` (invisible) / `auto` — чтобы клики не проваливались.  |
| `--nav-content-offset`   | `margin-left` `<main>` (vw/px).                              |
| `--layout-state`         | `fullscreen \| standard \| slim \| invisible` (для отладки). |
| `--layout-scroll-locked` | `1 \| 0` (резерв для modal/immersive).                       |

## Acceptance criteria

- [x] Нет `data-* state` атрибутов в layout — только CSS-переменные (D7).
- [x] `machine/` + `engine.ts` — чистые (без React/GSAP), `import type` для типов.
- [x] `GsapProvider` не знает про navbar; мост отдельный (D8).
- [x] `bp` присутствует в snapshot и учитывается (D6).
- [x] Старый `src/components/layout/` удалён, импортов нет (D2).
- [x] Контракт страниц: `useRegisterHomeSpacer` для `/home`.
- [x] `npm run build` зелёный.
- [ ] `npm run lint`, `npm run stylelint`, `npm run format` — будут проверены вручную.
- [ ] Документация `docs/architecture.md` — обновление осталось.
