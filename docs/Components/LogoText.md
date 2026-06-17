# LogoText — Архитектура компонента

## Обзор

Анимированный SVG-логотип для сплэш-экрана. Две начальные фигуры (подкова + гвоздь) морфируют в слово **COVSKIY** с помощью GSAP `MorphSVGPlugin`. Курсороподобный элемент последовательно открывает буквы.

## Файлы

| Файл                  | Назначение                                                              |
| --------------------- | ----------------------------------------------------------------------- |
| `LogoText.tsx`        | Логика компонента — GSAP timeline + импорт SVG                          |
| `LogoText.svg`        | Исходный SVG с двумя слоями (исходные фигуры + пути букв)               |
| `LogoText.module.css` | Контейнер + глобальные CSS-переопределения для начального состояния SVG |

## Структура SVG

Два слоя внутри `viewBox="0 0 200 150"`:

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

Моменты начала морфинга букв в LogoText синхронизированы с подсветкой клавиш в компоненте `Tagline`. Оба компонента опираются на единый источник истины — `src/pages/SplashPage/splashChoreography.ts`:

| Буква | Master-время начала морфинга | Источник в `SPLASH_CHOREOGRAPHY`                          | Соответствующая клавиша в Tagline |
| ----- | ---------------------------- | --------------------------------------------------------- | --------------------------------- |
| C     | 1.9                          | `logoText.C.phaseLetter.start`                            | `.key_c`                          |
| O     | 2.59                         | `logoText.O.phaseDash.start + logoText.O.phaseLetter.delay` | `.key_o`                          |
| V     | 2.85                         | `logoText.V.phaseDash.start + logoText.V.phaseLetter.delay` | `.key_v`                          |
| S     | 3.07                         | `logoText.S.phaseDash.start + logoText.S.phaseLetter.delay` | `.key_s`                          |
| K     | 3.3                          | `logoText.K.phaseDash.start + logoText.K.phaseLetter.delay` | `.key_k`                          |
| I     | 3.45                         | `logoText.I.phaseDash.start + logoText.I.phaseLetter.delay` | `.key_i`                          |
| Y     | 3.6                          | `logoText.Y.phaseDash.start + logoText.Y.phaseLetter.delay` | `.key_y`                          |

Tagline стартует на master-таймлайне в позиции `1.0` (`SPLASH_CHOREOGRAPHY.master.labels.TAGLINE`); позиции подсветки клавиш вычисляются в `Tagline.tsx` как `morphStart - 1.0`. Подробности — в `docs/Components/Tagline.md`.

## Mobile-first стили

Базовые стили рассчитаны на мобильные устройства (phone, ≤480px):

- `.container` — `padding: 0 1rem` для отступов по бокам, `flex-shrink: 0` (защита от сжатия в flex-контейнере SplashPage)
- `.svg` — `max-width: min(90vw, 360px)`, вписывается в мобильный viewport
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
