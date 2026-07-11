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

export type IntroAnimationProps = {
  onComplete?: () => void;
  skipDelay?: number;
};

export type IntroStorageData = {
  neverShow: boolean;
  timestamp?: number;
};
