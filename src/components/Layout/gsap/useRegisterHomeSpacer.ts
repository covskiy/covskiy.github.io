import { useEffect } from 'react';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { logger } from '../../../utils/logger';
import { useLayoutSend, useLayoutSnapshot } from '../context/layoutContexts';

const EDGE_EPS = 0.0001;

/**
 * Хук для регистрации ScrollTrigger на спейсере страницы `/home`.
 *
 * Страница передаёт ref на spacer-ноду; хук создаёт ScrollTrigger и
 * шлёт `REACH_TOP`/`REACH_BOTTOM` в движок при пересечении границ.
 * Возвращает cleanup (для удобства — но useEffect сам его вызовет).
 */
export function useRegisterHomeSpacer(
  triggerRef: React.RefObject<HTMLElement | null>,
) {
  const send = useLayoutSend();
  const snapshot = useLayoutSnapshot();

  useEffect(() => {
    const triggerEl = triggerRef.current;
    if (!triggerEl || !snapshot.context.isHome) return;

    logger.info('Layout', 'Регистрация ScrollTrigger на /home');

    let lastBoundary: 'top' | 'mid' | 'bottom' = 'mid';

    const st = ScrollTrigger.create({
      trigger: triggerEl,
      start: 'top top',
      end: 'bottom top',
      scrub: true,
      invalidateOnRefresh: true,
      onUpdate: (self) => {
        if (self.progress <= EDGE_EPS) {
          if (lastBoundary !== 'top') {
            lastBoundary = 'top';
            send({ type: 'REACH_TOP' });
          }
        } else if (self.progress >= 1 - EDGE_EPS) {
          if (lastBoundary !== 'bottom') {
            lastBoundary = 'bottom';
            send({ type: 'REACH_BOTTOM' });
          }
        } else {
          lastBoundary = 'mid';
        }
      },
    });

    return () => {
      st.kill();
    };
  }, [send, snapshot.context.isHome, triggerRef]);
}
