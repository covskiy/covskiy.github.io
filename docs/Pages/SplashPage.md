# SplashPage

Анимированная интро-страница (Splash Screen), последовательно анимирующая три ключевых элемента: **Логотип**, **Логотекст** и **Слоган**. Анимация управляется единым `gsap.core.Timeline`, создаваемым в `SplashPage`. Дочерние компоненты регистрируют свои локальные таймлайны через колбэк `onRegisterTimeline`, переданный в props.

## Управление состоянием

| Флаг        | Хранилище      | Механизм                                  |
| ----------- | -------------- | ----------------------------------------- |
| `neverShow` | `localStorage` | Неактивен (закомментирован для переписи)  |
| `skipDelay` | Пропс          | Таймер показа кнопки пропуска (неактивен) |

**Примечание**: Логика `useSplashSkip`, `splashStorage.getNeverShow()`, `shouldBypass` временно закомментирована в `SplashPage.tsx` и будет переписана позже. Компонент всегда рендерится.

## Архитектура

```
pages/SplashPage/
├── index.ts                    # Barrel: SplashPage, splashStorage
├── SplashPage.tsx              # Создаёт мастер-таймлайн + координирует регистрацию
├── SplashPage.module.css       # Стили контейнера (fixed overlay)
├── splashChoreography.ts       # Константы времени и длительностей анимаций
├── hooks/
│   ├── index.ts                # Отсутствует (useSplashSkip импортируется напрямую)
│   └── useSplashSkip.ts        # Закомментирован (待 перепись)
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
| `1.0`       | Tagline  | `SplitText` lines reveal (`y: -20 → 0`, `back.out(1.7)`), keyboard SVG animation                                |

**Примечание**: Таймлайны дочерних компонентов вкладываются в мастер-таймлайн через `position` параметр (см. `SPLASH_CHOREOGRAPHY` в `splashChoreography.ts`).

## Хореография (SPLASH_CHOREOGRAPHY)

Константа `SPLASH_CHOREOGRAPHY` (файл `splashChoreography.ts`) управляет временными позициями и длительностями анимаций.

### master.labels

- `LOGO`: `0` (Logo и LogoText вкладываются в начало)
- `LOGO_TEXT`: `0`
- `TAGLINE`: `1.0` (Tagline вкладывается через 1 секунду)

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
- `KEY_STAGGER_GAP`: `0.3s`
- `ENTER_KEY_OFFSET`: `0.5s`
- `KEYBOARD_OUT`: `0.4s`
- `TEXT_REVEAL`: `0.6s`
- `TEXT_STAGGER`: `0.15s`

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

**Примечание**: Условный рендеринг `showSplash` управляется состоянием и `splashStorage.getNeverShow()`.

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
- **Пропуск** (закомментирован,待 перепись): `timeline.progress(1).kill()` без `gsap.set`/`clearProps`
- **`useGSAP`** из `@gsap/react` гарантирует безопасную работу в `StrictMode` и автоочистку
