import { useCallback, useRef, type RefObject } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { logger } from '../../../utils/logger';
import { useNavbar, useNavbarScrollProgress } from '../core/navbarContext';
import { getNavTransform } from '../core/navbarStates';

/** Опции `useNavbarPosition` — сцена-владелец позиции `.nav`. */
export interface NavbarPositionOptions {
  /** Реф на `<nav>` — единственная DOM-нода, которой владеет эта сцена. */
  navRef: RefObject<HTMLElement | null>;
}

/**
 * useNavbarPosition — сцена-владелец позиции корневой ноды навбара (`.nav`).
 *
 * Единственный источник анимации `x` на `.nav`. Объединяет два режима,
 * которые раньше жили в разных сценах и конфликтовали через `overwrite`:
 *
 * 1. **Scrub (`/home`)** — paused-твин `fromTo(nav, {x:0} → {x: homeEnd})`,
 *    ведомый низкоуровневым каналом `onScrollProgress` (ScrollTrigger
 *    остаётся в провайдере/странице, навбар лишь потребляет прогресс).
 * 2. **Дискретная анимация** (`state:change` с `source !== 'scroll'` —
 *    toggle/route/breakpoint) — `gsap.to(nav, {x})` со стандартным
 *    `overwrite: 'auto'`.
 *
 * Так как scrub-твин `paused`, он не «активен» для GSAP: `overwrite:'auto'`
 * дискретной анимации его НЕ убивает. Гонка двух владельцев (корень бага
 * «не автораскрывается на /home после tablet toggle») устранена структурно —
 * теперь нодой владеет одна сцена.
 *
 * Также регистрирует в провайдере функцию пересоздания scrub-твина при смене
 * ручного tablet-выбора (`preferredRef` → `getHomeEndState`), вызываемую из
 * `useNavbarToggle` через `retargetScrub`.
 */
export function useNavbarPosition({ navRef }: NavbarPositionOptions): void {
  const { getHomeEndState, registerRetargetScrub, events } = useNavbar();

  /** Ссылка на paused-твин scrub-позиции `/home`. */
  const scrubTweenRef = useRef<gsap.core.Tween | null>(null);

  useGSAP(
    (_ctx, contextSafe) => {
      /**
       * Пересоздаёт paused scrub-твин под актуальный `getHomeEndState()`.
       *
       * GSAP читает значение твина один раз при создании, поэтому при смене
       * ручного tablet-выбора таргет стал бы устаревшим. `immediateRender:false`
       * и `paused:true` — твин ничего не выставляет при создании; позицию он
       * применяет только когда `onScrollProgress` выставит `progress`.
       */
      const buildScrub = contextSafe!(() => {
        const nav = navRef.current;
        if (!nav) return;
        scrubTweenRef.current?.kill();
        scrubTweenRef.current = gsap.fromTo(
          nav,
          { x: 0 },
          {
            x: getHomeEndState(),
            ease: 'none',
            paused: true,
            immediateRender: false,
          },
        );
      });

      // Первичная сборка + регистрация ретаргета для `useNavbarToggle`.
      buildScrub();
      const unregisterRetarget = registerRetargetScrub(buildScrub);

      // Дискретная анимация: позицию при `source === 'scroll'` ведёт scrub-твин,
      // отдельный gsap.to здесь не нужен (иначе убил бы scrub `overwrite:'auto'`).
      const offDiscrete = events.on(
        'state:change',
        ({ state, prev, source }) => {
          if (state === prev || source === 'scroll') return;
          const nav = navRef.current;
          if (!nav) return;
          const t = getNavTransform(state, window.innerWidth);
          logger.trace(
            'NavbarLayout',
            `animate → ${state} (source=${source})`,
            { navX: t.navX },
          );
          gsap.to(nav, {
            x: t.navX,
            duration: 0.6,
            ease: 'power2.inOut',
            overwrite: 'auto',
          });
        },
      );

      return () => {
        offDiscrete();
        unregisterRetarget();
        scrubTweenRef.current?.kill();
        scrubTweenRef.current = null;
      };
    },
    { dependencies: [navRef, getHomeEndState, registerRetargetScrub, events] },
  );

  // Scrub-прогресс из ScrollTrigger (низкоуровневый канал, без React-рендера).
  // Paused-твин применяет позицию при каждом `progress`.
  useNavbarScrollProgress(
    useCallback(({ progress }) => {
      scrubTweenRef.current?.progress(progress);
    }, []),
  );
}
