import type { Breakpoint } from '../../../utils/breakpoints';
import type { NavState } from './navbarStates';
import { logger } from '../../../utils/logger';

/**
 * Источник изменения состояния навбара.
 *
 * Используется в payload `state:change`, чтобы подписчики могли отличить
 * автоматическое переключение (скролл, смена роута/breakpoint) от ручного
 * (toggle) и — в будущем — от событий, инициированных IntroAnimation.
 *
 * - `scroll`     — ScrollTrigger на спейсере страницы достиг границы (progress 0 / 1)
 * - `toggle`     — клик по кнопке toggle (☰ / ←)
 * - `route`      — смена pathname через react-router
 * - `breakpoint` — смена breakpoint (mobile / tablet / desktop)
 * - `intro`      — зарезервировано для будущей интеграции с IntroAnimation,
 *                  когда IntroAnimation будет инициировать «вход» навбара
 *                  после завершения собственной сцены. Контракт API зафиксирован,
 *                  но потребителей пока нет (см. docs/Components/NavigationBar.md).
 */
export type NavbarSource =
  | 'scroll'
  | 'toggle'
  | 'route'
  | 'breakpoint'
  | 'intro';

/**
 * Карта событий шины навбара. Используется для типобезопасной подписки
 * `bus.on('state:change', listener)` — TypeScript проверяет форму payload
 * по имени события.
 *
 * События делятся на две группы по частоте:
 *
 * - Дискретные (`state:change`, `route:change`, `breakpoint:change`,
 *   `spacer:enter`, `spacer:leave`) — безопасны для React-подписчиков
 *   через `useNavbarEvent`. Срабатывают на границах состояния,
 *   не чаще нескольких раз за навигацию.
 *
 * - Непрерывные (`scroll:progress`) — публикуются до 60 раз в секунду
 *   при scrub. Для них в `NavbarAPI` предусмотрен отдельный низкоуровневый
 *   канал `onScrollProgress`, который НЕ проходит через `bus.emit`,
 *   чтобы не давить на React-рендер. Доступ к шине через `events.emit`
 *   для прогресса скролла зарезервирован под будущие сценарии, которым
 *   нужна согласованная последовательность (например, финальный кадр
 *   scrub-анимации как часть большего таймлайна).
 */
export interface NavbarEventMap {
  'state:change': {
    state: NavState;
    prev: NavState;
    source: NavbarSource;
  };
  'route:change': {
    pathname: string;
    prev: string;
  };
  'breakpoint:change': {
    bp: Breakpoint;
    prev: Breakpoint;
  };
  'scroll:progress': {
    progress: number;
    direction: 1 | -1;
  };
  /**
   * Пользователь кликнул по кнопке toggle (☰ / ←) — интент вручную
   * переключить состояние навбара. Публикуется дочерней сценой
   * `ToggleButton`; обработчик живёт в `useNavbarToggle`.
   */
  'toggle:request': object;
  /**
   * Спейсер страницы (зарегистрированный через `registerScrollTrigger`)
   * полностью ушёл за верхний край экрана: скролл вниз, `progress ≈ 1`.
   * См. `onLeave` ScrollTrigger в `useNavbarLayout`.
   */
  'spacer:leave': object;
  /**
   * Спейсер страницы снова появился во вьюпорте: скролл вверх,
   * `progress` упал ниже 1. См. `onEnterBack` ScrollTrigger
   * в `useNavbarLayout`.
   */
  'spacer:enter': object;
}

export type EventName = keyof NavbarEventMap;
export type Listener<E extends EventName> = (
  payload: NavbarEventMap[E],
) => void;

/**
 * Типизированная шина событий навбара.
 *
 * Минимальный pub/sub с snapshot-семантикой при emit: если listener
 * удаляет сам себя в обработчике, оставшиеся слушатели всё равно
 * получат событие в текущей итерации. Это упрощает cleanup-логику
 * в дочерних сценах (NavItem и т. д.), которым нужно отписаться
 * при размонтировании прямо во время обработки события.
 */
export interface NavbarEventBus {
  on<E extends EventName>(event: E, listener: Listener<E>): () => void;
  off<E extends EventName>(event: E, listener: Listener<E>): void;
  emit<E extends EventName>(event: E, payload: NavbarEventMap[E]): void;
}

/**
 * Создаёт инстанс шины. Вызывается один раз в `NavigationBarProvider`
 * через `useMemo`, поэтому шина scoped на провайдер и переживает ререндеры.
 *
 * Для подписки на прогресс скролла в 60fps-сценариях используйте
 * отдельный канал `NavbarAPI.onScrollProgress`, а НЕ этот bus — emit
 * синхронный и попадает во все подписчики подряд, что неоптимально
 * для высокочастотных событий.
 */
export function createNavbarEventBus(): NavbarEventBus {
  const listeners = new Map<EventName, Set<Listener<EventName>>>();

  return {
    on(event, listener) {
      let set = listeners.get(event);
      if (!set) {
        set = new Set();
        listeners.set(event, set);
      }
      set.add(listener as Listener<EventName>);
      return () => {
        set?.delete(listener as Listener<EventName>);
      };
    },
    off(event, listener) {
      listeners.get(event)?.delete(listener as Listener<EventName>);
    },
    emit(event, payload) {
      const set = listeners.get(event);
      if (!set || set.size === 0) return;
      logger.debug('navbarEventBus', 'event emitted: ', event);
      // Snapshot, чтобы listener, удаливший себя в обработчике,
      // не сломал итерацию. `[...set]` копирует текущий набор.
      [...set].forEach((l) => {
        (l as Listener<typeof event>)(payload);
      });
    },
  };
}
