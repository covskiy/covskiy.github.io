import { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { SplitText } from 'gsap/SplitText';
import KeyboardSvg from './keyboard.svg?react';
import type { AnimationComponentProps } from '../../types/splash.types';
import styles from './Tagline.module.css';

const KEY_SELECTORS = [
  '.key_c',
  '.key_o',
  '.key_v',
  '.key_s',
  '.key_k',
  '.key_i',
  '.key_y',
];

export function Tagline({ timeline }: AnimationComponentProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const keyboardRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (!timeline || !containerRef.current) return;

      const tl = gsap.timeline({
        id: 'Tagline.tsx timeline',
        defaults: { ease: 'power2.out' },
      });

      const split = SplitText.create(textRef.current, { type: 'lines' });
      gsap.set(split.lines, { y: -20, opacity: 0 });

      tl.fromTo(
        keyboardRef.current,
        { y: '-120%' },
        { y: '0%', opacity: 1, duration: 0.5 },
      );

      KEY_SELECTORS.forEach((selector) => {
        tl.to(
          selector,
          {
            fill: '#04bf8a',
            opacity: 1,
            scale: 1.2,
            duration: 0.3,
            transformOrigin: 'center center',
          },
          '>0.3',
        );
      });

      tl.to(
        '.key_enter',
        {
          fill: '#04bf8a',
          opacity: 1,
          scale: 1.2,
          duration: 0.3,
          transformOrigin: 'center center',
        },
        '>0.5',
      );

      tl.to(keyboardRef.current, {
        y: '120%',
        opacity: 0,
        duration: 0.4,
        ease: 'power2.in',
      });

      tl.fromTo(
        split.lines,
        { y: -20 },
        {
          y: 0,
          opacity: 1,
          duration: 0.6,
          ease: 'back.out(1.7)',
          stagger: 0.15,
        },
      );

      timeline.add(tl, 1.0);
    },
    { dependencies: [timeline], scope: containerRef },
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
