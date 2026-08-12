# Контекст для агентов — covskiy.github.io

## Обзор

React 19 + TypeScript + Vite SPA, разворачивается на GitHub Pages. Сайт-визитка
с GSAP-анимациями, design-tokens через style-dictionary, intro animation
при первом заходе и системой preloader. Проект в активной разработке (WIP).

## Команды

| Скрипт                                | Назначение                                           |
| ------------------------------------- | ---------------------------------------------------- |
| `npm run dev`                         | Dev-сервер на `0.0.0.0:3005` с HMR                   |
| `npm run build`                       | `tsc -b && vite build` — типы + production-сборка    |
| `npm run build:design-tokens`         | `style-dictionary build` — JSON → `src/styles/*.css` |
| `npm run preview`                     | Локальный просмотр production-сборки                 |
| `npm run test`                        | `vitest run` — юнит-тесты layout-машины              |
| `npm run lint` / `lint:fix`           | ESLint                                               |
| `npm run format` / `format:fix`       | Prettier                                             |
| `npm run stylelint` / `stylelint:fix` | Stylelint по `src/**/*.css`                          |
| `npm run precommit:check`             | Ручной запуск lint-staged                            |

## Структура (верхний уровень)

```
covskiy.github.io/
├── design-tokens/        # JSON-токены → style-dictionary → src/styles/
├── docs/                 # Подробная документация (см. ниже)
├── public/               # favicon.svg, icons.svg (статические ассеты)
├── src/
│   ├── assets/           # Изображения, SVG-исходники Intro
│   ├── components/       # Logo, LogoText, Tagline, SkipControls,
│   │                     #   Layout, PageTransition, IntroAnimation
│   ├── pages/            # HomePage + About/Services/Contact
│   ├── styles/           # reset/global.css + сгенерированные токен-файлы
│   ├── types/            # Типы intro и общие типы
│   ├── utils/            # initGsap, logger
│   ├── App.tsx           # Подключает <LayoutProvider /> (layout-движок)
│   ├── routes.tsx        # Все роуты + lazy-обёртки
│   ├── main.tsx          # Entry: BrowserRouter, debug-хелперы
│   └── index.css         # CSS entry: reset + global
├── .github/workflows/    # deploy.yml
├── index.html            # Inline preloader (CSS+JS) + #root
├── vite.config.ts        # Vite, lightningcss, svgr
├── eslint.config.js
├── sd.config.js          # Конфиг style-dictionary
├── tsconfig*.json
└── package.json
```

## Ключевые архитектурные решения

- **App.tsx** — рендерит `<LayoutProvider />` (`src/components/Layout/`).
  Никакой intro/splash-логики, не импортирует `IntroAnimation`,
  `introStorage`, `useState`, `useEffect`. `/` всегда рендерит HomePage.
- **Layout** (машина состояния + per-component animator + GSAP-шина) —
  новый layout-движок, построен с нуля в задаче `task/11.FullLayoutRefactoring.md`.
  Структура: `machine/` (чистый TS: `transition` reducer + `resolveLayout`),
  `engine.ts` (внешний движок с `send/subscribe/getSnapshot`),
  `gsap/` (60fps-шина + `GsapProvider` + `GsapLayoutBridge`),
  `context/` (React-обёртка, реакция на bp/route/resize),
  `slots/` (`LayoutRoot` с CSS-vars + `useLayoutApplier` через `gsap.to`),
  `nav/` (презентационная `VerticalNavigationBar` + `ToggleButton`).
  `machine/` + `engine.ts` — без React/GSAP/DOM. Состояние (`mode`)
  держится в движке, не в React. Страницы регистрируют ScrollTrigger
  через `useRegisterHomeSpacer(triggerRef)` (`src/components/Layout/gsap/GsapLayoutBridge.tsx`).
  Чистый слой покрыт юнит-тестами (`vitest`): co-located `*.test.ts`
  в `machine/` + `engine.test.ts` — React-компоненты не тестируются.
- **HomePage** — владеет состоянием `showIntro`, `useEffect` для
  `overflow: hidden` на body, рендерит `<IntroAnimation />` как overlay
  поверх собственного контента и регистрирует ScrollTrigger раскладки
  через `useRegisterHomeSpacer(spacerRef)`.
- **routes.tsx** — `RouteConfig[]` с `label`, `HomePage` eager,
  `About/Services/Contact` — `React.lazy` + `withSuspense`.
  Роут `/` — HomePage, роут `*` — NotFoundPage.
- **vendor chunk** — выделен через
  `build.rolldownOptions.output.codeSplitting.groups` по `test: /node_modules/`.
- **GSAP** — регистрация всех плагинов в `src/utils/initGsap.ts`
  (`useGSAP`, `ScrollTrigger`, `SplitText`, `MorphSVGPlugin`,
  `DrawSVGPlugin`, `MotionPathPlugin`), вызывается на модульном уровне
  при импорте `App`. `GSDevTools` подключается в `IntroAnimation` только в DEV.
- **IntroAnimation** — `introStorage` (`localStorage`, ключ `intro_never_show`,
  объект `{ neverShow, timestamp? }`). Skip-логика в `useSplashSkip`.
- **Breakpoints** — 3-тирная mobile-first модель (`mobile` / `tablet: 768` / `desktop: 1024`). Единый источник правды: `design-tokens/breakpoints.json` → токены, `src/utils/breakpoints.ts` → JS/TS, hardcoded в CSS `@media`. Spark-система импортирует `BREAKPOINTS`. Подробнее: `docs/breakpoints.md`.
- **Design Tokens** — `design-tokens/*.json` → `sd.config.js` (custom
  transform `attribute/gradient-to-css`, `value/px-to-rem-conditional`) →
  `src/styles/*.css`. `px` → `rem` (base 16).
- **SVG** — `vite-plugin-svgr` + кастомный `svgoConfig`
  (`cleanupIds: false`, `removeHiddenElems.displayNone: false`) ради
  morph-путей в `Logo/LogoText`.
- **Preloader** — inline в `index.html`, `window.hidePreloader()` вызывается
  в `main.tsx` до `createRoot().render()`.
- **Dev debug** — в DEV `main.tsx` регистрирует `window.introDebug`
  (reset/forceShow/forceHide/status) и `window.loggerDebug`
  (setLevel/reset/status/levels).
- **CI/CD** — `cp dist/index.html dist/404.html` в deploy.yml — хак для
  React Router BrowserRouter на GitHub Pages.

## Документация (docs/)

| Файл                                | Назначение                                                          |
| ----------------------------------- | ------------------------------------------------------------------- |
| `docs/architecture.md`              | Архитектура, роутинг, GSAP, стили, конфиги                          |
| `docs/breakpoints.md`               | Breakpoints: модель, источник правды, CSS/JS использование          |
| `docs/design-tokens.md`             | Сборка design tokens, маппинг, градиенты                            |
| `docs/preloader.md`                 | Preloader — описание работы                                         |
| `docs/logging-rules.md`             | Соглашения по логгеру (теги, уровни)                                |
| `docs/utils/logger.md`              | API логгера                                                         |
| `docs/Components/Logo.md`           | Анимация логотипа (наковальня)                                      |
| `docs/Components/LogoText.md`       | Анимация текста логотипа (SVG morph)                                |
| `docs/Components/Layout/README.md`  | Layout-движок: machine/engine/snapshot/CSS-vars/GsapProvider/Bridge |
| `docs/Components/Layout/testing.md` | Тесты: глоссарий терминов и конвенция имен (GWT/AAA)                |
| `docs/Components/Tagline.md`        | Анимация слогана (клавиатура)                                       |
| `docs/Components/IntroAnimation.md` | Хореография Intro-анимации                                          |
| `docs/Pages/NotFoundPage.md`        | Описание страницы 404                                               |

## Зависимости

### Runtime

`react`, `react-dom`, `react-router` (v7), `gsap`, `@gsap/react`.

### Dev

- **Сборка**: `vite`, `@vitejs/plugin-react`, `vite-plugin-svgr`,
  `@svgr/plugin-svgo`, `browserslist`, `lightningcss`.
- **Токены**: `style-dictionary`.
- **TypeScript**: `typescript` (~5.9), `@types/{node,react,react-dom}`.
- **ESLint**: `eslint`, `@eslint/js`, `typescript-eslint`,
  `eslint-plugin-react`, `-react-hooks`, `-react-refresh`,
  `eslint-config-prettier`, `globals`.
- **Стиль**: `prettier`, `stylelint`, `stylelint-config-standard`.
- **Тесты**: `vitest`, `@vitest/coverage-v8`.
- **Git-хуки**: `husky`, `lint-staged`.

## CI/CD

`.github/workflows/deploy.yml`:

- Триггер: `push` в `main` (или `workflow_dispatch`).
- `ubuntu-latest`, Node `24.12.0`, `npm ci`.
- `npm run build` → `cp dist/index.html dist/404.html` →
  `actions/configure-pages@v5` → `upload-pages-artifact@v3` →
  `actions/deploy-pages@v4`.
- `concurrency.group: "pages"`, `cancel-in-progress: true`.

## Заметки

- `vite.config.ts`: `base: '/'` (привязан к кастомному домену),
  `lightningcss` с `browserslistToTargets(browserslist('baseline 2020'))`,
  `vite-plugin-svgr` с custom `svgoConfig`.
- Stylelint: `selector-class-pattern: null` (CSS Modules генерируют хеши).
- Проект WIP — `App.tsx`, `routes.tsx`, страницы будут дорабатываться.
- Husky v8 + lint-staged, см. `package.json` секцию `lint-staged`.
  Pre-commit дополнительно прогоняет `npm run test` (vitest).

## Соглашения по коммитам

LLM должна следовать этим правилам при составлении commit message.

**Subject (заголовок):**

- 1–3 слова, Title Case (`LogoText`, `IntroAnimation`, `Design Tokens`).
- Совпадает с именем затронутого компонента/фичи.
- Без префиксов (`feat:`, `fix:`, `chore:`) и без точки в конце.

**Body (тело):**

- Маркированный список на русском, тире `—` или `-` с пробелом.
- Первое слово каждого пункта — с маленькой буквы.
- Глаголы прошедшего времени совершенного вида:
  `добавлен`, `обновлена`, `удалён`, `сделан`, `исправлен`.
- Технические термины — как в коде: `GSAP`, `master timeline`,
  `SVGR`, `useGSAP`, `localStorage`, `react-router`.
- Без пустой строки между subject и body.
- Без `Co-authored-by`, `Signed-off-by`, ссылок на issue, эмодзи.
- Длина тела пропорциональна объёму изменений (1 пункт — мелкий фикс,
  4–6 пунктов — крупный коммит).

**Пример:**

```
LogoText
- доделал анимацию букв
- добавление в svg траектории для гвоздя
- синхронизировал тайминги букв и курсора
```
