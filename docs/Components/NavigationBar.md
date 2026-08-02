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
ширина достигается трансформациями (GSAP твинит `x` на `.nav` и `.navInner`).
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

### Tablet (`768 – 1024px`)

| Роут     | Начальное    | Скролл                    | Toggle              |
| -------- | ------------ | ------------------------- | ------------------- |
| `/home`  | `fullscreen` | `fullscreen` → `standard` | `standard` ↔ `slim` |
| `/other` | `slim`       | нет                       | `slim` ↔ `standard` |

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
│                               #   navItems, useNavbar, NavbarAPI, NavItemConfig,
│                               #   getNavTransform, SLIM_WIDTH, NavState, NavTransform
├── NavigationBarProvider.tsx   # Владелец: логика состояний, рефы nav/navInner/toggle,
│                               #   registerScrollTrigger, Context.Provider
├── NavigationBarProvider.module.css  # .app, .main (layout-обёртка)
├── navbarContext.ts            # createContext + useNavbar() + тип NavbarAPI
├── navbarStates.ts             # NavState, NavTransform, SLIM_WIDTH + чистые
│                               #   хелперы: getNavTransform/getDefaultState/getNextState
├── NavigationBar.tsx           # Презентационный: <nav>, логотип, toggle-btn;
│                               #   пропсы isSlim/hasToggle/handleToggle
├── NavigationBar.module.css    # .nav, .navInner, .logo, .toggleBtn
├── NavList.tsx                 # <ul>{items.map → NavItem}</ul>
├── NavList.module.css          # .list
├── NavItem.tsx                 # <li> + <NavLink>, иконка/текст в зависимости от isSlim
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

## Архитектура: Context-Driven Animation Factory

**владелец** (`NavigationBarProvider`)
полностью инкапсулирует DOM-ноды и суть анимации (какие свойства меняются,
с какой скоростью), но контроль над тем, когда и от чего анимация запускается
(скролл со страницы), делегирует наружу через React Context функцией
`registerScrollTrigger`.

### Поток данных

```
App.tsx
└── <NavigationBarProvider />              ← всегда в DOM, владелец анимации
      ├── <NavigationBar navRef navInnerRef toggleRef isSlim hasToggle handleToggle/>
      │     └── <NavList /> → <NavItem> × N
      ├── <main>                          ← контентная область
      │     └── <Routes>
      │           └── HomePage
      │                 ├── <div ref={spacerRef} />   ← 100dvh спейсер
      │                 └── <LandingSections />
      └── Context API:
            └── registerScrollTrigger(trigger) → () => void

Пропсы NavigationBar (не через контекст): isSlim, hasToggle, handleToggle, рефы

HomePage (useEffect)
  └── registerScrollTrigger(spacerRef.current)
        └── NavigationBarProvider создаёт ScrollTrigger + таймлайн
              ├── scrub: nav.x (100vw → видимая ширина)
              ├── scrub: navInner.x (counter-translate контента)
              ├── main.x НЕ твинится — статичная правая колонка
              │     (отступ через CSS-переменную --nav-content-offset)
              ├── progress === 0 → fullscreen (авто > ручное)
              ├── progress >= 1 → endState (invisible | standard)
              └── возвращает cleanup → kill() при размонтировании страницы
```

Страница не знает ни о DOM-нодах навбара (`.nav`, `<main>`), ни о целевых
ширинах — она только отдаёт свой элемент-триггер. Это гарантирует,
что даже после ручного toggle (который убивает ScrollTrigger-твин)
принудительный разворот в `fullscreen` сработает при скролле к началу:
триггер живёт в провайдере и обновляет состояние навбара на границах
спейсера напрямую.

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

| Сущность                | Тип                                    | Назначение                                                  |
| ----------------------- | -------------------------------------- | ----------------------------------------------------------- |
| `currentState`          | `React.State<NavState>`                | UI-состояние для пропа `isSlim` в NavigationBar             |
| `stateRef`              | `React.Ref<NavState>`                  | Актуальное состояние для логики toggle (без stale closure)  |
| `registerScrollTrigger` | `(trigger: HTMLElement) => () => void` | Функция из Context API: регистрирует ScrollTrigger страницы |

**NavState**: `'fullscreen' | 'standard' | 'slim' | 'invisible'` — тип и геометрия
состояний вынесены в `navbarStates.ts` (чистая логика, без React). Провайдер
использует `getDefaultState`/`getNextState` для пересчёта состояний,
`getNavTransform(state, bp, viewport)` для GSAP-анимаций трансформаций навбара
и `getContentOffset(state, bp, isHome)` для статичного отступа `<main>`.

**NavTransform** (px, от `viewport = window.innerWidth`):

| Состояние    | `navX`     | `innerX`    | `toggleX`                   |
| ------------ | ---------- | ----------- | --------------------------- |
| `fullscreen` | `0`        | `0`         | mobile: `0`, tablet: `null` |
| `standard`   | `-0.75·vp` | `+0.75·vp`  | `null` (едет с навбаром)    |
| `slim`       | `-(vp-80)` | `vp/2 - 40` | `null` (едет с навбаром)    |
| `invisible`  | `-vp`      | `0` (слайд) | `+vp` (контр-сдвиг)         |

- **Counter-translate**: `innerX = -navX` (tablet/desktop) — контент остаётся
  привязан к левому краю экрана, окно панели «наезжает» на него.
- **Slim**: `innerX = vp/2 - 40` — иконки, центрированные на 50vw в 100vw-раскладке,
  попадают в центр окна 80px.
- **Mobile invisible**: `innerX = 0` (слайд без контр-сдвига) — `.nav` имеет
  `overflow: visible` ради кнопки toggle, поэтому контент уезжает вместе с окном,
  а toggle компенсируется `toggleX`, оставаясь фиксированным в `left: 20`.

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
- `.navInner` получает контр-сдвиг (`innerX = -navX`), чтобы контент оставался
  привязан к левому краю экрана и не искажался;
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

- **Context-Driven Animation Factory вместо custom event** — NavigationBar
  инкапсулирует DOM и анимацию, а страница делегирует управление через
  `registerScrollTrigger` (React Context). Прогресс скролла НЕ передаётся
  через React State (запрещено архитектурой) — ScrollTrigger обновляет
  состояние навбара только в дискретных точках (progress 0 / 1) на границах
  спейсера. Магическая строка `navbar:setstate` + `window.dispatchEvent`
  удалены.

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
