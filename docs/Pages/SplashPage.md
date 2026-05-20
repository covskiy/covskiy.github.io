# SplashPage

Анимированная интро-страница (Splash Screen), последовательно анимирующая три ключевых элемента: **Логотип**, **Логотекст** и **Слоган**. Анимация управляется единым `gsap.core.Timeline`, создаваемым в `SplashPage` и передаваемым в дочерние компоненты через пропсы.

## Управление состоянием

| Флаг        | Хранилище      | Механизм                               |
| ----------- | -------------- | -------------------------------------- |
| `neverShow` | `localStorage` | Синхронно проверяется при монтировании |
| `skipDelay` | Пропс          | Таймер показа кнопки пропуска          |

SplashPage не рендерится в DOM при повторных визитах, если флаг `neverShow` установлен.

## Архитектура

```
pages/SplashPage/
├── index.ts                    # Barrel: SplashPage, splashStorage
├── SplashPage.tsx              # Orchestrates timeline + пропускание
├── SplashPage.module.css
├── hooks/
│   ├── index.ts
│   └── useSplashSkip.ts        # Логика пропуска + localStorage
└── utils/
    ├── index.ts
    └── splashStorage.ts        # Работа с localStorage
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
├── index.ts                    # Barrel: splash types
└── splash.types.ts             # AnimationComponentProps, SkipControlsProps, SplashPageProps, SplashStorageData
```

## Последовательность анимации

| Время (сек) | Элемент  | Анимация                                                       |
| ----------- | -------- | -------------------------------------------------------------- |
| `0.0`       | Logo     | `scale: 0.5 → 1`, `opacity: 0 → 1`, `ease: back.out(1.2)`      |
| `0.5`       | LogoText | `y: 30 → 0`, `opacity: 0 → 1`, `ease: power2.out`              |
| `1.0`       | Tagline  | `filter: blur(10px) → 0`, `opacity: 0 → 1`, `ease: power1.out` |

## Пропуск анимации

1. Кнопка "Пропустить" появляется через `skipDelay` (по умолч. 1000мс)
2. Чекбокс "Больше не показывать" сохраняет флаг в localStorage
3. При нажатии: `timeline.progress(1).kill()` — мгновенно применяет финальные стили
4. При повторных визитах: синхронная проверка `splashStorage.getNeverShow()`, компонент не рендерится

## Использование в App.tsx

```tsx
import { useState } from 'react';
import { SplashPage, splashStorage } from './pages/SplashPage';

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

## Отладка (dev-mode)

В `main.tsx` добавляется глобальный объект `window.splashDebug`:

| Метод         | Действие                              |
| ------------- | ------------------------------------- |
| `reset()`     | Очищает флаг, перезагружает страницу  |
| `forceShow()` | Сбрасывает флаг, показывает Splash    |
| `forceHide()` | Устанавливает флаг, скрывает Splash   |
| `status()`    | Логирует текущее значение `neverShow` |

## Ключевые решения

- **Timeline создаётся ТОЛЬКО** в `SplashPage` через `useGSAP`, а не в дочерних компонентах
- **Дочерние компоненты** получают `timeline` через пропсы и вызывают `timeline.add()`
- **Исходные стили** скрыты через `visibility: hidden`, GSAP переключает на `visible`
- **Пропуск** выполняется через `timeline.progress(1).kill()` без `gsap.set`/`clearProps`
- **`useGSAP`** из `@gsap/react` гарантирует безопасную работу в `StrictMode` и автоочистку
