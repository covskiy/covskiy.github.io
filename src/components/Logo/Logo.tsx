import { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import type { AnimationComponentProps } from '../../types/splash.types';
import styles from './Logo.module.css';

export function Logo({ timeline }: AnimationComponentProps) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (!timeline || !ref.current) return;

      const tween = gsap.fromTo(
        ref.current,
        { opacity: 0, scale: 0.5, visibility: 'visible' },
        { opacity: 1, scale: 1, duration: 0.8, ease: 'back.out(1.2)' },
      );

      timeline.add(tween, 0);
    },
    { dependencies: [timeline], scope: ref },
  );

  return (
    <div ref={ref} className={styles.logo} style={{ visibility: 'hidden' }}>
      <div className={styles.logoPlaceholder}>LOGO</div>
    </div>
  );
}
