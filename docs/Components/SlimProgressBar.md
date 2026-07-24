# SlimProgressBar

## Обзор

Минималистичная полоса прогресса с CSS-анимацией. Анимация работает чисто на CSS (`@keyframes`), без JS или GSAP-таймлайнов.

## Props

| Проп           | Тип    | Обязательный | Описание                   |
| -------------- | ------ | ------------ | -------------------------- |
| `durationInMs` | number | Да           | Длительность анимации в мс |
| `className`    | string | Нет          | Дополнительный CSS-класс   |

## Архитектура

### Структура файлов

```
SlimProgressBar/
├── SlimProgressBar.tsx         # Компонент
├── SlimProgressBar.module.css  # Scoped-стили + @keyframes
└── index.ts                    # Бочёночный экспорт
```

### CSS-анимация

Компонент передаёт `durationInMs` в CSS-переменную `--duration` через inline-стиль. CSS Module определяет `@keyframes timeline-fill`, который масштабирует fill-элемент через `transform: scaleX()` от `0` до `1` за указанную длительность:

```css
animation-name: timeline-fill;
animation-duration: var(--duration, 5000ms);
animation-timing-function: linear;
animation-fill-mode: forwards;
```

- `.track` — фоновая полоса (`--color-gray-800` с бордером `--color-gray-700`), `overflow: hidden`, высота `calc(var(--spacing-xxs) * 1.4)`
- `.fill` — заполняющий элемент (`--color-core-400`), анимируется через `transform: scaleX()` с `transform-origin: left`
- `will-change: transform` — подсказка браузеру для GPU-ускорения
- Shorthand `animation` разобран на отдельные свойства для совместимости с мобильными браузерами
- Дефолтная длительность fallback: `5000ms`

### Использование

```tsx
import { SlimProgressBar } from '../SlimProgressBar';

<SlimProgressBar durationInMs={6200} />;
```
