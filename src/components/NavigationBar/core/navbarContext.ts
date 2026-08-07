import {
  createContext,
  useContext,
  useEffect,
  useRef,
  type DependencyList,
} from 'react';
import type {
  EventName,
  Listener,
  NavbarEventBus,
  NavbarEventMap,
} from './navbarEventBus';
import type { NavState } from './navbarStates';

/**
 * API управления навбаром, который NavigationBarProvider прокидывает
 * страницам и дочерним сценам через React Context.
 *
 * Слои API:
 *
 * 1. `registerScrollTrigger(trigger)` — контракт для страниц.
 *    NavigationBar создаёт scrub-таймлайн, привязанный к `trigger`,
 *    и сам обновляет состояние навбара на границах спейсера.
 *
 * 2. `getState()` — синхронное чтение текущего состояния. Полезно
 *    при инициализации подписчика, чтобы понять, в каком состоянии
 *    уже находится навбар и не делать лишний твин «из воздуха».
 *
 * 3. `events` — типизированная шина событий. Для дискретных событий
 *    (`state:change`, `route:change`, `breakpoint:change`) и редких
 *    публикаций `scroll:progress` (например, финальный кадр scrub).
 *
 * 4. `onScrollProgress(listener)` — низкоуровневый канал для 60fps
 *    scrub-подписчиков. НЕ использует React-re-render, работает
 *    через прямой вызов listener внутри `ScrollTrigger.onUpdate`.
 *    Возвращает unsubscribe-функцию.
 *
 * 5. `onToggleVisibility(listener)` — низкоуровневый канал видимости
 *    кнопки toggle (scrub-производная, см. `useNavbarToggleVisibility`).
 *    Аналогично `onScrollProgress`: прямой вызов listener без bus.emit
 *    и без React-рендера. Возвращает unsubscribe-функцию.
 */
export interface NavbarAPI {
  /**
   * Регистрирует ScrollTrigger, привязанный к элементу-триггеру со страницы.
   *
   * NavigationBar сам создаёт таймлайн (width навбара + margin-left контента)
   * и обновляет своё React-состояние на границах спейсера.
   * Возвращает функцию, убивающую триггер и таймлайн (вызывается в cleanup
   * вызывающей страницы).
   */
  registerScrollTrigger: (trigger: HTMLElement) => () => void;

  /** Текущее состояние навбара (синхронный snapshot). */
  getState: () => NavState;

  /** Шина событий. См. `NavbarEventMap` в `navbarEventBus.ts`. */
  events: NavbarEventBus;

  /**
   * Подписка на прогресс скролла БЕЗ React-re-render. Для scrub-сценариев,
   * которым нужно знать progress непрерывно (бегущая подсветка активной
   * ссылки, parallax внутри навбара и т. п.).
   *
   * В отличие от `events.on('scroll:progress', ...)`, listener вызывается
   * напрямую из `ScrollTrigger.onUpdate` — без прохода через `emit`
   * и без потенциальных ререндеров.
   */
  onScrollProgress: (
    listener: (p: { progress: number; direction: 1 | -1 }) => void,
  ) => () => void;

  /**
   * Подписка на видимость кнопки toggle БЕЗ React-re-render.
   *
   * Видимость — scrub-производная: вычисляется в `ScrollTrigger.onUpdate`
   * `/home` (видна, когда навбар ушёл за экран `progress ≈ 1` или пока
   * состояние задано вручную) и передаётся подписчикам напрямую, минуя
   * `events` (см. `useNavbarToggleVisibility`). Listener применяет `gsap.set`
   * к своей DOM-ноде, React-рендер не используется.
   */
  onToggleVisibility: (listener: (visible: boolean) => void) => () => void;
}

export const NavbarContext = createContext<NavbarAPI | null>(null);

/** Доступ к API навбара из любой страницы или компонента внутри NavigationBarProvider. */
export function useNavbar(): NavbarAPI {
  const ctx = useContext(NavbarContext);
  if (!ctx) {
    throw new Error('useNavbar must be used within NavigationBarProvider');
  }
  return ctx;
}

/**
 * React-обёртка над `events.on` — подписка на дискретные события шины.
 *
 * Подходит для `state:change`, `route:change`, `breakpoint:change`,
 * `spacer:enter`, `spacer:leave`. Для
 * `scroll:progress` предпочтительнее `useNavbarScrollProgress` —
 * он работает через низкоуровневый канал и не вызывает ререндер.
 *
 * Listener оборачивается в latest-ref: при изменении listener переподписка
 * не происходит, listener всегда видит свежее замыкание. Это упрощает
 * вызывающую сторону (не нужно оборачивать listener в `useCallback`).
 * Если listener'у нужны дополнительные зависимости для переподписки —
 * используйте `deps` (массив зависимостей).
 */
export function useNavbarEvent<E extends EventName>(
  event: E,
  listener: Listener<E>,
  deps?: DependencyList,
): void {
  const { events } = useNavbar();
  const listenerRef = useRef(listener);
  listenerRef.current = listener;

  useEffect(() => {
    const ref = listenerRef as unknown as {
      current: (p: NavbarEventMap[E]) => void;
    };
    const stable = ((payload: NavbarEventMap[E]) => {
      ref.current(payload);
    }) as Listener<E>;
    return events.on(event, stable);
    // deps пробрасываются напрямую: если они меняются, подписка пересоздаётся.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, event, ...(deps ?? [])]);
}

/**
 * React-обёртка над `onScrollProgress` для scrub-подписчиков.
 *
 * Listener вызывается из `ScrollTrigger.onUpdate` напрямую, минуя
 * React-рендер. Не используйте setState внутри — это приведёт к 60fps
 * ререндерам. Вместо этого применяйте GSAP напрямую к DOM-нодам.
 */
export function useNavbarScrollProgress(
  listener: (p: { progress: number; direction: 1 | -1 }) => void,
): void {
  const { onScrollProgress } = useNavbar();
  useEffect(() => onScrollProgress(listener), [onScrollProgress, listener]);
}

/**
 * React-обёртка над `onToggleVisibility` для подписчиков видимости toggle.
 *
 * Listener вызывается из `ScrollTrigger.onUpdate` напрямую, минуя
 * React-рендер. Не используйте setState внутри — вместо этого применяйте
 * GSAP к своей DOM-ноде (например `gsap.set(ref.current, { autoAlpha, pointerEvents })`).
 */
export function useNavbarToggleVisibility(
  listener: (visible: boolean) => void,
): void {
  const { onToggleVisibility } = useNavbar();
  useEffect(() => onToggleVisibility(listener), [onToggleVisibility, listener]);
}
