# ToggleButton (кнопка ☰ / ←)

Самостоятельная сцена ручного переключения состояния навбара. Кнопка владеет
своей DOM-нодой (`useRef`), по клику публикует системный интент `toggle:request`
в шину; обработчик состояния живёт в `useNavbarToggle` (layout-сцена, `hooks.md`).

Файлы: `src/components/NavigationBar/ToggleButton/ToggleButton.tsx` +
`ToggleButton.module.css`.

## Сцена

- **Вход**: `useRef` + подписка на видимость через `useNavbarToggleVisibility`.
- **Клик**: `onClick` → `useNavbar().events.emit('toggle:request')` — интент,
  а не прямое изменение состояния.
- **Обработчик**: `useNavbarToggle` вычисляет `getNextState` и применяет
  `applyState(next, 'toggle')` (см. `hooks.md`).
- Рендер глифа/aria остаётся на React-пропе `isSlim` — по правилу
  «проп вместо шины для условного рендера».

## Позиционирование (lifecycle placement)

Placement задаёт `NavigationBar` по breakpoint:

- **Tablet**: кнопка рендерится **внутри** `<nav>`, `position: absolute;
top: 20px; right: 20px` (модификатор `--absolute`) — правый верхний угол.
  Кнопка — дочерний элемент сдвигаемого навбара, поэтому «едет» вместе с
  правым краем окна при slim↔standard.
- **Mobile**: кнопка рендерится **сиблингом** после `</nav>`, `position: fixed;
top: 20px; left: 20px` (модификатор `--fixed`). Это настоящий fixed-элемент
  вне трансформированного `.nav` (transform создаёт containing block, который
  ломает `fixed` у потомка), поэтому кнопка не «едет» и видна, даже когда
  навбар ушёл за экран (invisible).

`.nav` имеет `overflow: hidden` на всех bp, а fixed-сиблинг кнопки — вне клапа.

> Нет противофазы: раньше на mobile кнопка компенсировалась `toggleX = -navX`.
> Теперь противофазы нет — кнопка настоящий `position: fixed`-сиблинг,
> `toggleX` удалён из `NavTransform` и scrub-твина (см. `hooks.md`, `core.md`).

## Видимость на `/home`

Видимость управляется из `registerScrollTrigger.onUpdate` через
`notifyToggleVisibility` (решение `progress ≈ 1 || manualState`), живёт в
scrub-сцене (`useNavbarScrubTrigger`) и публикуется через низкоуровневый
канал `toggleVisibilityListenersRef`. Применяет её сам `ToggleButton`:

- `useNavbarToggleVisibility((visible) => gsap.set(ref, { autoAlpha, pointerEvents }))`.

Без React-рендера. Кнопка скрыта наверху (fullscreen) и во время scrub-анимации
(в обе стороны), видна когда навбар ушёл за экран (`progress ≈ 1`).
Исключение (mobile, ручное состояние `source === 'toggle'`): кнопка видна и в
полёте — ручной fullscreen показывает `←`, ручной invisible — `☰`.
Cleanup триггера возвращает видимость в исходную при уходе с `/home`.
Поведение идентично для mobile и tablet.

## Ключевые решения

- **Toggle — сцена, а не проп-кнопка** — `ToggleButton` публикует `toggle:request`,
  обработчик в layout-сцене. Убрано `handleToggle` из пропсов `NavigationBar`.
- **Тот же канал, что и route/breakpoint/scroll** — ручное переключение проходит
  через шину по общим правилам (`applyState(next, 'toggle')`).
