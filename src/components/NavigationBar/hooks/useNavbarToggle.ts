import { useCallback, useEffect, type RefObject } from 'react';
import gsap from 'gsap';
import type { ScrollTrigger } from 'gsap/ScrollTrigger';
import type { Breakpoint } from '../../../utils/breakpoints';
import { logger } from '../../../utils/logger';
import type { NavbarEventBus } from '../core/navbarEventBus';
import { getNextState, hasToggleFor } from '../core/navbarStates';
import type { NavbarStateApi } from './useNavbarState';

/** Опции `useNavbarToggle` — сцена ручного переключения состояния навбара. */
export interface NavbarToggleOptions {
  bus: NavbarEventBus;
  bp: Breakpoint;
  state: Pick<
    NavbarStateApi,
    'applyState' | 'stateRef' | 'preferredRef' | 'isHomeRef'
  >;
  /** Активный ScrollTrigger страницы (для программной прокрутки на /home). */
  scrollTriggerRef: RefObject<ScrollTrigger | null>;
  /** Пересоздание nav-твина scrub-таймлайна при смене ручного выбора. */
  retargetScrub: () => void;
}

/**
 * useNavbarToggle — сцена ручного переключения состояния навбара.
 *
 * Подписчик на событие `'toggle:request'`, которое публикует дочерняя
 * сцена `ToggleButton` (клик по ☰ / ←). Вычисляет следующее состояние через
 * `getNextState`, применяет его через `applyState(next, 'toggle')`, сохраняет
 * ручной tablet-выбор (`slim`/`standard`) между страницами и уведомляет scrub-сцену
 * о смене предпочтения через `retargetScrub`. На `/home` (mobile) сворачивание
 * навбара в `invisible` дополнительно прокручивает страницу к концу спейсера.
 *
 * Подписка пересоздаётся при смене зависимостей (`bp`, `applyState` и т. д.) —
 * редкие события, переподписка дешевле latest-ref паттерна.
 */
export function useNavbarToggle({
  bus,
  bp,
  state,
  scrollTriggerRef,
  retargetScrub,
}: NavbarToggleOptions): void {
  const { applyState, stateRef, preferredRef, isHomeRef } = state;

  /** Ручное переключение: клик по ☰ / ←. */
  const handleToggleRequest = useCallback(() => {
    if (!hasToggleFor(bp)) {
      logger.warn(
        'NavbarLayout',
        'Toggle вызван на desktop — кнопка скрыта, игнорируем',
      );
      return;
    }

    const next = getNextState(stateRef.current, bp);
    if (!next) {
      logger.warn(
        'NavbarLayout',
        `getNextState вернул null при current=${stateRef.current}, bp=${bp}`,
      );
      return;
    }

    const prev = applyState(next, 'toggle');
    logger.info('NavbarLayout', `Toggle: ${prev} → ${next} (${bp})`);

    // Ручной tablet-выбор (slim/standard) сохраняем между страницами:
    // при смене роута он становится целевым состоянием, чтобы не было
    // «моргания» границы навбар/контент (25vw ↔ 80px).
    if (bp === 'tablet' && (next === 'slim' || next === 'standard')) {
      preferredRef.current = next;
      // Пересоздаём nav-твин scrub-таймлайна с новым таргетом: GSAP берёт
      // значение твина один раз при рендере, без пересоздания скролл к низу
      // /home вёл бы навбар в устаревшее `standard` вместо ручного `slim`.
      retargetScrub();
    }

    // Проматываем spacer если мы сворачиваем навбар на мобильном профиле домашней страницы
    if (
      next === 'invisible' &&
      bp === 'mobile' &&
      isHomeRef.current &&
      scrollTriggerRef.current
    ) {
      const targetScroll = scrollTriggerRef.current.end;
      // Не скроллим, если пользователь уже ниже конца спейсера
      if (window.scrollY < targetScroll) {
        gsap.to(window, {
          scrollTo: { y: targetScroll, autoKill: false },
          duration: 0.6,
          ease: 'power2.inOut',
          overwrite: 'auto',
        });
      }
    }
  }, [
    bp,
    applyState,
    stateRef,
    preferredRef,
    isHomeRef,
    scrollTriggerRef,
    retargetScrub,
  ]);

  useEffect(
    () => bus.on('toggle:request', handleToggleRequest),
    [bus, handleToggleRequest],
  );
}
