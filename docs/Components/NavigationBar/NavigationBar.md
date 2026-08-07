# NavigationBar (компонент)

Презентационная панель навигации. Рендерит `<nav>`, логотип, список ссылок
и кнопку toggle. Значения `isSlim` / `hasToggle` прокидываются пропсами от
`NavigationBarProvider` (не через контекст).

Файлы: `src/components/NavigationBar/NavigationBar/NavigationBar.tsx` +
`NavigationBar.module.css`.

## Пропсы

| Проп        | Тип       | Назначение                                                   |
| ----------- | --------- | ------------------------------------------------------------ |
| `isSlim`    | `boolean` | Навбар в свёрнутом состоянии (`slim`/`invisible`)            |
| `hasToggle` | `boolean` | Доступна ли кнопка toggle (mobile/tablet). Скрыта на desktop |

## Владение позицией `.nav`

Логика состояний живёт в `NavigationBarProvider`; анимацию позиции своей
корневой ноды компонент владеет сам через хук-сцену `useNavbarPosition`:

```ts
const navRef = useRef<HTMLElement>(null);
useNavbarPosition({ navRef }); // discrete + scrub через шину и onScrollProgress
```

Кратко о `useNavbarPosition` — см. `hooks.md`. Позиция `.nav` (видимая ширина)
достигается трансформациями, а не `width` (см. ниже).

## Placement кнопки toggle по breakpoint

Позицию/вложение кнопки задаёт `NavigationBar` по `useBreakpoint()`:

- **Mobile**: `<ToggleButton/>` рендерится **сиблингом** после `</nav>` —
  как `position: fixed`-элемент вне трансформированного `.nav`. Иначе transform
  на `.nav` создал бы containing block и сломал `fixed` у потомка.
- **Tablet**: `<ToggleButton/>` рендерится **внутри** `<nav>` и «едет»
  с его краем при slim↔standard.

Детали жизни кнопки — в `ToggleButton.md`.

## Стили позиционирования

```css
/* NavigationBar.module.css — фиксированное позиционирование; GSAP анимирует трансформации */
.nav {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100dvh;
  z-index: var(--z-nav-overlay, 1000);
  will-change: transform;
}
```

Навбар всегда `width: 100vw` в раскладке; видимая ширина (25vw / 80px / 0)
достигается сдвигом окна через `transform: translateX`, а не `width`.
`.nav` имеет `overflow: hidden` на всех bp — контент (логотип, ссылки)
обрезается окном в свёрнутых состояниях.

## Почему transforms вместо width

`width`/`marginLeft` — layout-свойства: их изменение заставляет браузер
пересчитывать раскладку (reflow). ScrollTrigger с scrub обновляет твин
до 60 раз/с — анимация `width` давала бы reflow на каждом кадре (jank).

Трансформации (`translateX`) обрабатываются композитором GPU и не трогают
layout:

- `.nav` всегда `100vw`, видимая ширина — сдвиг окна `nav.x` (тот же эффект,
  что у width, но без reflow);
- контент `.navInner` движется вместе с окном; counter-translate убран, поэтому
  на tablet/desktop в `standard`/`slim` он обрезается `overflow: hidden`;
- `<main>` не твинится вовсе (см. `NavigationBarProvider.md`, `.main`);
- на mobile кнопка toggle — `position: fixed`-сиблинг, компенсация не нужна.

Плата — px-значения геометрии запекаются при создании твина. `invalidateOnRefresh`
пересчитывает позиции скролла, а смена breakpoint пересоздаёт анимацию.

## Поток `isSlim`

`NavigationBarProvider` вычисляет:

```ts
const isSlim = currentState === 'slim' || currentState === 'invisible';
```

`isSlim` прокидывается в `NavigationBar` → `NavList` → `NavItem`, где
управляет видимостью текста/иконки и `tabIndex={-1}` (см. `NavList.md`).
