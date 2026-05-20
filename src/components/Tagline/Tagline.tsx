import { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import type { AnimationComponentProps } from '../../types/splash.types';
import styles from './Tagline.module.css';

export function Tagline({ timeline }: AnimationComponentProps) {
  const ref = useRef<HTMLParagraphElement>(null);

  useGSAP(
    () => {
      if (!timeline || !ref.current) return;

      const tween = gsap.fromTo(
        ref.current,
        { opacity: 0, filter: 'blur(10px)', visibility: 'visible' },
        { opacity: 1, filter: 'blur(0px)', duration: 0.5, ease: 'power1.out' },
      );

      timeline.add(tween, 1.0);
    },
    { dependencies: [timeline], scope: ref },
  );

  return (
    <p ref={ref} className={styles.tagline} style={{ visibility: 'hidden' }}>
      Web Developer & Designer
    </p>
  );
}
