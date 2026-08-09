/**
 * GsapLayoutBridge — компонент-эффект (см. план §II.2).
 *
 * Превращает 60fps-события GSAP-шины в редкие дискретные события машины.
 *
 * Сейчас Bridge только подписан на scroll-кадры и шлёт `REACH_TOP`,
 * когда `y ≤ 2`. Полная edge-detection логика по границам спейсера
 * реализована в `useRegisterHomeSpacer` — отдельный хук, который страница
 * вызывает на spacer-элементе.
 *
 * Развязка:
 * - `GsapProvider` — инфраструктура (bus, ticker, cleanup).
 * - `GsapLayoutBridge` — компонент-эффект, рендерит `null`.
 * - `useRegisterHomeSpacer` — хук для страницы: создаёт ScrollTrigger,
 *   edge-detection границ, отправляет `REACH_*` в движок.
 *
 * Доступ к движку — только через `useLayoutSend()` (не знает внутренностей).
 */

import { useEffect } from 'react';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useLayoutSend, useLayoutSnapshot } from '../context/layoutContexts';
import { useGsapBus } from './GsapProvider';
import { logger } from '../../../utils/logger';

const EDGE_EPS = 0.0001;
const SCROLL_TOP_PX = 2;

export function GsapLayoutBridge() {
  const bus = useGsapBus();
  const send = useLayoutSend();
  const snapshot = useLayoutSnapshot();

  useEffect(() => {
    if (!snapshot.context.isHome) return;

    const offFrame = bus.on('scroll:frame', ({ y }) => {
      if (typeof window === 'undefined') return;
      if (y <= SCROLL_TOP_PX) send({ type: 'REACH_TOP' });
    });

    return () => {
      offFrame();
    };
  }, [bus, send, snapshot.context.isHome]);

  // При уходе с /home — обновить ScrollTrigger (чтобы не остались
  // закешированные позиции спейсера).
  useEffect(() => {
    if (!snapshot.context.isHome) {
      ScrollTrigger.refresh();
    }
  }, [snapshot.context.isHome]);

  return null;
}

/**
 * Хук для регистрации ScrollTrigger на спейсере страницы `/home`.
 *
 * Страница передаёт ref на spacer-ноду; хук создаёт ScrollTrigger и
 * шлёт `REACH_TOP`/`REACH_BOTTOM` в движок при пересечении границ.
 * Возвращает cleanup (для удобства — но useEffect сам его вызовет).
 */
export function useRegisterHomeSpacer(triggerEl: HTMLElement | null) {
  const send = useLayoutSend();
  const snapshot = useLayoutSnapshot();

  useEffect(() => {
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
  }, [send, snapshot.context.isHome, triggerEl]);
}
