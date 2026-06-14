import { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { SplitText } from 'gsap/SplitText';
import KeyboardSvg from './keyboard.svg?react';
import type { AnimationComponentProps } from '../../types/splash.types';
import { SPLASH_CHOREOGRAPHY } from '../../pages/SplashPage/splashChoreography';
import styles from './Tagline.module.css';

const KEY_MAP: readonly { selector: string; at: number }[] = [
  { selector: '.key_c', at: SPLASH_CHOREOGRAPHY.tagline.keyOffsets.C },
  { selector: '.key_o', at: SPLASH_CHOREOGRAPHY.tagline.keyOffsets.O },
  { selector: '.key_v', at: SPLASH_CHOREOGRAPHY.tagline.keyOffsets.V },
  { selector: '.key_s', at: SPLASH_CHOREOGRAPHY.tagline.keyOffsets.S },
  { selector: '.key_k', at: SPLASH_CHOREOGRAPHY.tagline.keyOffsets.K },
  { selector: '.key_i', at: SPLASH_CHOREOGRAPHY.tagline.keyOffsets.I },
  { selector: '.key_y', at: SPLASH_CHOREOGRAPHY.tagline.keyOffsets.Y },
  { selector: '.key_enter', at: SPLASH_CHOREOGRAPHY.tagline.keyOffsets.ENTER },
];

export function Tagline({ onRegisterTimeline }: AnimationComponentProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const keyboardRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const { labels: L, durations: D } = SPLASH_CHOREOGRAPHY.tagline;

  useGSAP(
    () => {
      if (!containerRef.current) return;

      const tl = gsap.timeline({
        id: 'Tagline.tsx timeline',
        defaults: { ease: 'power2.out' },
      });

      // Метка старта Tagline на его собственном timeline
      tl.addLabel('KEYBOARD_IN', L.KEYBOARD_IN);

      const split = SplitText.create(textRef.current, { type: 'lines' });
      gsap.set(split.lines, { y: -20, opacity: 0 });

      tl.fromTo(
        keyboardRef.current,
        { y: '-120%' },
        { y: '0%', opacity: 1, duration: D.KEYBOARD_IN },
        'KEYBOARD_IN',
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

      tl.to(keyboardRef.current, {
        y: '120%',
        opacity: 0,
        duration: D.KEYBOARD_OUT,
        ease: 'power2.in',
      });

      tl.fromTo(
        split.lines,
        { y: -20 },
        {
          y: 0,
          opacity: 1,
          duration: D.TEXT_REVEAL,
          ease: 'back.out(1.7)',
          stagger: D.TEXT_STAGGER,
        },
      );

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
        Lorem ipsum dolor sit
        <br />
        Amet consectetur adipiscing
      </div>
    </div>
  );
}
