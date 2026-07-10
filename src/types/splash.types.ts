export type RegisterTimelineFn = (
  tl: gsap.core.Timeline,
  position?: number,
) => void;

export type AnimationComponentProps = {
  onRegisterTimeline: RegisterTimelineFn;
};

export type SkipControlsProps = {
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
