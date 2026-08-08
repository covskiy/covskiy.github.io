import { useCallback, type RefObject } from 'react';
import gsap from 'gsap';
import type { ScrollTrigger } from 'gsap/ScrollTrigger';
import type { Breakpoint } from '../../../utils/breakpoints';
import { logger } from '../../../utils/logger';
import { getNextState, hasToggleFor } from '../machine/derive';
import type { LayoutStateApi } from './useLayoutState';

/** Опции `useLayoutToggle` — сцена ручного переключения состояния раскладки. */
export interface LayoutToggleOptions {
  bp: Breakpoint;
  state: Pick<
    LayoutStateApi,
    'applyState' | 'modeRef' | 'preferredRef' | 'isHomeRef'
  >;
  /** Активный ScrollTrigger страницы (для программной прокрутки на `/home`). */
  scrollTriggerRef: RefObject<ScrollTrigger | null>;
  /**
   * Фасад провайдера, пересоздающий scrub-твин позиции `.nav` под актуальный
   * ручной tablet-выбор (см. `useNavPosition` → `registerRetargetScrub`).
   */
  retargetScrub: () => void;
}

/**
 * useLayoutToggle — сцена ручного переключения состояния раскладки.
 *
 * Возвращает хендлер `toggle()`, который при клике по ☰ / ← вычисляет
 * следующее состояние через `getNextState`, применяет его через
 * `applyState(next, 'toggle')`, сохраняет ручной tablet-выбор
 * (`slim`/`standard`) между страницами и уведомляет владельца позиции
 * (`useNavPosition`) о смене предпочтения через `retargetScrub`. На `/home`
 * (mobile) сворачивание в `invisible` дополнительно прокручивает страницу
 * к концу спейсера.
 *
 * Это обычный колбэк (без подписки на события): `ToggleButton` вызывает
 * `useLayout().toggle()` напрямую.
 */
export function useLayoutToggle({
  bp,
  state,
  scrollTriggerRef,
  retargetScrub,
}: LayoutToggleOptions): () => void {
  const { applyState, modeRef, preferredRef, isHomeRef } = state;

  return useCallback(() => {
    if (!hasToggleFor(bp)) {
      logger.warn(
        'Layout',
        'Toggle вызван на desktop — кнопка скрыта, игнорируем',
      );
      return;
    }

    const next = getNextState(modeRef.current, bp);
    if (!next) {
      logger.warn(
        'Layout',
        `getNextState вернул null при current=${modeRef.current}, bp=${bp}`,
      );
      return;
    }

    const prev = modeRef.current;
    applyState(next, 'toggle');
    logger.info('Layout', `Toggle: ${prev} → ${next} (${bp})`);

    // Ручной tablet-выбор (slim/standard) сохраняем между страницами:
    // при смене роута он становится целевым состоянием, чтобы не было
    // «моргания» границы навбар/контент (25vw ↔ 80px).
    if (bp === 'tablet' && (next === 'slim' || next === 'standard')) {
      preferredRef.current = next;
      // Пересоздаём scrub-твин позиции `.nav` с новым таргетом: GSAP берёт
      // значение твина один раз при рендере, без пересоздания скролл к низу
      // /home вёл бы навбар в устаревшее `standard` вместо ручного `slim`.
      retargetScrub();
    }

    // Проматываем спейсер если мы сворачиваем навбар на мобильном профиле
    // домашней страницы.
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
    modeRef,
    preferredRef,
    isHomeRef,
    scrollTriggerRef,
    retargetScrub,
  ]);
}
