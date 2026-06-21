# LogoText — Архитектура компонента

## Обзор

Анимированный SVG-логотип для сплэш-экрана. Две начальные фигуры (подкова + гвоздь) морфируют в слово **COVSKIY** с помощью GSAP `MorphSVGPlugin`. Курсороподобный элемент последовательно открывает буквы.

## Файлы

| Файл                  | Назначение                                                              |
| --------------------- | ----------------------------------------------------------------------- |
| `LogoText.tsx`        | Компонент — GSAP timeline + оркестрация burst-эмиссии искр. Canvas/rAF/clipPath вынесены в `useSparkCanvas.ts`, timeline-билдеры — в `timelines.ts` |
| `LogoText.svg`        | Исходный SVG с двумя слоями (исходные фигуры + пути букв). Финальные `morphPath-*` — единый источник истины и для `morphSVG`, и для Path2D-клиппинга искр |
| `LogoText.module.css` | Контейнер + глобальные CSS-переопределения для начального состояния SVG + стили канваса (bottom-anchored, `aspect-ratio`). Клиппинг искр делается в коде через `ctx.clip(Path2D)`, не через CSS-маску |
| `constants.ts`        | Общие константы: viewBox-размеры (`SVG_VIEW_W/H`), `LETTER_BOUNDS`, `LETTER_IDS`/`OVSKIY_IDS`, хелперы `selectorFor`/`pathIdFor`/`morphSelectorFor` |
| `timelines.ts`        | Timeline-билдеры: `createCLetterTimeline`, `createOVSKIYTimeline` (data-driven цикл), `createCursorTimeline` (data-driven scales) |
| `useSparkCanvas.ts`   | Хук: canvas DPR-sync + ResizeObserver, Path2D-клиппинг по контурам букв, rAF-цикл отрисовки искр, API эмиссии (`emitOne`/`boostAll`/`sizeRef`/`profile`) |
| `sparks.ts`           | Particle system: физика искр, отрисовка 3 слоями (tail/halo/core), bounding box cull (из `LETTER_BOUNDS`), per-burst множители яркости |

## Структура SVG

Два слоя внутри `viewBox="0 0 200 150"` (размеры — `SVG_VIEW_W`/`SVG_VIEW_H` в `constants.ts`). `<defs>` отсутствует — клиппинг искр делается через `Path2D`/`ctx.clip()` в `useSparkCanvas.ts`, отдельная SVG-маска не нужна.

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

## Искры в конце анимации

В конце морфинга букв (master-время 4.2s и 4.7s) над логотипом вылетают два пучка искр — горизонтально влево, с лёгким случайным наклоном, видимые **только внутри букв** C-O-V-S-K-I-Y.

### Архитектура

- **Канвас** (`<canvas>` внутри контейнера, после SVG в JSX) — оверлеится поверх SVG
- **Particle system** (`sparks.ts`) — 30–100 искр, рисуются через `requestAnimationFrame` цикл, который стартует на первом burst'е и гаснет, когда все искры потухли
- **Конфигурация** в `splashChoreography.ts → logoText.sparks` — общие параметры (coneHalfAngle, colors, smokeHalo, tailColor, coreAlphaMultipliers) + per-profile (mobile/tablet/desktop) с разными count/size/lifetime/friction/windX/ampY/periodY/slopeMax и т.д.
- **Letter clip (Path2D)** — в `useSparkCanvas.ts` из DOM читаются `d` финальных `#morphPath-C/O/V/S/K/I/Y` (идентификаторы — `LETTER_IDS`/`pathIdFor` в `constants.ts`), объединяются в один `Path2D` через `addPath` и применяются к канвасу через `ctx.clip()` перед каждым `system.step()`. Подробности — в секции «Path2D clip» ниже.
- **Bounding box cull** — в `step()` пропускает draw для искр вне зоны букв (≈50–60% draw calls экономятся)

### Алгоритм искры

Каждая искра (`type Spark` в `sparks.ts`) хранит:

- `x, y` — текущая позиция (пиксели канваса)
- `x0, y0` — позиция в момент эмиссии (опорная точка для наклона)
- `vx` — горизонтальная скорость, отрицательная (влево), с затуханием `vx *= 1 - friction*dt` и подвержена `windX * dt`
- `y` — вычисляется через **наклонённую синусоиду**: `y = y0 + slope * (x - x0) + ampY * sin(omega * t + phase)`. Нет гравитации, нет шума — только sine + slope
- `life` — линейный спад от 1 до 0 за `lifetime` секунд (per-spark с джиттером)
- `history` — кольцевой буфер последних `tailLength` позиций для кометного хвоста
- `burst: 1 | 2` (`BurstId` из `sparks.ts`) — определяет per-burst множитель яркости
- `periodY` (per-spark), `ampY` (per-spark с джиттером), `phase` — разнообразят траектории

### Отрисовка: 3 слоя

1. **Tail** — 10 кругов в `source-over`, фиксированный `tailColor` (`rgb(255, 100, 0)`), `alpha = i/length * life`, `size = baseSize * i/length`. Классический кометный хвост — прозрачный мелкий сзади, яркий крупный спереди.
2. **Halo** — 1 тёмный круг в `source-over`, `smokeHalo.color` (`rgb(15, 12, 25)`), `radius = size * smokeHalo.radius` (2.2×). Даёт «угольный» ореол.
3. **Core** — 1 яркий круг в `lighter` (аддитивное свечение), цвет из `colors[(1 - life) * length]` (color-shift от белого к красному по мере остывания). `alpha = life * coreAlphaMultipliers[burst]` (per-burst формула).

Каждый кадр начинается с `ctx.clearRect(0, 0, w, h)` — никакого motion-blur, хвост рисуется явно.

### Профили (mobile / tablet / desktop)

Per-profile параметры (полная карта с диапазонами — в docblock `sparks` в `splashChoreography.ts`):

- `count` — искр в одном sub-spawn (итого на пучок: `count * subSpawns`)
- `sizeMin/Max` — диапазон радиуса ядра
- `lifetime` + `lifetimeJitter` — база + разброс жизни (длинноживущие долетают до C яркими)
- `friction` — затухание vx (1/s). Баланс с `windX` даёт терминальную скорость `vx_term = windX / friction`
- `initialSpeedMin/Max` — стартовая скорость в пикселях/секунду
- `windX` — постоянное горизонтальное ускорение (px/s², <0 = влево)
- `ampY` + `ampYJitter` — амплитуда/разброс синусоиды Y
- `periodY` + `periodYJitter` — период/разброс синусоиды (в секундах)
- `slopeMax` — макс |наклон| траектории
- `subSpawns` + `subSpawnInterval` — кол-во и интервал порывов ветра в пучке
- `burstDuration` — длительность одного непрерывного потока sub-spawn
- `tailLength` — кол-во точек в кометном хвосте

### Per-burst множители яркости

`coreAlphaMultipliers.burst1: 2.5` — первый пучок, длиннее peak-фаза (60% жизни при alpha=1.0)
`coreAlphaMultipliers.burst2: 1.4` — второй пучок, стандартно (29%)

Формула: `coreAlpha = min(1, life * multiplier)`. Фаза полной яркости = первые `(1 - 1/multiplier) * 100%` жизни. Burst1 заметно дольше «горит» на максимуме, что логически работает как первый импульс кузнечного горна (который должен зажечь внимание).

### Burst 2 — boostAll(1.7)

При эмиссии burst2 дополнительно вызывается `system.boostAll(SPARKS.burstBoostFactor)` — все живые искры получают +70% к vx (разовый множитель, не постоянное ускорение). Визуально — «порыв ветра» подхватывает уже летящий рой. На desktop с 3 sub-spawn'ами в burst2 (4.70/4.85/5.00) это даёт ступенчатый разгон, как 3 порыва ветра подряд.

`sparks.burstBoostFactor = 1.7` живёт в `splashChoreography.ts` — правка в одном месте.

### Bounding box cull (оптимизация)

В `step()` вычисляются 4 константы (один раз на кадр) из `LETTER_BOUNDS` и `SVG_VIEW_W/H` (`constants.ts`):
```ts
const X_MIN = w * (LETTER_BOUNDS.xMin / SVG_VIEW_W);   // 18/200
const X_MAX = w * (LETTER_BOUNDS.xMax / SVG_VIEW_W);   // 186/200
const Y_MIN = h * (LETTER_BOUNDS.yMin / SVG_VIEW_H);   // 94/150
const Y_MAX = h * (LETTER_BOUNDS.yMax / SVG_VIEW_H);   // 140/150
```

Перед отрисовкой каждой искры:
```ts
if (s.x < X_MIN || s.x > X_MAX || s.y < Y_MIN || s.y > Y_MAX) {
  alive.push(s);
  continue;  // skip draw — mask всё равно скроет
}
```

**Экономия**: ~50–60% draw calls. Физика и life продолжают работать — искра, вылетевшая за зону, может вернуться в следующем кадре. Зазоры между буквами (внутри bounding box) не отсекаются — для точного cull нужны 7 per-letter rects, это уже over-engineering.

### Path2D clip

Канвас с искрами клипуется по контурам букв **в коде**, без CSS-маски и без `<mask>` в SVG. В `useSparkCanvas.ts` при инициализации:

```ts
// LETTER_IDS — ['C','O','V','S','K','I','Y'] из constants.ts
const clipPath = new Path2D();
for (const id of LETTER_IDS) {
  const el = document.getElementById(pathIdFor(id)); // 'morphPath-C', ...
  if (el instanceof SVGPathElement) {
    const d = el.getAttribute('d');
    if (d) clipPath.addPath(new Path2D(d));
  }
}
clipPathRef.current = clipPath;
```

Перед каждым `system.step()` в rAF-цикле — техника `setTransform → clip → setTransform(dpr) → draw`:
```ts
const dpr = dprRef.current;
ctx2d.save();
ctx2d.setTransform(
  dpr * (w / SVG_VIEW_W), 0, 0, dpr * (h / SVG_VIEW_H), 0, 0,
);
if (clipPathRef.current) ctx2d.clip(clipPathRef.current);
ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
system.step(dt, ctx2d, w, h);
ctx2d.restore();
```

**Почему один `Path2D`, а не 7 `clip`-вызовов**: повторный `ctx.clip()` даёт **пересечение** областей, а не объединение. Чтобы получить union семи контуров букв, добавляем их subpath'ы в один `Path2D` через `addPath()`.

**Почему `setTransform(scaled)` для clip, а не `scale`**: `Path2D` хранит координаты в viewBox-юнитах (0..200 × 0..150). Под CTM `dpr × (w/200, h/150)` viewBox-юниты мапятся на device-координаты всего канваса (0..dpr*w × 0..dpr*h), и клип устанавливается в device-space как контуры букв.

**Почему `setTransform(dpr)` перед `step()`**: `step()` рисует в CSS-пикселях (`clearRect(0,0,w,h)`, `arc(s.x, s.y, s.size)`), ожидая CTM = `dpr`. Если бы остался масштабированный CTM, clearRect чистил бы крошечную область, а arc-ы улетали бы за края. После `setTransform(dpr)` клип-переживает-CTM (clip region хранится в user-agent coordinate system, не зависит от CTM), а `restore()` в конце корректно сбрасывает и CTM, и клип.

**`dprRef`**: хранит `window.devicePixelRatio`, проставляется в `sync()` (useEffect для canvas) рядом с `sizeRef`. Нужен потому что CTM может быть сброшен кем угодно между кадрами, и нам нужно восстановить именно `dpr` (а не identity).

**Канвас имеет `aspect-ratio: 200/150`**: поэтому `w/200 === h/150` (всегда), и `scaleX === scaleY` — выравнивание 1:1 с viewBox SVG.

**Единый источник истины**: `d` читаются прямо из DOM у тех же `#morphPath-*`, что используются для `morphSVG` анимации букв. Никакого дублирования путей.

**`clearRect` под клипом**: очищает только область внутри букв, но искры и так рисуются только там (см. bounding box cull выше), так что поведение идентично «чистому листу» в полном канвасе.

**Выравнивание 1:1**: канвас позиционирован точно поверх SVG (`bottom: 0; left/right: 0; margin: 0 auto; width: 100%; max-width: min(90vw, 420px); aspect-ratio: 200/150`). Совпадение `aspect-ratio` и `max-width` с SVG даёт одинаковый физический размер → `scaleX === scaleY` и буквы в клипе совпадают с буквами в SVG попиксельно.

**Преимущество перед CSS mask-image**: работает на любом движке canvas, не зависит от `-webkit-mask-image` quirks, и комбинируется с `globalCompositeOperation = 'lighter'` (аддитивный CORE) корректно.

### Стартовые позиции и timing

- **Эмиссия** всегда у правой границы канваса (`ox = w - sparks.emit.xOffset`), случайный Y в нижней половине (`oyMin = sparks.emit.yMinFrac * h`, `oyMax = sparks.emit.yMaxFrac * h`) — sparks стартуют примерно в полосе букв
- **Burst 1** — master-время `4.2s`, длительность потока `burstDuration` (0.18–0.35s по профилю)
- **Burst 2** — master-время `4.7s`, `boostAll(1.7)` к уже летящим
- **Sub-spawns** (только desktop) — `subSpawns=3` через `subSpawnInterval=0.15s`, ступенчатый «продув» в течение 0.36s

### Тюнинг (карта «что крутить»)

Полная карта — в docblock `sparks` в `splashChoreography.ts`. Краткая сводка:

| Хочу изменить | Поле |
|---|---|
| Сделать искры крупнее | `profile.sizeMin`, `sizeMax` |
| Дольше живут | `profile.lifetime`, `lifetimeJitter` |
| Быстрее летят | `profile.initialSpeedMax`, ↓ `profile.friction` |
| Медленнее тормозят | ↑ `profile.windX`, ↓ `profile.friction` |
| Дольше яркая фаза burst1 | `coreAlphaMultipliers.burst1` (выше = дольше) |
| Больше искр | `profile.count` |
| Длиннее хвост | `profile.tailLength` |
| Сильнее порыв на burst2 | `sparks.burstBoostFactor` в `splashChoreography.ts` |
| Больше порывов в пучке | `profile.subSpawns`, `subSpawnInterval` |
| Круче наклон | `profile.slopeMax` |
| Шире разброс в начале | `coneHalfAngle` |
| Сильнее рябь | `profile.periodYJitter`, `ampYJitter` |
| Цвет хвоста | `tailColor` |
| Цвет halo | `smokeHalo.color`, `.alpha`, `.radius` |
| Направление полёта | `BASE_ANGLE` в `sparks.ts` |

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
