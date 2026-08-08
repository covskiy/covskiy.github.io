import { useEffect, useRef, type RefObject } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { logger } from '../../../utils/logger';
import { useLayout } from '../LayoutProvider/LayoutContext';
import { getNavTransform } from '../machine/geometry';

/** Опции `useNavPosition` — сцена-владелец позиции `.nav`. */
export interface NavPositionOptions {
  /** Реф на `<nav>` — единственная DOM-нода, которой владеет эта сцена. */
  navRef: RefObject<HTMLElement | null>;
}

/**
 * useNavPosition — сцена-владелец позиции корневой ноды навбара (`.nav`).
 *
 * Единственный источник анимации `x` на `.nav`. Объединяет два режима,
 * которые раньше жили в разных сценах и конфликтовали через `overwrite`:
 *
 * 1. **Scrub (`/home`)** — paused-твин `fromTo(nav, {x:0} → {x: homeEndMode})`,
 *    ведомый низкоуровневым каналом `onScrollProgress` (ScrollTrigger остаётся
 *    в `/home`, навбар лишь потребляет прогресс).
 * 2. **Дискретная анимация** (`onNavState` с `source !== 'scroll'` —
 *    toggle/route/breakpoint) — `gsap.to(nav, {x})` со стандартным
 *    `overwrite: 'auto'`.
 *
 * Так как scrub-твин `paused`, он не «активен» для GSAP: `overwrite:'auto'`
 * дискретной анимации его НЕ убивает. Гонка двух владельцев устраняется
 * структурно — нодой владеет одна сцена.
 *
 * Также регистрирует в провайдере функцию пересоздания scrub-твина при смене
 * ручного tablet-выбора (`preferredRef` → `getHomeEndState`). Executor машины
 * дёргает её по action `RETARGET_SCRUB`.
 */
export function useNavPosition({ navRef }: NavPositionOptions): void {
  const {
    getHomeEndState,
    registerRetargetScrub,
    onNavState,
    onScrollProgress,
  } = useLayout();

  /** Ссылка на paused-твин scrub-позиции `/home`. */
  const scrubTweenRef = useRef<gsap.core.Tween | null>(null);

  useGSAP(
    (_ctx, contextSafeSrc) => {
      /**
       * Пересоздаёт paused scrub-твин под актуальный `getHomeEndState()`.
       *
       * GSAP читает значение твина один раз при создании, поэтому при смене
       * ручного tablet-выбора таргет стал бы устаревшим. `immediateRender:false`
       * и `paused:true` — твин ничего не выставляет при создании; позицию он
       * применяет только когда `onScrollProgress` выставит `progress`.
       */
      const buildScrub = contextSafeSrc!((): void => {
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

      // Первичная сборка + регистрация ретаргета (action RETARGET_SCRUB).
      buildScrub();
      const unregisterRetarget = registerRetargetScrub(buildScrub);

      // Дискретная анимация: позицию при `source === 'scroll'` ведёт scrub-твин,
      // отдельный gsap.to здесь не нужен (иначе убил бы scrub `overwrite:'auto'`).
      const offNavState = onNavState(({ prev, next, source }) => {
        if (next === prev || source === 'scroll') return;
        const nav = navRef.current;
        if (!nav) return;
        const t = getNavTransform(next, window.innerWidth);
        logger.trace('Layout', `animatePosition → ${next} (source=${source})`, {
          navX: t.navX,
        });
        gsap.to(nav, {
          x: t.navX,
          duration: 0.6,
          ease: 'power2.inOut',
          overwrite: 'auto',
        });
      });

      return () => {
        offNavState();
        unregisterRetarget();
        scrubTweenRef.current?.kill();
        scrubTweenRef.current = null;
      };
    },
    {
      dependencies: [
        navRef,
        getHomeEndState,
        registerRetargetScrub,
        onNavState,
      ],
    },
  );

  // Scrub-прогресс из ScrollTrigger (низкоуровневый канал, без React-рендера).
  // Paused-твин применяет позицию при каждом `progress`.
  useEffect(() => {
    return onScrollProgress(({ progress }) => {
      scrubTweenRef.current?.progress(progress);
    });
  }, [onScrollProgress]);
}
