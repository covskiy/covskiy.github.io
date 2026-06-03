import { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import type { AnimationComponentProps } from '../../types/splash.types';
import LogoSvg from './LogoText.svg?react';
import styles from './LogoText.module.css';

const MORPH_DURATION = 0.4;
const NAIL_FLY_DURATION = 1.2;
const NAIL_MORPH_DURATION = 0.5;
const CURSOR_MOVE_DURATION = 2;

export function LogoText({ onRegisterTimeline }: AnimationComponentProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (!containerRef.current) return;

      const tl = gsap.timeline({ id: 'Logo.tsx tl' });

      const svg = containerRef.current;

      const getPathD = (sel: string) =>
        svg.querySelector(sel)?.getAttribute('d') ?? '';

      const ltr = {
        c: getPathD('.letter-c'),
        o: getPathD('.letter-o'),
        v: getPathD('.letter-v'),
        s: getPathD('.letter-s'),
        k: getPathD('.letter-k'),
        i: getPathD('.letter-i'),
        y: getPathD('.letter-y'),
      };

      const letterC = gsap.utils.selector(containerRef)('.img-c');
      const CLetter = gsap
        .timeline({ id: 'CLetter tl' })
        .from(letterC, {
          x: '-50',
          rotate: '-90',
          duration: 0.5,
        })
        .to(letterC, {
          morphSVG: { shape: ltr.c },
          duration: 0.5,
        });

      const posMarkers = ['o', 'v', 's', 'k', 'i', 'y'] as const;
      const positions: Record<string, number> = {};
      for (const letter of posMarkers) {
        const el = svg.querySelector(`.img-${letter}`);
        if (el) positions[letter] = (el as SVGGraphicsElement).getBBox().x;
      }

      const lettersTl = gsap.timeline({
        id: 'letters tl',
        paused: true,
        onStart: () => console.log('letters tl start playing'),
      });
      for (const letter of posMarkers) {
        lettersTl
          .set(`.img-${letter}`, {
            opacity: 1,
            visibility: 'visible',
            onComplete: () => console.log(`letter ${letter} set to visible`),
          })
          .to(`.img-${letter}`, {
            morphSVG: ltr[letter as keyof typeof ltr],
            duration: MORPH_DURATION,
            ease: 'power1.inOut',
            onComplete: () => console.log(`another morph done for: ${letter}`),
          })
          .pause();
      }

      const cursor = gsap.utils.selector(containerRef)('.img-nail');
      const NailLine = gsap
        .timeline({ id: 'Nail tl' })
        .from(cursor, {
          x: 300,
          y: -150,
          rotation: 540,
          duration: NAIL_FLY_DURATION,
          ease: 'power3.out',
          transformOrigin: '50% 50%',
        })
        .to(cursor, {
          morphSVG: { shape: getPathD('.img-cur') },
          duration: NAIL_MORPH_DURATION,
          ease: 'power2.inOut',
        })
        .add(lettersTl)
        .to(cursor, {
          x: 127,
          duration: CURSOR_MOVE_DURATION,
          ease: 'none',
          onStart: () => {
            lettersTl.play(0);
            console.log(`Letters tl started by cursor`);
          },
        })
        .set(cursor, {
          opacity: 0,
          visibility: 'hidden',
        });

      // const posMarkers = ['o', 'v', 's', 'k', 'i'] as const;
      // const positions: Record<string, number> = {};
      // for (const letter of posMarkers) {
      //   const el = svg.querySelector(`.img-${letter}`);
      //   if (el) positions[letter] = (el as SVGGraphicsElement).getBBox().x;
      // }

      // const nailEl = svg.querySelector(
      //   '.img-nail',
      // ) as SVGGraphicsElement | null;
      // const imgOEl = svg.querySelector('.img-o') as SVGGraphicsElement | null;
      // const curEl = svg.querySelector('.img-cur') as SVGGraphicsElement | null;
      // if (!nailEl || !imgOEl || !curEl) return;
      // const nailBBox = nailEl.getBBox();
      // const imgOBBox = imgOEl.getBBox();
      // const curBBox = curEl.getBBox();

      // const targetCurCenter = positions.i + 30;
      // const cursorDeltaX = targetCurCenter - (curBBox.x + curBBox.width / 2);

      // const nailDx = imgOBBox.x - nailBBox.x;
      // const nailDy = imgOBBox.y - nailBBox.y;

      // const morphed: Record<string, boolean> = {};

      // tl.add(
      //   gsap.from('.img-nail', {
      //     x: 300,
      //     y: -150,
      //     rotation: 540,
      //     duration: NAIL_FLY_DURATION,
      //     ease: 'power3.out',
      //     transformOrigin: '50% 50%',
      //   }),
      //   0,
      // );

      // tl.add(
      //   gsap.to('.img-nail', {
      //     morphSVG: { shape: '.img-o' },
      //     x: nailDx,
      //     y: nailDy,
      //     duration: NAIL_MORPH_DURATION,
      //     ease: 'power2.inOut',
      //     onComplete: () => {
      //       gsap.set('.img-nail', { opacity: 0, visibility: 'hidden' });
      //       gsap.set('.img-o', { opacity: 1, visibility: 'visible' });
      //     },
      //   }),
      //   NAIL_FLY_DURATION,
      // );

      // const cursorTween = gsap.to('.img-cur', {
      //   x: cursorDeltaX,
      //   duration: CURSOR_MOVE_DURATION,
      //   ease: 'none',
      //   onUpdate: () => {
      //     const curX = gsap.getProperty('.img-cur', 'x') as number;
      //     const cursorCenter = curBBox.x + curX + curBBox.width / 2;

      //     if (!morphed.c) {
      //       morphed.c = true;
      //       gsap.to('.img-c', {
      //         morphSVG: ltr.c,
      //         duration: MORPH_DURATION,
      //         ease: 'power1.inOut',
      //       });
      //     }

      //     for (const letter of posMarkers) {
      //       const posX = positions[letter];
      //       if (cursorCenter >= posX && !morphed[letter]) {
      //         morphed[letter] = true;
      //         gsap.to(`.img-${letter}`, {
      //           morphSVG: ltr[letter as keyof typeof ltr],
      //           duration: MORPH_DURATION,
      //           ease: 'power1.inOut',
      //         });
      //       }
      //     }
      //   },
      //   onComplete: () => {
      //     gsap.to('.img-cur', {
      //       morphSVG: ltr.y,
      //       duration: MORPH_DURATION + 0.1,
      //       ease: 'power1.inOut',
      //     });
      //   },
      // });

      // tl.add(cursorTween, NAIL_FLY_DURATION + NAIL_MORPH_DURATION);
      tl.add([CLetter, NailLine]);
      onRegisterTimeline(tl);
    },
    { dependencies: [onRegisterTimeline], scope: containerRef },
  );

  return (
    <div ref={containerRef} className={styles.container}>
      <LogoSvg className={styles.svg} />
    </div>
  );
}
