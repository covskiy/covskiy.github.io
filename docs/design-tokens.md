# Design Tokens — Сборка и использование

> Этот файл вынесен из `docs/architecture.md` как самостоятельный раздел.
> Описывает механизм сборки токенов из JSON в CSS-переменные через
> style-dictionary.

## 1. Источник

JSON-файлы в `design-tokens/`:

| Файл               | Содержимое                                                                                     |
| ------------------ | ---------------------------------------------------------------------------------------------- |
| `breakpoints.json` | `breakpoints` (min-width)                                                                      |
| `colors.json`      | `color` (primary/purple/gray/success/error, 25..900) + `color-gradient`                        |
| `shadows.json`     | `shadows` (level-1..4)                                                                         |
| `sizing.json`      | `sizing` (inputHeight, buttonHeight, containerMaxWidth, avatarSize, iconSize) + `borderRadius` |
| `spacing.json`     | `spacing` (xxs, xs, sm, md, lg, xl, xxl)                                                       |
| `transition.json`  | `transitions` (short, medium, long) + easing                                                   |
| `typography.json`  | `fontFamilies`, `fontSizes`, `lineHeights`, `fontWeights`, `letterSpacings`                    |

## 2. Конфиг — `sd.config.js`

- `source: ['design-tokens/**/*.json']`.
- `transformGroup: css` (стандартные CSS-трансформы).
- **Два custom transform:**
  - `attribute/gradient-to-css` — для токенов `$type: 'custom-gradient'`,
    поддерживает `linear` и `radial` (см. § 4).
  - `value/px-to-rem-conditional` — для `dimension` токенов конвертирует
    `px` → `rem` (`basePxFontSize: 16`), **кроме**:
    - токенов категории `breakpoints` (остаются в `px`);
    - токена `layout.containerMaxWidth` — фиксированная ширина макета
      (`1200px`), не масштабируется с размером шрифта пользователя,
      поэтому остаётся в `px`.

    в дефолтной группе `transformGroups.css` трансформер `transforms.sizeRem` ('size/rem') заменен на этот

- `buildPath: 'src/styles'`.

## 3. Маппинг категория → файл

| Категория                                                                                 | Файл              |
| ----------------------------------------------------------------------------------------- | ----------------- |
| `color`, `color-gradient`                                                                 | `colors.css`      |
| `fontFamilies`, `fontSizes`, `lineHeights`, `fontWeights`, `letterSpacings`, `typography` | `typography.css`  |
| `spacing`                                                                                 | `spacing.css`     |
| `breakpoints`                                                                             | `breakpoints.css` |
| `shadows`                                                                                 | `shadows.css`     |
| `transitions`                                                                             | `transitions.css` |
| `borderRadius`, `sizing`                                                                  | `sizing.css`      |

## 4. Градиенты

Токены типа `custom-gradient` (только в `colors.json`) конвертируются в
стандартный CSS-градиент. `alpha` берётся из последних 2 hex-символов
(`#rrggbbaa`):

```json
{
  "color-gradient": {
    "primary": {
      "$type": "custom-gradient",
      "800 -> 600 (90 deg)": {
        "$value": {
          "gradientType": "linear",
          "rotation": 90,
          "stops": [
            { "position": 0, "color": "#016d6eff" },
            { "position": 1, "color": "#02a486ff" }
          ]
        }
      }
    }
  }
}
```

→

```css
--primary-800---600-90-deg: linear-gradient(90deg, #016d6e 0%, #02a486 100%);
```

Реализован `linear` и `radial` (последний — на случай будущего
использования).

## 5. Команда

```bash
npm run build:design-tokens
# style-dictionary build --config sd.config.js --verbose
```

> Перед `npm run build` токены должны быть сгенерированы. CI это не делает —
> токены коммитятся в `src/styles/`. Если меняешь `design-tokens/*.json` —
> запусти `build:design-tokens` и закоммить изменения.

---

## 6. Семантические переменные

Слой между raw-токенами (`colors.css`, `spacing.css`) и компонентами.
Каждая переменная отвечает на вопрос «зачем этот цвет», а не «какой это цвет».

### 6.1 Файлы

- `semantic-mid.css` — средняя тема (используется сейчас)
- `semantic-dark.css` — тёмная тема (закомментирована)

Переключение: в `global.css` заменить `@import url('./semantic-mid.css')` на
`@import url('./semantic-dark.css')`.

### 6.2 Схема именования

Формат: `--{category}-{item}-{state?}`.

| Категория     | Назначение                                           | Пример                                                                           |
| ------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------- |
| `--color-*`   | Цвета фона, текста, границ, акцентов, обратной связи | `--color-bg-page`, `--color-text-body`, `--color-border`, `--color-status-error` |
| `--font-*`    | Шрифты (алиасы на `font-families-*`)                 | `--font-body`, `--font-heading`, `--font-mono`                                   |
| `--shadow-*`  | Тени элементов                                       | `--shadow-card`                                                                  |
| `--z-*`       | z-index для слоёв                                    | `--z-nav-overlay`                                                                |
| `--opacity-*` | Прозрачность для состояний                           | `--opacity-disabled`                                                             |

Префикс категории обязателен — он делает назначение переменной читаемым
без заглядывания в значение. Состояние (опционально) указывается суффиксом:
`hover`, `focus`, `disabled`, `error`, `success`.

Переменные без префикса (`--font-size-base`, `--line-height-base`,
`--letter-spacing-base`) — исключение для body font shorthand и не относятся
к семантическому слою.

### 6.3 Полный список

| Переменная               | Raw-токен                  | Hex               | Где используется                     |
| ------------------------ | -------------------------- | ----------------- | ------------------------------------ |
| `--color-bg-page`        | `--color-gray-700/800`     | #1e293b / #1a1c23 | body, секции, карточки               |
| `--color-text-body`      | `--color-gray-100/200`     | #e2e8f0 / #cbd5e1 | p, li, .card p, инпуты               |
| `--color-text-heading`   | `--color-gray-50`          | #f1f5f9           | h1–h4, .logo, code                   |
| `--color-text-secondary` | `--color-gray-200/300`     | #cbd5e1 / #94a3b8 | подписи, мета-данные                 |
| `--color-text-on-accent` | `--color-gray-25`          | #fff7f0           | текст на акцентном фоне              |
| `--color-accent-primary` | `--color-core-500`         | #ff9447           | CTA, ссылки, иконки, NavLink.active  |
| `--color-accent-hover`   | `--color-core-400`         | #ffa259           | CTA:hover, ссылки:hover              |
| `--color-bg-accent`      | `--color-core-800/900`     | #994d13 / #66330a | NavLink:hover/active, alert-блоки    |
| `--color-border-accent`  | `--color-core-700`         | #cc6620           | input:focus, выделенные блоки        |
| `--color-border`         | `--color-gray-600/700`     | #334155 / #1e293b | border-right навбара, рамки карточек |
| `--color-bg-card`        | `--color-gray-600/700`     | #334155 / #1e293b | .card, .item, info-блоки             |
| `--color-border-focus`   | `--color-core-400`         | #ffa259           | :focus-visible outline               |
| `--color-status-error`   | `--color-center-500`       | #ff9999           | border-color/text ошибок             |
| `--color-status-success` | `--color-glow-500`         | #fed85d           | сообщения об успехе                  |
| `--color-bg-code`        | `--color-gray-600/700`     | #334155 / #1e293b | code, pre                            |
| `--color-bg-social`      | `--color-gray-600/700`     | #334155 / #1e293b | .social-links, кнопки-иконки         |
| `--font-body`            | `--font-families-body`     | Open Sans         | body, p, li, span                    |
| `--font-heading`         | `--font-families-headings` | Inter             | h1–h4                                |
| `--font-mono`            | `--font-families-mono`     | Fira Code         | code, pre                            |
| `--shadow-card`          | `--shadows-level-2/3`      | —                 | .card:hover, модальные окна          |
| `--z-nav-overlay`        | —                          | —                 | NavigationBar mobile overlay         |
| `--opacity-disabled`     | —                          | 0.5               | disabled кнопки, инпуты              |

В колонке «Raw-токен» через слэш указаны значения для средней и тёмной темы
там, где они различаются.

### 6.4 Как добавить новый семантический токен

1. Если значение зависит от темы — определить в обоих `semantic-*.css`.
   Если одинаково в обеих темах — достаточно одного файла.
2. Дать имя по схеме `--{category}-{item}`, без сокращений.
3. Над определением — комментарий с описанием и списком мест использования.
4. Заменить raw-токены в компонентах на новый семантический токен.
5. Обновить таблицу в этом разделе.
