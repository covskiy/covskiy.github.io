import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import type { RefObject } from 'react';
import { useLayoutEngine } from '../../context/layoutContexts';
import { useGsapBus } from '../../gsap/gsapContext';
import { useRegisterSpacerScrollTrigger } from '../../gsap/useRegisterSpacerScrollTrigger';
import { getNavTransform } from '../../machine/geometry';
import {
  decideScrubBuild,
  shouldAnimateDiscrete,
  shouldResyncScrub,
} from '../../machine/navPolicy';
import { logger } from '../../../../utils/logger';
import type { LayoutSnapshot } from '../../machine/layoutSnapshot';

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

      // Анимированная перецеливка scrub-а на новую геометрию, синхронная с
      // контентом (snapshot.transition). Единая точка для двух триггеров:
      // - смена breakpoint (buildScrub находит живой твин и делегирует сюда);
      // - действие RETARGET_SCRUB (tablet TOGGLE standard↔slim), см. ниже.
      // Значения homeEndState/transition берём из engine.getSnapshot(), т.к.
      // RETARGET_SCRUB стреляет синхронно внутри send() ДО ре-рендера, и
      // замыкание `snapshot` было бы устаревшим.
      const retargetScrub = contextSafe!(() => {
        const live = engine.getSnapshot();
        const progress =
          scrubTweenRef.current?.progress() ?? getSpacerScrollProgress();
        const endX = getNavTransform(live.homeEndState, window.innerWidth).navX;
        gsap.killTweensOf(nav);
        scrubTweenRef.current?.kill();
        scrubTweenRef.current = null;
        gsap.to(nav, {
          x: endX * progress,
          duration: live.transition.duration,
          ease: live.transition.ease,
          overwrite: 'auto',
          onComplete: () => {
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
            scrubTweenRef.current.progress(getSpacerScrollProgress());
          },
        });
      });

      const buildScrub = contextSafe!(() => {
        // Scrub-твин — владелец x только на /home. Вне /home позицию держит
        // дискретная gsap.to, поэтому твин не создаём. При перецеливке
        // (смена breakpoint меняет homeEndState) старый твин жив — useGSAP
        // перезапускает колбэк без cleanup, `scrubTweenRef` сохраняется, поэтому
        // проигрываем плавную анимацию к новой геометрии (retargetScrub),
        // синхронно с контентом. Иначе навбар «прыгал» мгновенно, пока контент
        // плывёт. RETARGET_SCRUB (tablet TOGGLE) ведёт ту же анимацию через
        // подписку на действие, не через rebuild.
        const decision = decideScrubBuild({
          isHome: snapshot.isHome,
          homeEndState: snapshot.homeEndState,
          viewport: window.innerWidth,
          existingProgress: scrubTweenRef.current?.progress() ?? 0,
        });
        if (!decision.shouldBuild) {
          scrubTweenRef.current?.kill();
          scrubTweenRef.current = null;
          return;
        }

        const prevProgress = decision.prevProgress;
        const hadScrub = scrubTweenRef.current != null;
        if (hadScrub) {
          retargetScrub();
          return;
        }

        scrubTweenRef.current?.kill();
        scrubTweenRef.current = gsap.fromTo(
          nav,
          { x: 0 },
          {
            x: decision.endX,
            ease: 'none',
            paused: true,
            immediateRender: false,
          },
        );
        scrubTweenRef.current.progress(prevProgress);

        logger.debug('NavigationBar', 'buildScrub', {
          isHome: snapshot.isHome,
          homeEndState: snapshot.homeEndState,
          bp: snapshot.bp,
          endX: decision.endX,
          prevProgress,
          retarget: hadScrub,
        });
      });

      buildScrub();

      // Явная обработка RETARGET_SCRUB (вариант A из task/18): tablet TOGGLE
      // standard↔slim меняет homeEndState без смены bp/isHome, поэтому
      // buildScrub не перезапускается — перецеливку запускаем по действию.
      // guard `scrubTweenRef.current` — перецеливка имеет смысл только когда
      // scrub уже построен (на /home).
      const unsubscribeActions = engine.subscribeActions((actions) => {
        for (const action of actions) {
          if (action.type === 'RETARGET_SCRUB' && scrubTweenRef.current) {
            retargetScrub();
          }
        }
      });

      // Ресайз внутри breakpoint (RC2 из task/18) обрабатывается отдельным
      // useEffect-ом (см. ниже) — не внутри useGSAP, чтобы повторные запуски
      // колбэка по смене deps не навешивали дубликаты listener-а.

      const unsubscribe = engine.subscribe((snap) => {
        const manualNow = snap.isManualToggle;
        // Обычный /home-scrub: пропускаем discrete-анимацию, пока НЕ было
        // ручного toggle (иначе твин будет биться со scrub-твином).
        if (
          !shouldAnimateDiscrete({
            isHome: snap.isHome,
            manualNow,
            prevManual: prevManualRef.current,
          })
        ) {
          logger.trace(
            'NavigationBar',
            'applyDiscrete skipped (home scrub owns x)',
            {
              mode: snap.value,
            },
          );
          return;
        }
        prevManualRef.current = manualNow;
        const navEl = navRef.current;
        if (!navEl) return;
        const t = getNavTransform(snap.value, window.innerWidth);
        logger.debug('NavigationBar', 'applyDiscrete', {
          mode: snap.value,
          navX: t.navX,
          isHome: snap.isHome,
          manual: manualNow,
        });
        gsap.to(navEl, {
          x: t.navX,
          duration: snap.transition.duration,
          ease: snap.transition.ease,
          overwrite: 'auto',
        });
      });

      return () => {
        unsubscribe();
        unsubscribeActions();
        scrubTweenRef.current?.kill();
        scrubTweenRef.current = null;
      };
    },
    {
      dependencies: [navRef, engine, snapshot.bp, snapshot.isHome],
      scope: navRef,
    },
  );

  // Ресайз внутри breakpoint: контент адаптируется мгновенно
  // (CSS-переменная), а навбар «плывёт», т.к. scrub-твин запечён под старую
  // ширину. Снапаем позицию под новый viewport без анимации (как у контента),
  // сохраняя прогресс. Отдельный effect (mount-once) — чтобы повторные
  // перезапуски useGSAP по смене deps не дублировали listener.
  useEffect(() => {
    function handleResize() {
      const navEl = navRef.current;
      if (!navEl) return;
      const live = engine.getSnapshot();
      if (!live.isHome) return;
      const progress =
        scrubTweenRef.current?.progress() ?? getSpacerScrollProgress();
      gsap.killTweensOf(navEl);
      scrubTweenRef.current?.kill();
      scrubTweenRef.current = gsap.fromTo(
        navEl,
        { x: 0 },
        {
          x: getNavTransform(live.homeEndState, window.innerWidth).navX,
          ease: 'none',
          paused: true,
          immediateRender: false,
        },
      );
      scrubTweenRef.current.progress(progress);
    }
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [engine, navRef, getSpacerScrollProgress]);

  useEffect(() => {
    if (
      !shouldResyncScrub({
        isHome: snapshot.isHome,
        isManualToggle: snapshot.isManualToggle,
      })
    ) {
      return;
    }
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
