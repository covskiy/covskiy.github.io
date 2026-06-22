import { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { logger } from '../../utils/logger';
import type { AnimationComponentProps } from '../../types/splash.types';
import {
  createCLetterTimeline,
  createCursorTimeline,
  createOVSKIYTimeline,
} from './timelines';
import LogoSvg from './LogoText.svg?react';
import styles from './LogoText.module.css';

export function LogoText({ onRegisterTimeline }: AnimationComponentProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const container = containerRef.current;
      if (!container) {
        logger.warn('LogoText', 'container is null, skipping animation');
        return;
      }

      logger.info('LogoText', 'Building animation timelines');
      const localTimeline = gsap.timeline({ id: 'Logo.tsx tl' });

      // Три параллельных суб-таймлайна на позицию 0 — внутренние метки
      // из SPLASH_CHOREOGRAPHY задают последовательность. Каждый билдер
      // наполняет свой tl; без отдельных child-таймлайнов твин без явной
      // позиции (x-движение курсора) аппендился бы в конец localTimeline.
      const cLetterTl = gsap.timeline({ id: 'CLetter tl' });
      createCLetterTimeline(cLetterTl);

      const ovskiyTl = gsap.timeline({ id: 'letters tl' });
      createOVSKIYTimeline(ovskiyTl);

      const cursorTl = gsap.timeline({ id: 'Nail tl' });
      createCursorTimeline(cursorTl);

      localTimeline.add(cLetterTl, 0).add(cursorTl, 0).add(ovskiyTl, 0);

      logger.debug('LogoText', 'Registering local timeline on master');
      onRegisterTimeline(localTimeline);
    },
    {
      dependencies: [onRegisterTimeline],
      scope: containerRef,
    },
  );

  return (
    <div ref={containerRef} className={styles.container}>
      <LogoSvg className={styles.svg} />
    </div>
  );
}
