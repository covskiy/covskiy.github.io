# HomePage

Лендинг — основной контент сайта при заходе на `/` или `/home`. Управляет двумя
независимыми механизмами: **IntroAnimation** (оверлей при первом заходе) и
**ScrollTrigger** (регистрация анимации навбара при скролле).

## Состояния

| Сущность    | Тип                         | Назначение                                     |
| ----------- | --------------------------- | ---------------------------------------------- |
| `showIntro` | `React.State<boolean>`      | Показывать ли overlay IntroAnimation           |
| `spacerRef` | `React.Ref<HTMLDivElement>` | Невидимый спейсер 100dvh для ScrollTrigger     |
| `bp`        | `useBreakpoint()`           | Текущий breakpoint (mobile / tablet / desktop) |

## Архитектура

```
pages/HomePage/
├── HomePage.tsx          # Компонент (default export)
└── HomePage.module.css   # Стили спейсера (.spacer)
```

### Зависимости

- `IntroAnimation`, `introStorage` — `components/IntroAnimation/`
- `LandingSections` — `components/LandingSections/`
- `useNavbar` — `components/NavigationBar/` (`registerScrollTrigger`)
- `useBreakpoint` — `utils/breakpoints.ts`

## IntroAnimation

При первом заходе (или пока не поставлен флаг `neverShow`) HomePage рендерит
`IntroAnimation` как `createPortal` в `document.body` — оверлей `position: fixed`
поверх всего контента.

```tsx
const [showIntro, setShowIntro] = useState(
  () => !introStorage.getNeverShow() && !introStorage.getSessionSkip(),
);
```

- `overflow: hidden` на `body` / `html` блокирует скролл во время интро
- После `onComplete` → `setShowIntro(false)` → оверлей анмаунтится
- Контент `LandingSections` всё это время находится в DOM под оверлеем

**Подробности анимации и хореографии:** `docs/Components/IntroAnimation.md`.

## ScrollTrigger

ScrollTrigger создаёт **useNavbarLayout** (корневая сцена раскладки навбара)
через `registerScrollTrigger`, который HomePage вызывает в `useEffect`.
Пересоздаётся только при смене breakpoint (`dependencies: [registerScrollTrigger, bp]`).

### Спейсер

Невидимый `div` высотой `100dvh` и `pointer-events: none` — обеспечивает
физическую длину скролла на `/home`. Создаётся для **всех** breakpoint'ов

```tsx
<div ref={spacerRef} className={styles.spacer} />
```

```css
.spacer {
  height: 100dvh;
  width: 100%;
  pointer-events: none;
}
```

### Регистрация триггера

```tsx
const { registerScrollTrigger } = useNavbar();

useEffect(() => {
  if (!spacerRef.current) return;
  return registerScrollTrigger(spacerRef.current);
}, [registerScrollTrigger, bp]);
```

Сам таймлайн (scrub) и обновление состояния навбара на границах спейсера
живут в провайдере — HomePage отдаёт только элемент-триггер. Cleanup,
возвращённый из `registerScrollTrigger`, убивает ScrollTrigger и таймлайн
при размонтировании страницы или смене breakpoint.

**Целевые значения** зависят от breakpoint и известны провайдеру:

| Breakpoint | Начало     | Конец скролла | Ширина навбара | Отступ контента |
| ---------- | ---------- | ------------- | -------------- | --------------- |
| Mobile     | fullscreen | invisible     | `0px`          | `0` (нет)       |
| Tablet     | fullscreen | standard      | `25vw`         | `25vw`          |
| Desktop    | fullscreen | standard      | `25vw`         | `25vw`          |

### Границы спейсера

При достижении границ спейсера ScrollTrigger обновляет состояние навбара
внутри провайдера:

- `progress === 0` → `fullscreen` — скролл к началу, принудительный разворот
- `progress >= 1` → `invisible` | `standard` — конец спейсера

### Приоритет: автоскролл > ручное переключение

При скролле к началу страницы ScrollTrigger принудительно разворачивает
навбар в `fullscreen`, переопределяя предыдущее ручное `slim` или `invisible`
состояние. Это реализовано через `onUpdate` внутри провайдера, который
обрабатывает границы безусловно — без custom event'ов.

## Связь с NavigationBar

```text
HomePage (useEffect)
  └── useNavbar().registerScrollTrigger(spacerRef.current)
        │
        NavigationBarProvider
          ├── bus: NavbarEventBus (createNavbarEventBus, scoped)
          │     └── шина для типизированных сцен
          └── useNavbarLayout (корневая сцена раскладки)
                ├── GSAP: nav.x (transform, scrub — ширина окна навбара)
                ├── GSAP: navInner.x (counter-translate контента)
                ├── main.x НЕ твинится — статичная колонка (--nav-content-offset)
                ├── applyState(next, source) → bus.emit('state:change')
                ├── bus.on('state:change') → animateNavbar
                ├── ScrollTrigger.onUpdate:
                │     ├── scrollListenersRef (низкоуровневый канал для scrub)
                │     ├── progress 0  → applyState('fullscreen', 'scroll')
                │     └── progress ≥ 1 → applyState(endState, 'scroll')
                └── cleanup → kill() ScrollTrigger + timeline
```

Дочерние сцены (`NavItem`, будущие) подписываются на шину через
`useNavbarEvent` / `useNavbarScrollProgress` и анимируют свои DOM-ноды
самостоятельно — без участия провайдера.
Детальнее: `docs/Components/NavigationBar.md`, API шины:
`docs/Components/navbarEventBus.md`.

## Ключевые решения

- **ScrollTrigger НЕ использует React State** — прогресс скролла передаётся
  GSAP напрямую в DOM. Состояние навбара обновляется только в дискретных
  точках на границах спейсера.
- **Страница не знает о DOM навбара** — никаких селекторов `.nav` / `<main>`
  и целевых ширин; страница отдаёт только элемент-триггер.
- **Жизненный цикл триггера — на странице** — создание в `useEffect`,
  уничтожение через cleanup из `registerScrollTrigger` при размонтировании
  или смене breakpoint.
- **`overwrite: 'auto'`** только в прямых твинах `animateNavbar` —
  гарантирует, что ручной toggle не сломает ScrollTrigger при повторном
  скролле. Твины внутри scrub-таймлайна `registerScrollTrigger` идут без
  `overwrite` (им это не нужно — они живут в собственном timeline).
  `animateNavbar` теперь живёт в `useNavbarLayout` (корневая сцена
  раскладки) и подписана на `bus.on('state:change')` — единый путь
  публикации → реакции для всех источников (toggle/route/breakpoint/scroll).
- **Spacer общий для всех bp** — единый механизм анимации навбара,
  независимо от устройства, с разными целевыми значениями.
- **IntroAnimation — overlay, не замена контента** — `LandingSections` всегда
  в DOM под intro-оверлеем, поисковики и соцсети видят контент с первого рендера.
