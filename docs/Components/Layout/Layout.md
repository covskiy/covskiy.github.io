# Layout — машина состояния + per-component animator

Layout-модуль (`src/components/layout/`) — движок раскладки всей страницы:
навбар (`fixed`) + контентная область `<main>`, модель построена на принципе
**один источник состояния + каждый компонент сам строит свою анимацию**:

```
LayoutProvider (useState<LayoutMode>; триггер-эффекты; низкоуровневые каналы)
   ├─ mode ───────── derive ── mainOffset / hasToggle / isSlim
   ├─ NavigationBar (панель): useLayout()
   │    ├─ NavPosition: единственный владелец .nav (scrub + discrete)
   │    │    └─ один низкоуровневый канал onNavState(prev,next,source) для .nav
   │    ├─ NavList/NavItem: useLayout() → собственный useGSAP(deps:[mode])
   │    └─ ToggleButton: клик → layout.toggle() → dispatch({ type: 'TOGGLE' })
   ├─ <main>: offset = selectContentOffset(mode)   (--nav-content-offset)
   └─ onScrollProgress / onToggleVisibility — низкоуровневые каналы
```

## Структура

```
src/components/layout/
├── index.ts                          # публичный API модуля
├── LayoutProvider/
│   ├── LayoutProvider.tsx            # композер: useLayoutMachine + useScrollScrub,
│   │                                 #   каналы, scrollToRef, разметка nav+main
│   ├── LayoutProvider.module.css     # .app, .main (--nav-content-offset)
│   └── LayoutContext.ts              # LayoutContextValue + useLayout()
├── machine/                          # ЧИСТАЯ логика — без React и GSAP
│   ├── layoutMode.ts                 # LayoutMode, LayoutChangeSource, LayoutEvent,
│   │                                 #   LayoutAction, MachineContext
│   ├── transition.ts                 # transition(state,event,ctx) → { state, actions, preferredAfter }
│   ├── selectors.ts                  # selectIsSlim/HasToggle/IsHome/NavX/HomeEndState/ContentOffset
│   ├── geometry.ts                   # SLIM_WIDTH, getNavTransform, deriveMainOffset
│   └── derive.ts                     # getDefaultState, getNextState, homeEndStateFor,
│                                     #   isPreferredStateValid, hasToggleFor, isManualMobileState, isHomePath
├── scenes/                           # React-хуки-сцены (по одной ответственности)
│   ├── useLayoutMachine.ts           # executor: useState + стабильный dispatch + actions (v2)
│   ├── useScrollScrub.ts             # сенсор /home: ScrollTrigger, REACH_*, видимость toggle, scrollTo
│   └── useNavPosition.ts             # единственный владелец позиции .nav (scrub + discrete)
└── nav/                              # презентационная часть (панель = часть layout)
    ├── NavigationBar.tsx             # <nav> + компоновка (лого, NavList, ToggleButton)
    ├── NavigationBar.module.css
    ├── NavList.tsx
    ├── NavList.module.css
    ├── NavItem.tsx
    ├── NavItem.module.css
    ├── navItems.ts                   # конфиг ссылок (path/label/icon)
    ├── ToggleButton.tsx
    └── ToggleButton.module.css
```

## Правила развязки (кто что знает)

Однонаправленные зависимости: `nav → context → scenes → machine`; провайдер —
наверху.

- **`machine/`** — pure, без React и GSAP. `transition.ts` — единственный
  решатель переходов; `selectors.ts` — единые производные.
- **`scenes/`** — импортируют `machine` + контекст; **не** импортируют панели
  `nav/`. Каждая сцена владеет своей областью (machine / scrub / позиция `.nav`).
- **`nav/`** — читают из контекста `mode`/`isSlim` (или получают пропом),
  строят свои `useGSAP`; не импортируют `scenes/` и провайдер.
- **`LayoutProvider`** — единственный, кто знает обе стороны: собирает сцены,
  держит низкоуровневые каналы, рефы `scrollToRef`/`retargetScrubRef`,
  рендерит `nav` + `<main>`.

## Модель «редюсер + executor» (v2)

- **редucer-функция** — чистая `machine/transition.ts` (`transition(state,event,ctx)`
  → `{ state, actions, preferredAfter }`), без React/GSAP/DOM.
- **executor** — `scenes/useLayoutMachine`: `useState`, стабильный `dispatch`,
  собирает `MachineContext`, применяет `preferredAfter` и actions к refs-каналам,
  обновляет `lastSource` и логирует переходы.
- **сенсор** — `useScrollScrub`: только input — диспатчит `REACH_TOP`/
  `REACH_BOTTOM` на границах; видимость toggle и `scrollTo` остаются здесь.

## Что удалено в ходе рефакторинга

| Что                                                                             | Причина            |
| ------------------------------------------------------------------------------- | ------------------ |
| `navbarEventBus.ts`, `NavbarEventMap`, `createNavbarEventBus`, `useNavbarEvent` | слой pub/sub убран |
| `scenes/useLayoutState.ts`, `scenes/useLayoutToggle.ts`                          | заменены `useLayoutMachine` |
| `NOTIFY_TOGGLE_VISIBILITY` action в машине                                    | видимость — производная скролла, живёт в scrub |
| `spacer:enter` / `spacer:leave`                                                 | нет потребителей   |
| `'intro'` в источнике изменения                                                  | мёртвый reserved   |

### Как вернуть (для будущих сессий)

- **интеграция с IntroAnimation**: `INTRO_COMPLETE` уже в `LayoutEvent`,
  `transition` возвращает NOOP; подключить — диспатчить из `HomePage`.
- **`NOTIFY_TOGGLE_VISIBILITY` в машину** — не планируется (решение +2).

## Публичный API (`index.ts`)

- компонент `LayoutProvider`
- хук `useLayout()`
- хелперы геометрии: `getNavTransform`, `SLIM_WIDTH`
- типы: `LayoutMode`, `LayoutChangeSource`, `NavTransform`

Экспортов шины событий больше нет. Внутренние типы (`LayoutEvent`,
`LayoutAction`, `MachineContext`, `TransitionResult`) — приватны.