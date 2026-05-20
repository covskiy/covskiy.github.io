import { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import type { AnimationComponentProps } from '../../types/splash.types';
import styles from './LogoText.module.css';

export function LogoText({ timeline }: AnimationComponentProps) {
  const ref = useRef<HTMLHeadingElement>(null);

  useGSAP(
    () => {
      if (!timeline || !ref.current) return;

      const tween = gsap.fromTo(
        ref.current,
        { opacity: 0, y: 30, visibility: 'visible' },
        { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out' },
      );

      timeline.add(tween, 0.5);
    },
    { dependencies: [timeline], scope: ref },
  );

  return (
    <h1 ref={ref} className={styles.logoText} style={{ visibility: 'hidden' }}>
      COVSKIY
    </h1>
  );
}
