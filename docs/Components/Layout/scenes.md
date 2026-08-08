# scenes — React-хуки-сцены

`src/components/layout/scenes/` — сцены по одной ответственности. Импортируют
`machine` + контекст, **не** импортируют панели `nav/`.

## `useLayoutMachine.ts` — executor машины

Заменяет прежние `useLayoutState` + `useLayoutToggle`. Владеет `mode` в
**`useState`**, стабильным `dispatch` (useCallback) и прогоняет результат
чистой `transition()` из `machine/transition.ts`:

1. собирает `MachineContext` из актуальных refs (`bpRef`, `isHomeRef`,
   `preferredRef`, `lastSourceRef`, `EVENT_TO_SOURCE[event.type]`);
2. применяет `preferredAfter` к `preferredRef` (единственное место
   установки/сброса ручного tablet-выбора);
3. применяет actions (executor): `NOTIFY_NAV_STATE` → `navStateListenersRef`,
   `SCROLL_TO_END` → `scrollToRef.current?.()`, `RETARGET_SCRUB` →
   `retargetScrubRef.current?.()`, `NOOP` — игнор;
4. обновляет `lastSourceRef` ВСЕГДА (даже на no-op — иначе повторный
   `REACH_TOP` не снимет mobile-«пин»);
5. логирует `logger.info` на реальной смене state, `logger.debug` на no-op.

Триггеры-эффекты разделены: `[bp]` → `BREAKPOINT_CHANGED`, `[isHome]` →
`ROUTE_CHANGED` — смена breakpoint НЕ диспатчит лишний `ROUTE_CHANGED` и
наоборот (исправление двойного dispatch). `setMode` вызывается только на
реальной смене state — без лишних re-render.

Опции: `bp`, `isHome`, `navStateListenersRef`, `scrollToRef`,
`retargetScrubRef`. Рефы `scrollToRef`/`retargetScrubRef` — стабильные;
`dispatch` не меняется между рендерами.

API: `mode`, `modeRef`, `dispatch`, `getHomeEndState`, `preferredRef`,
`lastSourceRef`.

## `useScrollScrub.ts` — сенсор scrub на `/home` (изменён)

Убраны прямые вызовы `applyState` — теперь это сенсор:

- `registerScrollTrigger(trigger)` — ScrollTrigger на спейсере страницы,
  60fps-канал `onScrollProgress` (прямой вызов без React-рендера). На границах
  диспатчит события **при пересечении** границы (`lastBoundaryRef`), не на
  каждый кадр: `progress ≤ 0.0001` → `REACH_TOP`, `≥ 0.9999` → `REACH_BOTTOM`.
- Mobile-«пин»: `isManualMobileState(bp, lastSourceRef.current, modeRef.current)`
  → scrub-таймлайн запинен к крайнему положению.
- Видимость toggle (`onToggleVisibility`) **остаётся здесь** (производный сигнал
  геометрии скролла, не переход машины): `progress ≥ 0.9999 || manualState`.
- `scrollTo` — колбэк владельца ScrollTrigger, выполняющий action
  `SCROLL_TO_END` (guard `window.scrollY < st.end`). Провайдер пишет его в
  `scrollToRef` машины эффектом.
- Cleanup при уходе с `/home` — `notifyToggleVisibility(true)` (жизненный
  цикл ScrollTrigger, не машина).

## `useNavPosition.ts` — единственный владелец позиции `.nav`

Объединяет два режима, конфликтовавшие через `overwrite`:

1. **Scrub** — paused-твин `fromTo(nav, {x:0} → {x: homeEnd})`, ведомый
   низкоуровневым каналом `onScrollProgress`.
2. **Дискретная** — `onNavState` с `source !== 'scroll'` → `gsap.to(nav, {x})`
   со стандартным `overwrite: 'auto'`.

Регистрирует в провайдере `buildScrub` через `registerRetargetScrub` для
ретаргета при смене ручного tablet-выбора; executor дёргает его по action
`RETARGET_SCRUB`.