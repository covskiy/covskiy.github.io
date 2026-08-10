/**
 * useLayoutApplier — подписка на engine + анимация CSS-переменных на root.
 *
 * Реализация по образцу `chat-React Layout.txt` §10, адаптированная:
 * - единственный CSS-source = `snapshot.vars` (D7: без `data-*`);
 * - после дискретных переходов — `ScrollTrigger.refresh()` (не на каждый кадр);
 * - scroll-lock — на `document.documentElement.style.overflow` (для window-скролла).
 */

import { useLayoutEffect, type RefObject } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useLayoutEngine } from '../context/layoutContexts';
import type { LayoutSnapshot } from '../machine/layoutSnapshot';

export function useLayoutApplier(rootRef: RefObject<HTMLElement | null>) {
  const engine = useLayoutEngine();

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    let tween: gsap.core.Tween | null = null;

    function apply(snapshot: LayoutSnapshot) {
      tween?.kill();

      document.documentElement.style.overflow = snapshot.scrollLocked
        ? 'hidden'
        : '';

      tween = gsap.to(root, {
        ...snapshot.vars,
        duration: snapshot.transition.duration,
        ease: snapshot.transition.ease,
        overwrite: 'auto',
        onComplete: () => {
          snapshot.transition.onComplete?.();
          ScrollTrigger.refresh();
        },
      } as gsap.TweenVars);
    }

    apply(engine.getSnapshot());
    const unsubscribe = engine.subscribe(apply);

    return () => {
      unsubscribe();
      tween?.kill();
      document.documentElement.style.overflow = '';
    };
  }, [engine, rootRef]);
}
