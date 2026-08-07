# hooks (сцены раскладки навбара)

Сцены — это хуки-подписчики на шину событий, каждый владеет своей областью
ответственности и (опционально) DOM-нодой. Корневая сцена — композер.

Файлы: `src/components/NavigationBar/hooks/useNavbarLayout.ts`,
`useNavbarState.ts`, `useNavbarPosition.ts`, `useNavbarScrubTrigger.ts`,
`useNavbarToggle.ts`.

## useNavbarLayout — композер корневой сцены

Единственная сцена, которая знает о геометрии раскладки (видимая ширина).
Собирает три под-сцены:

- `useNavbarState` — состояние и подписки на дискретные события шины;
- `useNavbarScrubTrigger` — scrub-таймлайн `/home` (`registerScrollTrigger`);
- `useNavbarToggle` — подписчик на `toggle:request`.

Возвращает API `NavbarLayout`: `currentState`, `applyState`, `registerScrollTrigger`,
`scrollListenersRef`, `getHomeEndState`.

**Позицию `.nav` эта сцена НЕ двигает** — ей владеет дочерняя `useNavbarPosition`
(вызывается в `NavigationBar`). `retargetScrub` (пересоздание scrub-твина)
прокидывается сюда аргументом от провайдера и передаётся в `useNavbarToggle`.

Порядок эффектов важен: layout-эффект `useGSAP` в `useNavbarPosition` выполняется
раньше passive-эффекта `useNavbarState`, поэтому подписка discrete-анимации
регистрируется до первого `recomputeTarget()` и публикации начального состояния.

## useNavbarState — сцена состояния

- refs: `stateRef`, `stateSourceRef`, `preferredRef`, `isHomeRef`;
- `applyState(next, source)` — единственная точка записи: `stateRef.current = next`
  → `bus.emit('state:change', { state, prev, source })`. Фиксирует `source` даже
  при `prev === next`;
- `getHomeEndState()` — эффективное конечное состояние `/home`: читает
  `preferredRef` на лету (`mobile → invisible`, tablet с выбором → `slim`/`standard`,
  иначе `standard`);
- `recomputeTarget()` — пересчёт целевого состояния из `route:change`/
  `breakpoint:change` и на монтировании;
- React-мост: `bus.on('state:change')` → `setCurrentState` для `isSlim`.

## useNavbarScrubTrigger — сцена ScrollTrigger

НЕ твинит позицию — только ScrollTrigger и каналы:

- `registerScrollTrigger(trigger)` — таймлайн с `ScrollTrigger.onUpdate`;
- границы спейсера: `progress === 0` → `applyState('fullscreen', 'scroll')`
  (снимает «пин»), `progress === 1` → `applyState(endState, 'scroll')`
  (пропускается при `isMobilePin`);
- **пин ручного состояния (mobile)**: `isMobilePin = isMobile && source === 'toggle'
&& state ∈ {fullscreen, invisible}` → `tl.progress(fullscreen ? 0 : 1)`;
- `spacer:enter` / `spacer:leave` — видимость/чистка;
- `notifyToggleVisibility(progress === 1 || isMobilePin)` — через
  `toggleVisibilityListenersRef` (применяет `ToggleButton`, см. `ToggleButton.md`);
- `notifyScrollProgress` — listener-ы `scrollListenersRef` вызываются напрямую из
  `onUpdate` (60fps без React-рендера).

## useNavbarPosition — сцена-владелец позиции `.nav`

Вызывается в `NavigationBar` с `navRef`. Единственный источник анимации `x` на `.nav`:

1. **Scrub** — paused-твин `fromTo(nav, {x: 0} → {x: getHomeEndState()})`, ведомый
   низкоуровневым каналом `onScrollProgress` (`scrubTween.progress(progress)`).
2. **Discrete** — `gsap.to(nav, {x: getNavTransform(state).navX, overwrite: 'auto'})`
   на `state:change`, но только при `source !== 'scroll'` (позицию при скролле
   ведёт scrub-твин).

Так как scrub-твин `paused`, он не «активен» для GSAP: `overwrite:'auto'`
discrete-анимации его не убивает. Один владелец `.nav` устраняет гонку, которая
была причиной бага «навбар не автораскрывается на `/home` после ручного
tablet-toggle».

Также регистрирует в провайдере `registerRetargetScrub(buildScrub)`:
пересоздание scrub-твина при смене ручного tablet-выбора. GSAP читает значение
твина один раз при создании, поэтому после изменения `preferredRef` таргет
стал бы устаревшим. `buildScrub` = kill + `fromTo` с `immediateRender: false`
(иначе добавление твина мгновенно выставляло бы навбар в fullscreen в момент
toggle) и paused-твином.

```ts
useNavbarScrollProgress(({ progress }) =>
  scrubTweenRef.current?.progress(progress),
);
useNavbarEvent('state:change', ({ state, prev, source }) => {
  if (state === prev || source === 'scroll') return;
  gsap.to(navRef.current, {
    x: getNavTransform(state).navX,
    overwrite: 'auto',
  });
});
```

## useNavbarToggle — сцена ручного переключения

Подписчик на `toggle:request` от `ToggleButton`:

- `getNextState(stateRef.current, bp)` → `applyState(next, 'toggle')`;
- **tablet**: `preferredRef.current = next` (для `slim`/`standard`) +
  `retargetScrub()` — фасад провайдера, пересоздающий scrub-твин под новый таргет
  (см. `useNavbarPosition`). Прокидывается аргументом, НЕ через контекст —
  сцена вызывается из `useNavbarLayout` внутри рендера провайдера;
- **mobile `/home`**: при сворачивании в `invisible` программно скроллит к концу
  спейсера (`gsap.to(window, { scrollTo: { y: trigger.end, autoKill: false } })`),
  если пользователь ещё не ниже него.

## Сцен-флоу

```
applyState(next, source):                       ← useNavbarState
  stateRef.current = next
  bus.emit('state:change', { state, prev, source })

bus.on('route:change', { pathname }):          ← useNavbarState
  isHomeRef.current = isHomePath(pathname)
  recomputeTarget()

bus.on('breakpoint:change', { bp }):           ← useNavbarState
  recomputeTarget()

bus.on('toggle:request'):                       ← useNavbarToggle
  getNextState(stateRef.current, bp) → applyState(next, 'toggle')
  (tablet) preferredRef.current = next + retargetScrub()
  (mobile /home) scrollTo конца спейсера при сворачивании в invisible

useNavbarPosition (сцена-владелец .nav):
  useNavbarScrollProgress(({ progress }) => scrubTween.progress(progress))  ← paused-твин
  useNavbarEvent('state:change'):
    if source === 'scroll' → return          (позицию ведёт scrub-твин)
    else gsap.to(nav, { x: getNavTransform(state).navX, overwrite: 'auto' })
  registerRetargetScrub(buildScrub)          (пересоздание таргета)

registerScrollTrigger(trigger):                ← useNavbarScrubTrigger (НЕ твинит позицию)
  gsap.timeline({ scrollTrigger: { ..., onUpdate } })
    onUpdate:
      listeners.forEach(l => l({ progress, direction }))   ← onScrollProgress канал
      isMobilePin = isMobile && source === 'toggle'
                    && state ∈ {fullscreen, invisible}
      if progress === 0 → applyState('fullscreen', 'scroll')   (снимает пин)
      if progress === 1 → applyState(endState, 'scroll')       (skip при isMobilePin)
      if isMobilePin    → tl.progress(fullscreen ? 0 : 1)      («пин» ручного состояния)
      notifyToggleVisibility(progress === 1 || isMobilePin)
```

## Что знает каждый уровень

| Уровень                                       | Знает                                                                                   | НЕ знает                                     |
| --------------------------------------------- | --------------------------------------------------------------------------------------- | -------------------------------------------- |
| `useNavbarLayout`                             | Геометрия раскладки (`getContentOffset`), ScrollTrigger/applyState на границах спейсера | Позицию `.nav` (владеет `useNavbarPosition`) |
| `useNavbarPosition`                           | Позицию `.nav` (`navRef`), discrete + scrub через шину и `onScrollProgress`             | Содержимое пунктов меню, геометрию `<main>`  |
| Дочерняя сцена (ToggleButton, NavItem и т.д.) | Свою DOM-ноду, `prev → next` state через шину                                           | DOM соседей, общую анимацию                  |

## Ключевые решения

- **Один владелец `.nav`** — `useNavbarPosition` объединяет discrete и scrub;
  `overwrite:'auto'` больше не убивает scrub-твин.
- **`overwrite: 'auto'` только в discrete** — прямые `gsap.to()` прерывают
  конфликтующие активные твины; paused scrub-твин не «активен», поэтому
  не задевается.
- **Двухканальная публикация прогресса** — дискретные события через `events.emit`,
  непрерывный scrub-прогресс через низкоуровневый канал `onScrollProgress`.
- **Дочерние сцены не знают DOM корневого навбара** — новый элемент внутри навбара
  (логотип, badge, индикатор) реализуется как новая сцена без правок провайдера
  или layout-сцены.
