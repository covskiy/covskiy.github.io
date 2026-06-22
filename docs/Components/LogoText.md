# LogoText — Архитектура компонента

## Обзор

Анимированный SVG-логотип для сплэш-экрана. Две начальные фигуры (подкова + гвоздь) морфируют в слово **COVSKIY** с помощью GSAP `MorphSVGPlugin`. Курсороподобный элемент последовательно открывает буквы.

## Файлы

| Файл                  | Назначение                                                              |
| --------------------- | ----------------------------------------------------------------------- |
| `LogoText.tsx`        | Компонент — GSAP timeline, оркестрация суб-таймлайнов букв и курсора. Timeline-билдеры — в `timelines.ts` |
| `LogoText.svg`        | Исходный SVG с двумя слоями (исходные фигуры + пути букв). Финальные `morphPath-*` — единый источник истины для `morphSVG` |
| `LogoText.module.css` | Контейнер + глобальные CSS-переопределения для начального состояния SVG |
| `timelines.ts`        | Timeline-билдеры: `createCLetterTimeline`, `createOVSKIYTimeline` (data-driven цикл), `createCursorTimeline` (data-driven scales), `createSparksTimeline` + `scheduleSparksBoost` |
| `sparks.config.ts`    | Слой 1 — все «магические числа» эффекта искр + профили mobile/tablet/desktop |
| `sparks.system.ts`    | Слой 2 — чистая SparkSystem (emit / update / draw / boostAll / clear) без знания React/GSAP/DOM |
| `useSparkCanvas.ts`   | Слой 3 — хук канваса: DPR-синк, ResizeObserver, Path2D-клип из `#morphPath-*`, RAF-цикл, cleanup |

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

Эффект вылета искр из точки курсора на букве Y влево, привязанный к двум
моментам локального таймлайна (`burst1.start = 4.2s`, `burst2.start = 4.6s`).
Строгое разделение на три слоя:

### Mobile-first архитектура профилей

`MOBILE_PROFILE` — самостоятельный base (без `...SHARED_PROFILE`).
`TABLET_PROFILE` и `DESKTOP_PROFILE` наследуются от mobile через spread
и переопределяют только то, что должно расти с мощностью устройства:

| Параметр | mobile (base) | tablet | desktop |
|---|---|---|---|
| `baseRadius` | 1.1 | 1.4 | 1.6 |
| `tailLength` | 11 | 14 | 16 |
| `speedMul` | 0.95 | 1.0 | 1.05 |
| `burst1.count` | 20 | 30 | 35 |
| `burst2.count` | 15 | 25 | 28 |
| `boostFactor` | 1.4 | 1.5 | 1.7 |

Глобально (одинаково на всех устройствах):
- Тайминги burst'ов (`start`, `duration`) — часть хореографии
- Визуал пучка (`brightnessMul`, `sizeMul`) — burst1 чуть скромнее burst2
- Цвета, физика, jitter

### Слой 1 — `sparks.config.ts`

Все «магические числа» (цвета ядра/хвоста/дыма, физика, jitter, тайминги,
профили `mobile` / `tablet` / `desktop`). Селектор профиля —
`selectSparkProfile(innerWidth)` через пороги `768` / `1280`. Чтобы
подкрутить визуал — правь только этот файл.

`profileName(profile)` — возвращает `'mobile' | 'tablet' | 'desktop'`
по ссылочной идентичности (профили — module-singletons).

### Слой 2 — `sparks.system.ts`

Чистая логика частиц, **не знающая** про React, GSAP и DOM. API:
- `emit(origin, delta, burst, profile, config)` — создание частиц с jitter.
- `update(dt, profile, config)` — физика (трение, ветер, синусоида по Y, старение).
- `draw(ctx, clip, profile, bbox)` — 3-слойная отрисовка: дымный halo → кометный хвост (история позиций в `Float32Array`-кольце) → яркое ядро. Culling по bbox перед `arc()` для halo/core; хвост рисуется всегда, но автоматически клипается по `ctx.clip(clip)`.
- `boostAll(factor)` — резкое увеличение `vel.x` для всех живых частиц.
- `clear()` — сброс массива (используется при скрабе GSDevTools назад).

### Слой 3 — `useSparkCanvas.ts` + интеграция в `LogoText.tsx`

- Инициализация `<canvas>`, синхронизация DPR (`devicePixelRatio`).
- `ResizeObserver` на канвас: пересборка `Path2D` из `getBBox()` всех
  `#morphPath-*` (union контуров) + пересчёт профиля по `innerWidth`.
- Трансформация контекста: `ctx.setTransform(scaleX * dpr, 0, 0, scaleY * dpr, 0, 0)`,
  где `scaleX = cssWidth / 200`, `scaleY = cssHeight / 150`. Это позволяет
  физике/отрисовке оперировать в **viewBox-пространстве** (200×150) —
  инвариант к размеру канваса.
- **RAF-цикл** (не `gsap.ticker`): стартует при `emit()`, сам останавливается
  когда `aliveCount === 0`. Не зависит от паузы GSAP-мастера — искры
  догорают в своём render-loop даже на `master.pause()`.
- `createSparksTimeline(tl, config, getProfile, emitFn, onClear, onBurstStart)`:
  два твина `progress.value: 0 → 1` на позициях `burst1.start` / `burst2.start`.
  В `onUpdate` читается `getProfile()[label].count`, считается дельта
  эмиссии и зовётся `emitFn(delta, label)`. При скрабе назад
  (`progress.value < lastValue`) — `onClear()` сбрасывает систему.
- `scheduleSparksBoost(tl, config, getProfile, boostFn)` — одноразовый
  `tl.call()` на позиции `burst2.start`, дающий «пинок» живым искрам
  первого пучка. Множитель читается из `getProfile().boostFactor`.

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
