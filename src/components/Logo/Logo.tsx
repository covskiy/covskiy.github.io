import { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import type { AnimationComponentProps } from '../../types/intro.types';
import { INTRO_CHOREOGRAPHY } from '../IntroAnimation/choreography';
import LogoSvg from './anvil_md.svg?react';
import styles from './Logo.module.css';

export function Logo({ onRegisterTimeline }: AnimationComponentProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (!containerRef.current) return;

      const tl = gsap.timeline({ id: 'Logo.tsx timeline' });
      const L = INTRO_CHOREOGRAPHY.logo.labels;
      const D = INTRO_CHOREOGRAPHY.logo.durations;

      // Метки для стартовых точек анимации
      tl.addLabel('GLOW_START', L.GLOW_START)
        .addLabel('MAIN_PATH_START', L.MAIN_PATH_START)
        .addLabel('GLOW_FADE_START', L.GLOW_FADE_START);

      tl.fromTo(
        '.glow-path',
        { drawSVG: '0% 0%' },
        { drawSVG: '0% 100%', duration: D.GLOW_DRAW, ease: 'power2.inOut' },
        'GLOW_START',
      )
        .fromTo(
          '.main-path',
          { drawSVG: '0% 0%' },
          {
            drawSVG: '0% 100%',
            duration: D.MAIN_PATH_DRAW,
            ease: 'power2.inOut',
          },
          'MAIN_PATH_START',
        )
        .to(
          '.glow-path',
          { opacity: 0, duration: D.GLOW_FADE, ease: 'power2.out' },
          'GLOW_FADE_START',
        );

      onRegisterTimeline(tl, INTRO_CHOREOGRAPHY.master.labels.LOGO);
    },
    { dependencies: [onRegisterTimeline], scope: containerRef },
  );

  return (
    <div ref={containerRef} className={styles.logo}>
      <LogoSvg className={styles.svg} />
    </div>
  );
}
