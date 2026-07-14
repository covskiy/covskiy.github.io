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

Компонент передаёт `durationInMs` в CSS-переменную `--duration` через inline-стиль. CSS Module определяет `@keyframes timeline-fill`, который увеличивает `width` fill-элемента от `0%` до `100%` за указанную длительность:

```css
animation: timeline-fill var(--duration, 5000ms) linear forwards;
```

- `.track` — фоновая полоса (`--color-gray-800` с бордером `--color-gray-700`), `overflow: hidden`
- `.fill` — заполняющий элемент (`--color-core-400`), анимируется по ширине
- Дефолтная длительность fallback: `5000ms`

### Использование

```tsx
import { SlimProgressBar } from '../SlimProgressBar';

<SlimProgressBar durationInMs={6200} />;
```
