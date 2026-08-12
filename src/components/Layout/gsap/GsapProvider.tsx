import { useCallback, useEffect, useRef, type PropsWithChildren } from 'react';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { createGsapBus, type GsapBus } from './gsapBus';
import { GsapContext } from './gsapContext';
import { useLayoutEngine, useLayoutSnapshot } from '../context/layoutContexts';
import { RegisterScrollTriggerContext } from './useRegisterScrollTrigger';

export const EDGE_EPS = 0.0001;

export function GsapProvider({ children }: PropsWithChildren) {
  const busRef = useRef<GsapBus | null>(null);
  busRef.current ??= createGsapBus();

  const engine = useLayoutEngine();
  const snapshot = useLayoutSnapshot();

  useEffect(() => {
    const bus = busRef.current;
    if (!bus) return;
    return () => {
      bus.dispose();
    };
  }, []);

  useEffect(() => {
    if (!snapshot.context.isHome) {
      ScrollTrigger.refresh();
    }
  }, [snapshot.context.isHome]);

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

      return () => {
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
