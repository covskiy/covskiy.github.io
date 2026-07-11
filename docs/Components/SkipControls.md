# SkipControls

## Обзор

Компонент кнопки пропуска intro-анимации с чекбоксом «Больше не показывать при запуске». Появляется с fade-in анимацией через `skipDelay` мс после старта IntroAnimation. Управляет собственным состоянием чекбокса и синхронизирует его с `localStorage` через `introStorage`.

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

- **Инициализация**: `useState(() => introStorage.getNeverShow())` — читает предыдущее значение из `localStorage`
- **Изменение**: `handleChange(checked)` — вызывает `setNeverShowAgain(checked)` + `introStorage.setNeverShow(checked)`
- **Родитель** (`IntroAnimation`) не знает о состоянии чекбокса — передаёт только `onSkip`

### Ключ localStorage

`SkipControls` импортирует `introStorage` напрямую из `components/IntroAnimation`:

```ts
import { introStorage } from '../../components/IntroAnimation';
```

Ключ в localStorage: `intro_never_show`. Формат: `{ neverShow: boolean, timestamp?: number }`.

### Fade-in анимация

Появление контролов — CSS-анимация `@keyframes skipFadeIn` (`opacity 0 → 1`), применяется при монтировании компонента через `animation` в `.skipControls`.

### Responsive

Через `@media (width >= 481px)` отступы и gap увеличиваются для планшетов/десктопов.

## Использование

```tsx
// IntroAnimation.tsx
{
  showSkipButton && <SkipControls onSkip={handleSkip} />;
}
```

Компонент рендерится условно: появляется в DOM только после `skipDelay` мс (управляется таймером в `IntroAnimation`). При размонтировании (условие `showSkipButton` → `false`) React удаляет DOM-элементы, CSS-анимация не проигрывается в обратную сторону.
