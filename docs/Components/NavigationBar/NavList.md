# NavList (список ссылок)

Список ссылок навигации: `<NavList/>` рендерит `<ul>`, каждый пункт — дочерний
`<NavItem/>`. Конфиг пунктов (path/label/icon) — в `navItems.ts`.

Файлы: `src/components/NavigationBar/NavList/NavList.tsx`, `NavItem.tsx`,
`navItems.ts` (+ `.module.css`).

## navItems.ts — единственный источник правды

`path` и `label` деривируются от `routes.tsx` (отфильтрован `*`/NotFound),
`icon` навешивается через маппинг `Record<path, ReactNode>`:

```ts
import { routes } from '../../../routes';

const routeIcons: Record<string, ReactNode> = {
  '/': '🏠',
  '/about': 'ℹ️',
  '/services': '🛠️',
  '/contact': '📬',
};

export const navItems: NavItemConfig[] = routes
  .filter(
    (r): r is (typeof routes)[number] & { label: string } =>
      r.path !== '*' && typeof r.label === 'string',
  )
  .map((r) => ({
    path: r.path,
    label: r.label,
    icon: routeIcons[r.path] ?? '❓',
  }));
```

`icon` типизирован как `ReactNode` — замена emoji на `<HomeIcon />` не
потребует изменения интерфейсов, только замены значения в `routeIcons`
(см. раздел «Замена иконок»).

## NavItem — поведение `isSlim`

Проп `isSlim` фактически означает «навбар в свёрнутом состоянии» — он `true`
и для `slim`, и для `invisible`:

- `isSlim === false`: рендерится `<span class="label">{label}</span>` +
  `<span class="icon">{icon}</span>`.
- `isSlim === true`: текст `.label` не рендерится, иконка `.icon` центрируется
  (класс `styles.slim`), на `<NavLink>` вешается `tabIndex={-1}`, исключающий
  ссылку из Tab-навигации.

NavItem — также демо-сцена end-to-end: при первом переходе навбара в `slim`
иконка делает fade-in через `useNavbarEvent('state:change')` (см. `hooks.md`).

## CSS slim-режима

В `NavItem.module.css` переключение — через условный класс `styles.slim`:

```css
.slim {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 10px 0;
}

.slim .icon {
  font-size: var(--font-sizes-xl);
}
```

Текстовая метка `.label` не скрывается CSS — она просто не рендерится в JSX
(`{!isSlim && <span className={styles.label}>...}`).

## Замена иконок (emoji → React-компоненты)

Достаточно отредактировать `navItems.ts`:

```ts
const routeIcons: Record<string, ReactNode> = {
  '/':        <HomeIcon />,
  '/about':   <InfoIcon />,
  '/services':<ToolsIcon />,
  '/contact': <MailIcon />,
};
```

Остальные компоненты (NavItem, NavList, NavigationBar) изменений не требуют.
