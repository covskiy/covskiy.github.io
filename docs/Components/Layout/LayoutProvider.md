# LayoutProvider

`src/components/layout/LayoutProvider/LayoutProvider.tsx` — машина состояния
раскладки + композер сцен. Оборачивает весь `App` и рендерит корневую
колонку: навбар `fixed` + контентную область `<main>{children}</main>` с
отступом `--nav-content-offset`.

## Один источник состояния + per-component animator

Провайдер сам не владеет анимациями. Он держит `mode` в контексте
(единственный источник), собирает сцены из `scenes/` и прокидывает API через
React Context. Каждый компонент (`nav/*`) сам строит свой GSAP-таймлайн из
`mode`/`isSlim` или низкоуровневых каналов.

Сцены (см. `docs/Components/Layout/scenes.md`):

- `useLayoutMachine` — executor машины (v2): `mode` в `useState`, стабильный
  `dispatch`, чистая `transition()` решает переход, executor применяет actions
  и `preferredAfter`. Заменяет прежние `useLayoutState` + `useLayoutToggle`.
- `useScrollScrub` — сенсор `/home` (`registerScrollTrigger`), диспатчит
  `REACH_TOP`/`REACH_BOTTOM` на границах, публикует видимость toggle и
  экспортирует `scrollTo` (action `SCROLL_TO_END`).

## Композиция машины и scrub (разрешение цикла)

Машина и scrub взаимозависимы (`machine.dispatch` → scrub; `scrollToRef` ←
scrub). Цикл в объявлении хуков исключён через refs:

1. `useLayoutMachine` объявляется первой и получает пустые рефы
   `scrollToRef`/`retargetScrubRef`.
2. `useScrollScrub` получает `dispatch`, `modeRef`, `lastSourceRef`,
   `getHomeEndState` из машины.
3. Эффект провайдера после обоих хуков пишет `scrollToRef.current =
   scrub.scrollTo` (паттерн `registerRetargetScrub`).
4. Executor по action `SCROLL_TO_END` вызывает `scrollToRef.current?.()` —
   синхронно после смены state (состояние уже `'invisible'`, scrub читает
   свежий `scrollTriggerRef`).

## Низкоуровневые каналы

Провайдер держит три Set-а подписчиков в ref (без ререндера провайдера):

- `scrollListenersRef` — прогресс скролла (60fps, scrub `/home`);
- `toggleVisibilityListenersRef` — видимость кнопки toggle (scrub-производная);
- `navStateListenersRef` — смена состояния раскладки для сцены-владельца
  позиции `.nav`.

Каналы инкапсулированы в API контекста (`onScrollProgress`,
`onToggleVisibility`, `onNavState`) — наружу провайдер только их фасады.

## Контракт со страницами

`registerScrollTrigger(trigger)` — единственная публичная точка для
подключения ScrollTrigger (используется `HomePage`). Возвращает cleanup,
убивающий триггер и таймлайн.

## Разметка

`<nav>` + `<main className={styles.main}>` внутри корневого `div.app`.
Отступ контента — CSS-переменная `--nav-content-offset`, вычисляется через
`selectContentOffset(mode, bp, isHome, getHomeEndState())`. На mobile offset
всегда `0`; на `/home` tablet/desktop «fullscreen» маппится на
`homeEndState`, чтобы контент сразу ориентировался на конечную ширину.