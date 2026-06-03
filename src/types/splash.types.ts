export type RegisterTimelineFn = (
  tl: gsap.core.Timeline,
  position?: number,
) => void;

export type AnimationComponentProps = {
  onRegisterTimeline: RegisterTimelineFn;
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
