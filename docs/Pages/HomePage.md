# HomePage

Лендинг — основной контент сайта при заходе на `/` или `/home`. Управляет двумя
независимыми механизмами: **IntroAnimation** (оверлей при первом заходе) и
**ScrollTrigger** (анимация навбара при скролле).

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
- `useBreakpoint` — `utils/breakpoints.ts`
- `useGSAP` + `ScrollTrigger` — GSAP

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

ScrollTrigger создаётся внутри `useGSAP` и пересоздаётся только при смене
breakpoint (`dependencies: [bp]`).

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

### Timeline + scrub

GSAP-таймлайн с ScrollTrigger, привязанным к спейсеру:

```tsx
const scrollConfig = {
  trigger: spacerRef.current,
  start: 'top top',
  end: 'bottom top',
  scrub: true,
  invalidateOnRefresh: true,
  onUpdate: (self: ScrollTrigger) => {
    if (self.progress === 0) {
      window.dispatchEvent(
        new CustomEvent('navbar:setstate', { detail: 'fullscreen' }),
      );
    } else if (self.progress >= 1) {
      window.dispatchEvent(
        new CustomEvent('navbar:setstate', { detail: endState }),
      );
    }
  },
};

const tl = gsap.timeline({ scrollTrigger: scrollConfig });

tl.to('[data-navbar]', {
  width: targetWidth,
  ease: 'none',
  overwrite: 'auto',
});

if (!isMobile) {
  tl.to(
    '[data-content]',
    { marginLeft: targetMargin, ease: 'none', overwrite: 'auto' },
    0,
  );
}
```

**Целевые значения** зависят от breakpoint:

| Breakpoint | Начало     | Конец скролла | Ширина навбара | Отступ контента |
| ---------- | ---------- | ------------- | -------------- | --------------- |
| Mobile     | fullscreen | invisible     | `0px`          | `0` (нет)       |
| Tablet     | fullscreen | standard      | `25vw`         | `25vw`          |
| Desktop    | fullscreen | standard      | `25vw`         | `25vw`          |

### Custom event `navbar:setstate`

При достижении границ спейсера ScrollTrigger диспатчит кастомное событие:

- `progress === 0` → `{ detail: 'fullscreen' }` — скролл к началу, принудительный разворот
- `progress >= 1` → `{ detail: 'invisible' | 'standard' }` — конец спейсера

NavigationBar слушает это событие и вызывает `animateNavbar()` — это
гарантирует синхронизацию состояния, даже если ручной toggle убил
ScrollTrigger-твин.

### Приоритет: автоскролл > ручное переключение

При скролле к началу страницы ScrollTrigger принудительно разворачивает
навбар в `fullscreen`, переопределяя предыдущее ручное `slim` или `invisible` состояние.
Это реализовано через `onUpdate` + custom event, который NavigationBar
обрабатывает безусловно.

## Связь с NavigationBar

```text
HomePage (ScrollTrigger)
  │
  ├── GSAP: анимация [data-navbar] width напрямую (scrub)
  ├── GSAP: анимация [data-content] marginLeft (scrub, tablet/desktop)
  │
  └── dispatchEvent('navbar:setstate', detail)
        │
        NavigationBar (addEventListener)
          └── animateNavbar(newState) — GSAP.to() с overwrite: 'auto'
```

Детальнее: `docs/Components/NavigationBar.md`.

## Ключевые решения

- **ScrollTrigger НЕ использует React State** — прогресс скролла передаётся
  GSAP напрямую в DOM. Custom event диспатчит только дискретные значения
  при достижении границ спейсера.
- **`overwrite: 'auto'`** во всех `gsap.to()` — гарантирует, что ручной toggle
  не сломает ScrollTrigger при повторном скролле.
- **Spacer общий для всех bp** — единый механизм анимации навбара,
  независимо от устройства, с разными целевыми значениями.
- **GSAP анимирует data-атрибуты напрямую** — без переключения CSS-классов,
  что исключает проблемы с хешированными именами CSS Modules.
- **IntroAnimation — overlay, не замена контента** — `LandingSections` всегда
  в DOM под intro-оверлеем, поисковики и соцсети видят контент с первого рендера.
