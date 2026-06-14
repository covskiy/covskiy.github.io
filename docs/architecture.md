# Архитектура React SPA — Сайт-визитка

React 19 + TypeScript + Vite SPA, деплой на GitHub Pages. Сайт-визитка с
GSAP-анимациями, design-tokens через style-dictionary, splash screen при
первом заходе и системой preloader.

> Содержимое этого файла пересматривается вместе с кодом. При расхождениях
> с реальным кодом — приоритет у кода. Этот документ фиксирует **как устроено**
> проект сейчас, а не план.

> Этот файл — обзор архитектуры. Детали реализации (Splash-хореография,
> работа с design tokens, конфиги) вынесены в `docs/Pages/SplashPage.md`,
> `docs/design-tokens.md` и `docs/Components/`.

---

## Соглашения по написанию кода

Канонические паттерны проекта. Перед написанием нового кода — ознакомься
с этими правилами. Отступления должны быть обоснованы.

- **useGSAP** для анимаций — канонический паттерн GSAP в React
  (см. § 6.2). Не использовать ручной `gsap.context()` / `ctx.revert()` —
  хук `useGSAP` из `@gsap/react` делает это автоматически.
- **logger** для любого кода — единый стиль логирования: module tag
  первым аргументом, выбор уровня по ситуации, без raw `console.log`
  рядом с `logger.*`. Подробные правила и антипаттерны —
  `docs/logging-rules.md`, API — `docs/utils/logger.md`.

---

## 1. Дерево папок и файлов

```
covskiy.github.io/
├── .github/
│   └── workflows/
│       └── deploy.yml                # GitHub Actions: build + deploy to Pages
├── .husky/
│   └── pre-commit                    # Хук: npx lint-staged
├── design-tokens/                    # JSON-токены для style-dictionary
│   ├── breakpoints.json
│   ├── colors.json
│   ├── shadows.json
│   ├── sizing.json
│   ├── spacing.json
│   ├── transition.json
│   └── typography.json
├── docs/                             # Подробная документация
│   ├── architecture.md               # ← этот файл
│   ├── logging-rules.md
│   ├── design-tokens.md
│   ├── preloader.md
│   ├── Components/
│   │   ├── Logo.md
│   │   ├── LogoText.md
│   │   └── Tagline.md
│   ├── Pages/
│   │   └── SplashPage.md
│   └── utils/
│       └── logger.md
├── public/                           # Статические ассеты, отдаются как есть
│   ├── favicon.svg
│   └── icons.svg
├── src/
│   ├── assets/                       # Изображения, SVG-исходники Intro/
│   │   ├── anvil_sm.svg
│   │   ├── drawing.svg
│   │   ├── hero.svg
│   │   ├── hummer.svg
│   │   ├── keyboard_orig.svg
│   │   ├── react.svg
│   │   ├── vite.svg
│   │   └── Intro/                    # SVG-исходники для Intro-компонентов
│   ├── components/
│   │   ├── index.ts                  # Barrel-экспорт
│   │   ├── Logo/                     # Наковальня (drawSVG)
│   │   │   ├── Logo.tsx
│   │   │   ├── Logo.module.css
│   │   │   ├── anvil_md.svg
│   │   │   └── index.ts
│   │   ├── LogoText/                 # Текст "COVSKIY" (SVG morph)
│   │   │   ├── LogoText.tsx
│   │   │   ├── LogoText.module.css
│   │   │   ├── LogoText.svg
│   │   │   └── index.ts
│   │   ├── Tagline/                  # Клавиатура (split + keyframes)
│   │   │   ├── Tagline.tsx
│   │   │   ├── Tagline.module.css
│   │   │   ├── keyboard.svg
│   │   │   └── index.ts
│   │   ├── SkipControls/             # Кнопки skip / never-show
│   │   │   ├── SkipControls.tsx
│   │   │   ├── SkipControls.module.css
│   │   │   └── index.ts
│   │   ├── VerticalNav/              # Десктоп-навигация (фикс. слева)
│   │   │   ├── VerticalNav.tsx
│   │   │   └── VerticalNav.module.css
│   │   ├── BurgerMenu/               # Мобильная навигация
│   │   │   ├── BurgerMenu.tsx
│   │   │   └── BurgerMenu.module.css
│   │   └── PageTransition/           # Обёртка анимации смены роута
│   │       └── PageTransition.tsx
│   ├── pages/
│   │   ├── SplashPage/               # Splash screen (блокирует UI до onComplete)
│   │   │   ├── SplashPage.tsx
│   │   │   ├── SplashPage.module.css
│   │   │   ├── splashChoreography.ts
│   │   │   ├── index.ts
│   │   │   ├── hooks/
│   │   │   │   ├── useSplashSkip.ts
│   │   │   │   └── index.ts
│   │   │   └── utils/
│   │   │       ├── splashStorage.ts
│   │   │       └── index.ts
│   │   ├── HomePage/
│   │   ├── AboutPage/
│   │   ├── ServicesPage/
│   │   └── ContactPage/
│   ├── styles/                       # Ручные: reset, global
│   │   ├── reset.css                 # ← ручной
│   │   ├── global.css                # ← ручной (импортирует все токен-файлы)
│   │   ├── breakpoints.css           # ← сгенерирован style-dictionary
│   │   ├── colors.css                # ← сгенерирован
│   │   ├── shadows.css               # ← сгенерирован
│   │   ├── sizing.css                # ← сгенерирован
│   │   ├── spacing.css               # ← сгенерирован
│   │   ├── transitions.css           # ← сгенерирован
│   │   └── typography.css            # ← сгенерирован
│   ├── types/
│   │   ├── index.ts
│   │   └── splash.types.ts
│   ├── utils/
│   │   ├── initGsap.ts               # Регистрация всех GSAP-плагинов
│   │   └── logger.ts                 # Модульный логгер
│   ├── App.tsx                       # SplashPage → layout (Nav + Routes)
│   ├── App.css                       # Устаревший (используется редко)
│   ├── App.module.css                # Стили layout App
│   ├── routes.tsx                    # Все роуты + lazy-обёртки
│   ├── main.tsx                      # Entry: BrowserRouter + debug-хелперы
│   ├── index.css                     # CSS entry: reset + global
├── .editorconfig
├── .gitattributes
├── .gitignore
├── .prettierrc.json
├── .prettierignore
├── .stylelintrc.json
├── eslint.config.js                  # ESLint flat config
├── index.html                       # Inline preloader + #root
├── LICENSE
├── README.md
├── package.json
├── package-lock.json
├── sd.config.js                      # Конфиг style-dictionary
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.node.json
└── vite.config.ts
```

---

## 2. Потоки данных и навигация

### 2.1 Загрузка приложения

```
[index.html]
  └─ inline preloader (CSS+JS), performance.getEntriesByType('resource')
  └─ <div id="root"></div>
  └─ <script type="module" src="/src/main.tsx"></script>

[main.tsx]
  ├─ window.hidePreloader()                  ← сразу после загрузки модуля
  ├─ DEV: window.splashDebug / loggerDebug   ← devtools helpers
  └─ createRoot().render(<BrowserRouter><App /></BrowserRouter>)

[App.tsx]
  ├─ initGsap()                              ← на модульном уровне (top-level)
  └─ useState: showSplash = pathname === '/' && !splashStorage.getNeverShow()
       ├─ showSplash === true  →  <SplashPage onComplete skipDelay=800 />
       │                            │
       │                            ├─ master GSAP timeline (paused → play)
       │                            ├─ child timelines (Logo/LogoText/Tagline)
       │                            │   регистрируются через onRegisterTimeline
       │                            ├─ LogoText и Tagline синхронизированы:
       │                            │   подсветка клавиш в Tagline совпадает
       │                            │   с появлением букв в LogoText
       │                            │   (общий источник — SPLASH_CHOREOGRAPHY)
       │                            ├─ GSDevTools.create() (только DEV)
       │                            └─ onComplete → setShowSplash(false)
       │
       └─ showSplash === false →  layout
            ├─ <VerticalNav />
            ├─ <BurgerMenu />
            └─ <main>
                 └─ <Routes>
                      └─ каждая route обёрнута в <PageTransition>
```

### 2.2 Навигация между страницами

```
[VerticalNav / BurgerMenu]
  └─ NavLink to="/home" | "/about" | "/services" | "/contact"
        └─ React Router (client-side)
              └─ <PageTransition> (useGSAP entrance-анимация)
                    └─ page component (eager или lazy)
```

`PageTransition` использует `useGSAP` с `scope` и `dependencies: [pathname]`,
`revertOnUpdate: true` — анимации автоматически откатываются при смене роута.

### 2.3 GSAP lifecycle

```
Component mount
  └─ useGSAP(() => { ... }, { scope, dependencies })
        ├─ Автоматически создаёт gsap.context()
        ├─ Выполняет анимации
        └─ Регистрирует cleanup при unmount

Component unmount (route change / re-render)
  └─ useGSAP автоматически вызывает revert() — без утечек
```

---

## 3. Роутинг и GitHub Pages

### 3.1 Роутинг

- **React Router v7** с `BrowserRouter`.
- Все роуты определены в `src/routes.tsx` — массив `RouteObject[]`.
- Роут `/` НЕ в `routes.tsx` — перехватывается в `App.tsx` (splash screen).
- `*` — inline 404 (заглушка в `routes.tsx`).

```ts
// src/routes.tsx (концепция)
const AboutPage    = lazy(() => import('./pages/AboutPage/AboutPage'));
const ServicesPage = lazy(() => import('./pages/ServicesPage/ServicesPage'));
const ContactPage  = lazy(() => import('./pages/ContactPage/ContactPage'));

function withSuspense(element: ReactNode) {
  return <Suspense fallback={<LazyFallback />}>{element}</Suspense>;
}

export const routes: RouteObject[] = [
  { path: '/home',     element: <HomePage /> },         // eager
  { path: '/about',    element: withSuspense(<AboutPage />) },
  { path: '/services', element: withSuspense(<ServicesPage />) },
  { path: '/contact',  element: withSuspense(<ContactPage />) },
  { path: '*',         element: <NotFound /> },         // inline 404
];
```

### 3.2 Проблема прямых ссылок на GitHub Pages

GitHub Pages — статический хостинг. При прямом переходе на `/about` сервер
не находит `about/index.html` и отдаёт 404.

**Решение (без `public/404.html`):** в `deploy.yml` после `vite build`
выполняется `cp dist/index.html dist/404.html`. GitHub Pages отдаёт
`404.html` на любой неизвестный путь, а это копия `index.html` —
BrowserRouter читает URL уже на клиенте и рендерит нужный роут.

---

## 4. Стилизация и переиспользование компонентов

### 4.1 CSS Modules

- Каждый компонент имеет свой `.module.css` (scoped-стили).
- Vite генерирует хешированные имена классов.

### 4.2 Глобальные стили

- `src/index.css` — точка входа CSS, импортирует `styles/reset.css` →
  `styles/global.css`.
- `styles/global.css` — `@import` всех сгенерированных токен-файлов
  (`breakpoints`, `colors`, `shadows`, `sizing`, `spacing`, `transitions`,
  `typography`) + стили `body`, `#root`, `h1`, `h2`, `p`, `code`.
- `styles/reset.css` — минимальный reset.

### 4.3 Трансформация CSS

- `vite.config.ts`: `css.transformer: 'lightningcss'`,
  `css.lightningcss.targets: browserslistToTargets(browserslist('baseline 2020'))`,
  `build.cssMinify: 'lightningcss'`.

### 4.4 Компоненты

| Компонент        | Назначение                                |
| ---------------- | ----------------------------------------- |
| `Logo`           | Наковальня, drawSVG (Intro)               |
| `LogoText`       | Текст "COVSKIY" — SVG morph между формами |
| `Tagline`        | Слоган — клавиатура, поэтапная анимация   |
| `SkipControls`   | Кнопки skip / never-show для Splash       |
| `VerticalNav`    | Десктоп-навигация (фикс. слева)           |
| `BurgerMenu`     | Мобильная навигация                       |
| `PageTransition` | Обёртка анимации смены роута              |
| `SplashPage`     | Splash screen (conditional render в App)  |

Подробности по `Logo` / `LogoText` / `Tagline` — в `docs/Components/`.
Подробности по `SplashPage` — в `docs/Pages/SplashPage.md`.

### 4.5 Responsive breakpoint

- Брейкпоинты — токены в `design-tokens/breakpoints.json`:
  `phone` (0), `tablet` (481px), `laptop` (769px), `desktop` (1025px).
- В коде сейчас используется `@media (width <= 1024px)` в CSS Modules
  (mobile-first базовые стили в `<= 1024`, десктоп-override не задаётся).
- Переключение `VerticalNav` ↔ `BurgerMenu` — в коде компонентов
  (через CSS media query).

---

## 5. Code-splitting / lazy loading

### 5.1 Стратегия

- `HomePage` — **eagerly** (нужен для первого рендера после splash).
- `AboutPage` / `ServicesPage` / `ContactPage` — `React.lazy()` + `Suspense`
  через хелпер `withSuspense()` в `routes.tsx`.
- GSAP и `@gsap/react` — глобальные зависимости, попадают в `vendor` чанк.

### 5.2 vendor chunk

`vite.config.ts`:

```ts
build: {
  rolldownOptions: {
    output: {
      codeSplitting: {
        groups: [
          { test: /node_modules/, name: 'vendor', priority: 10 },
        ],
      },
    },
  },
}
```

### 5.3 Ожидаемые чанки (production)

```
dist/
├── index.html
├── 404.html                          # копия index.html (см. § 3.2)
├── assets/
│   ├── index-[hash].css              # Global CSS (reset + global + tokens)
│   ├── index-[hash].js               # main + App + SplashPage + eager Pages
│   ├── HomePage-[hash].js            # eager, в основном чанке
│   ├── AboutPage-[hash].js           # lazy chunk
│   ├── ServicesPage-[hash].js        # lazy chunk
│   ├── ContactPage-[hash].js         # lazy chunk
│   └── vendor-[hash].js              # react, react-dom, react-router, gsap
```

---

## 6. GSAP

### 6.1 Регистрация плагинов

Все плагины регистрируются **один раз** в `src/utils/initGsap.ts`:
`useGSAP`, `ScrollTrigger`, `SplitText`, `MorphSVGPlugin`, `DrawSVGPlugin`,
`MotionPathPlugin`. Вызов — на модульном уровне в `App.tsx`
(`initGsap()` при импорте модуля).

`GSDevTools` подключается отдельно в `SplashPage.tsx`
(`gsap.registerPlugin(GSDevTools)` + `GSDevTools.create({ animation: master })`),
только в `import.meta.env.DEV`.

### 6.2 useGSAP

`useGSAP(() => { ... }, { scope, dependencies })` из `@gsap/react` —
канонический паттерн анимаций в проекте. Преимущества:

- Автоматически создаёт `gsap.context()`.
- Cleanup при unmount — `revert()`.
- `scope` ограничивает селекторы потомками ref.
- `dependencies` + `revertOnUpdate: true` для реактивных анимаций.

### 6.3 Splash-хореография

`SplashPage` собирает **master-timeline** из фрагментов дочерних
компонентов (`Logo`, `LogoText`, `Tagline`) через callback
`onRegisterTimeline(timeline, position)`. После завершения master
вызывает `onComplete()` → `App` снимает splash-экран.

Skip-логика — хук `useSplashSkip(timeline, onSkip, skipDelay)`. В текущем
коде хук закомментирован (`shouldBypass = false` в `SplashPage.tsx`) —
оставлено на доработку.

**Подробности хореографии и полный код:** `docs/Pages/SplashPage.md`.

---

## 7. Design Tokens

Источник — `design-tokens/*.json` (7 файлов), сборка — `style-dictionary`
через `sd.config.js` → `src/styles/*.css`. Custom transforms
`attribute/gradient-to-css` и `value/px-to-rem-conditional`,
маппинг категория → файл, формат градиентов и команда сборки —
**в `docs/design-tokens.md`**.

---

## 8. Утилиты

### 8.1 `initGsap.ts`

Описан в § 6.1.

### 8.2 `splashStorage`

`src/pages/SplashPage/utils/splashStorage.ts` — обёртка над `localStorage`
ключом `splash_never_show`, тип `SplashStorageData` в
`src/types/splash.types.ts`.

### 8.3 `logger.ts`

`src/utils/logger.ts` — модульный логгер с цветными тегами.

- API: `logger.{error, warn, info, debug, trace}(module, ...args)`.
- Первый аргумент — тег модуля (PascalCase для компонентов, camelCase для утилит).
- Уровень управляется через `localStorage.loggerLevel` или
  `window.loggerDebug.setLevel()` (см. § 9).

**Подробности и соглашения:** `docs/logging-rules.md`, `docs/utils/logger.md`.

---

## 9. Dev debug helpers

Только в `import.meta.env.DEV` (`src/main.tsx`).

### 9.1 `window.splashDebug`

| Метод         | Действие                                                  |
| ------------- | --------------------------------------------------------- |
| `reset()`     | `splashStorage.clearFlag()` + reload (splash покажется)   |
| `forceShow()` | `setNeverShow(false)` + reload                            |
| `forceHide()` | `setNeverShow(true)` + reload (splash не покажется)       |
| `status()`    | `console.log('neverShow:', splashStorage.getNeverShow())` |

### 9.2 `window.loggerDebug`

| Метод             | Действие                                                   |
| ----------------- | ---------------------------------------------------------- |
| `setLevel(level)` | Установить уровень (`error`/`warn`/`info`/`debug`/`trace`) |
| `reset()`         | Сбросить на `debug` (дефолт)                               |
| `status()`        | `Level: <active> \| localStorage: <value>`                 |
| `levels()`        | Таблица всех уровней с их `weight`                         |

---

## 10. Конфигурация (ключевые решения)

### 10.1 Vite

`vite-plugin-svgr` + кастомный `svgoConfig` нужен, чтобы SVGO не вырезал
скрытые элементы (`removeHiddenElems.displayNone: false`) и не
переименовывал ID (`cleanupIds: false`) — это ломает morph-пути
в `Logo`/`LogoText`. `cleanupAttrs: false` — чтобы сохранять `class`
у импортируемых SVG.

Полный конфиг — в `vite.config.ts`.

### 10.2 ESLint

Flat-config с type-checked правилами: `@eslint/js` recommended +
`typescript-eslint` `recommendedTypeChecked`/`stylisticTypeChecked` +
`eslint-plugin-react` (`recommended` + `jsx-runtime`) +
`eslint-plugin-react-hooks` + `eslint-plugin-react-refresh` (Vite preset) +
`eslint-config-prettier/flat` в конце цепочки.

`parserOptions.project: ['./tsconfig.node.json', './tsconfig.app.json']`.

Полный конфиг — в `eslint.config.js`.

### 10.3 Prettier / Stylelint

`selector-class-pattern: null` в stylelint — CSS Modules генерируют
хешированные имена, не подходящие под kebab-case.

### 10.4 Husky + lint-staged

`.husky/pre-commit` → `npx lint-staged` → для `*.{ts,tsx}`:
`npm run lint:staged` (`eslint --fix`) + `npm run format:staged`
(`prettier --write`); для `*.css`: `npm run stylelint:staged`
(`stylelint --fix`).

### 10.5 Deploy

`.github/workflows/deploy.yml` — Node `24.12.0`, `npm ci` →
`npm run build` → `cp dist/index.html dist/404.html` →
`actions/configure-pages@v5` → `upload-pages-artifact@v3` →
`deploy-pages@v4`. CI/CD-сводка — в `AGENTS.md`.

---

## 11. Сводка файлов — быстрый поиск

| Задача                       | Файл                                          |
| ---------------------------- | --------------------------------------------- |
| Точка входа JS               | `src/main.tsx`                                |
| Корневой компонент           | `src/App.tsx`                                 |
| Все роуты                    | `src/routes.tsx`                              |
| Splash screen                | `src/pages/SplashPage/SplashPage.tsx`         |
| Splash storage               | `src/pages/SplashPage/utils/splashStorage.ts` |
| Skip-логика                  | `src/pages/SplashPage/hooks/useSplashSkip.ts` |
| Splash типы                  | `src/types/splash.types.ts`                   |
| GSAP-инициализация           | `src/utils/initGsap.ts`                       |
| Логгер                       | `src/utils/logger.ts`                         |
| Design tokens build          | `sd.config.js`                                |
| Design tokens источник       | `design-tokens/*.json`                        |
| Design tokens (документация) | `docs/design-tokens.md`                       |
| Сгенерированные токены       | `src/styles/*.css`                            |
| Preloader HTML               | `index.html`                                  |
| Vite config                  | `vite.config.ts`                              |
| ESLint config                | `eslint.config.js`                            |
| Deploy CI                    | `.github/workflows/deploy.yml`                |
| Husky hook                   | `.husky/pre-commit`                           |
| Скрипты npm                  | `package.json`                                |
| Обзор проекта (для AI)       | `AGENTS.md`                                   |
