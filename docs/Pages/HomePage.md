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
- `useLayout` — `components/layout/` (`registerScrollTrigger`)
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

ScrollTrigger создаёт **useScrollScrub** (сцена layout-модуля) через
`registerScrollTrigger`, который HomePage вызывает в `useEffect`.
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
const { registerScrollTrigger } = useLayout();

useEffect(() => {
  if (!spacerRef.current) return;
  return registerScrollTrigger(spacerRef.current);
}, [registerScrollTrigger, bp]);
```

Сам таймлайн (scrub) и обновление состояния раскладки на границах спейсера
живут в layout-модуле — HomePage отдаёт только элемент-триггер. Cleanup,
возвращённый из `registerScrollTrigger`, убивает ScrollTrigger и таймлайн
при размонтировании страницы или смене breakpoint.

**Целевые значения** зависят от breakpoint и известны провайдеру:

| Breakpoint | Начало     | Конец скролла | Ширина навбара | Отступ контента |
| ---------- | ---------- | ------------- | -------------- | --------------- |
| Mobile     | fullscreen | invisible     | `0px`          | `0` (нет)       |
| Tablet     | fullscreen | standard      | `25vw`         | `25vw`          |
| Desktop    | fullscreen | standard      | `25vw`         | `25vw`          |

### Границы спейсера

При достижении границ спейсера ScrollTrigger диспатчит события в машину
(`useScrollScrub` → `dispatch`):

- `progress === 0` → `REACH_TOP` → `fullscreen` — скролл к началу,
  принудительный разворот
- `progress >= 1` → `REACH_BOTTOM` → `invisible` | `standard` — конец спейсера

### Приоритет: автоскролл > ручное переключение

При скролле к началу страницы ScrollTrigger принудительно разворачивает
навбар в `fullscreen`, переопределяя предыдущее ручное `slim` или `invisible`
состояние. Это реализовано в `machine/transition.ts`: `REACH_TOP` всегда ведёт
в `fullscreen` (guard `isManualMobileState` — только для `REACH_BOTTOM`).

## Связь с layout

```text
HomePage (useEffect)
  └── useLayout().registerScrollTrigger(spacerRef.current)
        │
        LayoutProvider (машина + композер)
          ├── mode — единственный источник состояния (React Context)
          ├── useScrollScrub   (сенсор: регистрирует ScrollTrigger, REACH_*)
          ├── useLayoutMachine (executor: transition() решает переход + actions)
          └── useNavPosition   (единственный владелец .nav: scrub + discrete)
                ├── onScrollProgress → paused scrub-твин nav.x
                ├── onNavState (source !== 'scroll') → gsap.to(nav, {x})
                ├── main.x НЕ твинится — статичная колонка (--nav-content-offset)
                └── cleanup → kill() ScrollTrigger + timeline
```

Каналы (`onScrollProgress`, `onToggleVisibility`, `onNavState`) работают без
React-рендера; каждый компонент панели `nav/*` строит свои `useGSAP` из
`mode`/`isSlim`. Детальнее: `docs/Components/Layout/`.

## Ключевые решения

- **ScrollTrigger НЕ использует React State** — прогресс скролла передаётся
  GSAP напрямую в DOM. Состояние раскладки обновляется только в дискретных
  точках на границах спейсера.
- **Страница не знает о DOM навбара** — никаких селекторов `.nav` / `<main>`
  и целевых ширин; страница отдаёт только элемент-триггер.
- **Жизненный цикл триггера — на странице** — создание в `useEffect`,
  уничтожение через cleanup из `registerScrollTrigger` при размонтировании
  или смене breakpoint.
- **`overwrite: 'auto'`** только в прямых твинах `useNavPosition` (дискретные
  переходы из `onNavState` с `source !== 'scroll'`) — гарантирует, что ручной
  toggle не сломает scrub-твин при повторном скролле. Paused scrub-твин
  (`onScrollProgress`) не активен для GSAP, поэтому его не уничтожает.
- **Spacer общий для всех bp** — единый механизм анимации раскладки,
  независимо от устройства, с разными целевыми значениями.
- **IntroAnimation — overlay, не замена контента** — `LandingSections` всегда
  в DOM под intro-оверлеем, поисковики и соцсети видят контент с первого рендера.
