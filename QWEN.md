# Project Context: covskiy.github.io

## Project Overview

This is a **React + TypeScript + Vite** web application, deployed via GitHub Pages (inferred from the repository name `covskiy.github.io`). It serves as a base/starter project for assembling libraries, configuring tooling (linters, formatters, pre-commit hooks), and deploying to a hosting service.

The project features:
- **React 19** with React Router for client-side routing
- **TypeScript** for type safety
- **Vite** as the build tool and dev server (with HMR)
- **LightningCSS** for CSS transformation and minification
- A pre-configured code quality pipeline: ESLint, Prettier, Stylelint, lint-staged, and Husky pre-commit hooks

### Routing Structure

| Route | Component | Description |
|-------|-----------|-------------|
| `/` | `Clicker` | Home page with a counter demo |
| `/info` | `Info` | Info page (described as "Базовый проект") |
| `/home` | Redirects to `/` | |
| `/*` | `RouteError` | 404 fallback |

## Key Directories & Files

| Path | Description |
|------|-------------|
| `src/App.tsx` | Main application component with routing and UI |
| `src/main.tsx` | Entry point — renders App into `#root` with `BrowserRouter` |
| `src/index.css` / `src/App.css` | Styles |
| `src/assets/` | Static assets (React, Vite, hero images) |
| `public/` | Static public assets (favicon, icons SVG sprite) |
| `vite.config.ts` | Vite configuration (port 3005, LightningCSS, code splitting) |
| `eslint.config.js` | ESLint flat config |
| `.prettierrc.json` / `.stylelintrc.json` | Prettier and Stylelint configs |
| `.husky/pre-commit` | Pre-commit hook running `lint-staged` |

## Building and Running

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server on port 3005 with HMR |
| `npm run build` | Type-check (`tsc -b`) then build for production (`vite build`) |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run ESLint on all files |
| `npm run lint:fix` | Run ESLint and auto-fix issues |
| `npm run format` | Run Prettier check |
| `npm run format:fix` | Run Prettier and auto-format |
| `npm run stylelint` | Run Stylelint on CSS files |
| `npm run stylelint:fix` | Run Stylelint and auto-fix CSS |
| `npm run precommit:check` | Run lint-staged manually |

## Development Conventions

- **Pre-commit hooks**: Husky + lint-staged automatically run ESLint and Prettier on staged `.ts/.tsx` files, and Stylelint on staged `.css` files before each commit.
- **Linting**: ESLint with TypeScript, React, and React Hooks plugins. Prettier config is integrated to avoid lint/format conflicts.
- **Formatting**: Prettier with project defaults (see `.prettierrc.json`).
- **CSS**: Stylelint with `stylelint-config-standard` for stylesheet linting.
- **CSS Targets**: `baseline 2020` via LightningCSS (configured in `vite.config.ts`).
- **TypeScript**: Project references setup (`tsconfig.json` → `tsconfig.app.json` + `tsconfig.node.json`).

## Dependencies

- **Runtime**: `react`, `react-dom`, `react-router`
- **Dev**: `vite`, `@vitejs/plugin-react`, `typescript`, `eslint`, `prettier`, `stylelint`, `husky`, `lint-staged`, `lightningcss`

## Notes

- The project title in `index.html` is currently `vite-react` — likely a placeholder to update.
- The dev server is configured to listen on port **3005** and bind to `0.0.0.0` (accessible from network).
- Vendor code splitting is configured to bundle `node_modules` into a separate `vendor` chunk.
