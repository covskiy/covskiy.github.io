import type { RefObject } from 'react';
import { useBreakpoint } from '../../../utils/breakpoints';
import type { NavbarEventBus, NavbarSource } from '../core/navbarEventBus';
import type { NavState } from '../core/navbarStates';
import {
  useNavbarScrubTrigger,
  type ScrollProgressListener,
  type ToggleVisibilityListener,
} from './useNavbarScrubTrigger';
import { useNavbarState } from './useNavbarState';
import { useNavbarToggle } from './useNavbarToggle';

/**
 * Публичный API layout-сцены — возвращается из `useNavbarLayout`.
 *
 * - `currentState` — синхронный React-state для проброса `isSlim` в NavigationBar
 *   (рендер зависит от него). Обновляется из подписки на `state:change`,
 *   которую публикует `applyState`, — единый конвейер для всех источников.
 * - `applyState(next, source)` — единственная точка изменения состояния.
 *   Публикует `state:change` в шину, чтобы дочерние сцены узнали о смене.
 * - `registerScrollTrigger(trigger)` — фасад для страниц: создаёт scrub-таймлайн
 *   и публикует прогресс через низкоуровневый канал (см. `scrollListenersRef`).
 * - `scrollListenersRef` — Set, через который `ScrollTrigger.onUpdate` зовёт
 *   подписчиков напрямую (без bus.emit и без React-рендера).
 */
export interface NavbarLayout {
  currentState: NavState;
  applyState: (next: NavState, source: NavbarSource) => NavState;
  registerScrollTrigger: (trigger: HTMLElement) => () => void;
  scrollListenersRef: RefObject<Set<ScrollProgressListener>>;
  /**
   * Эффективное конечное состояние навбара на `/home` (после скролла
   * спейсера). Читает `preferredRef` на лету: `mobile → invisible`,
   * `tablet` с ручным выбором → `slim`/`standard`, иначе `standard`.
   * Используется провайдером для отступа `<main>` и scrub-таймлайном.
   */
  getHomeEndState: () => NavState;
}

/**
 * useNavbarLayout — композер корневой сцены раскладки навбара.
 *
 * Единственная сцена, которая знает о геометрии раскладки навбара
 * (видимая ширина). Собирает три тематические под-сцены:
 *
 * - `useNavbarState` — состояние и подписки на дискретные события шины
 *   (`state:change`/`route:change`/`breakpoint:change`);
 * - `useNavbarScrubTrigger` — scrub-таймлайн `/home` (`registerScrollTrigger`);
 * - `useNavbarToggle` — подписчик на `toggle:request` (клик по кнопке toggle).
 *
 * Позицию `.nav` владеет НЕ эта сцена, а дочерняя хук-сцена `useNavbarPosition`
 * (вызывается в `NavigationBar`): она подписана на `state:change` (дискретная
 * анимация) и на низкоуровневый канал `onScrollProgress` (scrub).
 *
 * Дочерние сцены (NavItem, логотип и т. д.) НЕ подписаны на layout —
 * они реагируют только на дискретные `state:change` (или `scroll:progress`,
 * если им нужна scrub-привязка через `useNavbarScrollProgress`).
 *
 * Порядок эффектов важен: layout-эффект `useGSAP` в `useNavbarPosition`
 * выполняется раньше passive-эффекта в `useNavbarState`, поэтому подписка
 * дискретной анимации регистрируется до того, как state-сцена вызовет начальный
 * `recomputeTarget()` и опубликует первое состояние.
 */
export function useNavbarLayout(
  bus: NavbarEventBus,
  options: {
    scrollListenersRef: NavbarLayout['scrollListenersRef'];
    /**
     * Set слушателей канала видимости toggle (владеет провайдер).
     * Пробрасывается в scrub-сцену, которая публикует видимость напрямую.
     */
    toggleVisibilityListenersRef: RefObject<Set<ToggleVisibilityListener>>;
    /** IsHome на момент первого рендера (без него layout не знает роута, пока шина не заэмитит route:change). */
    initialIsHome: boolean;
    /** Фасад провайдера — пересоздание scrub-твина позиции `.nav` (см. useNavbarToggle). */
    retargetScrub: () => void;
  },
): NavbarLayout {
  const bp = useBreakpoint();
  const {
    scrollListenersRef,
    toggleVisibilityListenersRef,
    initialIsHome,
    retargetScrub,
  } = options;

  const state = useNavbarState({ bus, bp, initialIsHome });

  const scrub = useNavbarScrubTrigger({
    bus,
    bp,
    scrollListenersRef,
    toggleVisibilityListenersRef,
    state,
  });

  // Сцена ручного переключения: подписчик на 'toggle:request' от ToggleButton.
  useNavbarToggle({
    bus,
    bp,
    state,
    scrollTriggerRef: scrub.scrollTriggerRef,
    retargetScrub,
  });

  return {
    currentState: state.currentState,
    applyState: state.applyState,
    registerScrollTrigger: scrub.registerScrollTrigger,
    scrollListenersRef,
    getHomeEndState: state.getHomeEndState,
  };
}
