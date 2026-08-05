# Navbar EventBus

Типизированная шина событий навбара — основа сценовой композиции.
Каждый дочерний компонент навбара (`NavItem`, логотип, будущие
расширения) может подписаться на изменения состояния и отреагировать
на них своей локальной анимацией, не уведомляя провайдер.

## Архитектура

```
NavigationBarProvider
  ├─ bus: NavbarEventBus  (useMemo, scoped на провайдер)
  │   ├─ on/off/emit: типизированный pub/sub
  │   └─ listeners: Map<EventName, Set<Listener>>
  │
  └─ scrollListenersRef: RefObject<Set<ListenerProgress>>
      (низкоуровневый канал для 60fps scrub-подписчиков)
```

**Шина** предназначена для дискретных событий. Для непрерывного
прогресса скролла (`scroll:progress`) используется **отдельный
канал**, чтобы не давить 60fps событиями на React.

## API шины

### Создание

```ts
import { createNavbarEventBus } from 'components/NavigationBar';

const bus = createNavbarEventBus();
```

На практике шина создаётся внутри `NavigationBarProvider` через
`useMemo([])` и передаётся через `NavbarAPI.events` —
создавать свою шину не нужно.

### Подписка / отписка / публикация

```ts
const unsubscribe = bus.on('state:change', (payload) => {
  // payload типизирован: { state, prev, source }
  console.log(payload.state);
});

// позже:
unsubscribe();
// или:
bus.off('state:change', sameListener);
```

`emit` — публикация события. Snapshot-семантика: если listener
удаляет сам себя в обработчике, оставшиеся слушатели всё равно
получат событие в текущей итерации.

## Карта событий (`NavbarEventMap`)

| Событие               | Payload                   | Когда                                                                  |
| --------------------- | ------------------------- | ---------------------------------------------------------------------- |
| `'state:change'`      | `{ state, prev, source }` | Любая смена состояния (toggle/route/breakpoint/scroll)                 |
| `'route:change'`      | `{ pathname, prev }`      | Смена pathname через react-router                                      |
| `'breakpoint:change'` | `{ bp, prev }`            | Смена breakpoint (mobile/tablet/desktop)                               |
| `'toggle:request'`    | `{}`                      | Клик по кнопке toggle (☰ / ←) — интент ручного переключения           |
| `'scroll:progress'`   | `{ progress, direction }` | **Непрерывный прогресс scrub** — для согласованных последовательностей |
| `'spacer:enter'`      | `{}`                      | Спейсер снова появился во вьюпорте (скролл вверх, `progress < 1`)      |
| `'spacer:leave'`      | `{}`                      | Спейсер полностью ушёл за экран (скролл вниз, `progress ≈ 1`)          |

`source` в `state:change`: `'toggle' | 'route' | 'breakpoint' | 'scroll' | 'intro'`.

## Событие `'toggle:request'` (ручное переключение)

Публикует дочерняя сцена `ToggleButton` по клику на кнопку (☰ / ←):

```ts
// ToggleButton.tsx
const { events } = useNavbar();
onClick={() => events.emit('toggle:request', {})}
```

Обработчик живёт в `useNavbarToggle` (layout-сцена): вычисляет следующее
состояние через `getNextState(stateRef.current, bp)` и применяет его через
`applyState(next, 'toggle')`. Payload пустой — интент, детали считает
приёмник. Это системное событие-интент (а не «болтовня» дочерней сцены),
поэтому оно допустимо в шине.

## Спейсер-события (`spacer:enter` / `spacer:leave`)

Эмитятся из колбэков ScrollTrigger в `useNavbarLayout.registerScrollTrigger`
и привязаны к зарегистрированному спейсеру страницы (сейчас — только `/`,
`HomePage`). Направление кодируется самим событием:

- `'spacer:leave'` — скролл вниз: низ спейсера пересёк верх вьюпорта
  (`progress ≈ 1`), спейсер больше не виден. `onLeave`.
- `'spacer:enter'` — скролл вверх: низ спейсера вернулся во вьюпорт
  (`progress < 1`), спейсер снова на экране. `onEnterBack`.

Оба события дискретные и срабатывают не чаще нескольких раз за навигацию —
подписываться безопасно через `useNavbarEvent`. Payload пустой, при
необходимости расширяется (например, `direction`).

Начальное состояние синхронизируется через `onRefresh`: если пользователь
загрузил страницу уже ниже спейсера, на подписку приходит `'spacer:leave'`.
Пока спейсер не зарегистрирован (другие роуты), события не эмитятся.

## Источники (`NavbarSource`)

| Значение     | Когда                                                     |
| ------------ | --------------------------------------------------------- |
| `toggle`     | Клик по ☰ / ← (ручной toggle)                            |
| `route`      | Смена pathname через react-router                         |
| `breakpoint` | Смена breakpoint (mobile / tablet / desktop)              |
| `scroll`     | ScrollTrigger на спейсере достиг границы (progress 0 / 1) |
| `intro`      | Зарезервировано для будущей интеграции с IntroAnimation   |

Подписчик может фильтровать по `source`:

```ts
useNavbarEvent('state:change', (p) => {
  if (p.source === 'toggle') runMyAnimation();
});
```

## React-хуки

### `useNavbarEvent`

React-обёртка над `bus.on` для дискретных событий. Использует
**latest-ref** паттерн: при изменении listener переподписка
не происходит, listener всегда видит свежее замыкание.
Дополнительные зависимости для переподписки — через `deps`.

```ts
useNavbarEvent('state:change', (p) => {
  // p: { state, prev, source }
  gsap.fromTo(myRef.current, { opacity: 0 }, { opacity: 1 });
});
// или с deps:
useNavbarEvent(
  'route:change',
  (p) => {
    if (p.pathname === '/about') runAboutIntro();
  },
  [runAboutIntro],
);
```

### `useNavbarScrollProgress`

React-обёртка над `onScrollProgress` для scrub-подписчиков.

```ts
useNavbarScrollProgress(({ progress, direction }) => {
  // вызывается до 60 раз в секунду — НЕ используйте setState
  gsap.set(activeIndicatorRef.current, {
    x: progress * totalWidth,
  });
});
```

Listener вызывается из `ScrollTrigger.onUpdate` напрямую,
минуя `bus.emit` и React-рендер.

## Низкоуровневый API (`NavbarAPI`)

```ts
interface NavbarAPI {
  registerScrollTrigger: (trigger: HTMLElement) => () => void;
  getState: () => NavState;
  events: NavbarEventBus;
  onScrollProgress: (
    listener: (p: { progress: number; direction: 1 | -1 }) => void,
  ) => () => void;
}
```

Получается через `useNavbar()`:

```ts
const { events, getState, onScrollProgress } = useNavbar();
```

## Демо-сцена: `NavItem` fade-in

В фазе 1 `NavItem` подписан на `'state:change'`: при первом
переходе навбара в `slim` (или `invisible`) иконка делает
fade-in с подскоком через `gsap.fromTo`. Это end-to-end
проверка пайплайна шины — `NavItem` сам реагирует на изменение
состояния, не получая его через проп `isSlim`.

```ts
useNavbarEvent('state:change', ({ state, prev }) => {
  if (state === prev) return;
  const enteredSlim =
    (state === 'slim' || state === 'invisible') &&
    prev !== 'slim' &&
    prev !== 'invisible';
  if (!enteredSlim) return;

  gsap.fromTo(
    iconRef.current,
    { scale: 0.6, opacity: 0 },
    { scale: 1, opacity: 1, duration: 0.4, ease: 'back.out(1.7)' },
  );
});
```

Существующее поведение (`isSlim` пропом) не заменяется —
демо лишь дополняет визуал, легко откатывается удалением хука.

## Будущая интеграция с IntroAnimation

`NavbarSource` уже включает `'intro'` — зарезервировано под
сценарий, когда IntroAnimation завершается и инициирует «вход»
навбара. На фазе 2:

1. Шина поднимается до singleton (или IntroAnimation получает
   `useNavbar()` через context — потребует вложенности
   `IntroAnimation` под `NavigationBarProvider`).
2. `IntroAnimation.onComplete` вызывает
   `events.emit('state:change', { state, prev, source: 'intro' })`.
3. Дочерние сцены фильтруют: `p.source === 'intro' && run()`.

Контракт API (`NavbarSource`, типы payload) уже зафиксирован,
потребителей пока нет.

## См. также

Руководство по добавлению новой сцены: `docs/Components/adding-navbar-scene.md`.
