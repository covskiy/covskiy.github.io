# SkipControls

## Обзор

Компонент кнопки пропуска splash-анимации с чекбоксом «Больше не показывать при запуске». Появляется с fade-in анимацией через `skipDelay` мс после старта SplashPage. Управляет собственным состоянием чекбокса и синхронизирует его с `localStorage` через `splashStorage`.

## Пропсы

| Проп     | Тип          | Описание                        |
| -------- | ------------ | ------------------------------- |
| `onSkip` | `() => void` | Колбэк при нажатии «Пропустить» |

## Архитектура

### Структура файлов

```
SkipControls/
├── SkipControls.tsx        # Компонент с собственным стейтом чекбокса
├── SkipControls.module.css # Стили (позиционирование, fade-in, responsive)
└── index.ts                # Бочёночный экспорт
```

### Управление состоянием

Чекбокс «Больше не показывать» управляется **локально** в `SkipControls`:

- **Инициализация**: `useState(() => splashStorage.getNeverShow())` — читает предыдущее значение из `localStorage`
- **Изменение**: `handleChange(checked)` — вызывает `setNeverShowAgain(checked)` + `splashStorage.setNeverShow(checked)`
- **Родитель** (`SplashPage`) не знает о состоянии чекбокса — передаёт только `onSkip`

### Ключ localStorage

`SkipControls` импортирует `splashStorage` напрямую из `pages/SplashPage`:

```ts
import { splashStorage } from '../../pages/SplashPage';
```

Ключ в localStorage: `splash_never_show`. Формат: `{ neverShow: boolean, timestamp?: number }`.

### Fade-in анимация

Появление контролов — CSS-анимация `@keyframes skipFadeIn` (`opacity 0 → 1`), применяется при монтировании компонента через `animation` в `.skipControls`.

### Responsive

Через `@media (width >= 481px)` отступы и gap увеличиваются для планшетов/десктопов.

## Использование

```tsx
// SplashPage.tsx
{
  showSkipButton && <SkipControls onSkip={handleSkip} />;
}
```

Компонент рендерится условно: появляется в DOM только после `skipDelay` мс (управляется таймером в `SplashPage`). При размонтировании (условие `showSkipButton` → `false`) React удаляет DOM-элементы, CSS-анимация не проигрывается в обратную сторону.
