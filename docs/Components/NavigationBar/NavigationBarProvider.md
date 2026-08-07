# NavigationBarProvider (диспетчер сцен)

Диспетчер всех сцен навбара. **Сам не владеет анимациями**: создаёт типизированную
шину событий, держит рефы публичных низкоуровневых каналов, читает `useLocation`/
`useBreakpoint` для эмиссии `route:change`/`breakpoint:change`, подключает корневую
сцену раскладки `useNavbarLayout` и прокидывает API в React Context.

Файлы: `src/components/NavigationBar/NavigationBarProvider/NavigationBarProvider.tsx` +
`NavigationBarProvider.module.css`.

## Слои

Навбар — это набор **сцен** (Scene-Composition): независимых подписчиков
на типизированную шину, каждый владеет своими DOM-нодами и GSAP-таймлайнами.
Провайдер не хранит все рефы и не владеет единой анимационной
последовательностью — он диспетчеризует события и держит контракт для страниц.

| Слой               | Что это                                                                                                                                                                                                                                           |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Шина**           | `createNavbarEventBus()` — типизированный pub/sub (`NavbarEventMap`)                                                                                                                                                                              |
| **Диспетчер**      | `NavigationBarProvider` — создаёт шину, держит рефы каналов (`scrollListenersRef`/`toggleVisibilityListenersRef`/`retargetScrubRef`), читает `useLocation`/`useBreakpoint` и эмитит `route:change`/`breakpoint:change`, прокидывает API в context |
| **Корневая сцена** | `useNavbarLayout` — композер над под-сценами (`useNavbarState`, `useNavbarScrubTrigger`, `useNavbarToggle`). `applyState` (единая точка записи), `registerScrollTrigger`. Позицию `.nav` не двигает                                               |
| **Дочерние сцены** | `ToggleButton`, **`useNavbarPosition`** (в `NavigationBar` владеет позицией `.nav`), NavItem, логотип, будущие расширения — подписываются на шину и анимируют свои DOM-ноды самостоятельно                                                        |

### Рефы каналов

- `retargetScrubRef: (() => void) | null` — ссылка на функцию пересоздания
  scrub-твина позиции `.nav`. Регистрирует `useNavbarPosition` через
  `registerRetargetScrub`; дергает провайдер фасадом `retargetScrub`,
  который пробрасывается аргументом в `useNavbarToggle` (см. `hooks.md`).
- `scrollListenersRef`, используемый 60fps-каналом прогресса скролла.
- `toggleVisibilityListenersRef` — канал видимости кнопки toggle.

## Context API

```ts
registerScrollTrigger(trigger) → () => void   // контракт для страниц
getState() → NavState                        // синхронный snapshot
events: NavbarEventBus                        // типизированная шина
onScrollProgress(listener) → () => void       // 60fps низкоуровневый канал
onToggleVisibility(listener) → () => void      // видимость кнопки toggle
getHomeEndState() → NavState                   // эффективное конечное состояние /home
retargetScrub() → void                        // фасад, дёргает ретаргет
registerRetargetScrub(fn) → () => void        // регистрация из useNavbarPosition
```

## Контракты

**Для страниц** (через `useNavbar()`):

- `registerScrollTrigger(trigger: HTMLElement) => () => void` — фасад над
  `useNavbarLayout`. Страница вызывает в `useEffect` и получает cleanup, который
  убивает ScrollTrigger и таймлайн при размонтировании.

**Для дочерних сцен** (через `useNavbar()` или хуки):

- `getState()` — синхронный snapshot текущего состояния.
- `events.on(event, listener)` — низкоуровневая подписка на шину.
- `useNavbarEvent(event, listener, deps?)` — React-обёртка с latest-ref.
- `onScrollProgress` / `useNavbarScrollProgress` — 60fps-канал прогресса скролла.
- `onToggleVisibility` / `useNavbarToggleVisibility` — канал видимости.

## Эмиссия смены роута и breakpoint

Провайдер не читает роут/breakpoint для пересчёта состояния — он только
эмитит события в шину (layout подписывается и пересчитывает сам):

- `bus.emit('route:change', { pathname, prev })` — при смене `useLocation`
  (ref на prev, чтобы подписчики отличали первую смену от реальной).
- `bus.emit('breakpoint:change', { bp, prev })` — по аналогии.

Канал низкого уровня чистится при размонтировании провайдера (страховка
от утечек в HMR/StrictMode).

## Сцен-флоу диаграмма — см. `hooks.md`

Сцена-флоу (`applyState`, обработка `toggle:request`/`scroll`), сведения
«что знает каждый уровень» и `currentState → isSlim` — в `hooks.md`.

## Поведение по устройствам

### Mobile (`< 768px`)

| Роут     | Начало       | Скролл                     | Toggle                     |
| -------- | ------------ | -------------------------- | -------------------------- |
| `/home`  | `fullscreen` | `fullscreen` → `invisible` | `invisible` ↔ `fullscreen` |
| `/other` | `invisible`  | нет                        | `invisible` ↔ `fullscreen` |

**Ручной `fullscreen` «держится» до верха страницы (mobile).** Если навбар развёрнут
вручную (клик `☰`) и пользователь скроллит вверх, scrub-таймлайн «запинен» к
крайнему положению (`progress = 0`, fullscreen) и не берёт управление. Переключение
на scrub происходит только на верху (`progress ≈ 0`), где `applyState('fullscreen',
'scroll')` перезаписывает источник и снимает пин. Если навбар ушёл скроллом
(`invisible`), при подъёме scrub ведёт его `invisible → fullscreen`.

### Tablet (`768 – 1024px`)

| Роут     | Начало       | Скролл                    | Toggle              |
| -------- | ------------ | ------------------------- | ------------------- |
| `/home`  | `fullscreen` | `fullscreen` → `standard` | `standard` ↔ `slim` |
| `/other` | `slim`       | нет                       | `slim` ↔ `standard` |

- При скролле к началу ScrollTrigger принудительно разворачивает навбар
  в `fullscreen` (приоритет над ручным). При обратной прокрутке навбар
  возвращается в последний ручной выбор, а не всегда в `standard`.
- **Персистентность ручного выбора**: ручной `slim`/`standard` сохраняется между
  страницами (в `preferredRef`). На другом роуте `useNavbarLayout` использует
  сохранённое состояние вместо дефолта — нет «моргания» границы навбар/контент.
  На `/home` переход всегда начинается с `fullscreen`, восстановление — через
  scrub при прокрутке вниз. На mobile/desktop предпочтение не хранится.

### Desktop (`>= 1024px`)

| Роут     | Начало       | Скролл                    | toggle |
| -------- | ------------ | ------------------------- | ------ |
| `/home`  | `fullscreen` | `fullscreen` → `standard` | нет    |
| `/other` | `standard`   | нет                       | нет    |

`hasToggle === false` на desktop, кнопка не рендерится.

## Колонка контента `<main>`

```css
/* NavigationBarProvider.module.css */
.main {
  margin-left: var(--nav-content-offset, 0px);
  width: calc(100% - var(--nav-content-offset, 0px));
  transition:
    margin-left var(--transitions-duration-medium)
      var(--transitions-easing-ease-in-out),
    width var(--transitions-duration-medium)
      var(--transitions-easing-ease-in-out);
}
```

Отступ `--nav-content-offset` выставляет провайдер (`getContentOffset`, см.
`core.md`); ширина сразу ориентирована на конечное значение — контент не едет
при скролле на `/home`. CSS-transition срабатывает только на дискретных
изменениях offset (tablet-тоггл, смена роута/breakpoint).

## Ключевые решения

- **Шина scoped на провайдер** — `createNavbarEventBus()` один раз через `useMemo([])`.
- **`applyState` — единственная точка записи state** (см. `hooks.md`).
- **Прогресс скролла и видимость toggle — через отдельные каналы**, не `bus.emit`,
  чтобы 60fps события не попадали в React-шину.
- **Приоритет: автоскролл > ручное переключение** — к началу страницы навбар
  принудительно разворачивается.
- Прогресс не передаётся через React State (запрещено архитектурой).
- Спачер `100dvh` живёт в `HomePage`, а не в навбаре.

## Будущая интеграция с IntroAnimation

`NavbarSource` уже содержит вариант `'intro'` — зарезервирован под сценарий,
когда IntroAnimation завершается и инициирует «вход» навбара. Детали: `core.md`.
