import { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { logger } from '../../utils/logger';
import type { AnimationComponentProps } from '../../types/intro.types';
import {
  createCLetterTimeline,
  createCursorTimeline,
  createOVSKIYTimeline,
  createSparksTimeline,
} from './timelines';
import { SPARKS_CONFIG, profileName } from './sparks.config';
import { useSparkCanvas } from './useSparkCanvas';
import LogoSvg from './LogoText.svg?react';
import styles from './LogoText.module.css';

export function LogoText({ onRegisterTimeline }: AnimationComponentProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const { system, loop, getProfile, reducedMotion } = useSparkCanvas(
    containerRef,
    canvasRef,
  );

  useGSAP(
    () => {
      const container = containerRef.current;
      if (!container) {
        logger.warn('LogoText', 'container is null, skipping animation');
        return;
      }

      logger.info('LogoText', 'Building animation timelines');
      const localTimeline = gsap.timeline({ id: 'Logo.tsx tl' });

      const cLetterTl = gsap.timeline({ id: 'CLetter tl' });
      createCLetterTimeline(cLetterTl);

      const ovskiyTl = gsap.timeline({ id: 'letters tl' });
      createOVSKIYTimeline(ovskiyTl);

      const cursorTl = gsap.timeline({ id: 'Nail tl' });
      createCursorTimeline(cursorTl);

      if (reducedMotion) {
        logger.info('LogoText', 'Sparks disabled by prefers-reduced-motion');
      } else {
        const sparksTl = gsap.timeline({ id: 'Sparks tl' });
        createSparksTimeline(
          sparksTl,
          SPARKS_CONFIG.emissionWindow,
          getProfile,
          (delta) => {
            const profile = getProfile();
            const { viewbox, spawn } = SPARKS_CONFIG;
            loop.ensureRunning();
            for (let i = 0; i < delta; i++) {
              system.emit(
                { x: Math.random() * viewbox.w, y: viewbox.h - spawn.yOffset },
                1,
                profile,
                SPARKS_CONFIG,
              );
            }
          },
          () => {
            logger.debug(
              'LogoText',
              'Invoking clear function for sparks system',
            );
            system.clear();
          },
          () => {
            loop.ensureRunning();
            logger.debug('LogoText', 'Burst start, active profile', {
              profile: profileName(getProfile()),
              width: window.innerWidth,
            });
          },
        );
        localTimeline.add(sparksTl, 0);
      }

      localTimeline.add(cLetterTl, 0).add(cursorTl, 0).add(ovskiyTl, 0);

      logger.debug('LogoText', 'Registering local timeline on master');
      onRegisterTimeline(localTimeline);
    },
    {
      dependencies: [
        onRegisterTimeline,
        system,
        loop,
        getProfile,
        reducedMotion,
      ],
      scope: containerRef,
      revertOnUpdate: true,
    },
  );

  return (
    <div className={styles.frame}>
      <span className={`${styles.rivet} ${styles.rivetTopLeft}`} />
      <span className={`${styles.rivet} ${styles.rivetTopRight}`} />
      <span className={`${styles.rivet} ${styles.rivetBottomLeft}`} />
      <span className={`${styles.rivet} ${styles.rivetBottomRight}`} />
      <div ref={containerRef} className={styles.container}>
        <LogoSvg className={styles.svg} />
        <canvas ref={canvasRef} className={styles.canvas} />
      </div>
    </div>
  );
}
