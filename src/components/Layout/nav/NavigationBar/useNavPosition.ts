import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import type { RefObject } from 'react';
import { useLayoutEngine } from '../../context/layoutContexts';
import { useGsapBus } from '../../gsap/gsapContext';
import { useRegisterSpacerScrollTrigger } from '../../gsap/useRegisterSpacerScrollTrigger';
import { getNavTransform } from '../../machine/geometry';
import type { LayoutSnapshot } from '../../machine/layoutSnapshot';

const NAV_ANIM_DURATION = 0.6;
const NAV_ANIM_EASE = 'power2.inOut';

/**
 * useNavPosition — владелец x-позиции `.nav`.
 *
 * Два режима:
 * 1. **Scrub (`/home`)** — paused-твин `fromTo(nav, {x:0} → {x: homeEnd})`,
 *    ведомый `scroll:progress` из gsapBus. Твин paused, поэтому не конфликтует
 *    с дискретной анимацией через `overwrite: 'auto'`.
 * 2. **Дискретная анимация** (toggle/route/breakpoint) — `gsap.to(nav, {x})`
 *    при смене mode через engine.subscribe.
 *
 * Снимок машины передаётся параметром из `NavigationBar` (единственный
 * читатель `useLayoutSnapshot()` в навбаре) — huk сам контекст не читает.
 */
export function useNavPosition(
  navRef: RefObject<HTMLElement | null>,
  snapshot: LayoutSnapshot,
) {
  const engine = useLayoutEngine();
  const bus = useGsapBus();
  const { getSpacerScrollProgress } = useRegisterSpacerScrollTrigger();
  const scrubTweenRef = useRef<gsap.core.Tween | null>(null);
  const prevManualRef = useRef(false);

  useGSAP(
    (_ctx, contextSafe) => {
      const nav = navRef.current;
      if (!nav) return;

      const buildScrub = contextSafe!(() => {
        scrubTweenRef.current?.kill();
        const endX = getNavTransform(
          snapshot.homeEndState,
          window.innerWidth,
        ).navX;
        scrubTweenRef.current = gsap.fromTo(
          nav,
          { x: 0 },
          {
            x: endX,
            ease: 'none',
            paused: true,
            immediateRender: false,
          },
        );
      });

      buildScrub();

      const unsubscribe = engine.subscribe((snap) => {
        const manualNow = snap.isManualToggle;
        // Обычный /home-scrub: пропускаем discrete-анимацию, пока НЕ было
        // ручного toggle (иначе твин будет биться со scrub-твином).
        if (snap.isHome && !manualNow && !prevManualRef.current) return;
        prevManualRef.current = manualNow;
        const navEl = navRef.current;
        if (!navEl) return;
        const t = getNavTransform(snap.value, window.innerWidth);
        gsap.to(navEl, {
          x: t.navX,
          duration: NAV_ANIM_DURATION,
          ease: NAV_ANIM_EASE,
          overwrite: 'auto',
        });
      });

      return () => {
        unsubscribe();
        scrubTweenRef.current?.kill();
        scrubTweenRef.current = null;
      };
    },
    { dependencies: [navRef, engine, snapshot.homeEndState], scope: navRef },
  );

  useEffect(() => {
    if (!snapshot.isHome || snapshot.isManualToggle) return;
    const tween = scrubTweenRef.current;
    if (tween) {
      tween.invalidate();
      tween.progress(getSpacerScrollProgress());
    }
    return bus.on('scroll:progress', ({ progress }) => {
      scrubTweenRef.current?.progress(progress);
    });
  }, [bus, snapshot.isHome, snapshot.isManualToggle, getSpacerScrollProgress]);
}
