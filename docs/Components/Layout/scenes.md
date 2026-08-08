# scenes — React-хуки-сцены

`src/components/layout/scenes/` — сцены по одной ответственности. Импортируют
`machine` + контекст, **не** импортируют панели `nav/`.

## `useLayoutState.ts` — состояние раскладки

Единственный источник состояния (`mode` в `useState`) и единая точка записи
`applyState(next, source)`. Владеет рефами `modeRef`, `sourceRef`,
`preferredRef`, `isHomeRef`, а также `getHomeEndState` и пересчётом целевого
состояния `recomputeTarget` (триггер — смена роута/breakpoint/инициализация).

`applyState` пишет рефы, вызывает `setMode` напрямую и уведомляет
низкоуровневый канал `onNavState` (владелец позиции `.nav`). React-bridge на
шину убран.

## `useLayoutToggle.ts` — ручной toggle

Возвращает обычный колбэк `toggle()` (без подписки на события):
`getNextState` → `applyState(next, 'toggle')`, сохраняет ручной tablet-выбор
в `preferredRef` и зовёт `retargetScrub` (пересоздание scrub-твина позиции
`.nav`). На mobile `/home` при сворачивании прокручивает страницу к концу
спейсера через `scrollTriggerRef`.

## `useScrollScrub.ts` — scrub на `/home`

`registerScrollTrigger(trigger)` — ScrollTrigger на спейсере страницы, границы
состояния (`progress ≈ 0` → fullscreen, `progress ≈ 1` → `getHomeEndState`),
60fps-каналы `onScrollProgress`/`onToggleVisibility` (прямой вызов listener-ов
без React-рендера), mobile-«пин» ручного состояния. Поле `scrollTriggerRef`
для автоскролла. Позицию `.nav` НЕ твинит.

## `useNavPosition.ts` — единственный владелец позиции `.nav`

Объединяет два режима, конфликтовавшие через `overwrite`:

1. **Scrub** — paused-твин `fromTo(nav, {x:0} → {x: homeEnd})`, ведомый
   низкоуровневым каналом `onScrollProgress`.
2. **Дискретная** — `onNavState` с `source !== 'scroll'` → `gsap.to(nav, {x})`
   со стандартным `overwrite: 'auto'`.

Регистрирует в провайдере `buildScrub` через `registerRetargetScrub` для
ретаргета при смене ручного tablet-выбора.
