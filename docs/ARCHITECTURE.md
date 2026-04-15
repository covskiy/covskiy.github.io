# Архитектура React SPA — Сайт-визитка

## 1. Дерево папок и файлов

```
covskiy.github.io/
├── .github/
│   └── workflows/
│       └── deploy.yml              # GitHub Actions: build + deploy to Pages
├── public/
│   ├── favicon.svg                 # Favicon
│   └── icons.svg                   # SVG-спрайт с иконками
├── src/
│   ├── assets/                     # Статические изображения
│   │   └── ...
│   ├── components/
│   │   ├── IntroAnimation/         # GSAP intro-анимация
│   │   │   ├── IntroAnimation.tsx
│   │   │   └── IntroAnimation.module.css
│   │   ├── VerticalNav/            # Фиксированный вертикальный navbar
│   │   │   ├── VerticalNav.tsx
│   │   │   └── VerticalNav.module.css
│   │   ├── BurgerMenu/             # Бургер-меню для мобильных (< 768px)
│   │   │   ├── BurgerMenu.tsx
│   │   │   └── BurgerMenu.module.css
│   │   └── PageTransition/         # Обёртка для анимации перехода между роутами
│   │       └── PageTransition.tsx  # useGSAP для анимаций (автоматический cleanup)
│   ├── pages/
│   │   ├── HomePage/               # Главная страница
│   │   │   ├── HomePage.tsx
│   │   │   └── HomePage.module.css
│   │   ├── AboutPage/              # Страница "О нас"
│   │   │   ├── AboutPage.tsx
│   │   │   └── AboutPage.module.css
│   │   ├── ServicesPage/           # Страница услуг
│   │   │   ├── ServicesPage.tsx
│   │   │   └── ServicesPage.module.css
│   │   └── ContactPage/            # Страница контактов
│   │       ├── ContactPage.tsx
│   │       └── ContactPage.module.css
│   ├── styles/
│   │   ├── typography.css          # Головной файл типографики (CSS-переменные, шрифты)
│   │   ├── reset.css               # Минимальный CSS reset
│   │   └── global.css              # Глобальные утилитарные стили (body, #root и т.д.)
│   ├── routes.tsx                  # Определение всех роутов (React Router)
│   ├── App.tsx                     # Корневой компонент (layout + Routes)
│   ├── App.module.css              # Стили layout App
│   ├── main.tsx                    # Entry point
│   └── index.css                   # Точка входа CSS (импортирует styles/*)
├── .editorconfig
├── .gitignore
├── .prettierrc.json
├── .prettierignore
├── eslint.config.js
├── .stylelintrc.json
├── .husky/
│   └── pre-commit                  # Husky → lint-staged
├── index.html
├── vite.config.ts
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.node.json
└── package.json
```

---

## 2. Схема потоков данных и навигации

### 2.1 Загрузка приложения

```
[main.tsx]
    │
    ├── render(<BrowserRouter><App /></BrowserRouter>)
    │
    ▼
[App.tsx]
    │
    ├── Mount → IntroAnimation (GSAP timeline)
    │       │
    │       ├── Анимация entrance (logo, текст, декоративные элементы)
    │       │
    │       └── onComplete → fade-out intro, show main content
    │
    └── После завершения intro:
            ├── VerticalNav (фиксированный, слева)
            └── <Routes> (основной контент)
```

### 2.2 Навигация между страницами

```
[VerticalNav] / [BurgerMenu]
    │
    ├── NavLink to="/about"  ──► React Router (client-side)
    │                               │
    │                               ▼
    │                         [PageTransition]
    │                               │
    │                               ├── GSAP: exit-анимация текущей страницы
    │                               ├── swap контента
    │                               ├── GSAP: entrance-анимация новой страницы
    │                               └── cleanup: kill/revert всех GSAP-таймлайнов
    │
    └── NavLink to="/"  ──► тот же поток
```

### 2.3 GSAP lifecycle

```
Component mount
    │
    ├── useGSAP hook (из @gsap/react)
    │       ├── Автоматически создаёт gsap.context()
    │       ├── Выполняет анимации
    │       └── Регистрирует cleanup при unmount
    │
    └── Все timeline/tween отслеживаются автоматически

Component unmount (route change)
    │
    └── useGSAP автоматически вызывает revert() — никаких утечек
```

---

## 3. Стратегия роутинга и защита от багов на GitHub Pages

### 3.1 Роутинг

- Используется **React Router v7** с **BrowserRouter**.
- Все роуты определены в отдельном файле `src/routes.tsx` — массив объектов `{ path, element }`, который импортируется в `App.tsx` и передаётся в `<Routes>`.
- Это обеспечивает единое место для управления маршрутами и упрощает добавление новых страниц.

```tsx
// routes.tsx — концепция
export const routes = [
  { path: '/', element: <HomePage /> },
  { path: '/about', element: <AboutPage /> },
  { path: '/services', element: <ServicesPage /> },
  { path: '/contact', element: <ContactPage /> },
];
```

### 3.2 Проблема GitHub Pages с BrowserRouter

GitHub Pages — статический хостинг. При прямом переходе на `/about` сервер отдаёт 404, т.к. файла `about/index.html` не существует.

**Стратегия защиты:**

1. **404.html redirect**: В `public/` создаётся `404.html` с минимальным JS-скриптом, который:
   - Считывает `sessionStorage` для сохранения запрошенного пути
   - Перенаправляет на `/?redirect=/about`
   - `main.tsx` при старте проверяет `redirect` в query-string и делает `navigate()` на нужный путь

### 3.3 Схема redirect

```
User → /about (direct link on GitHub Pages)
          │
          ▼
    GitHub Pages → 404
          │
          ▼
    404.html → sessionStorage.setItem('redirect', '/about')
            → location.replace('/')
          │
          ▼
    index.html → main.tsx
            → check ?redirect or sessionStorage
            → navigate('/about')
```

---

## 4. Стратегия стилизации и переиспользования компонентов

### 4.1 CSS Modules

- Каждый компонент получает собственный `.module.css` файл для scoped-стилей.
- Это гарантирует изоляцию стилей и предотвращает конфликты имён.
- Имена классов генерируются Vite автоматически (хеш-суффиксы).

### 4.2 Головной файл типографики

- `src/styles/typography.css` — содержит все CSS-переменные для шрифтов, цветов, размеров текста, медиа-запросы.
- Переносит существующие переменные из текущего `index.css` (цвета, шрифты, dark mode).
- Подключается через `@import` в `src/styles/reset.css` → `src/styles/global.css` → `src/index.css`.

### 4.3 Глобальные стили

- `src/styles/reset.css` — минимальный reset (margin, padding, box-sizing).
- `src/styles/global.css` — стили для `body`, `#root`, `h1`–`h2`, `p`, `code` — то, что должно быть глобально.
- `src/index.css` — точка входа, импортирует все вышеперечисленное.

### 4.4 Переиспользование компонентов

| Компонент        | Повторное использование                   |
| ---------------- | ----------------------------------------- |
| `VerticalNav`    | На всех страницах, fixed position         |
| `BurgerMenu`     | Только на мобильных, заменяет VerticalNav |
| `PageTransition` | Обёртка вокруг каждого `<Page>` в роутах  |
| `IntroAnimation` | Одноразовый, при первом монтировании App  |

### 4.5 Responsive breakpoint

- **768px** — ключевой breakpoint для переключения VerticalNav → BurgerMenu.
- Используется `@media (width < 768px)` внутри CSS Modules компонентов.
- Все остальные media-запросы наследуются из typography.css.

---

## 5. План code-splitting / lazy loading роутов

### 5.1 Стратегия

- **HomePage** — загружается eagerly (критичен для первого впечатления).
- **Все остальные страницы** — `React.lazy()` + `Suspense` для code-splitting по роутам.
- Vite автоматически создаёт отдельные чанки для каждого lazy-модуля.
- GSAP и `@gsap/react` подключаются как глобальные зависимости (не lazy), т.к. используются в нескольких компонентах.

### 5.2 Реализация в `routes.tsx`

```tsx
import { lazy, Suspense } from 'react';
import type { ReactNode } from 'react';

const AboutPage = lazy(() => import('./pages/AboutPage/AboutPage'));
const ServicesPage = lazy(() => import('./pages/ServicesPage/ServicesPage'));
const ContactPage = lazy(() => import('./pages/ContactPage/ContactPage'));

// HomePage — eagerly loaded
import HomePage from './pages/HomePage/HomePage';

function LazyFallback() {
  return <div className="loading">Загрузка...</div>;
}

export const routes = [
  { path: '/', element: <HomePage /> },
  {
    path: '/about',
    element: (
      <Suspense fallback={<LazyFallback />}>
        <AboutPage />
      </Suspense>
    ),
  },
  {
    path: '/services',
    element: (
      <Suspense fallback={<LazyFallback />}>
        <ServicesPage />
      </Suspense>
    ),
  },
  {
    path: '/contact',
    element: (
      <Suspense fallback={<LazyFallback />}>
        <ContactPage />
      </Suspense>
    ),
  },
];
```

### 5.3 Ожидаемые чанки (production build)

```
dist/
├── index.html
├── assets/
│   ├── index-[hash].css          # Global CSS (typography, reset, global)
│   ├── index-[hash].js           # main + App + VerticalNav + IntroAnimation
│   ├── HomePage-[hash].js        # HomePage (eager, в основном чанке)
│   ├── AboutPage-[hash].js       # lazy chunk
│   ├── ServicesPage-[hash].js    # lazy chunk
│   ├── ContactPage-[hash].js     # lazy chunk
│   └── vendor-[hash].js          # react, react-dom, react-router, gsap
```

---

## 6. GSAP: стратегия анимаций

### 6.1 Intro-анимация

- Компонент `IntroAnimation` монтируется один раз при загрузке `App`.
- Использует хук `useGSAP` из `@gsap/react` — автоматически создаёт контекст и управляет очисткой.
- Для однократной анимации используется `{ dependencies: [] }` (пустой массив зависимостей).
- После завершения — callback, который устанавливает флаг `showMain = true` в `App` (локальный state).
- Cleanup выполняется автоматически при unmount компонента.

### 6.2 Page transitions

- `PageTransition` — компонент-обёртка, принимает `children` (страницу).
- Использует `useGSAP` для entrance-анимации (fade-in, slide-in).
- При unmount `useGSAP` автоматически вызывает `revert()` — никаких дополнительных cleanup-функций не требуется.
- Для exit-анимаций используется комбинация `useGSAP` с `dependencies: [location.pathname]` и `revertOnUpdate: true`.

### 6.3 Рекомендуемый паттерн useGSAP

```tsx
import { useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

// Регистрацияция хука (один раз в проекте)
gsap.registerPlugin(useGSAP);

function AnimatedComponent() {
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      // Все GSAP-анимации здесь — автоматически очищаются при unmount
      gsap.from('.element', { opacity: 0, y: 20, duration: 0.6 });
    },
    { scope: containerRef },
  );

  return <div ref={containerRef}>...</div>;
}
```

**Ключевые преимущества:**

- Не нужно вручную вызывать `gsap.context()` и `ctx.revert()`
- Автоматическая очистка при unmount компонента
- Опция `scope` ограничивает селекторы потомками указанного элемента
- `dependencies` + `revertOnUpdate: true` для реактивных анимаций

---

## 7. Конфигурационные файлы

### 7.1 `vite.config.ts`

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  base: '/covskiy.github.io/', // GitHub Pages repo name
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router', 'gsap', '@gsap/react'],
        },
      },
    },
  },
  server: {
    port: 3005,
    host: '0.0.0.0',
  },
  css: {
    transformer: 'lightningcss',
  },
});
```

**Ключевые изменения:**

- `base` — путь для GitHub Pages (имя репозитория).
- `manualChunks.vendor` — вынос react + gsap в отдельный чанк.

### 7.2 `eslint.config.js`

```js
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['dist', 'node_modules'] },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: globals.browser,
    },
    plugins: {
      react,
      'react-hooks': reactHooks,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...tseslint.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off', // React 17+ не требует импорта
    },
  },
);
```

### 7.3 `.prettierrc.json`

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 80,
  "tabWidth": 2,
  "endOfLine": "lf"
}
```

### 7.4 `.stylelintrc.json`

```json
{
  "extends": "stylelint-config-standard",
  "rules": {
    "selector-class-pattern": null
  }
}
```

**Примечание:** `selector-class-pattern: null` отключён, т.к. CSS Modules генерирует хешированные имена классов, которые не соответствуют стандартному kebab-case.

### 7.5 `.husky/pre-commit`

```sh
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

npx lint-staged
```

### 7.6 `lint-staged` (в `package.json`)

```json
{
  "lint-staged": {
    "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
    "*.css": ["stylelint --fix", "prettier --write"]
  }
}
```

### 7.7 `.github/workflows/deploy.yml`

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

### 7.8 `public/404.html`

```html
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Redirecting...</title>
    <script>
      const path = location.pathname;
      if (path !== '/') {
        sessionStorage.setItem('redirect', path);
        const redirect = '/covskiy.github.io/?r=' + encodeURIComponent(path);
        location.replace(redirect);
      }
    </script>
  </head>
  <body>
    <p>Redirecting to SPA...</p>
  </body>
</html>
```

### 7.9 `main.tsx` — обработка redirect

```tsx
import { useEffect } from 'react';
import { useNavigate } from 'react-router';

// При старте проверяем sessionStorage / query param
function AppWithRedirect() {
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const redirect = params.get('r') || sessionStorage.getItem('redirect');
    if (redirect) {
      sessionStorage.removeItem('redirect');
      navigate(redirect, { replace: true });
    }
  }, [navigate]);

  return <App />;
}
```

---

## 8. Итоговая структура зависимостей

| Пакет                         | Назначение                                               |
| ----------------------------- | -------------------------------------------------------- |
| `react`                       | UI library                                               |
| `react-dom`                   | DOM rendering                                            |
| `react-router`                | Client-side routing                                      |
| `gsap`                        | Animations (intro + page transitions)                    |
| `@gsap/react`                 | React hook (`useGSAP`) для GSAP с автоматическим cleanup |
| `vite`                        | Build tool + dev server                                  |
| `@vitejs/plugin-react`        | React + HMR                                              |
| `typescript`                  | Type safety                                              |
| `eslint` + plugins            | Linting                                                  |
| `prettier`                    | Formatting                                               |
| `stylelint` + config-standard | CSS linting                                              |
| `husky`                       | Git hooks                                                |
| `lint-staged`                 | Pre-commit checks                                        |
| `lightningcss`                | CSS transform + minify                                   |
