import { useState, useEffect, useCallback } from 'react';
import { splashStorage } from '../utils/splashStorage';

type UseSplashSkipProps = {
  timeline: gsap.core.Timeline | null;
  onSkip?: () => void;
  skipDelay?: number;
};

export function useSplashSkip({
  timeline,
  onSkip,
  skipDelay = 1000,
}: UseSplashSkipProps) {
  const [neverShowAgain, setNeverShowAgain] = useState(() =>
    splashStorage.getNeverShow(),
  );
  const [showSkipButton, setShowSkipButton] = useState(false);

  useEffect(() => {
    if (!timeline) return;
    const timer = setTimeout(() => setShowSkipButton(true), skipDelay);
    return () => clearTimeout(timer);
  }, [timeline, skipDelay]);

  const handleSkip = useCallback(() => {
    if (!timeline) return;
    timeline.progress(1).kill();
    onSkip?.();
  }, [timeline, onSkip]);

  const handleNeverShowAgain = useCallback((value: boolean) => {
    setNeverShowAgain(value);
    splashStorage.setNeverShow(value);
  }, []);

  return {
    showSkipButton,
    neverShowAgain,
    handleSkip,
    handleNeverShowAgain,
    shouldBypass: neverShowAgain,
  };
}
