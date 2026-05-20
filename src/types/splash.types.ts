export type AnimationComponentProps = {
  timeline: gsap.core.Timeline | null;
};

export type SkipControlsProps = {
  // timeline: gsap.core.Timeline | null;
  onNeverShowAgain: (value: boolean) => void;
  neverShowAgain: boolean;
  onSkip: () => void;
};

export type SplashPageProps = {
  onComplete?: () => void;
  skipDelay?: number;
};

export type SplashStorageData = {
  neverShow: boolean;
  timestamp?: number;
};
