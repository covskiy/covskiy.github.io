# LogoText — Архитектура компонента

## Обзор

Анимированный SVG-логотип для сплэш-экрана. Две начальные фигуры (подкова + гвоздь) морфируют в слово **COVSKIY** с помощью GSAP `MorphSVGPlugin`. Курсороподобный элемент последовательно открывает буквы.

## Файлы

| Файл                  | Назначение                                                              |
| --------------------- | ----------------------------------------------------------------------- |
| `LogoText.tsx`        | Компонент — GSAP timeline, оркестрация суб-таймлайнов букв и курсора. Timeline-билдеры — в `timelines.ts` |
| `LogoText.svg`        | Исходный SVG с двумя слоями (исходные фигуры + пути букв). Финальные `morphPath-*` — единый источник истины для `morphSVG` |
| `LogoText.module.css` | Контейнер + глобальные CSS-переопределения для начального состояния SVG |
| `timelines.ts`        | Timeline-билдеры: `createCLetterTimeline`, `createOVSKIYTimeline` (data-driven цикл), `createCursorTimeline` (data-driven scales), `createSparksTimeline` |
| `sparks.config.ts`    | Слой 1 — все «магические числа» эффекта искр + профили mobile/tablet/desktop + тайминги burst'ов |
| `sparks.system.ts`    | Слой 2 — чистая SparkSystem (emit / update / draw / clear) без знания React/GSAP/DOM. Trajectory-based (spiral/sinwave) |
| `useSparkCanvas.ts`   | Слой 3 — хук канваса: DPR-синк, ResizeObserver, гибридный клиппинг (mobile=mask, tablet/desktop=clip), RAF-цикл, cleanup |
| `trajectory.ts`       | Абстракция траектории: интерфейс `Trajectory`, фабрика `createTrajectory()`, выбор spiral/sinwave по весам |
| `spiral/SpiralConfig.ts` | Интерфейс конфигурации спиральной траектории |
| `spiral/SpiralTrajectory.ts` | Класс спиральной траектории (точка на окружности с движущимся центром) |
| `sinwave/SinWaveConfig.ts` | Интерфейс конфигурации синусоидальной траектории |
| `sinwave/SinWaveTrajectory.ts` | Класс синусоидальной траектории (колебание перпендикулярно направлению движения) |

## Структура SVG

Два слоя внутри `viewBox="0 0 200 150"`. `<defs>` отсутствует.

### `#logoLetters` (скрыт, `style="display:none"`) — Финальные пути букв

```
#morphPath-C — контур "C"
#morphPath-O — контур "O"
#morphPath-V — контур "V"
#morphPath-S — контур "S"
#morphPath-K — контур "K"
#morphPath-I — контур "I"
#morphPath-Y — контур "Y"
#nail-path — траектория движения гвоздя-курсора
#morphCursorForm — форма курсора
```

### `#logoImg` (видим) — Исходные фигуры

```
path.img-orig.img-c   — подкова
path.img-nail          — гвоздь
rect.img-orig.img-o    — маркер позиции O (скрыт изначально)
rect.img-orig.img-v    — маркер позиции V (скрыт изначально)
rect.img-orig.img-s    — маркер позиции S (скрыт изначально)
rect.img-orig.img-k    — маркер позиции K (скрыт изначально)
rect.img-orig.img-i    — маркер позиции I (скрыт изначально)
rect.img-orig.img-y    — маркер позиции Y (скрыт изначально)
```

## Интерфейс компонента

```tsx
type RegisterTimelineFn = (tl: gsap.core.Timeline, position?: number) => void;

type AnimationComponentProps = {
  onRegisterTimeline: RegisterTimelineFn;
};
```

Получает колбэк `onRegisterTimeline`, создаёт свой внутренний таймлайн и регистрирует его через колбэк. Родитель (SplashPage) сам добавляет его в мастер-таймлайн.

## Хореография

Все временные метки, начальные позиции и масштабы централизованы в `src/pages/SplashPage/splashChoreography.ts` (`SPLASH_CHOREOGRAPHY.logoText`). Компонент импортирует конфиг и адресуется по ключам букв — это позволяет синхронизировать суб-таймлайны, не передавая числовые значения через родителя.

```tsx
const { C: letterC, O: letterO, Cursor } = SPLASH_CHOREOGRAPHY.logoText;
tl.from(selector, {
  x: letterC.phaseShoe.xPosition,
  duration: letterC.phaseShoe.duration,
});
```

## Последовательность анимации

Три фазы реализованы как **параллельные суб-таймлайны** (`CLetter`, `Nail`, `letters`), добавленные в локальный таймлайн на позицию 0. Внешне последовательный порядок достигается за счёт внутренних временных меток из `SPLASH_CHOREOGRAPHY`.

- Фаза 1
  - Появляется "вкатыванием" будущий символ C — `.img-c` в форме подковы
  - Двигаясь по траектории появляется гвоздь-каретка — `.img-nail` в форме гвоздя
- Фаза 2
  - Элемент `.img-c` трансформируется в форму символа C, используя путь `#morphPath-C`
  - Элемент `.img-nail` трансформируется в форму курсора, используя путь `#morphCursorForm`
- Фаза 3
  - Элемент `.img-nail` движется вправо, уменьшаясь по `scaleX` над каждой буквой; затем скрывается
  - Элементы `.letter-*` появляются в момент, когда позиция курсора совпадает с местом буквы; с небольшой задержкой элемент морфирует в конечную форму через `#morphPath-*`

## Синхронизация с Tagline

Тайминги LogoText используются как источник истины для двух событий в `Tagline`:

1. **Влёт клавиатуры** — привязан к началу морфа гвоздя в курсор (`Cursor.phaseCaret.start = 1.5`). Tagline стартует на master-таймлайне в позиции `1.0`, поэтому `KEYBOARD_IN` на локальном таймлайне = `0.5`.
2. **Подсветка клавиш** — привязана к началу морфа соответствующей буквы.

| Master-время | Источник в `SPLASH_CHOREOGRAPHY`                              | Соответствующее событие в Tagline  |
| ------------ | ------------------------------------------------------------- | ---------------------------------- |
| 1.5          | `logoText.Cursor.phaseCaret.start`                            | Влёт клавиатуры                    |
| 1.9          | `logoText.C.phaseLetter.start`                                | Подсветка `.key_c`                 |
| 2.59         | `logoText.O.phaseDash.start + logoText.O.phaseLetter.delay`   | Подсветка `.key_o`                 |
| 2.85         | `logoText.V.phaseDash.start + logoText.V.phaseLetter.delay`   | Подсветка `.key_v`                 |
| 3.07         | `logoText.S.phaseDash.start + logoText.S.phaseLetter.delay`   | Подсветка `.key_s`                 |
| 3.3          | `logoText.K.phaseDash.start + logoText.K.phaseLetter.delay`   | Подсветка `.key_k`                 |
| 3.45         | `logoText.I.phaseDash.start + logoText.I.phaseLetter.delay`   | Подсветка `.key_i`                 |
| 3.6          | `logoText.Y.phaseDash.start + logoText.Y.phaseLetter.delay`   | Подсветка `.key_y`                 |

Tagline стартует на master-таймлайне в позиции `1.0` (`SPLASH_CHOREOGRAPHY.master.labels.TAGLINE`); обе позиции (влёт клавиатуры, подсветка клавиш) вычисляются в `Tagline.tsx` как `master.время - 1.0`. Подробности — в `docs/Components/Tagline.md`.

## Mobile-first стили

Базовые стили рассчитаны на мобильные устройства (phone, ≤480px):

- `.container` — `padding: 0 1rem` для отступов по бокам, `flex-shrink: 0` (защита от сжатия в flex-контейнере SplashPage)
- `.svg` — `max-width: min(90vw, 420px)`, вписывается в мобильный viewport
- Высота определяется пропорцией исходного `viewBox` SVG (200×150 → 360×270)

**Важно**: контейнер **не** имеет `height: 100%` — это сломало бы flex-layout в SplashPage (заставляло LogoText занимать 100vh и вытеснять Tagline). Контейнер sizing определяется контентом (SVG).

Брейкпоинты для планшетов/десктопов пока не заданы — будут добавлены отдельной задачей.

## Архитектура регистрации

Компонент не получает мастер-таймлайн напрямую. Через колбэк `onRegisterTimeline` он сообщает родителю (SplashPage): «вот мой локальный таймлайн, добавь его в мастер». Это обеспечивает слабую связанность: дети не знают о структуре мастер-таймлайна и не мутируют его напрямую.

```tsx
// внутри useGSAP
const tl = gsap.timeline({ id: 'Logo.tsx tl' });
// наполнение tl анимациями...
onRegisterTimeline(tl); // регистрация без позиции (по умолчанию 0)
```

## Ключевые технические решения

### Определение позиции

Синхронизация курсора и букв происходит по времени через единый конфиг `SPLASH_CHOREOGRAPHY` — значения из него подставляются как `start`, `duration`, `delay` в каждой суб-таймлайне

### CSS module

Все правила `:global()` нацелены на внутренние классы SVG (не изменяются SVGR). `.img-orig:not(.img-c)` скрывает все исходные фигуры кроме подковы.

## Зависимости

- `gsap` (MorphSVGPlugin — зарегистрирован в `initGsap.ts`)
- `@gsap/react` (хук `useGSAP` — автоочистка)
- Vite SVGR (суффикс `?react` для импорта SVG)

## Sparks — эффект искр внутри букв

Эффект подъёма искр снизу вверх (из нижней части viewBox), привязанный к двум
моментам локального таймлайна (`burst1.start = 4.2s`, `burst2.start = 4.6s`).
Каждая искра летит по одной из двух траекторий: **spiral** (спираль) или
**sinwave** (синусоида). Выбор траектории и параметров случаен на каждую искру
в момент эмиссии.

Строгое разделение на три слоя:

### Mobile-first архитектура профилей

`MOBILE_PROFILE` — самостоятельный base (без `...SHARED_PROFILE`).
`TABLET_PROFILE` и `DESKTOP_PROFILE` наследуются от mobile через spread
и переопределяют только то, что должно расти с мощностью устройства:

| Параметр | mobile (base) | tablet | desktop |
|---|---|---|---|
| `baseRadius` | 1.9 | 2.2 | 2.2 |
| `lifetime` | 2.0 | 2.0 | 2.5 |
| `speed` | 30 | 30 | 30 |
| `emitCount` | 30 | 40 | 65 |
| `visual.sizeMul` | {min: 0.7, max: 1.3} | (наслед.) | (наслед.) |
| `visual.lifetimeMul` | {min: 0.8, max: 1.2} | (наслед.) | (наслед.) |

Глобально (одинаково на всех устройствах):
- Тайминги burst'ов (`start`, `duration`) — часть хореографии
- Цвета (glowColor, coreColor, centerColor)
- Jitter, tail, trajectory params/ranges/mix

### Слой 1 — `sparks.config.ts`

Все «магические числа» (цвета, профили `mobile` / `tablet` / `desktop`,
тайминги burst'ов, параметры траекторий, настройки шлейфа). Селектор профиля —
`selectSparkProfile(innerWidth)` через пороги `768` / `1280`. Чтобы
подкрутить визуал — правь только этот файл.

`profileName(profile)` — возвращает `'mobile' | 'tablet' | 'desktop'`
по ссылочной идентичности (профили — module-singletons).

**Структура конфига:**
- `viewbox` — размеры viewBox SVG (200×150)
- `jitter` — разброс начальной позиции искры
- `tail` — настройки шлейфа (length, color, startAlpha, startSize)
- `spawn` — точка эмиссии (yOffset от низа viewBox)
- `stage` — параметры stage-уровня (cullMargin, maxDt)
- `trajectory` — глобальные настройки траекторий (mix, params, ranges)
- `profiles` — mobile/tablet/desktop
- `burst1`, `burst2` — тайминги пучков (start, duration)

### Слой 2 — `sparks.system.ts`

Чистая логика частиц, **не знающая** про React, GSAP и DOM. API:
- `emit(origin, count, profile, config)` — создание частиц с jitter. Каждая искра
  получает случайную траекторию (spiral/sinwave) через `createTrajectory()`.
- `update(dt)` — продвижение траекторий, старение, удаление мёртвых искр.
- `draw(ctx, cullLineY, profile)` — 3-слойная отрисовка: свечение (glow) →
  ядро (core) → центр (center). Шлейф (trail) рисуется как последовательность
  затухающих кругов по истории позиций. Culling по `cullLineY` (искры выше
  верхней кромки букв не рисуются).
- `clear()` — сброс массива (используется при скрабе GSDevTools назад).

**Траектории:**
- `spiral` — точка на окружности с движущимся центром. Параметры: radius,
  angularSpeed, clockwise.
- `sinwave` — колебание перпендикулярно направлению движения. Параметры:
  amplitude, frequency, phase.

Выбор траектории — по весам `trajectory.mix` (spiral: 0.35, sinwave: 0.65).

### Слой 3 — `useSparkCanvas.ts` + интеграция в `LogoText.tsx`

- Инициализация `<canvas>`, синхронизация DPR (`devicePixelRatio`).
- `ResizeObserver` на канвас: пересборка `Path2D` из `getBBox()` всех
  `#morphPath-*` (union контуров) + пересчёт профиля по `innerWidth`.
- Трансформация контекста: `ctx.setTransform(scaleX * dpr, 0, 0, scaleY * dpr, 0, 0)`,
  где `scaleX = cssWidth / 200`, `scaleY = cssHeight / 150`. Это позволяет
  физике/отрисовке оперировать в **viewBox-пространстве** (200×150) —
  инвариант к размеру канваса.
- **Гибридный клиппинг**: mobile-профиль использует быстрый mask через
  `destination-in` + `drawImage(mask)`, tablet/desktop — `ctx.clip(Path2D)`.
  Маска пре-рендерится в OffscreenCanvas viewBox-размера белой заливкой клип-пути.
- **Culling**: `cullLineY` вычисляется по `getBBox()` морф-путей (верхняя кромка
  букв + margin). Искры и шлейф выше этой линии не рисуются (анти-«нож» на CSS-клипе).
- **RAF-цикл** (не `gsap.ticker`): стартует при `emit()`, сам останавливается
  когда `aliveCount === 0`. Не зависит от паузы GSAP-мастера — искры
  догорают в своём render-loop даже на `master.pause()`.
- `createSparksTimeline(tl, config, getProfile, emitFn, onClear, onBurstStart)`:
  два твина `progress.value: 0 → 1` на позициях `burst1.start` / `burst2.start`.
  В `onUpdate` читается `getProfile().emitCount`, считается дельта
  эмиссии и зовётся `emitFn(delta)`. При скрабе назад
  (`progress.value < lastValue`) — `onClear()` сбрасывает систему.
- Точка эмиссии: `{ x: Math.random() * viewbox.w, y: viewbox.h - spawn.yOffset }` —
  случайный X по всей ширине viewBox, Y — отступ от низа (сразу в зоне букв).

### `prefers-reduced-motion`

`useSparkCanvas` через `window.matchMedia('(prefers-reduced-motion: reduce)')`
проверяет настройку при инициализации. Если reduce — `useEffect` ранний
return, канвас не инициализируется, RAF-цикл недоступен. Хук возвращает
`reducedMotion: true`, и `LogoText` пропускает регистрацию sparks-таймлайна.
Доступность: пользователи с вестибулярными нарушениями не видят эффект.

### Поведение при паузе/скипе

- `master.pause()`: твины эмиссии встают → новые искры не летят. RAF-цикл
  продолжает крутиться → летящие искры догорают.
- `master.progress(1).kill()`: твины умирают. RAF цикл видит `aliveCount === 0`
  и сам отменяется.
- `useGSAP` cleanup на unmount (route change) → RAF отменяется,
  `ResizeObserver` отключается, `system.clear()`.
- StrictMode двойной маунт: cleanup-логика в `useEffect` идемпотентна.
