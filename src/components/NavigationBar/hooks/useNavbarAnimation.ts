import type { RefObject } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import type { Breakpoint } from '../../../utils/breakpoints';
import { logger } from '../../../utils/logger';
import type { NavbarEventBus, NavbarSource } from '../core/navbarEventBus';
import { getNavTransform, type NavState } from '../core/navbarStates';

/** Опции `useNavbarAnimation` — сцена дискретной анимации корневых нод навбара. */
export interface NavbarAnimationOptions {
  bus: NavbarEventBus;
  bp: Breakpoint;
  navRef: RefObject<HTMLElement | null>;
  toggleRef: RefObject<HTMLButtonElement | null>;
}

/**
 * useNavbarAnimation — сцена дискретной анимации раскладки навбара.
 *
 * Реагирует на `state:change` из шины и твинит `x` на `nav` (и toggle на mobile)
 * прямыми `gsap.to()` — всё на композиторе, без изменения раскладки. Отступ
 * контента `<main>` не трогается: он задаётся статично через
 * `--nav-content-offset`.
 *
 * Твины создаются через `contextSafe` и регистрируются в контексте `useGSAP`,
 * поэтому при размонтировании или смене зависимостей автоматически убиваются
 * (`revertOnUpdate`). Подписка на bus отписывается через cleanup-функцию,
 * возвращаемую из callback-а.
 *
 * При `source === 'scroll'` позиции уже задаёт scrub-таймлайн из
 * `useNavbarScrubTrigger`: отдельный tween с `overwrite:'auto'` убил бы его
 * активные твины на тех же таргетах, и скролл перестал бы двигать навбар.
 * Поэтому скролл-источник здесь НЕ анимируется.
 */
export function useNavbarAnimation({
  bus,
  bp,
  navRef,
  toggleRef,
}: NavbarAnimationOptions): void {
  useGSAP(
    (_ctx, contextSafe) => {
      // В callback-форме useGSAP всегда передаёт contextSafe; тип помечает
      // его optional из-за config-only оверлоада.
      const animateNavbar = contextSafe!(
        (state: NavState, source: NavbarSource) => {
          if (source === 'scroll') return;

          const isMobile = bp === 'mobile';
          const t = getNavTransform(state, bp, window.innerWidth);

          logger.trace(
            'NavbarLayout',
            `animate → ${state} (source=${source})`,
            { isMobile, ...t },
          );

          if (navRef.current) {
            gsap.to(navRef.current, {
              x: t.navX,
              duration: 0.6,
              ease: 'power2.inOut',
              overwrite: 'auto',
            });
          }

          if (isMobile && t.toggleX !== null && toggleRef.current) {
            gsap.to(toggleRef.current, {
              x: t.toggleX,
              duration: 0.6,
              ease: 'power2.inOut',
              overwrite: 'auto',
            });
          }
        },
      );

      // Подписка на дискретные события шины. Сцена публикует событие через
      // `applyState` (в useNavbarState), а сама на него реагирует здесь —
      // единый путь для всех источников (toggle/route/breakpoint/scroll).
      return bus.on('state:change', ({ state, prev, source }) => {
        if (state === prev) return;
        animateNavbar(state, source);
      });
    },
    {
      dependencies: [bus, bp, navRef, toggleRef],
      revertOnUpdate: true,
    },
  );
}
