# Breakpoints

## Модель

Проект использует **3-тирную mobile-first** модель:

| Ти́р       | Диапазон вьюпорта | Типовое применение                        |
| --------- | ----------------- | ----------------------------------------- |
| `mobile`  | `< 768px`         | Базовые стили по умолчанию (без `@media`) |
| `tablet`  | `≥ 768px`         | Планшеты, лэптопы — укрупнение, раскладка |
| `desktop` | `≥ 1024px`        | Десктопы — максимальные размеры, отступы  |

Значения **768** и **1024** — единственный источник правды для всех слоёв (токены,
CSS, JS).

## Источник правды

### Design Tokens

`design-tokens/breakpoints.json` — канонические значения. После изменения —
`npm run build:design-tokens` для регенерации `src/styles/breakpoints.css`.

```json
{
  "breakpoints": {
    "tablet": { "$value": "768px" },
    "desktop": { "$value": "1024px" }
  }
}
```

Генерятся в CSS-переменные `--breakpoints-tablet`, `--breakpoints-desktop`.
**Не использовать их в `@media`** — CSS не поддерживает `var()` внутри
`@media`-условия.

### CSS

В `@media`-запросах писать значения **явно**:

```css
/* mobile — стили по умолчанию, без @media */
.component {
  font-size: 14px;
}

/* tablet (>= 768px) */
@media (width >= 768px) {
  .component {
    font-size: 16px;
  }
}

/* desktop (>= 1024px) */
@media (width >= 1024px) {
  .component {
    font-size: 18px;
  }
}
```

Использовать синтаксис **`width >= Npx`** (mobile-first), не `min-width`.
Использовать синтаксис **`width < Npx`** для обратных переходов
(например, скрытие сайдбара на мобильных).

### JS/TS

`src/utils/breakpoints.ts` — единая точка входа для JS-логики:

```ts
import {
  BREAKPOINTS,
  getBreakpoint,
  useBreakpoint,
} from '../utils/breakpoints';
```

- **`BREAKPOINTS`** — константы `{ tablet: 768, desktop: 1024 }`.
  Использовать для прямых сравнений с `window.innerWidth`.
- **`getBreakpoint(width)`** — возвращает `'mobile' | 'tablet' | 'desktop'`
  для заданной ширины. Использовать вне React (утлиты, конфиги).
- **`useBreakpoint()`** — React-хук, возвращает текущий Breakpoint,
  подписан на `resize`. Использовать в компонентах, где нужна
  реактивность на изменение вьюпорта.

### Spark-система

`src/components/LogoText/sparks.config.ts` — импортирует `BREAKPOINTS`
из `src/utils/breakpoints.ts`. Функция `selectSparkProfile(width)` выбирает
профиль искр:

```ts
width < BREAKPOINTS.tablet  → mobile
width < BREAKPOINTS.desktop → tablet
>= BREAKPOINTS.desktop      → desktop
```

## Конвенции именования

| Код/язык        | Имя тира  |
| --------------- | --------- |
| CSS, JS, токены | `mobile`  |
| CSS, JS, токены | `tablet`  |
| CSS, JS, токены | `desktop` |

Тиры **не** называть `phone`, `laptop`, `small`, `large` — только
`mobile` / `tablet` / `desktop`.

## Добавление нового брейкпоинта

1. Добавить значение в `design-tokens/breakpoints.json`
2. `npm run build:design-tokens`
3. Добавить константу в `BREAKPOINTS` в `src/utils/breakpoints.ts`
4. Обновить тип `Breakpoint` и функцию `getBreakpoint()`
5. При необходимости — обновить `selectSparkProfile()` в `sparks.config.ts`
