import { useCallback, useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { LogoText, SkipControls, Tagline } from '..';
import type { IntroAnimationProps } from '../../types/intro.types';
import styles from './IntroAnimation.module.css';
import { INTRO_CHOREOGRAPHY } from './choreography';
import { useGSAP } from '@gsap/react';
import { GSDevTools } from 'gsap/GSDevTools';

gsap.registerPlugin(GSDevTools);

export type registerFunc = (masterTimeline: gsap.core.Timeline) => void;

export function IntroAnimation({ onComplete, skipDelay }: IntroAnimationProps) {
  const timelineContainerRef = useRef<HTMLDivElement | null>(null);
  const childTimelinesRegistrationRef = useRef<Set<registerFunc>>(new Set());
  const masterTimelineRef = useRef<gsap.core.Timeline | null>(null);

  const [showSkipButton, setShowSkipButton] = useState(false);
  const [remainingMs, setRemainingMs] = useState(0);

  useEffect(() => {
    if (skipDelay == null) return;
    const timer = setTimeout(() => {
      setShowSkipButton(true);
      const duration = masterTimelineRef.current?.duration();
      if (duration != null) {
        const remaining = Math.max(
          0,
          Math.round((duration - skipDelay / 1000) * 1000),
        );
        setRemainingMs(remaining);
      }
    }, skipDelay);
    return () => clearTimeout(timer);
  }, [skipDelay]);

  const handleSkip = useCallback(() => {
    masterTimelineRef.current?.progress(1).kill();
    onComplete?.();
  }, [onComplete]);

  const handleRegisterTimeline = useCallback(
    (timeline: gsap.core.Timeline, position = 0) => {
      const registrationFunc = (masterTimeline: gsap.core.Timeline) => {
        masterTimeline.add(timeline, position);
      };
      childTimelinesRegistrationRef.current.add(registrationFunc);
      return () => {
        childTimelinesRegistrationRef.current.delete(registrationFunc);
      };
    },
    [],
  );

  useGSAP(
    () => {
      const master = gsap.timeline({
        id: 'IntroAnimation_master_timeline',
        paused: true,
        onComplete: () => onComplete?.(),
      });

      masterTimelineRef.current = master;
      childTimelinesRegistrationRef.current.forEach((func) => func(master));
      master.to({}, { duration: INTRO_CHOREOGRAPHY.master.holdDuration });
      master.play();
      // GSDevTools.create({
      //   id: 'IntroTimeline',
      //   animation: master,
      //   css: { 'z-index': 9999 },
      // });
    },
    {
      dependencies: [onComplete],
      scope: timelineContainerRef,
    },
  );

  return (
    <div className={styles.introOverlay} ref={timelineContainerRef}>
      <div className={styles.introContent}>
        <LogoText onRegisterTimeline={handleRegisterTimeline} />
        <Tagline onRegisterTimeline={handleRegisterTimeline} />

        {showSkipButton && (
          <SkipControls onSkip={handleSkip} durationMs={remainingMs} />
        )}
      </div>
    </div>
  );
}
