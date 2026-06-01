import { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import type { AnimationComponentProps } from '../../types/splash.types';
import LogoSvg from './anvil_md.svg?react';
import styles from './Logo.module.css';

export function Logo({ timeline }: AnimationComponentProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (!timeline || !containerRef.current) return;

      const tl = gsap.timeline({ id: 'Logo.tsx timeline' });

      tl.fromTo(
        '.glow-path',
        { drawSVG: '0% 0%' },
        { drawSVG: '0% 100%', duration: 1.5, ease: 'power2.inOut' },
        0,
      )
        .fromTo(
          '.main-path',
          { drawSVG: '0% 0%' },
          { drawSVG: '0% 100%', duration: 1.2, ease: 'power2.inOut' },
          0.15,
        )
        .to(
          '.glow-path',
          { opacity: 0, duration: 0.5, ease: 'power2.out' },
          1.2,
        );

      timeline.add(tl, 0);
    },
    { dependencies: [timeline], scope: containerRef },
  );

  return (
    <div ref={containerRef} className={styles.logo}>
      <LogoSvg className={styles.svg} />
    </div>
  );
}
