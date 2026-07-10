import { useCallback, useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { LogoText, SkipControls, Tagline } from '../../components';
import type { SplashPageProps } from '../../types/splash.types';
import styles from './SplashPage.module.css';
import { SPLASH_CHOREOGRAPHY } from './splashChoreography';
import { useGSAP } from '@gsap/react';

export type registerFunc = (masterTimeline: gsap.core.Timeline) => void;

export function SplashPage({ onComplete, skipDelay }: SplashPageProps) {
  const timelineContainerRef = useRef<HTMLDivElement | null>(null);
  const childTimelinesRegistrationRef = useRef<Set<registerFunc>>(new Set());
  const masterTimelineRef = useRef<gsap.core.Timeline | null>(null);

  const [showSkipButton, setShowSkipButton] = useState(false);

  useEffect(() => {
    if (skipDelay == null) return;
    const timer = setTimeout(() => setShowSkipButton(true), skipDelay);
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
        id: 'SplashPage_master_timeline',
        paused: true,
        onComplete: () => onComplete?.(),
      });

      masterTimelineRef.current = master;
      childTimelinesRegistrationRef.current.forEach((func) => func(master));
      master.to({}, { duration: SPLASH_CHOREOGRAPHY.master.holdDuration });
      master.play();
    },
    {
      dependencies: [onComplete],
      scope: timelineContainerRef,
    },
  );

  return (
    <div className={styles.splashContainer} ref={timelineContainerRef}>
      <LogoText onRegisterTimeline={handleRegisterTimeline} />
      <Tagline onRegisterTimeline={handleRegisterTimeline} />

      {showSkipButton && <SkipControls onSkip={handleSkip} />}
    </div>
  );
}
