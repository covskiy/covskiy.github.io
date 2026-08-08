# LayoutContext + useLayout()

`src/components/layout/LayoutProvider/LayoutContext.ts` — React Context API
layout-модуля.

## LayoutContextValue

| Поле                             | Назначение                                           |
| -------------------------------- | ---------------------------------------------------- |
| `mode: LayoutMode`               | текущее состояние раскладки (single source of truth) |
| `isSlim: boolean`                | `slim`/`invisible` (рендер-производная)              |
| `hasToggle: boolean`             | доступна ли кнопка toggle                            |
| `toggle: () => void`             | ручное переключение состояния                        |
| `registerScrollTrigger(trigger)` | контракт страниц (`HomePage`) → cleanup              |
| `onScrollProgress(listener)`     | 60fps-канал прогресса скролла (без React-рендера)    |
| `onToggleVisibility(listener)`   | канал видимости toggle (без React-рендера)           |
| `onNavState(listener)`           | канал смены состояния для владельца позиции `.nav`   |
| `getHomeEndState(): LayoutMode`  | эффективное конечное состояние на `/home`            |
| `registerRetargetScrub(fn)`      | регистрация `buildScrub` сцены позиции `.nav`        |

`onScrollProgress` / `onToggleVisibility` / `onNavState` работают через
низкоуровневые Set-каналы и **не** вызывают React-ререндер — listener-ы
применяют GSAP к своим DOM-нодам напрямую.

## useLayout()

Бросает `Error`, если вызван вне `LayoutProvider`. Используется:

- страницами (`HomePage`): `const { registerScrollTrigger } = useLayout()`;
- панелью `nav/*`: `useLayout().toggle()`, `useLayout().onToggleVisibility`;
- сценой `useNavPosition`: `getHomeEndState`, `registerRetargetScrub`,
  `onNavState`, `onScrollProgress`.
