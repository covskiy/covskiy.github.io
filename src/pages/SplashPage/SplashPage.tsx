import { useRef, useState } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { Logo, LogoText, Tagline, SkipControls } from '../../components';
import { useSplashSkip } from './hooks';
import type { SplashPageProps } from '../../types/splash.types';
import styles from './SplashPage.module.css';

export function SplashPage({ onComplete, skipDelay = 1000 }: SplashPageProps) {
  const timelineContainerRef = useRef<HTMLDivElement | null>(null);
  const [timeline, setTimeline] = useState<gsap.core.Timeline | null>(null);

  const {
    showSkipButton,
    neverShowAgain,
    handleSkip,
    handleNeverShowAgain,
    shouldBypass,
  } = useSplashSkip({
    timeline: timeline,
    onSkip: onComplete,
    skipDelay,
  });

  useGSAP(
    () => {
      if (shouldBypass) return;
      const tl = gsap.timeline({ onComplete: () => onComplete?.() });
      setTimeline(tl);
    },
    {
      dependencies: [shouldBypass, onComplete],
      scope: timelineContainerRef,
    },
  );

  if (shouldBypass) return null;

  return (
    <div className={styles.splashContainer} ref={timelineContainerRef}>
      <Logo timeline={timeline} />
      <LogoText timeline={timeline} />
      <Tagline timeline={timeline} />
      {showSkipButton && (
        <SkipControls
          onNeverShowAgain={handleNeverShowAgain}
          neverShowAgain={neverShowAgain}
          onSkip={handleSkip}
        />
      )}
    </div>
  );
}
