# NavigationBar

Адаптивная многофункциональная навигационная панель с тремя состояниями отображения,
автоматически переключаемыми через ScrollTrigger или вручную через кнопку toggle.

## Состояния

| Состояние    | Ширина  | Высота   | Где используется                                      |
| ------------ | ------- | -------- | ----------------------------------------------------- |
| `fullscreen` | `100vw` | `100dvh` | `/home` в начальной позиции, mobile toggle            |
| `standard`   | `25vw`  | `100dvh` | tablet/desktop после скролла, дефолт на других роутах |
| `slim`       | `80px`  | `100dvh` | mobile по умолчанию, tablet при ручном toggle         |

Все состояния имеют `position: fixed`, `z-index: 1000` и прозрачный фон.

## Поведение по устройствам

### Mobile (`< 768px`)

| Роут     | Начальное    | Скролл                | Toggle                |
| -------- | ------------ | --------------------- | --------------------- |
| `/home`  | `fullscreen` | `fullscreen` → `slim` | `slim` ↔ `fullscreen` |
| `/other` | `slim`       | нет                   | `slim` ↔ `fullscreen` |

### Tablet (`768 – 1024px`)

| Роут     | Начальное    | Скролл                    | Toggle              |
| -------- | ------------ | ------------------------- | ------------------- |
| `/home`  | `fullscreen` | `fullscreen` → `standard` | `standard` ↔ `slim` |
| `/other` | `standard`   | нет                       | `standard` ↔ `slim` |

**Важно**: при скролле к началу страницы ScrollTrigger принудительно разворачивает навбар
в `fullscreen` — это имеет приоритет над ручным `slim` состоянием.

### Desktop (`>= 1024px`)

| Роут     | Начальное    | Скролл                    | Toggle |
| -------- | ------------ | ------------------------- | ------ |
| `/home`  | `fullscreen` | `fullscreen` → `standard` | нет    |
| `/other` | `standard`   | нет                       | нет    |

На desktop кнопка toggle не рендерится.

## Архитектура

```
src/components/NavigationBar/
├── index.ts                  # Barrel: NavigationBar, NavList, navItems, NavItemConfig
├── NavigationBar.tsx         # Nav-обёртка, логотип, toggle-btn, использует NavList
├── NavigationBar.module.css  # .nav, .navInner, .logo, .toggleBtn
├── NavList.tsx               # <ul>{items.map → NavItem}</ul>
├── NavList.module.css        # .list
├── NavItem.tsx               # <li> + <NavLink>, иконка/текст в зависимости от isSlim
├── NavItem.module.css        # .link, .active, .icon, .label, [data-slim]-стили
└── navItems.ts               # Конфиг (path, label, icon), деривация от routes
```

Barrel (`index.ts`) экспортирует только `NavigationBar`, `NavList`, `navItems` и тип `NavItemConfig`. `NavItem` — внутренний компонент, не экспортируется наружу.

### navItems.ts

Единственный источник правды для `path` и `label` — `routes.tsx`. `navItems.ts` импортирует `routes`, отфильтровывает `*` (NotFound) и навешивает `icon` через маппинг `Record<path, ReactNode>`:

```ts
// navItems.ts — схема
import { routes } from '../../routes';

const routeIcons: Record<string, ReactNode> = {
  '/': '🏠', // emoji-заглушка, позже — <HomeIcon />
  '/about': 'ℹ️',
  '/services': '🛠️',
  '/contact': '📬',
};

export const navItems: NavItemConfig[] = routes
  .filter((r) => r.path !== '*')
  .map((r) => ({
    path: r.path,
    label: r.label!,
    icon: routeIcons[r.path] ?? '❓',
  }));
```

Поле `icon` типизировано как `ReactNode` — замена emoji на `<HomeIcon />` не потребует изменения интерфейсов, только замены значения в `routeIcons`.

### NavItem — поведение `isSlim`

- `isSlim === false`: рендерится `<span class="label">{label}</span>` + `<span class="icon">{icon}</span>` (иконка в DOM, но в CSS на данный момент скрыта — в обычных режимах не отображается)
- `isSlim === true`: текст `.label` скрыт через CSS (`display: none`), иконка `.icon` центрируется, на `<NavLink>` вешается `data-slim` и `tabIndex={-1}`, исключающий ссылку из Tab-навигации

### Зависимости

- `useBreakpoint` — `src/utils/breakpoints.ts`
- `useLocation` — `react-router`
- `gsap` + `useGSAP` — GSAP-анимации
- `logger` — `src/utils/logger.ts`
- `routes` — `src/routes.tsx` (через `navItems.ts`)

### Поток данных

```
App.tsx
├── <NavigationBar />          ← всегда в DOM
│     ├── <NavList />
│     │     └── <NavItem> × N
│     └── GSAP анимирует width
│     └── dispatch: window 'navbar:setstate'
│
├── <main data-content>        ← margin-left анимируется GSAP
│     └── <Routes>
│           └── HomePage
│                 ├── <div ref={spacerRef} />   ← 100dvh спейсер
│                 └── <LandingSections />
│
HomePage (useGSAP)
  └── ScrollTrigger.create()
        ├── scrub: анимация [data-navbar] width
        ├── scrub: анимация [data-content] marginLeft (tablet/desktop)
        └── onUpdate:
              ├── progress === 0 → dispatchEvent('navbar:setstate', 'fullscreen')
              └── progress >= 1 → dispatchEvent('navbar:setstate', endState)
```

Навбар слушает кастомное событие `navbar:setstate` и при его получении
вызывает `animateNavbar()` — это гарантирует, что даже после ручного toggle
(который убивает ScrollTrigger-твин) принудительный разворот в `fullscreen`
сработает при скролле к началу.

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
  overflow: hidden;
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

| Сущность       | Тип                           | Назначение                                                 |
| -------------- | ----------------------------- | ---------------------------------------------------------- |
| `currentState` | `React.State<NavState>`       | UI-состояние для кнопки toggle и пропа `isSlim` в NavList  |
| `stateRef`     | `React.Ref<NavState>`         | Актуальное состояние для логики toggle (без stale closure) |
| `STATE_EVENT`  | константа `'navbar:setstate'` | Имя кастомного события для синхронизации с HomePage        |

**NavState**: `'fullscreen' | 'standard' | 'slim'`

### Триггеры изменения состояния

1. **Смена роута** — `useGSAP` с `dependencies: [location.pathname, bp]`
2. **Смена breakpoint** — `useGSAP` с `dependencies: [location.pathname, bp]`
3. **Ручной toggle** — `handleToggle` по клику на кнопку
4. **Событие ScrollTrigger** — `useEffect` с `addEventListener(STATE_EVENT)`

### Поток `currentState → isSlim`

```tsx
const isSlim = currentState === 'slim';

return <NavList isSlim={isSlim} />;
```

`isSlim` пробрасывается в `NavList` → `NavItem`, где:

- Управляет видимостью текста/иконки
- Выставляет `tabIndex={-1}` на `<NavLink>`
- Вешает `data-slim` для CSS-селекторов

## CSS-селекторы slim-режима

В `NavItem.module.css` переключение происходит через атрибут `data-slim`:

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
  '/':        <HomeIcon />,       // вместо '🏠'
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

- **`overwrite: 'auto'` во всех `gsap.to()`** — гарантирует, что новый твин
  прерывает предыдущие конфликты, включая твины от ScrollTrigger.

- **Custom event вместо React State** — прогресс скролла не передаётся
  через React State (запрещено архитектурой). ScrollTrigger диспатчит
  только дискретные значения (`fullscreen` / `slim` / `standard`) при
  достижении границ спейсера.

- **`useBreakpoint` через `matchMedia`** — в отличие от `resize`,
  `matchMedia` не срабатывает на каждом пикселе и корректно реагирует
  на поворот экрана на планшетах.

- **Приоритет: автоскролл > ручное переключение** — при скролле к началу
  страницы ScrollTrigger принудительно разворачивает навбар в `fullscreen`,
  переопределяя предыдущее ручное `slim` состояние.

- **`tabIndex={-1}` в slim** — ссылки навбара получают `tabIndex = -1`
  в slim-состоянии, исключая их из фокуса при навигации Tab.

- **Spacer в HomePage, а не в NavigationBar** — невидимый div `100dvh`
  создаётся внутри HomePage, а не в NavigationBar. Это гарантирует,
  что ScrollTrigger анимирует навбар только на `/home`, и не мешает
  на других роутах.
