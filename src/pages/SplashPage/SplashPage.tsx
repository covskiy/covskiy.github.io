import { useCallback, useRef } from 'react';
import gsap from 'gsap';
import { GSDevTools } from 'gsap/GSDevTools';
import { Logo, LogoText, Tagline } from '../../components';
import { useSplashSkip } from './hooks';
import type { SplashPageProps } from '../../types/splash.types';
import styles from './SplashPage.module.css';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(GSDevTools);

export type registerFunc = (masterTimeline: gsap.core.Timeline) => void;

export function SplashPage({ onComplete, skipDelay = 1000 }: SplashPageProps) {
  const timelineContainerRef = useRef<HTMLDivElement | null>(null);
  const childTimelinesRegistrationRef = useRef<Set<registerFunc>>(new Set());
  const masterTimelineRef = useRef<gsap.core.Timeline | null>(null);

  const shouldBypass = false;
  // const { shouldBypass } = useSplashSkip({
  //   timeline: masterTimeline,
  //   onSkip: () => onComplete?.(),
  //   skipDelay,
  // });

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
      if (shouldBypass) return;
      const master = gsap.timeline({
        id: 'SplashPage_master_timeline',
        paused: true,
        onComplete: () => onComplete?.(),
      });

      masterTimelineRef.current = master;
      childTimelinesRegistrationRef.current.forEach((func) => func(master));
      master.play();

      if (import.meta.env.DEV) {
        GSDevTools.create({ animation: master, css: 'z-index: 9999' });
      }
    },
    {
      dependencies: [shouldBypass, onComplete],
      scope: timelineContainerRef,
    },
  );

  if (shouldBypass) return null;

  return (
    <div className={styles.splashContainer} ref={timelineContainerRef}>
      <Logo onRegisterTimeline={handleRegisterTimeline} />
      <LogoText onRegisterTimeline={handleRegisterTimeline} />
      <Tagline onRegisterTimeline={handleRegisterTimeline} />

      {/*showSkipButton && (
        <SkipControls
          onNeverShowAgain={handleNeverShowAgain}
          neverShowAgain={neverShowAgain}
          onSkip={handleSkip}
        />
      )*/}
    </div>
  );
}
