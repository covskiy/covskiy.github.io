# Layout — layout-движок

Layout управляет раскладкой страницы: 4 состояния навбара
(`fullscreen | standard | slim | invisible`), реакция на скролл на `/home`,
анимации через GSAP. Направление — **state machine → LayoutSnapshot →
CSS-переменные на root → CSS задаёт геометрию слотов**.

---

## 1. Архитектурный контекст

Layout опирается на три внешние системы:

| Система     | Файл                                    | Что даёт Layout                                                                                                                    |
| ----------- | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Breakpoints | `src/utils/breakpoints.ts`              | 3-тирная модель (`mobile` / `tablet: 768` / `desktop: 1024`), хук `useBreakpoint()`                                                |
| GSAP        | `src/utils/initGsap.ts`                 | Регистрация плагинов: `useGSAP`, `ScrollTrigger`, `SplitText`, `MorphSVGPlugin`, `DrawSVGPlugin`, `MotionPathPlugin`, `CustomEase` |
| gsapBus     | `src/components/Layout/gsap/gsapBus.ts` | 60fps-шина на `gsap.ticker` с каналами `scroll:frame`, `frame`, `scroll:progress`                                                  |

`breakpoints.ts` и `initGsap.ts` — общие утилиты проекта. Layout — единственный
потребитель `gsapBus`.

---

## 2. Принцип работы

### Машина → CSS

```
machine/transition(state, event, ctx)
  ↓
resolveLayout(mode, ctx, opts) → LayoutSnapshot { value, vars, transition }
  ↓
useLayoutApplier → gsap.to(root, vars)
  ↓
layout.css → геометрия слотов
```

### Скролл на /home

```
Spacer (HTMLElement)
  │  регистрируется через registerScrollTrigger(el)
  ↓
ScrollTrigger.create({ trigger: el, scrub: true })
  ├─ onUpdate → bus.emit('scroll:progress', { progress, direction })
  │              └─ useNavPosition → scrubTween.progress(p)
  └─ boundary → engine.send(REACH_TOP / REACH_BOTTOM)
```

---

## 3. Файлы

```
src/components/Layout/
├── machine/
│   ├── layoutMode.ts        # LayoutMode, LayoutEvent, MachineContext, EVENT_TO_SOURCE
│   ├── transition.ts        # чистый reducer (transition(state, event, ctx))
│   ├── derive.ts            # getDefaultState, homeEndStateFor,
│   │                        #   isPreferredStateValid, hasToggleFor, isSlimFor, isHomePath
│   ├── geometry.ts          # SLIM_WIDTH, getNavTransform(state, viewport),
│   │                        #   deriveMainOffset
│   └── layoutSnapshot.ts    # LayoutSnapshot, LayoutVars, resolveLayout (ctx → snapshot)
├── engine.ts                # createLayoutEngine (send/subscribe/getSnapshot/setViewport/setIsHome)
├── gsap/
│   ├── gsapBus.ts           # 60fps-шина (каналы: scroll:frame, frame, scroll:progress)
│   ├── gsapContext.ts       # GsapContext + useGsapBus
│   ├── GsapProvider.tsx     # инфраструктура (bus, ticker, cleanup) + registerScrollTrigger
│   └── useRegisterScrollTrigger.ts # хук для регистрации ScrollTrigger страницами
├── context/
│   ├── layoutContexts.ts    # useLayoutEngine / useLayoutSnapshot / useLayoutSend
│   └── LayoutProvider.tsx   # реакция на bp/route/resize, владеет движком
├── slots/
│   ├── LayoutRoot.tsx       # корневая нода с CSS-переменными
│   └── useLayoutApplier.ts  # snapshot → gsap.to(root, vars)
├── nav/
│   ├── NavigationBar/
│   │   ├── NavigationBar.tsx
│   │   ├── NavigationBar.module.css
│   │   └── useNavPosition.ts # GSAP-анимация позиции .nav (scrub + discrete)
│   ├── ToggleButton/
│   │   ├── ToggleButton.tsx
│   │   ├── ToggleButton.module.css
│   │   └── useToggleVisibility.ts # 60fps-видимость кнопки на /home через gsapBus
│   └── NavList/
│       ├── NavList.tsx
│       ├── NavList.module.css
│       ├── NavItem.tsx
│       ├── NavItem.module.css
│       └── navItems.ts
└── styles/
    └── layout.css           # vars → геометрия слотов
```

---

## 4. Машина состояний

4 состояния навбара:

| Mode         | Навбар                 | Контент           |
| ------------ | ---------------------- | ----------------- |
| `fullscreen` | Полноэкранный, x=0     | Без отступа       |
| `standard`   | Уезжает на 75% влево   | margin-left: 25vw |
| `slim`       | Уезжает, оставляя 80px | margin-left: 80px |
| `invisible`  | Полностью за экраном   | Без отступа       |

### События

| Event                | Когда                          | Source       |
| -------------------- | ------------------------------ | ------------ |
| `TOGGLE`             | Клик по кнопке                 | `toggle`     |
| `ROUTE_CHANGED`      | Смена pathname                 | `route`      |
| `BREAKPOINT_CHANGED` | Смена ширины вьюпорта          | `breakpoint` |
| `REACH_TOP`          | Скролл наверх спейсера (/home) | `scroll`     |
| `REACH_BOTTOM`       | Скролл вниз спейсера (/home)   | `scroll`     |
| `INTRO_COMPLETE`     | Завершение intro-анимации      | `scroll`     |

---

## 5. transition()

`src/components/Layout/machine/transition.ts`

Чистая функция-описатель (Elm Architecture подход):

```ts
function transition(
  state: LayoutMode,
  event: LayoutEvent,
  ctx: MachineContext,
): TransitionResult;
```

Возвращает:

```ts
interface TransitionResult {
  state: LayoutMode; // новое состояние
  actions: LayoutAction[]; // сайд-эффекты (NOTIFY_NAV_STATE, SCROLL_TO_END, RETARGET_SCRUB)
  preferredAfter?: LayoutMode | null; // обновление ручного tablet-выбора
  manualOverrideAfter?: boolean; // обновление флага ручного состояния (mobile /home)
}
```

`manualOverrideAfter` — явный bool на стороне машины: `undefined` означает
«не трогать», движок резолвит в текущее значение контекста. Семантика флага:
«навбар **открыт** вручную». `true` — ручное открытие (`TOGGLE`
invisible→fullscreen) + `REACH_BOTTOM` (preserve); `false` — ручное закрытие
(`TOGGLE` fullscreen→invisible) + сброс на
`REACH_TOP`/`ROUTE_CHANGED`/`BREAKPOINT_CHANGED`/`REACH_BOTTOM` (без override);
`INTRO_COMPLETE` оставляет флаг нетронутым (`undefined`).

`transition` ничего не выполняет сам — только описывает. Применяет результат
`engine.send()` (см. §6). Машина и движок покрыты юнит-тестами (`vitest`):
co-located `*.test.ts` в `machine/` + `engine.test.ts`. Запуск — `npm run test`,
прогоняется в pre-commit. React-компоненты (gsap/context/slots/nav) не тестируются.
Глоссарий терминов и конвенция имен тестов — в [`testing.md`](./testing.md).

---

## 6. LayoutEngine

`src/components/Layout/engine.ts`

Импурный оркестратор — единственный владелец состояния (`mode`, `context`,
`snapshot`). React-компоненты только читают через `subscribe`.

### Хранение состояния

| Переменная | Назначение                                                                                 |
| ---------- | ------------------------------------------------------------------------------------------ |
| `mode`     | Текущее состояние (`LayoutMode`)                                                           |
| `viewport` | Ширина вьюпорта (для пересчёта геометрии)                                                  |
| `context`  | `MachineContext` (`bp`, `isHome`, `preferred`, `source`, `homeEndState`, `manualOverride`) |
| `snapshot` | Текущий публикуемый `LayoutSnapshot`                                                       |

### Приём событий (`send`)

1. Маппит `event.type → source` через `EVENT_TO_SOURCE`
2. Вызывает `transition(mode, event, fullCtx)` → получает `TransitionResult`
3. Проверяет `changed` — реально ли что-то изменилось
4. Если да — мутирует `mode` + `context`, пересоздаёт snapshot, notify-ит listeners
5. Диспатчит `result.actions` подписчикам `subscribeActions` — движок только
   публикует сайд-эффекты, выполняют их потребители DOM-слоя (например,
   `GsapProvider` скроллит спейсер на `SCROLL_TO_END`)

### Публикация (pub/sub)

```ts
engine.subscribe(listener) → unsubscribe
engine.subscribeActions(listener) → unsubscribe; // сайд-эффекты LayoutAction[]
engine.getSnapshot() → LayoutSnapshot
```

### Внешние изменения (без машины)

| Метод             | Что делает                                          | Кто вызывает                     |
| ----------------- | --------------------------------------------------- | -------------------------------- |
| `setViewport(px)` | Пересчитывает `--nav-content-offset` без смены mode | `LayoutProvider` при resize      |
| `setIsHome(bool)` | Обновляет `context.isHome` и `homeEndState`         | `LayoutProvider` при смене роута |

### 6.1 LayoutSnapshot — производные флаги

`LayoutSnapshot` публикует готовые производные значения, чтобы
React-потребители не пересчитывали их локально:

| Поле             | Вычисление                                    | Источник                                 |
| ---------------- | --------------------------------------------- | ---------------------------------------- |
| `hasToggle`      | `hasToggleFor(context.bp)` (true вне desktop) | `resolveLayout`                          |
| `isSlim`         | `isSlimFor(value)` (slim/invisible)           | `resolveLayout`                          |
| `homeEndState`   | `homeEndStateFor(bp, preferred)`              | `MachineContext` (владелец — transition) |
| `isManualToggle` | `bp === 'mobile' && context.manualOverride`   | `resolveLayout`                          |

Единая точка вычисления — `resolveLayout` (`layoutSnapshot.ts`), наружу
вызывается только чтение полей. Хелперы остаются machine-internal.

> Примечание: комбинация `invisible + manualOverride=true` на mobile
> недостижима — после ручного закрытия (`TOGGLE` fullscreen→invisible) машина
> снимает флаг, поэтому `isManualToggle` в scrub-зоне после ручного закрытия
> равен `false` (кнопка скрыта).

---

## 7. Подсистемы

### gsapBus — 60fps-шина

`src/components/Layout/gsap/gsapBus.ts`

Типизированная event-шина на `gsap.ticker` (единый `requestAnimationFrame`
для всех GSAP-анимаций):

| Канал             | Payload                         | Назначение                             |
| ----------------- | ------------------------------- | -------------------------------------- |
| `scroll:frame`    | `{ y, delta, time, direction }` | Raw scroll-позиция из `window.scrollY` |
| `frame`           | `{ y, delta, time, direction }` | Алиас `scroll:frame`                   |
| `scroll:progress` | `{ progress, direction }`       | Прогресс скролла 0..1 от ScrollTrigger |

`gsap.ticker` автоматически ставится на паузу при неактивной вкладке.

### GsapProvider + useRegisterScrollTrigger

`src/components/Layout/gsap/GsapProvider.tsx`
`src/components/Layout/gsap/useRegisterScrollTrigger.ts`

`GsapProvider` создаёт `gsapBus`, прокидывает через `GsapContext`, предоставляет
`registerScrollTrigger(el)` через `RegisterScrollTriggerContext`. Также
вызывает `ScrollTrigger.refresh()` при уходе с `/home`.

`useRegisterScrollTrigger()` — хук для страниц. Возвращает функцию
`registerScrollTrigger(el)`, которая создаёт `ScrollTrigger` на спейсере:

- `onUpdate` → `bus.emit('scroll:progress')` для scrub-анимаций
- Boundary detection → `engine.send(REACH_TOP / REACH_BOTTOM)`
- Сохраняет экземпляр в `spacerTriggerRef` — потребитель `SCROLL_TO_END`

**`SCROLL_TO_END` (пропуск пустого спейсера).** После `TOGGLE` на mobile
`/home` (`fullscreen → invisible`, машина декларирует action, а движок
публикует его через `subscribeActions`) `GsapProvider` доскролливает страницу
до конца спейсера, чтобы контент подтянулся вместо пустого участка spacer-а:

```ts
gsap.to(window, { scrollTo: st.end, duration, ease, overwrite: 'auto' });
```

Guard-ы: триггер зарегистрирован (`spacerTriggerRef.current`), ещё не в конце
(`st.progress < 1 − EDGE_EPS` — иначе перемотка с контента вниз), `st.end`
уже вычислен. Скролл идёт через `ScrollToPlugin` (зарегистрирован в
`initGsap.ts`), поэтому наследует прерываемость GSAP-твинов.

### useNavPosition

`src/components/Layout/nav/NavigationBar/useNavPosition.ts`

Владелец `x`-позиции `.nav`. Два режима:

| Режим        | Когда                               | Механизм                                                                                                   |
| ------------ | ----------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| **Scrub**    | На `/home`                          | Paused-твин `fromTo(nav, {x:0} → {x: homeEnd})`, ведомый `bus.on('scroll:progress')` → `tween.progress(p)` |
| **Discrete** | Вне `/home` или при toggle/route/bp | `gsap.to(nav, { x: navX, duration, ease })` при смене mode через `engine.subscribe`                        |

Снимок машины передаётся параметром из `NavigationBar`
(`useNavPosition(navRef, snapshot)`) — единственный читатель
`useLayoutSnapshot()` в навбаре, сам хук контекст не читает.

Paused-твин не конфликтует с дискретной анимацией — GSAP `overwrite: 'auto'`
не убивает paused-твины.

### useLayoutApplier

`src/components/Layout/slots/useLayoutApplier.ts`

Подписан на `engine.subscribe`. При каждом новом snapshot:

- `gsap.to(root, snapshot.vars)` — анимирует CSS-переменные
- Управляет `document.documentElement.style.overflow` (scroll-lock)
- Вызывает `ScrollTrigger.refresh()` в `onComplete`

### useToggleVisibility

`src/components/Layout/nav/ToggleButton/useToggleVisibility.ts`

Императивный 60fps-контроль видимости кнопки toggle на `/home`. На середине
скруб-полосы машина не меняет `mode` — поэтому видимость не выражается
снапшотом, а подписывается на `bus.on('scroll:progress')`.

Правило: `hidden = !(progress >= 1 - EDGE_EPS || isManualToggle)`.
`EDGE_EPS` экспортируется из `GsapProvider.tsx` (единый источник с граничным
детектом спейсера). Хук использует `lastProgressRef`, чтобы при перезапуске
эффекта (вход на `/home` уже на дне) начальное состояние не сбрасывалось в
`hidden`.

CSS-класс `.isHidden` (`ToggleButton.module.css`): `visibility: hidden;
pointer-events: none` — кнопка остаётся в DOM и подписанной на клик.

---

## 8. Публичный API

```ts
import {
  useLayoutEngine,
  useLayoutSnapshot,
  useLayoutSend,
} from 'src/components/Layout/context/layoutContexts';
import { useRegisterScrollTrigger } from 'src/components/Layout/gsap/useRegisterScrollTrigger';
import { useGsapBus } from 'src/components/Layout/gsap/gsapContext';
import { isHomePath } from 'src/components/Layout/machine/derive';
```

Хелперы `hasToggleFor`, `isSlimFor`, `getDefaultState`, `homeEndStateFor`,
`isPreferredStateValid` — **machine-internal**: они
используются только внутри машины / `resolveLayout`. Наружу они не утекают —
готовые производные флаги публикуются в `LayoutSnapshot` (см. §6.1).
Распознавание ручного состояния на mobile живёт как `manualOverride` в
`MachineContext` и публикуется в снапшоте как `isManualToggle` (§6.1).

### Регистрация ScrollTrigger на /home

```tsx
function HomePage() {
  const spacerRef = useRef<HTMLElement>(null);
  const registerScrollTrigger = useRegisterScrollTrigger();

  useEffect(() => {
    if (spacerRef.current) {
      return registerScrollTrigger(spacerRef.current);
    }
  }, [registerScrollTrigger]);

  return <div ref={spacerRef} />;
}
```

### Отправка событий в машину

```tsx
const send = useLayoutSend();
<button onClick={() => send({ type: 'TOGGLE' })}>Toggle</button>;
```

---

## 9. Подписка на изменения

| Хук                                          | Когда использовать                              | Re-render |
| -------------------------------------------- | ----------------------------------------------- | --------- |
| `useLayoutSnapshot()`                        | Нужен re-render UI на основе mode/state         | Да        |
| `useLayoutEngine()` + `engine.subscribe(cb)` | Imperative side-effect без re-render            | Нет       |
| `useGsapBus()`                               | Нужен raw 60fps (scroll:frame, scroll:progress) | Нет       |
| `useLayoutSend()`                            | Отправка событий в машину                       | Нет       |

`useLayoutEngine()` возвращает **стабильную ссылку** (никогда не меняется),
поэтому `engine.subscribe()` внутри `useEffect` не перезапускает эффект.

---

## 10. CSS-переменные layout-а

Публикуются `useLayoutApplier`-ом на `.layout-root`:

| Var                    | Назначение                                                       |
| ---------------------- | ---------------------------------------------------------------- |
| `--nav-pointer-events` | `none` на invisible, `auto` иначе — чтобы клики не проваливались |
| `--nav-content-offset` | `margin-left` для content-слота                                  |
| `--layout-state`       | Строка состояния (для отладки / DevTools)                        |

Позиция навбара (`translateX`) управляется напрямую через GSAP в
`useNavPosition`, не через CSS-переменную.
