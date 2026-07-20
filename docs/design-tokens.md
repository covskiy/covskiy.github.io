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
    - токена `sizing.containerMaxWidth` — фиксированная ширина макета
      (`1200px`), не масштабируется с размером шрифта пользователя,
      поэтому остаётся в `px`.
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
