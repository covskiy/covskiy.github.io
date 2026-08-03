# NavigationBar

Адаптивная многофункциональная навигационная панель с четырьмя состояниями отображения,
автоматически переключаемыми через ScrollTrigger или вручную через кнопку toggle.

## Состояния

| Состояние    | Ширина  | Высота   | Где используется                                        |
| ------------ | ------- | -------- | ------------------------------------------------------- |
| `fullscreen` | `100vw` | `100dvh` | `/home` в начальной позиции, mobile toggle              |
| `standard`   | `25vw`  | `100dvh` | tablet/desktop после скролла, дефолт на других роутах   |
| `slim`       | `80px`  | `100dvh` | tablet по умолчанию, tablet при ручном toggle           |
| `invisible`  | `0px`   | `100dvh` | mobile по умолчанию (навбар скрыт, виден только toggle) |

Все состояния имеют `position: fixed`, `z-index: 1000` и прозрачный фон.

**Реализация ширины**: навбар всегда занимает `100vw` в раскладке, а видимая
ширина достигается трансформациями (GSAP твинит `x` на `.nav`).
Это держит анимацию на композиторе и не вызывает reflow при
60fps-обновлениях ScrollTrigger (scrub). Подробнее — в разделе
«Почему transforms вместо width».

## Поведение по устройствам

### Mobile (`< 768px`)

| Роут     | Начальное    | Скролл                     | Toggle                     |
| -------- | ------------ | -------------------------- | -------------------------- |
| `/home`  | `fullscreen` | `fullscreen` → `invisible` | `invisible` ↔ `fullscreen` |
| `/other` | `invisible`  | нет                        | `invisible` ↔ `fullscreen` |

Кнопка toggle фиксирована в левом верхнем углу экрана (`position: fixed; left: 20px; top: 20px`),
чтобы оставаться доступной даже когда навбар полностью скрыт.

**На `/home` toggle виден только когда навбар ушёл за экран** (`progress ≈ 1`): наверху
(fullscreen) и во время scrub-анимации спейсера кнопка скрыта (`autoAlpha: 0`), чтобы
пользователь не мог сломать scrub ручным кликом. Обратная прокрутка первым же кадром
снова скрывает кнопку. Когда навбар в `invisible`, кнопка `☰` видна; при ручном
открытии навбара в `fullscreen` кнопка (`←`) остаётся доступной, чтобы вернуться
в `invisible`.

### Tablet (`768 – 1024px`)

| Роут     | Начальное    | Скролл                    | Toggle              |
| -------- | ------------ | ------------------------- | ------------------- |
| `/home`  | `fullscreen` | `fullscreen` → `standard` | `standard` ↔ `slim` |
| `/other` | `slim`       | нет                       | `slim` ↔ `standard` |

**На `/home` поведение toggle идентично mobile**: кнопка скрыта в `fullscreen` и во время
scrub-анимации, видна в состояниях `standard` / `slim` (когда навбар дошёл до конца
спейсера или переключён вручную).

**Важно**: при скролле к началу страницы ScrollTrigger принудительно разворачивает навбар
в `fullscreen` — это имеет приоритет над ручным `slim` / `invisible` состоянием.

### Desktop (`>= 1024px`)

| Роут     | Начальное    | Скролл                    | Toggle |
| -------- | ------------ | ------------------------- | ------ |
| `/home`  | `fullscreen` | `fullscreen` → `standard` | нет    |
| `/other` | `standard`   | нет                       | нет    |

На desktop кнопка toggle не рендерится.

## Архитектура

```
src/components/NavigationBar/
├── index.ts                    # Barrel: NavigationBarProvider, NavigationBar, NavList,
│                               #   navItems, useNavbar, useNavbarEvent,
│                               #   useNavbarScrollProgress, NavbarAPI, NavbarEventBus,
│                               #   NavbarSource, NavbarEventMap, getNavTransform, SLIM_WIDTH,
│                               #   NavState, NavTransform, NavbarLayout, NavbarLayoutRefs
├── NavigationBarProvider.tsx   # Диспетчер сцен: шина событий, рефы nav/toggle,
│                               #   scrollListenersRef, useNavbarLayout, Context.Provider
├── NavigationBarProvider.module.css  # .app, .main (layout-обёртка)
├── useNavbarLayout.ts          # Корневая сцена раскладки: animateNavbar, applyState,
│                               #   registerScrollTrigger (scrub + ScrollTrigger.onUpdate),
│                               #   подписка на state:change
├── navbarContext.ts            # createContext + useNavbar() + тип NavbarAPI
│                               #   + хуки useNavbarEvent/useNavbarScrollProgress
├── navbarEventBus.ts           # createNavbarEventBus + NavbarEventMap + NavbarSource
├── navbarStates.ts             # NavState, NavTransform, SLIM_WIDTH + чистые
│                               #   хелперы: getNavTransform/getDefaultState/getNextState
├── NavigationBar.tsx           # Презентационный: <nav>, логотип, toggle-btn;
│                               #   пропсы isSlim/hasToggle/handleToggle
├── NavigationBar.module.css    # .nav, .navInner, .logo, .toggleBtn
├── NavList.tsx                 # <ul>{items.map → NavItem}</ul>
├── NavList.module.css          # .list
├── NavItem.tsx                 # <li> + <NavLink>, иконка/текст в зависимости от isSlim
│                               #   + демо-сцена: fade-in иконки при входе в slim
├── NavItem.module.css          # .link, .active, .icon, .label, .slim-стили
└── navItems.ts                 # Конфиг (path, label, icon), деривация от routes
```

Barrel (`index.ts`) экспортирует `NavigationBarProvider` (основной компонент,
оборачивающий layout), `NavigationBar`, `NavList`, `navItems`, хук `useNavbar`,
геометрию `getNavTransform`/`SLIM_WIDTH` и типы `NavbarAPI`, `NavItemConfig`,
`NavState`, `NavTransform`.
`NavItem` — внутренний компонент, не экспортируется наружу.

### navItems.ts

Единственный источник правды для `path` и `label` — `routes.tsx`. `navItems.ts` импортирует `routes`, отфильтровывает `*` (NotFound) и навешивает `icon` через маппинг `Record<path, ReactNode>`:

```ts
// navItems.ts — схема
import { routes } from '../../routes';

const routeIcons: Record<string, ReactNode> = {
  '/': '🏠',
  '/about': 'ℹ️',
  '/services': '🛠️',
  '/contact': '📬',
};

export const navItems: NavItemConfig[] = routes
  .filter(
    (r): r is (typeof routes)[number] & { label: string } =>
      r.path !== '*' && typeof r.label === 'string',
  )
  .map((r) => ({
    path: r.path,
    label: r.label,
    icon: routeIcons[r.path] ?? '❓',
  }));
```

Поле `icon` типизировано как `ReactNode` — замена emoji на `<HomeIcon />` не потребует изменения интерфейсов, только замены значения в `routeIcons`.

### NavItem — поведение `isSlim`

- `isSlim === false`: рендерится `<span class="label">{label}</span>` + `<span class="icon">{icon}</span>`
- `isSlim === true`: текст `.label` не рендерится, иконка `.icon` центрируется
  (класс `styles.slim`), на `<NavLink>` вешается `tabIndex={-1}`, исключающий
  ссылку из Tab-навигации

Проп `isSlim` фактически означает «навбар в свёрнутом состоянии» — он `true` как для `slim`, так и для `invisible`.

### Зависимости

- `useBreakpoint` — `src/utils/breakpoints.ts`
- `useLocation` — `react-router`
- `gsap` + `useGSAP` — GSAP-анимации
- `logger` — `src/utils/logger.ts`
- `routes` — `src/routes.tsx` (через `navItems.ts`)

## Архитектура: Scene-Composition через EventBus

Навбар — это набор **сцен** (Scene-Composition): независимых подписчиков
на типизированную шину событий, каждый из которых владеет своими
DOM-нодами и GSAP-таймлайнами. Провайдер (`NavigationBarProvider`)
больше **не хранит все рефы** и **не владеет единой анимационной
последовательностью** — он только диспетчеризует события и держит
контракт для страниц.

### Слои

| Слой               | Что делает                                                                                                                                                                                                            |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Шина**           | `createNavbarEventBus()` — типизированный pub/sub (`NavbarEventMap`)                                                                                                                                                  |
| **Диспетчер**      | `NavigationBarProvider` — создаёт шину, держит рефы корневых нод, прокидывает API в context                                                                                                                           |
| **Корневая сцена** | `useNavbarLayout` — единственная сцена, знающая о геометрии навбара: animateNavbar (прямые `gsap.to` на nav/toggle), applyState (единая точка записи state), `registerScrollTrigger` (scrub-таймлайн), `handleToggle` |
| **Дочерние сцены** | NavItem, логотип, будущие расширения — подписываются на шину через `useNavbarEvent` / `useNavbarScrollProgress` и анимируют свои DOM-ноды самостоятельно                                                              |

### Поток данных

```
App.tsx
└── <NavigationBarProvider />              ← диспетчер
      │  (создаёт bus, scrollListenersRef, регистрирует useNavbarLayout)
      ├── <NavigationBar navRef toggleRef isSlim hasToggle handleToggle/>
      │     └── <NavList /> → <NavItem> × N
      │           └── useNavbarEvent('state:change', ...) — демо-сцена fade-in иконки
      ├── <main>                          ← контентная область (статичная правая колонка)
      │     └── <Routes>
      │           └── HomePage
      │                 ├── <div ref={spacerRef} />   ← 100dvh спейсер
      │                 └── <LandingSections />
      │                 └── useEffect:
      │                       registerScrollTrigger(spacerRef.current)
      └── Context API:
            ├── registerScrollTrigger(trigger) → () => void   (контракт для страниц)
            ├── getState() → NavState                          (синхронный snapshot)
            ├── events: NavbarEventBus                          (типизированная шина)
            └── onScrollProgress(listener) → () => void         (60fps низкоуровневый канал)

useNavbarLayout (корневая сцена):
  applyState(next, source):
    stateRef.current = next
    setCurrentState(next)
    bus.emit('state:change', { state, prev, source })
  bus.on('state:change'):
    animateNavbar: gsap.to(nav / toggle) с overwrite: 'auto'
  registerScrollTrigger(trigger):
    gsap.timeline({ scrollTrigger: { ..., onUpdate } })
      onUpdate:
        listeners.forEach(l => l({ progress, direction }))   ← низкоуровневый канал
        if progress === 0  → applyState('fullscreen', 'scroll')
        if progress >= 1   → applyState(endState, 'scroll')
        setToggleVisibility(progress >= 0.9999)              ← кнопка видна только в конце спейсера
```

### Что знает каждый уровень

| Уровень                          | Знает                                                                  | НЕ знает                        |
| -------------------------------- | ---------------------------------------------------------------------- | ------------------------------- |
| `NavigationBarProvider`          | Роут, breakpoint, рефы корневых нод (`nav/toggle`), шина, layout-сцена | DOM NavItem, иконки, логотип    |
| `useNavbarLayout`                | Геометрия раскладки (`getNavTransform`), ScrollTrigger, scrub          | Содержимое пунктов меню, иконки |
| Дочерняя сцена (NavItem и т. д.) | Своя DOM-нода, `prev → next` state через шину                          | DOM соседей, общую анимацию     |

### Контракты

**Для страниц** (через `useNavbar()`):

- `registerScrollTrigger(trigger: HTMLElement) => () => void` — контракт
  сохранён без изменений. Внутри — фасад над `useNavbarLayout`.

**Для дочерних сцен** (через `useNavbar()` или хуки):

- `getState()` — синхронный snapshot текущего состояния.
- `events.on(event, listener)` — низкоуровневая подписка на шину.
- `useNavbarEvent(event, listener, deps?)` — React-обёртка с latest-ref
  (listener всегда видит свежее замыкание, не нужно оборачивать
  в `useCallback`).
- `onScrollProgress(listener)` / `useNavbarScrollProgress(listener)` —
  низкоуровневый канал для 60fps scrub-подписчиков. Listener вызывается
  из `ScrollTrigger.onUpdate` напрямую, минуя React-рендер.

### Принципы

1. **Шина scoped на провайдер** — `createNavbarEventBus()` вызывается
   один раз через `useMemo([])` в `NavigationBarProvider`. Если в
   будущем потребуется кросс-провайдерный доступ (например,
   `IntroAnimation` ↔ Navbar), переход на singleton возможен без
   изменения потребителей — они получают `events` через context.

2. **`applyState` — единственная точка записи состояния.** Любой
   источник (toggle/route/breakpoint/scroll) проходит через неё и
   публикует `state:change` с указанием `source` в payload. Это даёт
   подписчикам возможность фильтровать события по источнику.

3. **`scroll:progress` идёт через отдельный канал** — не через
   `events.emit`, чтобы 60fps события не попадали в React-шину.
   Провайдер владеет `scrollListenersRef: RefObject<Set<Listener>>`,
   layout-сцена дёргает listener-ов напрямую из `ScrollTrigger.onUpdate`.

4. **Дочерние сцены не знают о DOM корневого навбара** — они получают
   только логические события. Это означает, что появление нового
   элемента внутри навбара (логотип, badge, индикатор секции)
   реализуется как новая сцена, без изменения провайдера или
   layout-сцены.

5. **`NavItem` — демо-сцена end-to-end.** Фаза 1 проверяет пайплайн
   шины: при первом переходе навбара в `slim` иконка делает fade-in
   с подскоком через `gsap.fromTo`. Это дополняет существующее
   поведение (`isSlim` пропом) и легко откатывается удалением хука.

### Будущая интеграция с IntroAnimation (задел)

`NavbarSource` уже включает вариант `'intro'`, зарезервированный под
сценарий, когда IntroAnimation завершается и инициирует «вход» навбара.

Сейчас `applyState` всегда получает source из контекста NavigationBarProvider
(`'toggle' | 'route' | 'breakpoint' | 'scroll'`). При появлении интеграции:

1. IntroAnimation `onComplete` либо вызовет
   `useNavbar().events.emit('state:change', { state, prev, source: 'intro' })`,
   либо (если у IntroAnimation появится свой контракт через context)
   напрямую через низкоуровневый API.
2. Дочерние сцены, желающие отреагировать именно на завершение intro,
   фильтруют: `useNavbarEvent('state:change', (p) => p.source === 'intro' && run())`.

Для этого потребуется поднять bus до singleton (отдельная задача фазы 2) —
контракт API уже зафиксирован.

## Стили позиционирования

Базовое позиционирование и отступы живут в CSS Modules

```css
/* NavigationBar.module.css — фиксированное позиционирование; GSAP анимирует трансформации */
.nav {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100dvh;
  z-index: var(--z-nav-overlay, 1000);
  will-change: transform;
}

/* NavigationBarProvider.module.css — статичная правая колонка через CSS-переменную */
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

Навбар всегда `width: 100vw` в раскладке; видимая ширина (25vw / 80px / 0)
достигается сдвигом окна через `transform: translateX`, а не `width` — это не
вызывает reflow при обновлении ScrollTrigger до 60 раз в секунду.

`<main>` не твинится вообще: `--nav-content-offset` выставляет провайдер
(`getContentOffset`), ширина сразу ориентирована на конечное значение
(`100% − offset`), поэтому при скролле на `/home` контент не едет по диагонали.
CSS-transition срабатывает только на дискретных изменениях offset (tablet-тоггл
slim ↔ standard, смена роута/breakpoint) — разовый reflow, не 60fps-scrub.

## Управление состоянием

| Сущность                   | Где живёт                         | Назначение                                                           |
| -------------------------- | --------------------------------- | -------------------------------------------------------------------- |
| `currentState`             | `useNavbarLayout` (state)         | UI-состояние для пропа `isSlim` в NavigationBar                      |
| `stateRef`                 | `useNavbarLayout` (ref)           | Актуальное состояние для логики toggle (без stale closure)           |
| `applyState(next, source)` | `useNavbarLayout`                 | **Единственная точка записи state.** Публикует `state:change` в шину |
| `registerScrollTrigger`    | `useNavbarLayout` (через API)     | Функция из Context API: регистрирует ScrollTrigger страницы          |
| `scrollListenersRef`       | `NavigationBarProvider` (ref)     | Низкоуровневый канал для 60fps scrub-подписчиков                     |
| `bus: NavbarEventBus`      | `NavigationBarProvider` (useMemo) | Типизированная шина событий                                          |

**NavState**: `'fullscreen' | 'standard' | 'slim' | 'invisible'` — тип и геометрия
состояний вынесены в `navbarStates.ts` (чистая логика, без React). Провайдер
использует `getDefaultState`/`getNextState` для пересчёта состояний,
`getNavTransform(state, bp, viewport)` для GSAP-анимаций трансформаций навбара
и `getContentOffset(state, bp, isHome)` для статичного отступа `<main>`.

**NavbarSource** (источник `state:change`):

| Значение     | Когда                                                     |
| ------------ | --------------------------------------------------------- |
| `toggle`     | Клик по ☰ / ← (ручной toggle)                            |
| `route`      | Смена pathname через react-router                         |
| `breakpoint` | Смена breakpoint (mobile / tablet / desktop)              |
| `scroll`     | ScrollTrigger на спейсере достиг границы (progress 0 / 1) |
| `intro`      | Зарезервировано для будущей интеграции с IntroAnimation   |

**NavTransform** (px, от `viewport = window.innerWidth`):

| Состояние    | `navX`     | `toggleX`                   |
| ------------ | ---------- | --------------------------- |
| `fullscreen` | `0`        | mobile: `0`, tablet: `null` |
| `standard`   | `-0.75·vp` | `null` (едет с навбаром)    |
| `slim`       | `-(vp-80)` | `null` (едет с навбаром)    |
| `invisible`  | `-vp`      | `+vp` (контр-сдвиг)         |

- **Модель окна**: навбар всегда `100vw`, видимая ширина — сдвиг окна `navX`.
  Counter-translate контента убран: `.navInner` движется вместе с окном и на
  tablet/desktop в `standard`/`slim` обрезается `overflow: hidden` (промежуточное
  состояние до новой модели layout).
- **Mobile invisible**: `.nav` имеет `overflow: visible` ради кнопки toggle,
  поэтому контент уезжает вместе с окном, а toggle компенсируется `toggleX`,
  оставаясь фиксированным в `left: 20`.

**`<main>` — статичная колонка, `getContentOffset`**:

| Контекст                                        | Отступ (`--nav-content-offset`) |
| ----------------------------------------------- | ------------------------------- |
| mobile (любой роут)                             | `0` (полная ширина)             |
| `/home` tablet/desktop, `standard`/`fullscreen` | `25vw`                          |
| `/home` tablet, `slim` (после toggle)           | `80px`                          |
| `/other` tablet/desktop, `standard`             | `25vw`                          |
| `/other` tablet, `slim`                         | `80px`                          |

На `/home` fullscreen маппится на `standard` — контент сразу ориентирован на
конечную ширину (после скролла спейсера) и не двигается при скролле.

### Триггеры изменения состояния

1. **Смена роута** — `useGSAP` с `dependencies: [location.pathname, bp]`
2. **Смена breakpoint** — `useGSAP` с `dependencies: [location.pathname, bp]`
3. **Ручной toggle** — `handleToggle` по клику на кнопку
4. **Событие ScrollTrigger** — страница вызывает `registerScrollTrigger` в `useEffect`;
   границы спейсера (progress 0 / 1) обновляют состояние внутри провайдера

### Поток `currentState → isSlim`

```tsx
// NavigationBarProvider.tsx
const isSlim = currentState === 'slim' || currentState === 'invisible';

<NavigationBar
  navRef={navRef}
  isSlim={isSlim}
  hasToggle={hasToggle}
  handleToggle={handleToggle}
/>;
```

`isSlim` прокидывается пропсом в `NavigationBar` (не через контекст) и дальше —
в `NavList` → `NavItem`, где:

- Управляет видимостью текста/иконки
- Выставляет `tabIndex={-1}` на `<NavLink>`
- Добавляет класс `styles.slim` для CSS-селекторов

### Позиционирование toggle

Кнопка toggle рендерится **внутри** `<nav>` как дочерний элемент
и позиционируется через `position: absolute` (относительно навбара):

- **Tablet**: `top: 20px; right: 20px` — в правом верхнем углу навбара. Кнопка —
  дочерний элемент сдвигаемого навбара, поэтому «едет» вместе с правым краем окна.
- **Mobile**: `top: 20px; left: 20px` — в левом верхнем углу экрана. Кнопка
  компенсируется GSAP (`toggleX = -navX`), поэтому остаётся на месте, даже когда
  окно навбара уезжает за экран (invisible).

На mobile навбар имеет `overflow: visible`, а внутренний контейнер `.navInner` —
`overflow: hidden`. Это гарантирует, что контент (логотип, ссылки) обрезается,
когда окно навбара закрыто, а кнопка toggle остаётся видимой вне границ навбара.

**Видимость на `/home`** управляется из `registerScrollTrigger.onUpdate` через
`setToggleVisibility` (`gsap.set` с `autoAlpha` + `pointerEvents`), без React-рендера:
кнопка скрыта наверху (fullscreen) и во время scrub-анимации, видна только когда
навбар ушёл за экран (`progress ≈ 1`). Cleanup триггера сбрасывает видимость в
исходную при уходе с `/home`.

## CSS-классы slim-режима

В `NavItem.module.css` переключение происходит через условный класс `styles.slim`,
который добавляется при `isCollapsed === true` (то есть в состояниях `slim` и `invisible`):

```css
.slim {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 10px 0;
}

.slim .icon {
  font-size: var(--font-sizes-xl);
}
```

Текстовая метка `.label` не скрывается CSS — она просто не рендерится в JSX
(`{!isSlim && <span className={styles.label}>...}`).

## Замена иконок (emoji → React-компоненты)

Достаточно отредактировать `navItems.ts` — поле `icon` имеет тип `ReactNode`:

```ts
const routeIcons: Record<string, ReactNode> = {
  '/':        <HomeIcon />,
  '/about':   <InfoIcon />,
  '/services':<ToolsIcon />,
  '/contact': <MailIcon />,
};
```

Остальные компоненты (NavItem, NavList, NavigationBar) изменений не требуют.

## Почему transforms вместо width

`width` и `marginLeft` — layout-свойства: их изменение заставляет браузер
пересчитывать раскладку (reflow) и красить заново. ScrollTrigger с `scrub`
обновляет свойства твина до 60 раз в секунду — анимация ширины превращается
в reflow на каждом кадре, что даёт jank на слабых устройствах.

Трансформации (`translateX`) обрабатываются на композиторе GPU и не трогают
раскладку. Поэтому:

- `.nav` всегда занимает `100vw` в раскладке, видимая ширина задаётся сдвигом
  окна `nav.x` (тот же эффект, что у `width`, но без reflow);
- контент `.navInner` движется вместе с окном; counter-translate убран, поэтому
  на tablet/desktop в `standard`/`slim` он обрезается `overflow: hidden`
  (промежуточное состояние до новой модели layout);
- `<main>` вообще не твинится — это статичная правая колонка:
  отступ задаётся CSS-переменной `--nav-content-offset`, ширина сразу
  ориентирована на конечное значение (`100% − offset`), поэтому контент не едет
  по диагонали при скролле на `/home`;
- на mobile кнопка toggle компенсируется отдельным `toggleX`.

Единственная плата — px-значения геометрии навбара запекаются при создании
твина (как и раньше для `25vw`). `invalidateOnRefresh` пересчитывает позиции
скролла, а смена breakpoint пересоздаёт анимацию, поэтому при повороте/ресайзе
поведение не регрессирует. Отступ `<main>` задаётся в `vw`/`px` — он и так
отзывчив к ресайзу.

## Ключевые решения

- **CSS Modules + transforms вместо width/margin** — вместо переключения
  CSS-классов GSAP анимирует композитные трансформации (`x`) напрямую.
  `width`/`marginLeft` — layout-свойства: при scrub ScrollTrigger обновляет их
  до 60 раз в секунду, заставляя браузер пересчитывать раскладку на каждом
  кадре. Трансформации живут на композиторе и не вызывают reflow. Это упрощает
  интеграцию со ScrollTrigger и избегает проблем с хешированными именами CSS Modules.

- **`<main>` — статичная колонка, не твинится** — отступ задаётся
  через CSS-переменную `--nav-content-offset` (`getContentOffset`), а ширина —
  `calc(100% − offset)`. На `/home` fullscreen маппится на `standard`, поэтому
  контент сразу ориентирован на конечную ширину (после скролла спейсера) и при
  скролле не едет по диагонали. Плавность tablet-тоггла slim ↔ standard — через
  CSS-transition на `margin-left`/`width` (разовый reflow, не 60fps-scrub).

- **`overwrite: 'auto'` только в `animateNavbar`** — прямые `gsap.to()` прерывают
  конфликтующие твины (включая твины от ScrollTrigger). Твины scrub-таймлайна
  в `registerScrollTrigger` пишутся без `overwrite` — они привязаны к своему
  timeline и не конкурируют с внешними твинами.

- **Toggle скрыт во время scrub на `/home`** — видимость управляется из
  `registerScrollTrigger.onUpdate` через `setToggleVisibility` (`gsap.set` с
  `autoAlpha` + `pointerEvents`, без React-рендера). Кнопка видна только когда
  навбар ушёл за экран (`progress ≈ 1`); наверху (fullscreen) и в полёте
  scrub-анимации (в обе стороны) скрыта, чтобы пользователь не мог сломать
  анимацию ручным кликом. Cleanup триггера сбрасывает видимость при уходе
  с `/home`. Поведение идентично для mobile и tablet.

- **Context-Driven Animation Factory вместо custom event** — NavigationBar
  инкапсулирует DOM и анимацию, а страница делегирует управление через
  `registerScrollTrigger` (React Context). Прогресс скролла НЕ передаётся
  через React State (запрещено архитектурой) — ScrollTrigger обновляет
  состояние навбара только в дискретных точках (progress 0 / 1) на границах
  спейсера. Магическая строка `navbar:setstate` + `window.dispatchEvent`
  удалены.

- **Сценовая композиция через типизированный EventBus** — навбар
  разделён на корневую сцену раскладки (`useNavbarLayout`) и
  дочерние сцены (`NavItem`, будущие расширения). Все сцены
  подписаны на `NavbarEventBus` через `useNavbarEvent` и реагируют
  на изменения состояния самостоятельно, не уведомляя провайдер.
  Это устраняет «толстый scrub-таймлайн» и регистрацию всех
  анимируемых DOM-узлов через рефы в родителе.

- **Двухканальная публикация прогресса скролла** — дискретные события
  идут через `events.emit` (`'state:change'`, `'route:change'`,
  `'breakpoint:change'`), непрерывный scrub-прогресс — через
  низкоуровневый канал `onScrollProgress` напрямую из
  `ScrollTrigger.onUpdate`. Это исключает 60fps события из React-шины
  и сохраняет предсказуемую производительность для scrub-сцен
  (бегущая подсветка активной ссылки и т. п.).

- **`useBreakpoint` через `matchMedia`** — в отличие от `resize`,
  `matchMedia` не срабатывает на каждом пикселе и корректно реагирует
  на поворот экрана на планшетах.

- **Приоритет: автоскролл > ручное переключение** — при скролле к началу
  страницы ScrollTrigger принудительно разворачивает навбар в `fullscreen`,
  переопределяя предыдущее ручное `slim` или `invisible` состояние.

- **`tabIndex={-1}` в slim/invisible** — ссылки навбара получают `tabIndex = -1`
  в свёрнутых состояниях, исключая их из фокуса при навигации Tab.

- **Toggle внутри `<nav>`, overflow: hidden на `.navInner`** — кнопка
  рендерится внутри навбара с `position: absolute`. На desktop/tablet `.nav` имеет
  `overflow: hidden` — контент и окно обрезаются, кнопка едет вместе с навбаром.
  На mobile `.nav` переключается на `overflow: visible`, а `overflow: hidden`
  переносится на `.navInner`, при этом кнопка компенсируется GSAP (`toggleX`) —
  она остаётся видимой, даже когда окно навбара полностью уезжает за экран
  (invisible-режим).

- **Spacer в HomePage, а не в NavigationBar** — невидимый div `100dvh`
  создаётся внутри HomePage, а не в NavigationBar. Это гарантирует,
  что ScrollTrigger анимирует навбар только на `/home`, и не мешает
  на других роутах.

- **Жизненный цикл триггера — на стороне страницы** — страница вызывает
  `registerScrollTrigger` в `useEffect` и получает cleanup, который убивает
  ScrollTrigger и таймлайн (`kill()`) при размонтировании. Никаких утечек
  при переходах между роутами; навбар остаётся независимым модулем.
