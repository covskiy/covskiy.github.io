# Layout — машина состояния + per-component animator

Layout-модуль (`src/components/layout/`) — движок раскладки всей страницы:
навбар (`fixed`) + контентная область `<main>`, модель построена на принципе
**один источник состояния + каждый компонент сам строит свою анимацию**:

```
LayoutProvider (useState<LayoutMode>; триггер-эффекты; низкоуровневые каналы)
   ├─ mode ───────── derive ── mainOffset / hasToggle / isSlim
   ├─ NavigationBar (панель): useLayout()
   │    ├─ NavPosition: единственный владелец .nav (scrub + discrete)
   │    │    └─ один низкоуровневый канал onNavState(prev,next,source) для .nav
   │    ├─ NavList/NavItem: useLayout() → собственный useGSAP(deps:[mode])
   │    └─ ToggleButton: клик → layout.toggle()
   ├─ <main>: offset = deriveMainOffset(mode)   (--nav-content-offset)
   └─ onScrollProgress / onToggleVisibility — низкоуровневые каналы
```

## Структура

```
src/components/layout/
├── index.ts                          # публичный API модуля
├── LayoutProvider/
│   ├── LayoutProvider.tsx            # машина: state-мост, триггер-эффекты, каналы, разметка nav+main
│   ├── LayoutProvider.module.css     # .app, .main (--nav-content-offset)
│   └── LayoutContext.ts              # LayoutContextValue + useLayout()
├── machine/                          # ЧИСТАЯ логика — без React и GSAP
│   ├── layoutMode.ts                 # LayoutMode, LayoutChangeSource
│   ├── geometry.ts                   # SLIM_WIDTH, getNavTransform, deriveMainOffset
│   └── derive.ts                     # getDefaultState, getNextState, homeEndStateFor,
│                                     #   isPreferredStateValid, hasToggleFor, isManualMobileState, isHomePath
├── scenes/                           # React-хуки-сцены (по одной ответственности)
│   ├── useLayoutState.ts             # состояние + applyState + preferredRef + getHomeEndState
│   ├── useLayoutToggle.ts            # ручной toggle
│   ├── useScrollScrub.ts             # ScrollTrigger, границы спейсера, 60fps-каналы, видимость toggle
│   └── useNavPosition.ts             # единственный владелец позиции .nav (scrub + discrete)
└── nav/                              # презентационная часть (панель = часть layout)
    ├── NavigationBar.tsx             # <nav> + компоновка (лого, NavList, ToggleButton)
    ├── NavigationBar.module.css
    ├── NavList.tsx
    ├── NavList.module.css
    ├── NavItem.tsx
    ├── NavItem.module.css
    ├── navItems.ts                   # конфиг ссылок (path/label/icon)
    ├── ToggleButton.tsx
    └── ToggleButton.module.css
```

## Правила развязки (кто что знает)

Однонаправленные зависимости: `nav → context → scenes → machine`; провайдер —
наверху.

- **`machine/`** — pure, без React и GSAP. Только типы и хелперы.
- **`scenes/`** — импортируют `machine` + контекст; **не** импортируют панели
  `nav/`. Каждая сцена владеет своей областью (state / toggle / scroll /
  позиция `.nav`).
- **`nav/`** — читают из контекста `mode`/`isSlim` (или получают пропом),
  строят свои `useGSAP`; не импортируют `scenes/` и провайдер.
- **`LayoutProvider`** — единственный, кто знает обе стороны: собирает сцены,
  держит низкоуровневые каналы, рендерит `nav` + `<main>`.

## Что удалено в ходе рефакторинга

| Что                                                                             | Причина            |
| ------------------------------------------------------------------------------- | ------------------ |
| `navbarEventBus.ts`, `NavbarEventMap`, `createNavbarEventBus`, `useNavbarEvent` | слой pub/sub убран |
| `spacer:enter` / `spacer:leave`                                                 | нет потребителей   |
| `'intro'` в источнике изменения                                                 | мёртвый reserved   |
| `events`/`bus` в публичном API                                                  | механика шины      |

### Как вернуть (для будущих сессий)

- **`spacer:enter/leave`**: одна дискретная подписка на «спейсер снова
  вьюпорт / ушёл за экран». Если понадобится — добавить низкоуровневый
  Set-канал (по образцу `onScrollProgress`), emitter в `useScrollSpace.onUpdate`.
- **`'intro'`/интеграция с IntroAnimation**: `LayoutChangeSource` расширить на
  `'intro'`, при завершении intro вызвать `applyState(..., 'intro')` — контракт
  «один источник + per-component» сохраняется.

## Публичный API (`index.ts`)

- компонент `LayoutProvider`
- хук `useLayout()`
- хелперы геометрии: `getNavTransform`, `SLIM_WIDTH`
- типы: `LayoutMode`, `LayoutChangeSource`, `NavTransform`

Экспортов шины событий больше нет.
