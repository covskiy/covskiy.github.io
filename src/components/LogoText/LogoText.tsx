import { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { logger } from '../../utils/logger';
import type { AnimationComponentProps } from '../../types/splash.types';
import { SPLASH_CHOREOGRAPHY } from '../../pages/SplashPage/splashChoreography';
import type { BurstId } from './sparks';
import { useSparkCanvas } from './useSparkCanvas';
import {
  createCLetterTimeline,
  createCursorTimeline,
  createOVSKIYTimeline,
} from './timelines';
import LogoSvg from './LogoText.svg?react';
import styles from './LogoText.module.css';

export function LogoText({ onRegisterTimeline }: AnimationComponentProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { emitOne, boostAll, sizeRef, profile } = useSparkCanvas(canvasRef);

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

      const SPARKS = SPLASH_CHOREOGRAPHY.logoText.sparks;

      // Запускает GSAP-твин на burstDuration секунд.
      // Каждый кадр твина проверяет, какие из N заранее сгенерированных
      // scheduled times уже прошли, и эмитит соответствующие искры.
      // Сортированные случайные времена = искры распределены примерно
      // равномерно, но не строго по сетке (нет «армейского» строя).
      const startStream = (
        ox: number,
        oyMin: number,
        oyMax: number,
        total: number,
        duration: number,
        burst: BurstId,
      ) => {
        const scheduled: number[] = [];
        for (let i = 0; i < total; i++) {
          scheduled.push(Math.random() * duration);
        }
        scheduled.sort((a, b) => a - b);

        const state = { progress: 0, emitted: 0 };
        gsap.to(state, {
          progress: 1,
          duration,
          ease: 'none',
          onUpdate: () => {
            const currentTime = state.progress * duration;
            while (
              state.emitted < total &&
              scheduled[state.emitted] <= currentTime
            ) {
              const oy = oyMin + Math.random() * (oyMax - oyMin);
              emitOne(ox, oy, burst);
              state.emitted++;
            }
          },
        });
      };

      // Один sub-spawn = один непрерывный поток count искр за burstDuration.
      // Координаты эмиссии: правая граница канваса, случайный Y в заданном диапазоне.
      const startSubSpawn = (burst: BurstId) => {
        const { w, h } = sizeRef.current;
        const ox = w - SPARKS.emit.xOffset;
        const oyMin = h * SPARKS.emit.yMinFrac;
        const oyMax = h * SPARKS.emit.yMaxFrac;
        startStream(
          ox,
          oyMin,
          oyMax,
          profile.count,
          profile.burstDuration,
          burst,
        );
      };

      // === BURST 1: только эмиссия, без boost'а ===
      for (let i = 0; i < profile.subSpawns; i++) {
        localTimeline.call(
          () => startSubSpawn(1),
          [],
          SPARKS.burst1 + i * profile.subSpawnInterval,
        );
      }
      // === BURST 2: эмиссия + boost уже летящих искр ===
      // boostAll(factor) — все живые vx *= factor, визуально «порыв ветра»
      // подхватывает уже летящий рой. Ступенчато по sub-spawn'ам на десктопе.
      for (let i = 0; i < profile.subSpawns; i++) {
        localTimeline.call(
          () => {
            startSubSpawn(2);
            boostAll(SPARKS.burstBoostFactor);
          },
          [],
          SPARKS.burst2 + i * profile.subSpawnInterval,
        );
      }

      logger.debug('LogoText', 'Registering local timeline on master');
      onRegisterTimeline(localTimeline);
    },
    {
      dependencies: [onRegisterTimeline, emitOne, boostAll, sizeRef, profile],
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
