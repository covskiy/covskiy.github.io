# SplashPage

Анимированная интро-страница (Splash Screen), последовательно анимирующая три ключевых элемента: **Логотип**, **Логотекст** и **Слоган**. Анимация управляется единым `gsap.core.Timeline`, создаваемым в `SplashPage`. Дочерние компоненты регистрируют свои локальные таймлайны через колбэк `onRegisterTimeline`, переданный в props.

## Управление состоянием

| Флаг             | Хранилище      | Механизм                                   |
| ---------------- | -------------- | ------------------------------------------ |
| `showSplash`     | `App.tsx`      | Инициализируется из `splashStorage.getNeverShow()` |
| `showSkipButton` | `SplashPage`   | Таймер показа кнопки пропуска              |
| `neverShowAgain` | `SplashPage`   | Чекбокс "Больше не показывать"             |

**Примечание**: Логика skip инлайнена в `SplashPage.tsx`. Решение о показе splash принимается в `App.tsx` на основе `splashStorage.getNeverShow()`.

## Архитектура

```
pages/SplashPage/
├── index.ts                    # Barrel: SplashPage, splashStorage
├── SplashPage.tsx              # Создаёт мастер-таймлайн + skip-логика (инлайн)
├── SplashPage.module.css       # Стили контейнера (fixed overlay)
├── splashChoreography.ts       # Константы времени и длительностей анимаций
└── utils/
    ├── index.ts
    └── splashStorage.ts        # Работа с localStorage (ключ: splash_never_show)
```

```
components/
├── index.ts                    # Barrel: Logo, LogoText, Tagline, SkipControls
├── Logo/Logo.tsx               # Анимация логотипа (scale + opacity)
├── LogoText/LogoText.tsx       # Анимация текста (y + opacity)
├── Tagline/Tagline.tsx         # Анимация слогана (blur + opacity)
└── SkipControls/SkipControls.tsx # Кнопка пропуска + чекбокс
```

```
types/
└── splash.types.ts             # AnimationComponentProps, RegisterTimelineFn, SkipControlsProps, SplashPageProps, SplashStorageData
```

## Последовательность анимации

| Время (сек) | Элемент  | Реальная анимация                                                                                               |
| ----------- | -------- | --------------------------------------------------------------------------------------------------------------- |
| `0.0`       | Logo     | `drawSVG: '0% 0%' → '0% 100%'` (glow + main path), `ease: power2.inOut` + `power2.out` (fade)                   |
| `0.0`       | LogoText | `morphSVG` cursor (nail → anchor), `x/y/rotation` fly (`power3.out`), затем `ovskiyTl` playing (`power1.inOut`) |
| `1.5`       | Tagline  | Клавиатура влетает сверху (синхронно с морфом гвоздя → курсор в LogoText), затем подсветка клавиш синхронно с началом морфинга букв, в конце — SplitText |

**Примечание**: Таймлайны дочерних компонентов вкладываются в мастер-таймлайн через `position` параметр (см. `SPLASH_CHOREOGRAPHY` в `splashChoreography.ts`).

### Синхронизация Tagline ↔ LogoText

Tagline зарегистрирован на master-таймлайне в позиции `0` (`master.labels.TAGLINE`) и привязан к двум событиям в LogoText:

- **Влёт клавиатуры** (master `1.5`) — синхронно с началом морфа гвоздя в курсор (`Cursor.phaseCaret.start`).
- **Подсветка клавиш** (master `1.9`–`4.0`) — синхронно с началом морфа соответствующей буквы.

| Master-время | Tagline (событие)                | LogoText (начало морфинга)                                       |
| ------------ | -------------------------------- | ---------------------------------------------------------------- |
| 1.5          | Влёт клавиатуры                  | `Cursor.phaseCaret.start` (морф гвоздь → курсор)                 |
| 1.9          | Подсветка `C`                    | C: `phaseLetter.start`                                           |
| 2.59         | Подсветка `O`                    | O: `phaseDash.start + phaseLetter.delay`                         |
| 2.85         | Подсветка `V`                    | V: `phaseDash.start + phaseLetter.delay`                         |
| 3.07         | Подсветка `S`                    | S: `phaseDash.start + phaseLetter.delay`                         |
| 3.3          | Подсветка `K`                    | K: `phaseDash.start + phaseLetter.delay`                         |
| 3.45         | Подсветка `I`                    | I: `phaseDash.start + phaseLetter.delay`                         |
| 3.6          | Подсветка `Y`                    | Y: `phaseDash.start + phaseLetter.delay`                         |
| 4.2          | Подсветка `ENTER`                | `logoText.sparks.burst1` (первая эмиссия частиц)                   |

Все позиции вычисляются в `Tagline.tsx` программно из `SPLASH_CHOREOGRAPHY.logoText` (`Cursor.phaseCaret.start`, `C.phaseLetter.start` или `X.phaseDash.start + X.phaseLetter.delay`). `ENTER` привязан к `logoText.sparks.burst1`.

## Хореография (SPLASH_CHOREOGRAPHY)

Константа `SPLASH_CHOREOGRAPHY` (файл `splashChoreography.ts`) управляет временными позициями и длительностями анимаций.

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
- `NAIL_FLY`: `1.2s`
- `NAIL_MORPH`: `0.5s`
- `LETTER_MORPH`: `0.4s`
- `CURSOR_MOVE`: `2s`

### tagline.durations

- `KEYBOARD_IN`: `0.5s`
- `KEY_HIGHLIGHT`: `0.3s`
- `KEYBOARD_OUT`: `0.4s`
- `TEXT_REVEAL`: `0.6s`
- `TEXT_STAGGER`: `0.15s`

### Подсветка клавиш

Позиции подсветки клавиш вычисляются программно в `Tagline.tsx` из `SPLASH_CHOREOGRAPHY.logoText` (см. таблицу синхронизации выше). `ENTER` привязан к `logoText.sparks.burst1` (первая эмиссия частиц). Влёт клавиатуры (`KEYBOARD_IN_LOCAL = 1.5`) вычисляется из `Cursor.phaseCaret.start`.

- `C` — `logoText.C.phaseLetter.start` → `1.9`
- `O` — `logoText.O.phaseDash.start + logoText.O.phaseLetter.delay` → `2.59`
- `V` — `…V…` → `2.85`
- `S` — `…S…` → `3.07`
- `K` — `…K…` → `3.3`
- `I` — `…I…` → `3.45`
- `Y` — `…Y…` → `3.6`
- `ENTER` — `logoText.sparks.burst1` → `4.2`

**Примечание**: Метки и длительности используются в дочерних компонентах (`Logo.tsx`, `LogoText.tsx`, `Tagline.tsx`) для создания локальных таймлайнов.

## Использование в App.tsx

```tsx
import { SplashPage, splashStorage } from './pages/SplashPage';
import { useState } from 'react';
import { useLocation } from 'react-router';

function App() {
  const [showSplash, setShowSplash] = useState(
    () => location.pathname === '/' && !splashStorage.getNeverShow(),
  );

  const handleSplashComplete = () => setShowSplash(false);

  return (
    <>
      {showSplash && (
        <SplashPage onComplete={handleSplashComplete} skipDelay={800} />
      )}
      {/* основной контент */}
    </>
  );
}
```

**Примечание**: Условный рендеринг `showSplash` управляется состоянием и `splashStorage.getNeverShow()`. Если пользователь ранее выбрал "Больше не показывать", splash не отображается.

## Отладка (dev-mode)

В `main.tsx` добавляется глобальный объект `window.splashDebug`:

| Метод         | Действие                              |
| ------------- | ------------------------------------- |
| `reset()`     | Очищает флаг, перезагружает страницу  |
| `forceShow()` | Сбрасывает флаг, показывает Splash    |
| `forceHide()` | Устанавливает флаг, скрывает Splash   |
| `status()`    | Логирует текущее значение `neverShow` |

## Ключевые решения

- **Мастер-таймлайн** в `SplashPage` через `useGSAP` создаётся как `paused: true`, и после регистрации дочерних таймлайнов вызывается `master.play()`
- **Дочерние компоненты** получают `onRegisterTimeline` колбэк через пропсы — он принимает `tl: gsap.core.Timeline`(локальный таймлайн компоненты) и необязательный `position`, задающий время на мастер-таймлайне с которого локальный таймлайн начнет проигрываться
- **`handleRegisterTimeline`** создаётся через `useCallback` с `dependencies: []`, инициализируется один раз при монтировании `SplashPage`
- **`childTimelinesRegistrationRef`** — `ref`-контейнер (Set), который содержит в себе коллбеки с регистрацией локальных таймлайнов
- **Отсутствие гонки регистраций** гарантируется самим механизмом React, создание компонент происходит от потомков к родителю. В момент когда будет выполняться асинхронный useGSAP родителя, в childTimelinesRegistrationRef уже будут лежать коллбеки регистрации потомков
- **Исходные стили** скрыты через `visibility: hidden`, GSAP переключает на `visible`
- **Пропуск**: `handleSkip` вызывает `masterTimelineRef.current?.progress(1).kill()`, затем `onComplete()`
- **Кнопка пропуска** появляется через `skipDelay` мс (передаётся из `App.tsx`), fade-in анимация
- **`useGSAP`** из `@gsap/react` гарантирует безопасную работу в `StrictMode` и автоочистку
