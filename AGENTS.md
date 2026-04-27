# Контекст для агентов — covskiy.github.io

## Обзор проекта

Это **React 19 + TypeScript + Vite** одностраничное приложение, размещённое на GitHub Pages. Сайт представляет собой визитку/портфолио с GSAP-анимациями, переходами между страницами и системой прелоадера.

## Основные команды

```bash
npm run dev          # Запуск dev-сервера (порт 3005)
npm run build        # Проверка типов + продакшн-сборка
npm run lint         # Проверка ESLint
npm run lint:fix     # ESLint с автоисправлением
npm run format:fix   # Форматирование Prettier
npm run stylelint:fix # Исправление CSS Stylelint
npm run precommit:check # Ручной запуск lint-staged
```

## Структура директорий

```
covskiy.github.io/
├── public/
│   ├── favicon.svg          # Favicon
│   ├── icons.svg            # SVG-спрайт
│   └── 404.html             # Обработчик перенаправлений GitHub Pages
├── src/
│   ├── assets/              # Статические изображения
│   ├── components/
│   │   ├── VerticalNav/     # Навигация для десктопа (фикс. слева)
│   │   ├── BurgerMenu/      # Мобильная навигация (<768px)
│   │   └── PageTransition/  # Обертка для анимации переходов
│   ├── pages/
│   │   ├── SplashPage/      # Splash-экран с анимацией (блокирует UI)
│   │   ├── HomePage/
│   │   ├── AboutPage/
│   │   ├── ServicesPage/
│   │   └── ContactPage/
│   ├── styles/
│   │   ├── typography.css   # CSS-переменные, шрифты
│   │   ├── reset.css        # Минимальный сброс стилей
│   │   └── global.css       # Стили body, #root
│   ├── routes.tsx           # Все роуты (React Router)
│   ├── App.tsx              # Корневой компонент (layout)
│   ├── main.tsx             # Точка входа
│   └── index.css           # CSS точка входа
├── .github/workflows/deploy.yml
├── vite.config.ts
├── eslint.config.js
└── package.json
```

## Роутинг

| Роут        | Компонент    | Примечания                             |
| ----------- | ------------ | -------------------------------------- |
| `/`         | SplashPage   | Показывает анимацию 1 раз, затем /home |
| `/home`     | HomePage     | Загружается сразу                      |
| `/about`    | AboutPage    | Lazy loaded                            |
| `/services` | ServicesPage | Lazy loaded                            |
| `/contact`  | ContactPage  | Lazy loaded                            |
| `/*`        | RouteError   | 404 fallback                           |

Роуты определены в `src/routes.tsx` и используют `React.lazy()` + `Suspense` для код-сплиттинга.

## SplashPage (анимация)

- При переходе на `/` — App.tsx показывает **только** SplashPage (блокирует UI)
- Проверяет `localStorage.getItem('splashShown')`
- Если `true` — сразу редирект на `/home`
- Если `false` — проигрывает GSAP анимацию, затем редирект + записывает `splashShown: true`

## Стратегия GSAP

- Используй хук `useGSAP` из `@gsap/react` — автоочистка при размонтировании
- `gsap.registerPlugin(useGSAP)` один раз при входе в приложение
- Ограничивай анимации с помощью `ref` и опции `scope`
- `dependencies: [pathname]` + `revertOnUpdate: true` для реактивных переходов

```tsx
import { useGSAP } from '@gsap/react';

useGSAP(
  () => {
    gsap.from('.element', { opacity: 0, y: 20 });
  },
  { scope: containerRef },
);
```

## Система прелоадера

1. Инлайн в `index.html` — показывается сразу при загрузке HTML
2. Использует `performance.getEntriesByType('resource')` для счётчика прогресса
3. `window.hidePreloader()` вызывается в `main.tsx` **до** `createRoot().render()`
4. CSS transition 0.4s затухание, затем удаление из DOM

## Перенаправление на GitHub Pages

При разворачивании на Guthub pages вызывается операция `cp dist/index.html dist/404.html` Таким образом никакой дополнительно обработки 404 редиректов не требуется.

## Процесс разработки

1. Husky + lint-staged запускаются перед коммитом:
   - `.ts/.tsx` → `eslint --fix` + `prettier --write`
   - `.css` → `stylelint --fix` + `prettier --write`

## Зависимости

| Runtime      | Назначение          |
| ------------ | ------------------- |
| react        | UI-библиотека       |
| react-dom    | Рендеринг в DOM     |
| react-router | Клиентский роутинг  |
| gsap         | Анимации            |
| @gsap/react  | React-хуки для GSAP |

| Dev          | Назначение           |
| ------------ | -------------------- |
| vite         | Инструмент сборки    |
| typescript   | Типовая безопасность |
| eslint       | Линтинг              |
| prettier     | Форматирование       |
| stylelint    | Линтинг CSS          |
| husky        | Git-хуки             |
| lightningcss | Трансформация CSS    |

## Соглашения по стилям

- **CSS Modules** для scoped-стилей компонентов (`.module.css`)
- **LightningCSS** трансформер (настроен в `vite.config.ts`)
- **Design tokens** в `design-tokens/` в виде JSON-файлов, которые транслируются при помощи style-dictionary в css
- **CSS-переменные** доступны в `src/styles/global.css`
- **Breakpoint**: `design-tokens/breakpoints.json` которые транслируются в `src/styles/breakpoints.css`

## Design Tokens

Design tokens хранятся в `design-tokens/` в виде JSON-файлов и обеспечивают согласованные значения по всему проекту.

### Цвета

| Токен     | Пример значения | Использование             |
| --------- | --------------- | ------------------------- |
| `primary` | `#04bf8a` (500) | Основные действия, ссылки |
| `purple`  | `#6866d4` (500) | Акцентные элементы        |
| `gray`    | `#344054` (700) | Текст, границы            |
| `success` | `#60b527` (500) | Состояния успеха          |
| `error`   | `#ff3932` (500) | Состояния ошибки          |

Шкалы: 25, 50, 100, 200, 300, 400, 500, 600, 700, 800, 900

### Типографика

| Токен      | Значение                    | Использование             |
| ---------- | --------------------------- | ------------------------- |
| `logo`     | `"Playfair Display", serif` | Логотип, hero-заголовки   |
| `headings` | `"Inter", sans-serif`       | Все уровни заголовков     |
| `body`     | `"Open Sans", sans-serif`   | Параграфы, основной текст |

Размеры: `xs` (12px), `sm` (14px), `base` (16px), `lg` (18px), `xl` (20px), `2xl` (24px), `3xl` (30px), `4xl` (36px), `5xl` (48px), `6xl` (60px)

### Отступы

| Токен | Значение | Использование                    |
| ----- | -------- | -------------------------------- |
| `xxs` | 4px      | Микроотступы                     |
| `xs`  | 8px      | Компактные отступы в компонентах |
| `sm`  | 12px     | Метки для инпутов                |
| `md`  | 16px     | Стандартные между секциями       |
| `lg`  | 24px     | Заголовки секций от контента     |
| `xl`  | 32px     | Разделители крупных секций       |
| `xxl` | 48px     | Отступы hero-секции              |

### Брейкпоинты (min-width)

| Токен     | Значение | Устройства               |
| --------- | -------- | ------------------------ |
| `phone`   | 0px      | Мобильные (по умолчанию) |
| `tablet`  | 481px    | Планшеты                 |
| `laptop`  | 769px    | Ноутбуки                 |
| `desktop` | 1025px   | Десктопы                 |

### Тени

| Токен     | Значение                         | Использование               |
| --------- | -------------------------------- | --------------------------- |
| `level-1` | `0px 2px 4px rgb(0 0 0 / 5%)`    | Слегка приподнятые элементы |
| `level-2` | `0px 4px 8px rgb(0 0 0 / 10%)`   | Карточки, выпадающие списки |
| `level-3` | `0px 8px 16px rgb(0 0 0 / 15%)`  | Модалки, подсказки          |
| `level-4` | `0px 12px 24px rgb(0 0 0 / 20%)` | Критические уведомления     |

### Переходы

| Длительность | Значение | Использование                      |
| ------------ | -------- | ---------------------------------- |
| `short`      | 150ms    | Ховеры кнопок, изменение состояний |
| `medium`     | 300ms    | Появление/исчезновение элементов   |
| `long`       | 500ms    | Открытие модалок, сложные переходы |

Плавность: `easeInOut` (по умолчанию), `easeIn`, `easeOut`, `sharp`

### Размеры элементов

| Токен          | Значение | Использование             |
| -------------- | -------- | ------------------------- |
| `inputHeight`  | 40px     | Текстовые инпуты, селекты |
| `buttonHeight` | 44px     | Стандартные кнопки        |
| `avatarSize`   | 48px     | Аватары пользователей     |
| `iconSize`     | 24px     | Иконки компонентов        |

### Скругления

| Токен  | Значение | Использование                 |
| ------ | -------- | ----------------------------- |
| `xs`   | 2px      | Маленькие иконки, микрокнопки |
| `sm`   | 4px      | Инпуты, компактные кнопки     |
| `md`   | 8px      | Карточки, модалки             |
| `lg`   | 12px     | Баннеры, акцентные кнопки     |
| `full` | 9999px   | Круглые элементы              |

## Важные примечания

- `vite.config.ts`: `base: '/'` так как привязан сторонник domain
- `manualChunks`: vendor включает `react`, `react-dom`, `react-router`, `gsap`, `@gsap/react`
- Dev-сервер привязан к `0.0.0.0:3005` (доступен из сети)
- `selector-class-pattern: null` в stylelint (CSS Modules генерируют хешированные имена)
