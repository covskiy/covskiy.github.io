import { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { logger } from '../../utils/logger';
import type { AnimationComponentProps } from '../../types/splash.types';
import {
  createCLetterTimeline,
  createCursorTimeline,
  createOVSKIYTimeline,
  createSparksTimeline,
  scheduleSparksBoost,
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

      // Суб-таймлайн искр: эмиссия burst1/burst2 + boostAll на burst2.
      // Пропускается при prefers-reduced-motion: reduce.
      if (reducedMotion) {
        logger.info('LogoText', 'Sparks disabled by prefers-reduced-motion');
      } else {
        const sparksTl = gsap.timeline({ id: 'Sparks tl' });
        createSparksTimeline(
          sparksTl,
          SPARKS_CONFIG,
          getProfile,
          (delta, burstLabel) => {
            const profile = getProfile();
            const burstVisual = SPARKS_CONFIG[burstLabel];
            loop.ensureRunning();
            system.emit(
              SPARKS_CONFIG.emissionOrigin,
              delta,
              burstVisual,
              profile,
              SPARKS_CONFIG,
            );
          },
          () => {
            system.clear();
          },
          () => {
            loop.ensureRunning();
            logger.debug('LogoText', 'Burst start, active profile', {
              profile: profileName(getProfile()),
              width: window.innerWidth,
              boostFactor: getProfile().boostFactor,
            });
          },
        );
        scheduleSparksBoost(sparksTl, SPARKS_CONFIG, getProfile, (factor) => {
          system.boostAll(factor);
        });
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
    },
  );

  return (
    <div ref={containerRef} className={styles.container}>
      <LogoSvg className={styles.svg} />
      <canvas ref={canvasRef} className={styles.canvas} />
    </div>
  );
}
