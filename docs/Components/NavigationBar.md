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
│                               #   NAV_STATES, NavState
├── NavigationBarProvider.tsx   # Владелец: логика состояний, рефы nav/content,
│                               #   registerScrollTrigger, Context.Provider
├── NavigationBarProvider.module.css  # .app, .main (layout-обёртка)
├── navbarContext.ts            # createContext + useNavbar() + тип NavbarAPI
├── navbarStates.ts             # NavState, NAV_STATES + чистые хелперы:
│                               #   getWidth/getContentMargin/getDefaultState/getNextState
├── NavigationBar.tsx           # Презентационный: <nav>, логотип, toggle-btn;
│                               #   пропсы isSlim/hasToggle/handleToggle
├── NavigationBar.module.css    # .nav, .navInner, .logo, .toggleBtn
├── NavList.tsx                 # <ul>{items.map → NavItem}</ul>
├── NavList.module.css          # .list
├── NavItem.tsx                 # <li> + <NavLink>, иконка/текст в зависимости от isSlim
├── NavItem.module.css          # .link, .active, .icon, .label, [data-slim]-стили
└── navItems.ts                 # Конфиг (path, label, icon), деривация от routes
```

Barrel (`index.ts`) экспортирует `NavigationBarProvider` (основной компонент,
оборачивающий layout), `NavigationBar`, `NavList`, `navItems`, хук `useNavbar`,
конфиг `NAV_STATES` и типы `NavbarAPI`, `NavItemConfig`, `NavState`.
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
- `isSlim === true`: текст `.label` скрыт через CSS (`display: none`), иконка `.icon` центрируется, на `<NavLink>` вешается `data-slim` и `tabIndex={-1}`, исключающий ссылку из Tab-навигации

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
      ├── <NavigationBar navRef isSlim hasToggle handleToggle/>
      │     └── <NavList /> → <NavItem> × N
      ├── <main data-content ref>          ← контентная область
      │     └── <Routes>
      │           └── HomePage
      │                 ├── <div ref={spacerRef} />   ← 100dvh спейсер
      │                 └── <LandingSections />
      └── Context API:
            └── registerScrollTrigger(trigger) → () => void

Пропсы NavigationBar (не через контекст): isSlim, hasToggle, handleToggle

HomePage (useEffect)
  └── registerScrollTrigger(spacerRef.current)
        └── NavigationBarProvider создаёт ScrollTrigger + таймлайн
              ├── scrub: анимация navRef width (100vw → target)
              ├── scrub: анимация contentRef marginLeft (tablet/desktop)
              ├── progress === 0 → fullscreen (авто > ручное)
              ├── progress >= 1 → endState (invisible | standard)
              └── возвращает cleanup → kill() при размонтировании страницы
```

Страница не знает ни о DOM-нодах навбара (`[data-navbar]`, `[data-content]`),
ни о целевых ширинах — она только отдаёт свой элемент-триггер. Это гарантирует,
что даже после ручного toggle (который убивает ScrollTrigger-твин)
принудительный разворот в `fullscreen` сработает при скролле к началу:
триггер живёт в провайдере и обновляет состояние навбара на границах
спейсера напрямую.

## Глобальные стили

В `src/index.css` определены стили для data-атрибутов:

```css
/* Фиксированное позиционирование — GSAP анимирует width */
[data-navbar] {
  position: fixed;
  top: 0;
  left: 0;
  height: 100dvh;
  z-index: var(--z-nav-overlay, 1000);
  background: transparent;
  will-change: width, height;
}

/* Контентная область — margin-left анимируется на tablet/desktop */
[data-content] {
  will-change: margin-left;
}

/* Mobile: контент никогда не сдвигается */
@media (width < 768px) {
  [data-content] {
    margin-left: 0 !important;
  }
}
```

## Управление состоянием

| Сущность                | Тип                                    | Назначение                                                  |
| ----------------------- | -------------------------------------- | ----------------------------------------------------------- |
| `currentState`          | `React.State<NavState>`                | UI-состояние для пропа `isSlim` в NavigationBar             |
| `stateRef`              | `React.Ref<NavState>`                  | Актуальное состояние для логики toggle (без stale closure)  |
| `registerScrollTrigger` | `(trigger: HTMLElement) => () => void` | Функция из Context API: регистрирует ScrollTrigger страницы |

**NavState**: `'fullscreen' | 'standard' | 'slim' | 'invisible'` — тип и конфиг
ширин (`NAV_STATES`) вынесены в `navbarStates.ts` (чистая логика, без React).
Провайдер использует `getDefaultState`/`getNextState` для пересчёта состояний и
`getWidth`/`getContentMargin` для GSAP-анимаций.

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
- Вешает `data-slim` для CSS-селекторов

### Позиционирование toggle

Кнопка toggle рендерится **внутри** `<nav data-navbar>` как дочерний элемент
и позиционируется через `position: absolute` (относительно навбара):

- **Tablet**: `top: 20px; right: 20px` — в правом верхнем углу навбара
- **Mobile**: `top: 20px; left: 20px` — в левом верхнем углу экрана (всегда видна,
  даже когда навбар в `invisible`)

На mobile навбар имеет `overflow: visible`, а внутренний контейнер `.navInner` —
`overflow: hidden`. Это гарантирует, что контент (логотип, ссылки) обрезается
при `width: 0`, а кнопка toggle остаётся видимой вне границ навбара.

## CSS-селекторы slim-режима

В `NavItem.module.css` переключение происходит через атрибут `data-slim`,
который выставляется при `isCollapsed === true` (то есть в состояниях `slim` и `invisible`):

```css
.link[data-slim] {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 10px 0;
}

.link[data-slim] .label {
  display: none;
}

.link[data-slim] .icon {
  font-size: var(--font-sizes-xl);
}
```

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

## Ключевые решения

- **CSS Modules + direct GSAP props** — вместо переключения CSS-классов GSAP
  анимирует CSS-свойства (`width`, `marginLeft`) напрямую. Это упрощает
  интеграцию со ScrollTrigger и избегает проблем с хешированными именами CSS Modules.

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

- **Toggle внутри `[data-navbar]`, overflow: hidden на `.navInner`** — кнопка
  рендерится внутри навбара с `position: absolute`. На desktop/tablet `.nav` имеет
  `overflow: hidden`, контент обрезается. На mobile `.nav` переключается на
  `overflow: visible`, а `overflow: hidden` переносится на `.navInner` — toggle
  остаётся видимым даже при `width: 0` (invisible-режим).

- **Spacer в HomePage, а не в NavigationBar** — невидимый div `100dvh`
  создаётся внутри HomePage, а не в NavigationBar. Это гарантирует,
  что ScrollTrigger анимирует навбар только на `/home`, и не мешает
  на других роутах.

- **Жизненный цикл триггера — на стороне страницы** — страница вызывает
  `registerScrollTrigger` в `useEffect` и получает cleanup, который убивает
  ScrollTrigger и таймлайн (`kill()`) при размонтировании. Никаких утечек
  при переходах между роутами; навбар остаётся независимым модулем.
