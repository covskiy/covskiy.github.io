import { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { logger } from '../../utils/logger';
import type { AnimationComponentProps } from '../../types/splash.types';
import { SPLASH_CHOREOGRAPHY } from '../../pages/SplashPage/splashChoreography';
import LogoSvg from './LogoText.svg?react';
import styles from './LogoText.module.css';

export function LogoText({ onRegisterTimeline }: AnimationComponentProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (!containerRef.current) {
        logger.warn('LogoText', 'containerRef is null, skipping animation');
        return;
      }

      logger.info('LogoText', 'Building animation timelines');
      const localTimeline = gsap.timeline({ id: 'Logo.tsx tl' });

      const cLetterTimeline = gsap.timeline({ id: 'CLetter tl' });
      createCLetterTimeline(cLetterTimeline);

      const ovskiyTl = gsap.timeline({ id: 'letters tl' });
      createOVSKIYTimeline(ovskiyTl);

      const cursorTl = gsap.timeline({ id: 'Nail tl' });
      createCursorTimeline(cursorTl);

      localTimeline.add(cLetterTimeline, 0).add(cursorTl, 0).add(ovskiyTl, 0);
      logger.debug('LogoText', 'Registering local timeline on master');
      onRegisterTimeline(localTimeline);
    },
    { dependencies: [onRegisterTimeline], scope: containerRef },
  );

  return (
    <div ref={containerRef} className={styles.container}>
      <LogoSvg className={styles.svg} />
    </div>
  );
}

/**
 * Timeline с анимацией первой буквы C Intro страницы
 * @param tl timeline на который будет регистрироваться анимация
 * @returns timeline с добавленными аномалиями
 */
function createCLetterTimeline(tl: gsap.core.Timeline): gsap.core.Timeline {
  const { C: letterC } = SPLASH_CHOREOGRAPHY.logoText;
  const letterCSelector = '.img-c';

  logger.debug('LogoText', 'C phaseShoe', {
    x: letterC.phaseShoe.xPosition,
    rotate: letterC.phaseShoe.rotate,
    duration: letterC.phaseShoe.duration,
    start: letterC.phaseShoe.start,
  });
  logger.debug('LogoText', 'C phaseLetter', {
    duration: letterC.phaseLetter.duration,
    start: letterC.phaseLetter.start,
  });

  tl.from(
    letterCSelector,
    {
      transformOrigin: '50% 50%',
      x: letterC.phaseShoe.xPosition,
      rotate: letterC.phaseShoe.rotate,
      duration: letterC.phaseShoe.duration,
    },
    letterC.phaseShoe.start,
  ).to(
    letterCSelector,
    {
      morphSVG: { shape: '#morphPath-C' },
      duration: letterC.phaseLetter.duration,
    },
    letterC.phaseLetter.start,
  );
  return tl;
}

/**
 * Timeline с анимацией букв логотекста, кроме заглавной
 * @param tl timeline на который будет регистрироваться анимация
 * @returns timeline с добавленными аномалиями
 */
function createOVSKIYTimeline(tl: gsap.core.Timeline): gsap.core.Timeline {
  const {
    O: letterO,
    V: letterV,
    S: letterS,
    K: letterK,
    I: letterI,
    Y: letterY,
  } = SPLASH_CHOREOGRAPHY.logoText;

  logger.debug('LogoText', 'Letters phaseDash starts', {
    O: letterO.phaseDash.start,
    V: letterV.phaseDash.start,
    S: letterS.phaseDash.start,
    K: letterK.phaseDash.start,
    I: letterI.phaseDash.start,
    Y: letterY.phaseDash.start,
  });

  tl.set(
    '.img-o',
    { opacity: 1, visibility: 'visible' },
    letterO.phaseDash.start,
  )
    .to(
      '.img-o',
      {
        morphSVG: '#morphPath-O',
        duration: letterO.phaseLetter.duration,
        ease: 'power1.inOut',
      },
      letterO.phaseDash.start + letterO.phaseLetter.delay,
    )

    .set(
      '.img-v',
      { opacity: 1, visibility: 'visible' },
      letterV.phaseDash.start,
    )

    .to(
      '.img-v',
      {
        morphSVG: '#morphPath-V',
        duration: letterV.phaseLetter.duration,
        ease: 'power1.inOut',
      },
      letterV.phaseDash.start + letterV.phaseLetter.delay,
    )

    .set(
      '.img-s',
      { opacity: 1, visibility: 'visible' },
      letterS.phaseDash.start,
    )

    .to(
      '.img-s',
      {
        morphSVG: '#morphPath-S',
        duration: letterS.phaseLetter.duration,
        ease: 'power1.inOut',
      },
      letterS.phaseDash.start + letterS.phaseLetter.delay,
    )

    .set(
      '.img-k',
      { opacity: 1, visibility: 'visible' },
      letterK.phaseDash.start,
    )

    .to(
      '.img-k',
      {
        morphSVG: '#morphPath-K',
        duration: letterK.phaseLetter.duration,
        ease: 'power1.inOut',
      },
      letterK.phaseDash.start + letterK.phaseLetter.delay,
    )

    .set(
      '.img-i',
      { opacity: 1, visibility: 'visible' },
      letterI.phaseDash.start,
    )

    .to(
      '.img-i',
      {
        morphSVG: '#morphPath-I',
        duration: letterI.phaseLetter.duration,
        ease: 'power1.inOut',
      },
      letterI.phaseDash.start + letterI.phaseLetter.delay,
    )

    .set(
      '.img-y',
      { opacity: 1, visibility: 'visible' },
      letterY.phaseDash.start,
    )

    .to(
      '.img-y',
      {
        morphSVG: '#morphPath-Y',
        duration: letterY.phaseLetter.duration,
        ease: 'power1.inOut',
      },
      letterY.phaseDash.start + letterY.phaseLetter.delay,
    );

  return tl;
}

/**
 * Timeline с анимацией курсора, бегущего по логотексту
 * @param tl timeline на который будет регистрироваться анимация
 * @returns timeline с добавленными аномалиями
 */
function createCursorTimeline(tl: gsap.core.Timeline): gsap.core.Timeline {
  const {
    Cursor,
    O: letterO,
    V: letterV,
    S: letterS,
    K: letterK,
    I: letterI,
    Y: letterY,
  } = SPLASH_CHOREOGRAPHY.logoText;
  const cursorSelector = '.img-nail';

  logger.debug('LogoText', 'Cursor phaseNail', {
    rotation: Cursor.phaseNail.rotation,
    duration: Cursor.phaseNail.duration,
    start: Cursor.phaseNail.start,
  });
  logger.debug('LogoText', 'Cursor phaseMoving', {
    xPosition: Cursor.phaseMoving.xPosition,
    duration: Cursor.phaseMoving.duration,
    start: Cursor.phaseMoving.start,
  });

  tl.from(
    cursorSelector,
    {
      motionPath: {
        path: '#nail-path',
        align: '#nail-path',
        start: 0,
        end: 1,
      },
      transformOrigin: '50% 50%',
      ease: 'slow(0.7,0.7,false)',
      rotate: Cursor.phaseNail.rotation,
      duration: Cursor.phaseNail.duration,
    },
    Cursor.phaseNail.start,
  )
    .to(
      cursorSelector,
      {
        morphSVG: '#morphCursorForm',
        duration: Cursor.phaseCaret.duration,
        ease: 'power2.inOut',
      },
      Cursor.phaseCaret.start,
    )
    .to(cursorSelector, {
      x: Cursor.phaseMoving.xPosition,
      duration: Cursor.phaseMoving.duration,
      ease: 'none',
    })
    .set(
      cursorSelector,
      { transformOrigin: 'right center' },
      letterO.phaseDash.start,
    )
    .to(
      cursorSelector,
      { scaleX: Cursor.scales.O, duration: 0 },
      letterO.phaseDash.start,
    )
    .to(
      cursorSelector,
      { scaleX: Cursor.scales.V, duration: 0 },
      letterV.phaseDash.start,
    )
    .to(
      cursorSelector,
      { scaleX: Cursor.scales.S, duration: 0 },
      letterS.phaseDash.start,
    )
    .to(
      cursorSelector,
      { scaleX: Cursor.scales.K, duration: 0 },
      letterK.phaseDash.start,
    )
    .to(
      cursorSelector,
      { scaleX: Cursor.scales.I, duration: 0 },
      letterI.phaseDash.start,
    )
    .set(
      cursorSelector,
      {
        opacity: 0,
        visibility: 'hidden',
      },
      letterY.phaseDash.start,
    );

  return tl;
}
