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
│   ├── derive.ts            # getDefaultState, homeEndStateFor, isManualMobileState,
│   │                        #   isPreferredStateValid, isHomePath, hasToggleFor
│   ├── geometry.ts          # SLIM_WIDTH, getNavTransform(state, viewport),
│   │                        #   deriveMainOffset
│   └── layoutSnapshot.ts    # LayoutSnapshot, LayoutVars, resolveLayout (ctx → snapshot)
├── engine.ts                # createLayoutEngine (send/subscribe/getSnapshot/setViewport/setIsHome/registerSlot)
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
│   ├── LayoutSlot.tsx       # navbar/content слот
│   └── useLayoutApplier.ts  # snapshot → gsap.to(root, vars)
├── nav/
│   ├── NavigationBar/
│   │   ├── NavigationBar.tsx
│   │   ├── NavigationBar.module.css
│   │   └── useNavPosition.ts # GSAP-анимация позиции .nav (scrub + discrete)
│   ├── ToggleButton/
│   │   ├── ToggleButton.tsx
│   │   └── ToggleButton.module.css
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
}
```

`transition` ничего не выполняет сам — только описывает. Применяет результат
`engine.send()` (см. §6). Это позволяет тестировать переходы без DOM/GSAP.

---

## 6. LayoutEngine

`src/components/Layout/engine.ts`

Импурный оркестратор — единственный владелец состояния (`mode`, `context`,
`snapshot`). React-компоненты только читают через `subscribe`.

### Хранение состояния

| Переменная | Назначение                                                               |
| ---------- | ------------------------------------------------------------------------ |
| `mode`     | Текущее состояние (`LayoutMode`)                                         |
| `viewport` | Ширина вьюпорта (для пересчёта геометрии)                                |
| `context`  | `MachineContext` (`bp`, `isHome`, `preferred`, `source`, `homeEndState`) |
| `snapshot` | Текущий публикуемый `LayoutSnapshot`                                     |

### Приём событий (`send`)

1. Маппит `event.type → source` через `EVENT_TO_SOURCE`
2. Вызывает `transition(mode, event, fullCtx)` → получает `TransitionResult`
3. Проверяет `changed` — реально ли что-то изменилось
4. Если да — мутирует `mode` + `context`, пересоздаёт snapshot, notify-ит listeners

### Публикация (pub/sub)

```ts
engine.subscribe(listener) → unsubscribe
engine.getSnapshot() → LayoutSnapshot
```

### Внешние изменения (без машины)

| Метод             | Что делает                                          | Кто вызывает                     |
| ----------------- | --------------------------------------------------- | -------------------------------- |
| `setViewport(px)` | Пересчитывает `--nav-content-offset` без смены mode | `LayoutProvider` при resize      |
| `setIsHome(bool)` | Обновляет `context.isHome` и `homeEndState`         | `LayoutProvider` при смене роута |

### Регистрация слотов

```ts
engine.registerSlot(id: 'navbar' | 'content', el: HTMLElement | null)
```

`LayoutSlot` регистрирует DOM-элемент при mount. Engine хранит их в `Map`.
Пока нигде не потребляется — задел для будущего.

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

### useNavPosition

`src/components/Layout/nav/NavigationBar/useNavPosition.ts`

Владелец `x`-позиции `.nav`. Два режима:

| Режим        | Когда                               | Механизм                                                                                                   |
| ------------ | ----------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| **Scrub**    | На `/home`                          | Paused-твин `fromTo(nav, {x:0} → {x: homeEnd})`, ведомый `bus.on('scroll:progress')` → `tween.progress(p)` |
| **Discrete** | Вне `/home` или при toggle/route/bp | `gsap.to(nav, { x: navX, duration, ease })` при смене mode через `engine.subscribe`                        |

Paused-твин не конфликтует с дискретной анимацией — GSAP `overwrite: 'auto'`
не убивает paused-твины.

### useLayoutApplier

`src/components/Layout/slots/useLayoutApplier.ts`

Подписан на `engine.subscribe`. При каждом новом snapshot:

- `gsap.to(root, snapshot.vars)` — анимирует CSS-переменные
- Управляет `document.documentElement.style.overflow` (scroll-lock)
- Вызывает `ScrollTrigger.refresh()` в `onComplete`

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
import { hasToggleFor, isHomePath } from 'src/components/Layout/machine/derive';
```

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

| Var                      | Назначение                                                       |
| ------------------------ | ---------------------------------------------------------------- |
| `--nav-pointer-events`   | `none` на invisible, `auto` иначе — чтобы клики не проваливались |
| `--nav-content-offset`   | `margin-left` для content-слота                                  |
| `--layout-state`         | Строка состояния (для отладки / DevTools)                        |
| `--layout-scroll-locked` | `1` / `0` — резерв для modal/immersive                           |

Позиция навбара (`translateX`) управляется напрямую через GSAP в
`useNavPosition`, не через CSS-переменную.
