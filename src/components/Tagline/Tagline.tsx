import { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { CustomEase } from 'gsap/CustomEase';
import KeyboardSvg from './keyboard.svg?react';
import type { AnimationComponentProps } from '../../types/splash.types';
import { SPLASH_CHOREOGRAPHY } from '../../pages/SplashPage/splashChoreography';
import styles from './Tagline.module.css';

const KEYBOARD_IN_LOCAL = SPLASH_CHOREOGRAPHY.logoText.Cursor.phaseCaret.start;
const {
  C: letterC,
  O: letterO,
  V: letterV,
  S: letterS,
  K: letterK,
  I: letterI,
  Y: letterY,
} = SPLASH_CHOREOGRAPHY.logoText;

type AnimationItem = { selector: string; at: number };

const TAGLINE_MAP: readonly AnimationItem[] = [
  {
    selector: `.${styles.lineOne}`,
    at: SPLASH_CHOREOGRAPHY.tagline.text.lineOne,
  },
  {
    selector: `.${styles.lineTwo}`,
    at: SPLASH_CHOREOGRAPHY.tagline.text.lineTwo,
  },
];

const KEY_MAP: readonly AnimationItem[] = [
  { selector: '.key_c', at: letterC.phaseLetter.start },
  {
    selector: '.key_o',
    at: letterO.phaseDash.start + letterO.phaseLetter.delay,
  },
  {
    selector: '.key_v',
    at: letterV.phaseDash.start + letterV.phaseLetter.delay,
  },
  {
    selector: '.key_s',
    at: letterS.phaseDash.start + letterS.phaseLetter.delay,
  },
  {
    selector: '.key_k',
    at: letterK.phaseDash.start + letterK.phaseLetter.delay,
  },
  {
    selector: '.key_i',
    at: letterI.phaseDash.start + letterI.phaseLetter.delay,
  },
  {
    selector: '.key_y',
    at: letterY.phaseDash.start + letterY.phaseLetter.delay,
  },
  {
    selector: '.key_enter',
    at: SPLASH_CHOREOGRAPHY.tagline.enterKey.start,
  },
];

export function Tagline({ onRegisterTimeline }: AnimationComponentProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const keyboardRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const { durations: D } = SPLASH_CHOREOGRAPHY.tagline;

  useGSAP(
    () => {
      if (!containerRef.current) return;

      const tl = gsap.timeline({
        id: 'Tagline.tsx timeline',
        defaults: { ease: 'power2.out' },
      });

      // Метка старта Tagline на его собственном timeline
      tl.addLabel('KEYBOARD_IN', KEYBOARD_IN_LOCAL);

      TAGLINE_MAP.forEach(({ selector }) => {
        tl.set(selector, {
          autoAlpha: 0,
          y: -80,
        });
      });

      tl.set(keyboardRef.current, { y: -120, autoAlpha: 0 });

      tl.to(
        keyboardRef.current,
        {
          y: 0,
          autoAlpha: 1,
          duration: D.KEYBOARD_IN,
        },
        'KEYBOARD_IN',
      );

      tl.to(
        keyboardRef.current,
        {
          y: 120,
          autoAlpha: 0,
          duration: D.KEYBOARD_OUT,
          ease: 'power2.in',
        },
        SPLASH_CHOREOGRAPHY.tagline.enterKey.start,
      );

      KEY_MAP.forEach(({ selector, at }) => {
        tl.to(
          selector,
          {
            fill: '#04bf8a',
            opacity: 1,
            scale: 1.2,
            duration: D.KEY_HIGHLIGHT,
            transformOrigin: 'center center',
          },
          at,
        );
      });

      const customBounce = CustomEase.create(
        'custom',
        'M0,0 C0.069,0 0.303,0.261 0.46,0.511 0.617,0.761 0.698,1.001 0.7,1.011 0.7,1.005 0.758,0.895 0.849,0.895 0.936,0.895 1,1.011 1,1.011 ',
      );

      TAGLINE_MAP.forEach(({ selector, at }) => {
        tl.to(
          selector,
          {
            autoAlpha: 1,
            y: 0,
            duration: D.TEXT_REVEAL,
            ease: customBounce,
          },
          at,
        );
      });

      onRegisterTimeline(tl, SPLASH_CHOREOGRAPHY.master.labels.TAGLINE);
    },
    { dependencies: [onRegisterTimeline], scope: containerRef },
  );

  return (
    <div ref={containerRef} className={styles.container}>
      <div ref={keyboardRef} className={styles.keyboard}>
        <KeyboardSvg />
      </div>
      <div ref={textRef} className={styles.text}>
        {/* <p className={`${styles.textLine} ${styles.lineOne}`}> */}
        <p className={`${styles.lineOne}`}>Цифровая кузница</p>
        <p className={`${styles.textLine} ${styles.lineTwo}`}>ваших решений</p>
      </div>
    </div>
  );
}
