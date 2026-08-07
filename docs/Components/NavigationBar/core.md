# core (чистая логика без React)

Доменная логика навбара и контекст API, без JSX и GSAP.

Файлы: `src/components/NavigationBar/core/navbarStates.ts`,
`navbarContext.ts` (+ `navbarEventBus.ts` — см. отдельный `navbarEventBus.md`).

## navbarStates.ts

Типы и чистые хелперы состояний.

```ts
type NavState = 'fullscreen' | 'standard' | 'slim' | 'invisible';
type NavbarSource = 'toggle' | 'route' | 'breakpoint' | 'scroll' | 'intro';
```

Экспортируемое:

- `SLIM_WIDTH` — ширина slim (80px).
- `NavTransform` — `{ navX: number }` (px).
- `getNavTransform(state, viewport)` — для GSAP-трансформаций `.nav`.
- `getDefaultState(bp, isHome)`, `getNextState(state, bp)`, `getPriorityState(...)`.
- `getContentOffset(state, bp, isHome)` — статичный отступ для `<main>`.
- `hasToggleFor(bp)`, `isHomePath(path)`, `isPreferredStateValid(...)`,
  `isManualMobileState(...)`.

### Состояния

| Состояние    | Ширина  | Высота   | Где используется                                        |
| ------------ | ------- | -------- | ------------------------------------------------------- |
| `fullscreen` | `100vw` | `100dvh` | `/home` в начальной позиции, mobile toggle              |
| `standard`   | `25vw`  | `100dvh` | tablet/desktop после скролла, дефолт на других роутах   |
| `slim`       | `80px`  | `100dvh` | tablet по умолчанию, tablet при ручном toggle           |
| `invisible`  | `0px`   | `100dvh` | mobile по умолчанию (навбар скрыт, виден только toggle) |

Все состояния `position: fixed`, `z-index: 1000`, прозрачный фон.
Реализация ширины — через `x`-трансформацию `.nav` (см. `NavigationBar.md`).

### NavTransform (px, от `viewport = window.innerWidth`)

| Состояние    | `navX`     |
| ------------ | ---------- |
| `fullscreen` | `0`        |
| `standard`   | `-0.75·vp` |
| `slim`       | `-(vp-80)` |
| `invisible`  | `-vp`      |

> **Модель окна**: навбар всегда `100vw`, видимая ширина — сдвиг окна `navX`.
> Counter-translate контента убран; `.navInner` движется с окном и в
> `standard`/`slim` обрезается `overflow: hidden`. Поле `toggleX` удалено —
> кнопка toggle настоящий `position: fixed`-сиблинг (см. `ToggleButton.md`).

### NavbarSource (источник `state:change`)

| Значение     | Когда                                                     |
| ------------ | --------------------------------------------------------- |
| `toggle`     | Клик по ☰ / ← (ручной toggle)                            |
| `route`      | Смена pathname через react-router                         |
| `breakpoint` | Смена breakpoint (mobile / tablet / desktop)              |
| `scroll`     | ScrollTrigger на спейсере достиг границы (progress 0 / 1) |
| `intro`      | Зарезервировано для будущей интеграции с IntroAnimation   |

### Отступ `<main>` — `getContentOffset`

| Контекст                                        | Отступ (`--nav-content-offset`) |
| ----------------------------------------------- | ------------------------------- |
| mobile (любой роут)                             | `0` (полная ширина)             |
| `/home` tablet/desktop, `standard`/`fullscreen` | `25vw`                          |
| `/home` tablet, `slim` (после toggle)           | `80px`                          |
| `/other` tablet/desktop, `standard`             | `25vw`                          |
| `/other` tablet, `slim`                         | `80px`                          |

На `/home` `fullscreen` маппится на **эффективное конечное состояние**
(`getHomeEndState`, см. `hooks.md`): контент сразу ориентирован на ширину, в
которую навбар придёт после скролла спейсера.

## navbarContext.ts — контекст и хуки

`createContext<NavbarAPI | null>` +:

- `useNavbar()` — доступ к полному API (бросает, если вне провайдера).
- `useNavbarEvent(event, listener, deps?)` — React-обёртка над `events.on`
  с latest-ref (listener всегда видит свежее замыкание).
- `useNavbarScrollProgress(listener)` — подписка на 60fps-канал прогресса
  скролла (низкоуровневый, без React-рендера).
- `useNavbarToggleVisibility(listener)` — подписка на канал видимости кнопки.

Сам API (`NavbarAPI`) формирует `NavigationBarProvider` (см. `NavigationBarProvider.md`).

## Управление состоянием

| Сущность                   | Где живёт              | Назначение                                                            |
| -------------------------- | ---------------------- | --------------------------------------------------------------------- |
| `currentState`             | `useNavbarState`       | UI-состояние для пропа `isSlim`                                       |
| `stateRef`                 | `useNavbarState` (ref) | Актуальное состояние для логики toggle (без stale closure)            |
| `stateSourceRef`           | `useNavbarState` (ref) | Источник последнего `state:change`                                    |
| `preferredRef`             | `useNavbarState` (ref) | Ручной tablet-выбор (`slim`/`standard`), персистится между роутами    |
| `applyState(next, source)` | `useNavbarState`       | **Единственная точка записи state.** Публикует `state:change` в шину  |
| `recomputeTarget()`        | `useNavbarState`       | Пересчёт целевого состояния из `route`/`breakpoint` и на монтировании |

> `applyState` фиксирует `source` в `stateSourceRef` даже при `prev === next` —
> это важно для логики «пина» ручного состояния (см. `hooks.md`).

### Триггеры смены состояния

1. Смена роута — провайдер эмитит `route:change`; layout вызывает `recomputeTarget()`.
2. Смена breakpoint — провайдер эмитит `breakpoint:change`; layout вызывает `recomputeTarget()`.
3. Ручной toggle — `ToggleButton` публикует `toggle:request`; `useNavbarToggle`
   применяет `getNextState`.
4. ScrollTrigger — страница вызывает `registerScrollTrigger`; границы спейсера
   (progress 0/1) обновляют состояние в scrub-сцене.

> Шина — единственный источник триггеров: layout НЕ читает `useLocation`/
> `useBreakpoint` для пересчёта, а стартовый `isHome` провайдер передаёт через
> `initialIsHome` (на первом рендере шина не эмитит).
