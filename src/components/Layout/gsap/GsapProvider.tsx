import { useCallback, useEffect, useRef, type PropsWithChildren } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { createGsapBus, type GsapBus } from './gsapBus';
import { GsapContext } from './gsapContext';
import { useLayoutEngine, useLayoutSnapshot } from '../context/layoutContexts';
import { RegisterScrollTriggerContext } from './useRegisterScrollTrigger';

export const EDGE_EPS = 0.0001;

const SCROLL_SPACER_DURATION = 0.4;
const SCROLL_SPACER_EASE = 'power2.inOut';

export function GsapProvider({ children }: PropsWithChildren) {
  const busRef = useRef<GsapBus | null>(null);
  busRef.current ??= createGsapBus();

  const engine = useLayoutEngine();
  const snapshot = useLayoutSnapshot();
  const spacerTriggerRef = useRef<ScrollTrigger | null>(null);

  useEffect(() => {
    const bus = busRef.current;
    if (!bus) return;
    return () => {
      bus.dispose();
    };
  }, []);

  useEffect(() => {
    if (!snapshot.isHome) {
      ScrollTrigger.refresh();
    }
  }, [snapshot.isHome]);

  const scrollSpacerToEnd = useCallback(() => {
    const st = spacerTriggerRef.current;
    if (!st) return;
    if (st.progress >= 1 - EDGE_EPS) return;
    if (typeof st.end !== 'number') return;
    gsap.to(window, {
      scrollTo: st.end,
      duration: SCROLL_SPACER_DURATION,
      ease: SCROLL_SPACER_EASE,
      overwrite: 'auto',
    });
  }, []);

  useEffect(() => {
    return engine.subscribeActions((actions) => {
      for (const action of actions) {
        if (action.type === 'SCROLL_TO_END') {
          scrollSpacerToEnd();
        }
      }
    });
  }, [engine, scrollSpacerToEnd]);

  const registerScrollTrigger = useCallback(
    (el: HTMLElement): (() => void) => {
      const bus = busRef.current!;

      let lastBoundary: 'top' | 'mid' | 'bottom' = 'mid';

      const st = ScrollTrigger.create({
        trigger: el,
        start: 'top top',
        end: 'bottom top',
        scrub: true,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          bus.emit('scroll:progress', {
            progress: self.progress,
            direction: self.direction as 1 | -1,
          });

          if (self.progress <= EDGE_EPS) {
            if (lastBoundary !== 'top') {
              lastBoundary = 'top';
              engine.send({ type: 'REACH_TOP' });
            }
          } else if (self.progress >= 1 - EDGE_EPS) {
            if (lastBoundary !== 'bottom') {
              lastBoundary = 'bottom';
              engine.send({ type: 'REACH_BOTTOM' });
            }
          } else {
            lastBoundary = 'mid';
          }
        },
      });

      spacerTriggerRef.current = st;

      return () => {
        if (spacerTriggerRef.current === st) spacerTriggerRef.current = null;
        st.kill();
      };
    },
    [engine],
  );

  return (
    <GsapContext.Provider value={busRef.current}>
      <RegisterScrollTriggerContext.Provider value={registerScrollTrigger}>
        {children}
      </RegisterScrollTriggerContext.Provider>
    </GsapContext.Provider>
  );
}
