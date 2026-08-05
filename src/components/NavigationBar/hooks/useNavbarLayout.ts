import type { RefObject } from 'react';
import { useBreakpoint } from '../../../utils/breakpoints';
import type { NavbarEventBus, NavbarSource } from '../core/navbarEventBus';
import type { NavState } from '../core/navbarStates';
import { useNavbarAnimation } from './useNavbarAnimation';
import {
  useNavbarScrubTrigger,
  type ScrollProgressListener,
} from './useNavbarScrubTrigger';
import { useNavbarState } from './useNavbarState';
import { useNavbarToggle } from './useNavbarToggle';

/** Рефы на корневые DOM-ноды навбара, которыми владеет провайдер. */
export interface NavbarLayoutRefs {
  navRef: RefObject<HTMLElement | null>;
  toggleRef: RefObject<HTMLButtonElement | null>;
}

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
 * - `handleToggle()` — клик по кнопке toggle (☰ / ←). Использует
 *   `getNextState(current, bp)` для вычисления следующего состояния.
 */
export interface NavbarLayout {
  currentState: NavState;
  applyState: (next: NavState, source: NavbarSource) => NavState;
  registerScrollTrigger: (trigger: HTMLElement) => () => void;
  scrollListenersRef: RefObject<Set<ScrollProgressListener>>;
  handleToggle: () => void;
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
 * (видимая ширина, позиция toggle на mobile). Собирает четыре тематические
 * под-сцены:
 *
 * - `useNavbarState` — состояние и подписки на дискретные события шины
 *   (`state:change`/`route:change`/`breakpoint:change`);
 * - `useNavbarAnimation` — дискретная GSAP-анимация корневых нод
 *   (реакция на `state:change` через layout-эффект `useGSAP`);
 * - `useNavbarScrubTrigger` — scrub-таймлайн `/home` (`registerScrollTrigger`);
 * - `useNavbarToggle` — ручное переключение состояния по клику.
 *
 * Дочерние сцены (NavItem, логотип и т. д.) НЕ подписаны на layout —
 * они реагируют только на дискретные `state:change` (или `scroll:progress`,
 * если им нужна scrub-привязка через `useNavbarScrollProgress`).
 *
 * Порядок эффектов важен: layout-эффект `useGSAP` в `useNavbarAnimation`
 * выполняется раньше passive-эффекта в `useNavbarState`, поэтому подписка
 * `animateNavbar` регистрируется до того, как state-сцена вызовет начальный
 * `recomputeTarget()` и опубликует первое состояние.
 */
export function useNavbarLayout(
  bus: NavbarEventBus,
  refs: NavbarLayoutRefs,
  options: {
    scrollListenersRef: NavbarLayout['scrollListenersRef'];
    /** IsHome на момент первого рендера (без него layout не знает роута, пока шина не заэмитит route:change). */
    initialIsHome: boolean;
  },
): NavbarLayout {
  const bp = useBreakpoint();
  const { navRef, toggleRef } = refs;
  const { scrollListenersRef, initialIsHome } = options;

  const state = useNavbarState({ bus, bp, initialIsHome });

  useNavbarAnimation({ bus, bp, navRef, toggleRef });

  const scrub = useNavbarScrubTrigger({
    bus,
    bp,
    navRef,
    toggleRef,
    scrollListenersRef,
    state,
  });

  const handleToggle = useNavbarToggle({
    bp,
    state,
    scrollTriggerRef: scrub.scrollTriggerRef,
    retargetScrub: scrub.retargetScrub,
  });

  return {
    currentState: state.currentState,
    applyState: state.applyState,
    registerScrollTrigger: scrub.registerScrollTrigger,
    scrollListenersRef,
    handleToggle,
    getHomeEndState: state.getHomeEndState,
  };
}
