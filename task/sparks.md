# Задача: Анимация искр в финале LogoText (React 19 + GSAP 3 + Canvas 2D)

_Техническое задание на воссоздание анимации искр, появляющихся в финале морфинга логотипа COVSKIY. Описывает текущее состояние реализации в `src/components/LogoText/`._

---

## 1. Цель и скоуп

Визуальный эффект: после завершения сборки букв C-O-V-S-K-I-Y над логотипом вылетают два пучка искр (горизонтально влево, с лёгким случайным наклоном). Искры видны **только внутри контуров букв** (Path2D-клиппинг).

**Скоуп ТЗ:**

- Particle system (физика, 3-слойная отрисовка, cull).
- Эмиссионный твин на `localTimeline` (оркестрация burst'ов).
- Canvas-инфраструктура (DPR-sync, Path2D clip, gsap.ticker-цикл).
- Конфигурация в `splashChoreography.ts`.

**Не в скоупе:**

- SVG-морфинг букв (отдельный билдер `timelines.ts`).
- Master timeline, Splash-логика, `useGSAP`-обёртка — отдельные ТЗ.
- Layout / CSS-модули, кроме `.canvas { aspect-ratio: 200/150 }`.
- Тесты, GSDevTools, debug-хелперы.

---

## 2. Контекст и стек

| Категория        | Технология                 |
| ---------------- | -------------------------- |
| Фреймворк        | React 19                   |
| Язык             | TypeScript 5.3+            |
| Анимация         | GSAP 3.14+ + `@gsap/react` |
| Рендеринг частиц | Canvas 2D API              |
| Сборка           | Vite 5+                    |

**Связь с другими частями:** эмиссия запускается в `useGSAP`-колбэке компонента `LogoText`, привязана к `localTimeline`, которая в свою очередь вкладывается в master-таймлайн `SplashPage`. Эффект проигрывается на master-времени **4.2s** (burst1) и **4.7s** (burst2).

---

## 3. Архитектура (3 уровня)

```
localTimeline (gsap.core.Timeline)
  ├─ emission tween (child, на позиции burstN + i*subSpawnInterval)
  │   └─ onUpdate → emitOne(ox, oy, burst)
  └─ boostAll() call (на burst2 — разовый «порыв ветра»)

useSparkCanvas hook
  ├─ canvas DPR-sync + ResizeObserver
  ├─ Path2D clip из DOM (#morphPath-C/O/V/S/K/I/Y)
  └─ gsap.ticker.add(loop) — рендер-цикл, auto-stop когда !isAlive()

particle system (sparks.ts)
  ├─ sparks[] — массив активных частиц
  ├─ step(dt, ctx, w, h) — физика + 3-слойная отрисовка под клипом
  └─ emit / isAlive / clear / boostAll / destroy
```

**Ключевое отличие от свободно плавающего `gsap.to`:** твин эмиссии — child `localTimeline`, поэтому подчиняется `pause` / `timeScale` / `reverse` / scrub мастер-таймлайна. Рендер-цикл живёт на `gsap.ticker` независимо — существующие искры догорают даже при паузе мастера.

---

## 4. Конфигурация (`splashChoreography.ts → logoText.sparks`)

### 4.1. Общие параметры (все профили)

| Поле                          | Тип                 | Смысл                                                                                                                         |
| ----------------------------- | ------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `burst1`                      | `number` (s)        | Позиция первого пучка на `localTimeline` (по умолчанию `4.2`).                                                                |
| `burst2`                      | `number` (s)        | Позиция второго пучка (по умолчанию `4.7`).                                                                                   |
| `burstBoostFactor`            | `number`            | Множитель `vx` для уже летящих искр при `boostAll()` (по умолчанию `1.7`).                                                    |
| `emit.yMinFrac`               | `number` (0..1)     | Нижняя граница Y-полосы эмиссии (доля высоты канваса).                                                                        |
| `emit.yMaxFrac`               | `number` (0..1)     | Верхняя граница Y-полосы эмиссии.                                                                                             |
| `emit.xOffset`                | `number` (px)       | Отступ от правого края канваса (искры сразу летят влево).                                                                     |
| `coneHalfAngle`               | `number` (rad)      | Полуугол разброса стартовой `vx` от `BASE_ANGLE = π`.                                                                         |
| `colors`                      | `readonly string[]` | Палитра core. Индекс = `(1 - life) × length`: `[0]` — свежее (белое), `[N-1]` — тухлое (красное). 4 цвета = 4 фазы остывания. |
| `smokeHalo.radius`            | `number`            | Радиус halo = `size × radius` (обычно 2.2).                                                                                   |
| `smokeHalo.alpha`             | `number` (0..1)     | Прозрачность halo.                                                                                                            |
| `smokeHalo.color`             | `string`            | Тёмный «дымный» цвет halo.                                                                                                    |
| `tailColor`                   | `string`            | Фиксированный цвет кометного хвоста (source-over, не аддитивный).                                                             |
| `coreAlphaMultipliers.burst1` | `number`            | Множитель яркости для искр из burst1 (длиннее peak-фаза).                                                                     |
| `coreAlphaMultipliers.burst2` | `number`            | Множитель яркости для burst2 (стандартно).                                                                                    |

**Формула яркости core:** `coreAlpha = min(1, life × multiplier)`. Фаза полной яркости (`alpha = 1`) = первые `(1 - 1/multiplier) × 100%` жизни. Типичные значения: `burst1 ≈ 2.5` → 60% peak-фазы, `burst2 ≈ 1.4` → 29%.

### 4.2. Per-profile тип `SparkProfile`

```ts
type SparkProfile = {
  count: number; // искр в одном sub-spawn
  sizeMin: number; // минимальный радиус ядра (px)
  sizeMax: number; // максимальный радиус ядра (px)
  lifetime: number; // базовая длительность жизни (s)
  lifetimeJitter: number; // ±N% (0 = одинаковые, 1 = ±100%)
  friction: number; // затухание vx: vx *= (1 - friction*dt), 1/s
  initialSpeedMin: number; // стартовый |vx| (px/s), нижняя граница
  initialSpeedMax: number; // стартовый |vx| (px/s), верхняя граница
  windX: number; // постоянное горизонтальное ускорение (px/s², <0 = влево)
  ampY: number; // амплитуда синуса Y (px)
  ampYJitter: number; // ±N% разброс амплитуды per-spark
  periodY: number; // период синуса Y (s)
  periodYJitter: number; // ±N% разброс периода per-spark
  slopeMax: number; // макс |наклон| траектории (0.2 ≈ ±11°)
  tailLength: number; // кол-во точек в кометном хвосте
  subSpawns: number; // кол-во порывов ветра внутри пучка
  subSpawnInterval: number; // секунд между sub-spawn'ами
  burstDuration: number; // длительность одного непрерывного потока sub-spawn (s)
};
```

---

## 5. Параметры профилей (mobile / tablet / desktop)

Профили выбираются по `window.innerWidth` в `useSparkCanvas.ts:15-20`:

- `width < 481` → `mobile`
- `width < 1025` → `tablet`
- `иначе` → `desktop`

Брейкпоинты совпадают с design-tokens (`481`, `1025`). Laptop объединён с tablet.

### 5.1. Mobile (`< 481px`)

| Параметр               | Диапазон / значение | Тренд (vs desktop)         |
| ---------------------- | ------------------- | -------------------------- |
| `count`                | `~30`               | базовый                    |
| `sizeMin..sizeMax`     | `~1.6..3.0` px      | **крупнее**                |
| `lifetime`             | `~1.8` s (±50%)     | короче                     |
| `friction`             | `~0.5` 1/s          | ниже (медленнее тормозят)  |
| `initialSpeedMin..Max` | `~70..150` px/s     | **медленнее**              |
| `windX`                | `~-30` px/s²        | слабее ветер               |
| `ampY`                 | `~9` px             | меньше рябь                |
| `periodY`              | `~0.55` s           | реже колебания             |
| `slopeMax`             | `~0.18`             | положе траектории          |
| `subSpawns`            | `1`                 | **один непрерывный поток** |
| `subSpawnInterval`     | `0`                 | n/a                        |
| `burstDuration`        | `~0.35` s           | длиннее окно эмиссии       |
| `tailLength`           | `10`                | базовый                    |

### 5.2. Tablet (`481..1024px`)

| Параметр               | Диапазон / значение | Тренд (vs desktop) |
| ---------------------- | ------------------- | ------------------ |
| `count`                | `~30`               | базовый            |
| `sizeMin..sizeMax`     | `~1.2..2.2` px      | средний            |
| `lifetime`             | `~2.2` s            | средний            |
| `friction`             | `~0.55` 1/s         | средний            |
| `initialSpeedMin..Max` | `~90..200` px/s     | средний            |
| `windX`                | `~-50` px/s²        | средний            |
| `ampY`                 | `~11` px            | средний            |
| `periodY`              | `~0.5` s            | средний            |
| `slopeMax`             | `~0.2`              | средний            |
| `subSpawns`            | `1`                 | один поток         |
| `subSpawnInterval`     | `0`                 | n/a                |
| `burstDuration`        | `~0.4` s            | длиннее            |
| `tailLength`           | `10`                | базовый            |

### 5.3. Desktop (`≥ 1025px`)

| Параметр               | Диапазон / значение | Тренд (vs mobile)        |
| ---------------------- | ------------------- | ------------------------ |
| `count`                | `~33`               | базовый                  |
| `sizeMin..sizeMax`     | `~0.9..1.8` px      | **мельче**               |
| `lifetime`             | `~2.6` s (±50%)     | **дольше живут**         |
| `friction`             | `~0.6` 1/s          | выше (быстрее тормозят)  |
| `initialSpeedMin..Max` | `~120..260` px/s    | **быстрее**              |
| `windX`                | `~-75` px/s²        | **сильнее ветер**        |
| `ampY`                 | `~14` px            | **больше рябь**          |
| `periodY`              | `~0.45` s           | чаще колебания           |
| `slopeMax`             | `~0.22`             | круче траектории         |
| `subSpawns`            | `3`                 | **3 ступенчатых порыва** |
| `subSpawnInterval`     | `~0.15` s           | шаг между порывами       |
| `burstDuration`        | `~0.18` s           | **короче** окно эмиссии  |
| `tailLength`           | `10`                | базовый                  |

**Сводка тренда** (от mobile к desktop): размер уменьшается, скорость растёт, ветер усиливается, рябь усиливается, время жизни растёт, sub-spawn'ов становится больше, окно одного потока короче. Терминальная скорость `vx_terminal = windX / friction` остаётся примерно одинаковой по модулю (~ -60..-125 px/s).

---

## 6. Физика искры (формулы)

Все формулы — из `sparks.ts`. `t` в формулах — глобальное wall-clock время (`performance.now() / 1000`), `dt` — лаг-смузнутая дельта от gsap.ticker (в секундах, clamp `0.1`).

### 6.1. Эмиссия (один раз при создании искры)

```ts
const BASE_ANGLE = Math.PI; // влево
const angleOffset = (Math.random() - 0.5) * 2 * shared.coneHalfAngle;
const angle = BASE_ANGLE + angleOffset;
const speed =
  profile.initialSpeedMin +
  Math.random() * (profile.initialSpeedMax - profile.initialSpeedMin);
const ampJitter = 1 + (Math.random() - 0.5) * 2 * profile.ampYJitter;
const periodJitter = 1 + (Math.random() - 0.5) * 2 * profile.periodYJitter;
const slope = (Math.random() - 0.5) * 2 * profile.slopeMax;
const lifetime =
  profile.lifetime * (1 + (Math.random() - 0.5) * 2 * profile.lifetimeJitter);
const size =
  profile.sizeMin + Math.random() * (profile.sizeMax - profile.sizeMin);
const vx = Math.cos(angle) * speed;
```

Запоминаются: `x0, y0` (опорная точка для slope), `phase` (случайная фаза синуса `0..2π`), `burst: 1 | 2` (per-burst множитель яркости).

### 6.2. Физика (на каждом кадре `step`)

```ts
// Горизонтальный ветер + трение
s.vx += profile.windX * dt;
s.vx *= 1 - profile.friction * dt;

// Интегрирование X
s.x += s.vx * dt;

// Y: линейный наклон + синусоида
const omega = (2 * Math.PI) / s.periodY;
s.y = s.y0 + (s.x - s.x0) * s.slope + s.ampY * Math.sin(omega * t + s.phase);

// Линейный спад жизни
s.life -= dt / s.lifetime;
```

### 6.3. Цвет и яркость core (per-spark)

```ts
const hueIdx = Math.min(lastColorIdx, Math.floor((1 - s.life) * COLORS.length));
const coreMult =
  s.burst === 2
    ? shared.coreAlphaMultipliers.burst2
    : shared.coreAlphaMultipliers.burst1;
const coreAlpha = Math.min(1, s.life * coreMult);
```

---

## 7. Алгоритм (пошагово)

1. **Mount `LogoText`** — `useSparkCanvas` создаёт `<canvas>`, делает DPR-sync через `ResizeObserver`, строит `Path2D` из `#morphPath-*` в DOM (лог `clip path built` при успехе, `clip path incomplete` при частичной неудаче).
2. **`useGSAP` строит `localTimeline`** — три суб-таймлайна (`CLetter`, `Nail`, `letters`) на позиции 0, плюс spark-блок.
3. **Spark-блок на `localTimeline`:**
   - На позиции `burst1 + i * subSpawnInterval` (`i = 0..subSpawns-1`) — emission tween на `burstDuration` секунд.
   - На позиции `burst2 + i * subSpawnInterval` — emission tween + `localTimeline.call(boostAll, [], pos)`.
4. **Tween эмиссии** создаёт массив `scheduled[]` из `total` случайных времён в `[0, duration)`, сортирует его. На каждом кадре вычисляет `currentTime = state.progress * duration` и эмитит все искры, чьи `scheduled` уже прошли. Случайный Y в `[oyMin, oyMax)`, `ox = w - emit.xOffset` (правая граница).
5. **`emitOne(ox, oy, burst)`** пушит искру в `sparks[]` particle-системы. Если `gsap.ticker` ещё не слушает наш loop — `gsap.ticker.add(loop)`.
6. **На каждом тике `gsap.ticker`:** `dt = min(0.1, time - lastTime)`, `system.step(dt, ctx, w, h)` под Path2D-клипом. На каждом `step`:
   - `ctx.clearRect(0, 0, w, h)`.
   - Для каждой живой искры — пуш позиции в `history` (кольцевой буфер длиной `tailLength`).
   - Обновить физику (формулы §6.2).
   - Если `life <= 0` — пропустить draw.
   - Если позиция вне `LETTER_BOUNDS` (cull) — пропустить draw, оставить в alive (физика продолжается).
   - Нарисовать 3 слоя (см. §8).
7. **Когда `!system.isAlive()`** — `gsap.ticker.remove(loop)`, `lastTime = null`. Цикл самоостановился до следующего `emitOne`.

---

## 8. Отрисовка: 3 слоя

| Слой              | `globalCompositeOperation` | Цвет                       | Радиус                                 | `globalAlpha`                         | Источник              |
| ----------------- | -------------------------- | -------------------------- | -------------------------------------- | ------------------------------------- | --------------------- |
| **Tail** (комета) | `source-over`              | `shared.tailColor`         | `size × factor`, `factor = i / length` | `factor × life`                       | кольцевой `history[]` |
| **Halo** (дым)    | `source-over`              | `shared.smokeHalo.color`   | `size × smokeHalo.radius`              | `smokeHalo.alpha × life`              | одна окружность       |
| **Core** (ядро)   | `lighter`                  | `colors[life-based index]` | `size`                                 | `min(1, life × coreMult)` (per-burst) | одна окружность       |

Сброс состояния канваса в конце кадра: `globalAlpha = 1`, `globalCompositeOperation = 'source-over'`.

Cull-чек перед `arc(...)`:

```ts
if (s.x < X_MIN || s.x > X_MAX || s.y < Y_MIN || s.y > Y_MAX) {
  alive.push(s);
  continue;
}
```

---

## 9. Path2D clip

**Из каких DOM элементов:** `#morphPath-C`, `#morphPath-O`, `#morphPath-V`, `#morphPath-S`, `#morphPath-K`, `#morphPath-I`, `#morphPath-Y` (идентификаторы через `pathIdFor()` из `constants.ts`).

**Почему один `Path2D` через `addPath`, а не 7 `ctx.clip`-вызовов:** повторный `ctx.clip()` даёт **пересечение** областей, а нам нужен **union** контуров букв.

**CTM-трюк (в `useSparkCanvas.ts`):**

```ts
ctx.save();
ctx.setTransform(dpr * (w / SVG_VIEW_W), 0, 0, dpr * (h / SVG_VIEW_H), 0, 0);
if (clipPathRef.current) ctx.clip(clipPathRef.current);
ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // step() рисует в CSS-пикселях
system.step(dt, ctx2d, w, h);
ctx.restore();
```

- Под масштабированным CTM `Path2D` (в viewBox-юнитах) маппится на device-координаты всего канваса, клип = контуры букв.
- Сброс CTM к `dpr` перед `step()` — `step()` ожидает CSS-пиксели (`clearRect(0,0,w,h)`, `arc(s.x, s.y, s.size)`).
- Клип переживает `setTransform` (clip region хранится в user-agent coordinate system, не зависит от CTM). `restore()` сбрасывает и CTM, и клип.
- Канвас имеет `aspect-ratio: SVG_VIEW_W / SVG_VIEW_H` → `scaleX === scaleY` (1:1 с viewBox SVG).

Если `clipFound < LETTER_IDS.length` (не все пути найдены в DOM) — `clipPathRef.current = null`, искры рисуются без клипа (warning в лог).

---

## 10. Bounding box cull (оптимизация)

- `LETTER_BOUNDS = { xMin: 18, xMax: 186, yMin: 94, yMax: 140 }` (viewBox-юниты, из `constants.ts`).
- Пересчёт в CSS-пиксели (один раз на кадр в `step`):
  ```ts
  const X_MIN = w * (LETTER_BOUNDS.xMin / SVG_VIEW_W);
  const X_MAX = w * (LETTER_BOUNDS.xMax / SVG_VIEW_W);
  const Y_MIN = h * (LETTER_BOUNDS.yMin / SVG_VIEW_H);
  const Y_MAX = h * (LETTER_BOUNDS.yMax / SVG_VIEW_H);
  ```
- Перед `arc(...)` каждой искры — проверка `s.x`/`s.y` в зоне букв. Если вне — пропуск draw, физика/жизнь продолжаются (искра может залететь обратно).
- **Экономия:** ~50–60% draw calls. Зазоры между буквами (внутри bounding box) не отсекаются — для точного cull нужны 7 per-letter rects (over-engineering).

---

## 11. Структура файлов

```
src/components/LogoText/
├── LogoText.tsx                 # оркестрация: localTimeline + emission tween + boostAll
├── useSparkCanvas.ts            # canvas hook: DPR-sync, Path2D clip, gsap.ticker-цикл
├── sparks.ts                    # particle system: типы, createSparkSystem, step()
├── constants.ts                 # SVG_VIEW_W/H, LETTER_BOUNDS, LETTER_IDS, pathIdFor
├── LogoText.module.css          # .container, .svg, .canvas (aspect-ratio: 200/150)
├── LogoText.svg                 # исходный SVG, содержит #morphPath-* для клипа
├── timelines.ts                 # билдеры суб-таймлайнов букв (не трогаем в этом ТЗ)
└── index.ts                     # barrel-экспорт LogoText

src/pages/SplashPage/splashChoreography.ts
                                 # SPARKS конфиг: coneHalfAngle, colors, profiles (3 шт)
```

---

## 12. Граничные случаи

| Кейс                                       | Ожидаемое поведение                                                                                                     |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| StrictMode double-invoke эффектов          | `system.clear()` а не `destroy()` — флаг `destroyed` переживает cleanup, иначе re-mount не эмитит искры.                |
| Вкладка в фоне → возврат                   | GSAP `lagSmoothing(500, 33)` по умолчанию обрезает лаг; наш `Math.min(0.1, dt)` — финальная страховка от взрыва физики. |
| Canvas не готов (`getContext('2d')` null)  | `emitOne` no-op (warning в лог, sparks disabled).                                                                       |
| `clipPath` incomplete                      | `clipPathRef.current = null`, искры видны везде (warning в лог).                                                        |
| Master `pause()`                           | Эмиссия паузится (твин — child `localTimeline`). Летящие искры догорают (ticker-цикл живёт).                            |
| Master `reverse()`                         | `state.progress` идёт назад, `emitted` не уменьшается → новых искр не эмитится.                                         |
| Master `timeScale(0.5)`                    | Эмиссия замедляется пропорционально.                                                                                    |
| `gsap.ticker` уже работает (другие tweens) | Конфликтов нет: наш loop добавляется в listeners, оба работают параллельно.                                             |
| Component unmount                          | `useGSAP` → `gsap.context().revert()` убивает все tweens, `gsap.ticker.remove(loop)` чистит loop.                       |

---

## 13. Критерии приёмки

Чеклист для проверки реализации:

- [ ] Два пучка видны на master-времени 4.2s и 4.7s.
- [ ] Burst1: только эмиссия, без `boostAll`. Burst2: эмиссия + `boostAll(factor)`.
- [ ] На desktop: 3 ступенчатых sub-spawn'а в каждом пучке с интервалом `~0.15s` (видно как серия «порывов»).
- [ ] На mobile/tablet: 1 непрерывный поток.
- [ ] Искры видны **только внутри** контуров букв C-O-V-S-K-I-Y (Path2D-клиппинг работает).
- [ ] Траектория: горизонтальный полёт влево + лёгкий наклон + sin-колебание Y (не строго горизонтально, не парабола).
- [ ] Нет видимых «армейских» рядов искр — время эмиссии рандомизовано в пределах `burstDuration`.
- [ ] При `master.pause()` эмиссия останавливается, летящие искры догорают.
- [ ] При unmount нет утечек (gsap.context чистит tweens, ticker.remove чистит loop).

---

## 14. Что НЕ нужно реализовывать для соответствия ТЗ

- SVG-морфинг букв (отдельный билдер, `MorphSVGPlugin`).
- Master timeline и его `useGSAP`-обёртка.
- Sub-timelines букв (`createCLetterTimeline`, `createOVSKIYTimeline`, `createCursorTimeline`).
- Layout, CSS-модули (кроме `aspect-ratio: 200/150` на канвасе).
- Splash-логика, `useSplashSkip`, skip-кнопки.
- Mobile breakpoint-логика для других компонентов.
- Тесты, GSDevTools-интеграция, debug-хелперы (`window.splashDebug`).

---

# Компактное описание (TL;DR)

## Архитектура

3 уровня: **timeline** (эмиссия — child `localTimeline`) → **ticker** (рендер — `gsap.ticker.add/listener`) → **sparks.ts** (физика + 3-слойный draw). Эмиссия подчиняется мастеру (pause/reverse), рендер живёт своей жизнью.

## Ключевые числа (диапазоны, не точные)

- 2 пучка: **4.2s** и **4.7s** на локальном таймлайне.
- `count`: 30–33 искры на sub-spawn.
- `subSpawns`: 1 на mobile/tablet, **3** на desktop с интервалом ~0.15s.
- `burstDuration`: 0.18–0.4s (короче на desktop).
- `lifetime`: 1.8–2.6s (длиннее на desktop), ±50% джиттер.
- `tailLength`: 10 точек.
- `coreAlphaMultipliers`: burst1 ≈ 2.5 (60% peak), burst2 ≈ 1.4 (29% peak).
- `coneHalfAngle`: ~0.1π.

## Траектория (как ведёт себя искра)

Стартует у правой границы канваса, летит влево. Горизонтально: `vx += windX * dt; vx *= (1 - friction * dt)`. Вертикально: **наклоненная синусоида** `y = y0 + slope * (x - x0) + ampY * sin(2π/periodY * t + phase)`. Нет гравитации, нет шума. Терминал: `vx_terminal = windX / friction`. Per-spark jitter: `ampY`, `periodY`, `slope`, `lifetime`, `size`, `phase`.

## Рендеринг (3 слоя)

1. **Tail** — `source-over`, `tailColor`, кольцевой `history[]` длины `tailLength`, alpha `i/length × life`.
2. **Halo** — `source-over`, `smokeHalo.color`, радиус `size × smokeHalo.radius`, alpha `smokeHalo.alpha × life`.
3. **Core** — `lighter` (аддитивное), `colors[(1-life) × length]`, радиус `size`, alpha `min(1, life × coreMult)` per-burst.

`ctx.clearRect(0,0,w,h)` каждый кадр — никакого motion-blur.

## Клиппинг

`Path2D` из семи `#morphPath-*` в DOM, объединённых через `addPath` (один `clip`, а не 7 — иначе пересечение, а не union). Применяется через `setTransform(scaled) → clip → setTransform(dpr) → step → restore`. Дополнительно — `LETTER_BOUNDS` cull пропускает draw для искр вне зоны букв (экономия 50–60% draw calls).

## Тайминги (кто на чём)

- **Эмиссия** — child tween на `localTimeline` (`localTimeline.to(state, {progress: 1, duration, onUpdate})`).
- **Рендер-цикл** — `gsap.ticker.add(loop)`, self-stop на `!system.isAlive()`.
- **dt** — лаг-смузнутый `time - lastTime` (в секундах), clamp `0.1`.
- **Cleanup** — `useGSAP` (gsap.context) + `gsap.ticker.remove(loop)`.

## Мини-чеклист

- [ ] Burst1 = только эмиссия, Burst2 = эмиссия + `boostAll`.
- [ ] 3 sub-spawn'а на desktop, 1 на mobile/tablet.
- [ ] Искры видны **только внутри** контуров букв.
- [ ] Траектория: горизонтально + лёгкий наклон + sin-колебание Y.
- [ ] При паузе мастера летящие искры догорают, новые не эмитятся.
