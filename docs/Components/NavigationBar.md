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
├── NavigationBar.tsx          # Компонент (default export)
└── NavigationBar.module.css   # Стили (CSS Modules)
```

### Зависимости

- `useBreakpoint` — `src/utils/breakpoints.ts`
- `useLocation` — `react-router`
- `gsap` + `useGSAP` — GSAP-анимации
- `logger` — `src/utils/logger.ts`
- `routes` — `src/routes.tsx`

### Поток данных

```
App.tsx
├── <NavigationBar />          ← всегда в DOM
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
| `currentState` | `React.State<NavState>`       | UI-состояние для кнопки toggle и атрибута `tabIndex`       |
| `stateRef`     | `React.Ref<NavState>`         | Актуальное состояние для логики toggle (без stale closure) |
| `STATE_EVENT`  | константа `'navbar:setstate'` | Имя кастомного события для синхронизации с HomePage        |

**NavState**: `'fullscreen' | 'standard' | 'slim'`

### Триггеры изменения состояния

1. **Смена роута** — `useGSAP` с `dependencies: [location.pathname, bp]`
2. **Смена breakpoint** — `useGSAP` с `dependencies: [location.pathname, bp]`
3. **Ручной toggle** — `handleToggle` по клику на кнопку
4. **Событие ScrollTrigger** — `useEffect` с `addEventListener(STATE_EVENT)`

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
