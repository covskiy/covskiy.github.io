# IntroAnimation

Анимированный overlay (Intro Animation), последовательно анимирующий три ключевых элемента: **Логотип**, **Логотекст** и **Слоган**. Анимация управляется единым `gsap.core.Timeline`, создаваемым в `IntroAnimation`. Дочерние компоненты регистрируют свои локальные таймлайны через колбэк `onRegisterTimeline`, переданный в props.

IntroAnimation рендерится как оверлей (`position: fixed; inset: 0; z-index: 9999`) поверх контента HomePage. HomePage всегда находится в DOM под оверлеем — после завершения анимации IntroAnimation анмаунтится, открывая уже загруженный контент.

## Контейнер контента

Оверлей `.introOverlay` занимает всю ширину (`inset: 0`) и несёт только фон-градиент. Внутри него лежит `.introContent` — flex-контейнер с `padding`, который центрирует дочерние элементы (`LogoText`, `Tagline`, `SkipControls`) и ограничивает их ширину:

- `width: 100%`
- `max-width: var(--layout-container-max-width)` — токен `layout.containerMaxWidth` (фиксированные `1200px`, остаётся в px-линейке, см. `docs/design-tokens.md`)
- `margin: 0 auto` — горизонтальное центрирование на широких экранах

Таким образом фон-градиент тянется на весь вьюпорт, а сами анимируемые элементы интро не растягиваются за пределы максимальной ширины контейнера.

## Управление состоянием

| Флаг             | Хранилище        | Механизм                                          |
| ---------------- | ---------------- | ------------------------------------------------- |
| `showIntro`      | `HomePage`       | Инициализируется из `introStorage.getNeverShow()` |
| `showSkipButton` | `IntroAnimation` | Таймер показа кнопки пропуска                     |
| `neverShowAgain` | `IntroAnimation` | Чекбокс "Больше не показывать"                    |

**Примечание**: Логика skip инлайнена в `IntroAnimation.tsx`. Решение о показе intro принимается в `HomePage` на основе `introStorage.getNeverShow()`.

## Архитектура

```
components/IntroAnimation/
├── index.ts                    # Barrel: IntroAnimation, introStorage
├── IntroAnimation.tsx          # Создаёт мастер-таймлайн + skip-логика (инлайн)
├── IntroAnimation.module.css   # Стили контейнера (fixed overlay)
├── choreography.ts       # Константы времени и длительностей анимаций
└── utils/
    ├── index.ts
    └── introStorage.ts        # Работа с localStorage (ключ: intro_never_show)
```

```
components/
├── index.ts                    # Barrel: Logo, LogoText, Tagline, SkipControls, IntroAnimation, introStorage
├── Logo/Logo.tsx               # Анимация логотипа (scale + opacity)
├── LogoText/LogoText.tsx       # Анимация текста (y + opacity)
├── Tagline/Tagline.tsx         # Анимация слогана (blur + opacity)
└── SkipControls/SkipControls.tsx # Кнопка пропуска + чекбокс
```

```
types/
└── intro.types.ts             # AnimationComponentProps, RegisterTimelineFn, SkipControlsProps, IntroAnimationProps, IntroStorageData
```

## Последовательность анимации

| Время (сек) | Элемент  | Реальная анимация                                                                                                                                                          |
| ----------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `0.0`       | Logo     | `drawSVG: '0% 0%' → '0% 100%'` (glow + main path), `ease: power2.inOut` + `power2.out` (fade)                                                                              |
| `0.0`       | LogoText | `morphSVG` cursor (nail → cursor), `x/y/rotation` fly (`power3.out`), затем `ovskiyTl` playing (`power1.inOut`)                                                            |
| `1.5`       | Tagline  | Клавиатура влетает сверху (синхронно с морфом гвоздя → курсор в LogoText), затем подсветка клавиш синхронно с началом морфинга букв, в конце — text reveal с custom bounce |

**Примечание**: Таймлайны дочерних компонентов вкладываются в мастер-таймлайн через `position` параметр (см. `INTRO_CHOREOGRAPHY` в `choreography.ts`).

### Синхронизация Tagline ↔ LogoText

Tagline зарегистрирован на master-таймлайне в позиции `0` (`master.labels.TAGLINE`) и привязан к двум событиям в LogoText:

- **Влёт клавиатуры** (master `1.5`) — синхронно с началом морфа гвоздя в курсор (`Cursor.phaseCaret.start`).
- **Подсветка клавиш** (master `1.9`–`4.0`) — синхронно с началом морфа соответствующей буквы.

| Master-время | Tagline (событие) | LogoText (начало морфинга)                       |
| ------------ | ----------------- | ------------------------------------------------ |
| 1.5          | Влёт клавиатуры   | `Cursor.phaseCaret.start` (морф гвоздь → курсор) |
| 1.9          | Подсветка `C`     | C: `phaseLetter.start`                           |
| 2.59         | Подсветка `O`     | O: `phaseDash.start + phaseLetter.delay`         |
| 2.85         | Подсветка `V`     | V: `phaseDash.start + phaseLetter.delay`         |
| 3.07         | Подсветка `S`     | S: `phaseDash.start + phaseLetter.delay`         |
| 3.3          | Подсветка `K`     | K: `phaseDash.start + phaseLetter.delay`         |
| 3.45         | Подсветка `I`     | I: `phaseDash.start + phaseLetter.delay`         |
| 3.6          | Подсветка `Y`     | Y: `phaseDash.start + phaseLetter.delay`         |
| 4.2          | Подсветка `ENTER` | `logoText.sparks.burst1` (первая эмиссия частиц) |

Все позиции вычисляются в `Tagline.tsx` программно из `INTRO_CHOREOGRAPHY.logoText` (`Cursor.phaseCaret.start`, `C.phaseLetter.start` или `X.phaseDash.start + X.phaseLetter.delay`). `ENTER` привязан к `logoText.sparks.burst1`.

## Хореография (INTRO_CHOREOGRAPHY)

Константа `INTRO_CHOREOGRAPHY` (файл `choreography.ts`) управляет временными позициями и длительностями анимаций.

### master.labels

- `LOGO`: `0` (Logo и LogoText вкладываются в начало)
- `LOGO_TEXT`: `0`
- `TAGLINE`: `0` (Tagline вкладывается в начало)

### master.holdDuration

- `1.5s` — пауза после завершения всех дочерних анимаций перед вызовом `onComplete`

### logo.durations

- `GLOW_DRAW`: `1.5s`
- `MAIN_PATH_DRAW`: `1.2s`
- `GLOW_FADE`: `0.5s`

### logoText.durations

- `C_LETTER_FROM`: `0.5s`
- `C_LETTER_MORPH`: `0.5s`
- `NAIL_FLY`: `1s`
- `NAIL_MORPH`: `0.5s`
- `LETTER_MORPH`: `0.5s`
- `CURSOR_MOVE`: `1.6s`

### tagline.durations

- `KEYBOARD_IN`: `0.5s`
- `KEY_HIGHLIGHT`: `0.3s`
- `KEYBOARD_OUT`: `0.4s`
- `TEXT_REVEAL`: `1s`
- `TEXT_STAGGER`: `0.15s`

### Подсветка клавиш

Позиции подсветки клавиш вычисляются программно в `Tagline.tsx` из `INTRO_CHOREOGRAPHY.logoText` (см. таблицу синхронизации выше). `ENTER` привязан к `logoText.sparks.burst1` (первая эмиссия частиц). Влёт клавиатуры (`KEYBOARD_IN_LOCAL = 1.5`) вычисляется из `Cursor.phaseCaret.start`.

- `C` — `logoText.C.phaseLetter.start` → `1.9`
- `O` — `logoText.O.phaseDash.start + logoText.O.phaseLetter.delay` → `2.59`
- `V` — `…V…` → `2.85`
- `S` — `…S…` → `3.07`
- `K` — `…K…` → `3.3`
- `I` — `…I…` → `3.45`
- `Y` — `…Y…` → `3.6`
- `ENTER` — `logoText.sparks.burst1` → `4.2`

**Примечание**: Метки и длительности используются в дочерних компонентах (`Logo.tsx`, `LogoText.tsx`, `Tagline.tsx`) для создания локальных таймлайнов.

## Использование в HomePage

```tsx
import { IntroAnimation, introStorage } from './components/IntroAnimation';
import { useEffect, useState } from 'react';

function HomePage() {
  const [showIntro, setShowIntro] = useState(
    () => !introStorage.getNeverShow(),
  );

  useEffect(() => {
    document.body.style.overflow = showIntro ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [showIntro]);

  const handleIntroComplete = () => setShowIntro(false);

  return (
    <>
      {/* Контент HomePage всегда в DOM */}
      <HomePageContent />
      {/* IntroAnimation — оверлей поверх контента HomePage */}
      {showIntro && (
        <IntroAnimation onComplete={handleIntroComplete} skipDelay={800} />
      )}
    </>
  );
}
```

**Примечание**: Контент HomePage рендерится всегда, IntroAnimation — как оверлей поверх него. Контент HomePage находится в DOM с первого рендера — поисковики и соцсети видят контент. После завершения анимации IntroAnimation анмаунтится (просто `setShowIntro(false)`), без редиректа — URL всегда `/`.

## Отладка (dev-mode)

В `main.tsx` добавляется глобальный объект `window.introDebug`:

| Метод         | Действие                              |
| ------------- | ------------------------------------- |
| `reset()`     | Очищает флаг, перезагружает страницу  |
| `forceShow()` | Сбрасывает флаг, показывает Intro     |
| `forceHide()` | Устанавливает флаг, скрывает Intro    |
| `status()`    | Логирует текущее значение `neverShow` |

## Ключевые решения

- **Мастер-таймлайн** в `IntroAnimation` через `useGSAP` создаётся как `paused: true`, и после регистрации дочерних таймлайнов вызывается `master.play()`
- **Дочерние компоненты** получают `onRegisterTimeline` колбэк через пропсы — он принимает `tl: gsap.core.Timeline`(локальный таймлайн компоненты) и необязательный `position`, задающий время на мастер-таймлайне с которого локальный таймлайн начнет проигрываться
- **`handleRegisterTimeline`** создаётся через `useCallback` с `dependencies: []`, инициализируется один раз при монтировании `IntroAnimation`
- **`childTimelinesRegistrationRef`** — `ref`-контейнер (Set), который содержит в себе коллбеки с регистрацией локальных таймлайнов
- **Отсутствие гонки регистраций** гарантируется самим механизмом React, создание компонент происходит от потомков к родителю. В момент когда будет выполняться асинхронный useGSAP родителя, в childTimelinesRegistrationRef уже будут лежать коллбеки регистрации потомков
- **Исходные стили** скрыты через `visibility: hidden`, GSAP переключает на `visible`
- **Пропуск**: `handleSkip` вызывает `masterTimelineRef.current?.progress(1).kill()`, затем `onComplete()`
- **Кнопка пропуска** появляется через `skipDelay` мс (передаётся из `HomePage`), fade-in анимация
- **`useGSAP`** из `@gsap/react` гарантирует безопасную работу в `StrictMode` и автоочистку
- **Overlay-архитектура**: `overflow: hidden` на `body` блокирует скролл во время intro, контент HomePage всегда в DOM
