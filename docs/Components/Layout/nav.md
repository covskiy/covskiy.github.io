# nav — презентационная часть (панель)

`src/components/layout/nav/` — панель навигации, часть layout. Компоненты
читают `mode`/`isSlim` (обычно пропом от `LayoutProvider`) и сами строят свои
`useGSAP`. Не импортируют `scenes/` и провайдер (кроме контекста через
`useLayout`).

## `NavigationBar.tsx`

Презентационная панель `<nav>`: логотип, `NavList`, `ToggleButton`. Позицией
`.nav` владеет сам через хук-сцену `useNavPosition` (единственный владелец:
discrete + scrub). Значения `isSlim`/`hasToggle` приходят пропом от
`LayoutProvider` (производные от `mode`/breakpoint).

- `const isMobile = useBreakpoint() === 'mobile'` — Placement кнопки: mobile
  fixed-сиблинг навбара (вне трансформированного `.nav`), tablet/inner и
  «едет» с краем.

Стили: `.nav` занимает `100vw`, видимая ширина достигается трансформацией
`x` (не `width`) — анимация на композиторе, без reflow при 60fps-scrub.

## `NavList.tsx` / `NavItem.tsx`

`<ul>` со ссылками. `NavItem` — per-component animator: при первом переходе
в slim (проп `isSlim`) делает fade-in иконки с подскоком (собственный
`useGSAP` + `useEffect([isSlim])` + prevRef). В slim-режиме текстовая метка не
рендерится, иконка центрируется, `tabIndex=-1`.

## `navItems.ts`

Конфиг ссылок: берёт `routes` из `routes.tsx` (единственный источник
path/label), отфильтровывает NotFound (`*`), навешивает иконку. Тип —
`NavItemConfig { path, label, icon: ReactNode }`.

## `ToggleButton.tsx`

Самостоятельная сцена ☰ / ←. Полностью владеет своей DOM-нодой: применяет
`gsap.set` видимости на `/home` через `useLayout().onToggleVisibility`. Клик
вызывает `useLayout().toggle()` напрямую. Рендер (глиф/aria) — на пропе
`isSlim`.
