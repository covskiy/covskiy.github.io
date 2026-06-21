import { logger } from '../../utils/logger';
import { SPLASH_CHOREOGRAPHY } from '../../pages/SplashPage/splashChoreography';
import { morphSelectorFor, OVSKIY_IDS, selectorFor } from './constants';

/**
 * Timeline с анимацией первой буквы C Intro страницы.
 * @param tl timeline на который будет регистрироваться анимация
 * @returns timeline с добавленными анимациями
 */
export function createCLetterTimeline(
  tl: gsap.core.Timeline,
): gsap.core.Timeline {
  const { C: letterC } = SPLASH_CHOREOGRAPHY.logoText;

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
    selectorFor('C'),
    {
      transformOrigin: '50% 50%',
      x: letterC.phaseShoe.xPosition,
      rotate: letterC.phaseShoe.rotate,
      duration: letterC.phaseShoe.duration,
    },
    letterC.phaseShoe.start,
  ).to(
    selectorFor('C'),
    {
      morphSVG: morphSelectorFor('C'),
      duration: letterC.phaseLetter.duration,
    },
    letterC.phaseLetter.start,
  );
  return tl;
}

/**
 * Timeline с анимацией букв логотекста, кроме заглавной C.
 * Data-driven: итерация по OVSKIY_IDS, единый паттерн set(visible) → to(morphSVG).
 * @param tl timeline на который будет регистрироваться анимация
 * @returns timeline с добавленными анимациями
 */
export function createOVSKIYTimeline(
  tl: gsap.core.Timeline,
): gsap.core.Timeline {
  const logoText = SPLASH_CHOREOGRAPHY.logoText;

  const dashStarts: Record<string, number> = {};
  for (const id of OVSKIY_IDS) {
    dashStarts[id] = logoText[id].phaseDash.start;
  }
  logger.debug('LogoText', 'Letters phaseDash starts', dashStarts);

  for (const id of OVSKIY_IDS) {
    const letter = logoText[id];
    tl.set(
      selectorFor(id),
      { opacity: 1, visibility: 'visible' },
      letter.phaseDash.start,
    ).to(
      selectorFor(id),
      {
        morphSVG: morphSelectorFor(id),
        duration: letter.phaseLetter.duration,
        ease: 'power1.inOut',
      },
      letter.phaseDash.start + letter.phaseLetter.delay,
    );
  }

  return tl;
}

/**
 * Timeline с анимацией курсора, бегущего по логотексту.
 * @param tl timeline на который будет регистрироваться анимация
 * @returns timeline с добавленными анимациями
 */
export function createCursorTimeline(
  tl: gsap.core.Timeline,
): gsap.core.Timeline {
  const { Cursor } = SPLASH_CHOREOGRAPHY.logoText;
  const { O: letterO, Y: letterY } = SPLASH_CHOREOGRAPHY.logoText;
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
    );

  for (const id of OVSKIY_IDS) {
    if (id === 'Y') continue;
    const letter = SPLASH_CHOREOGRAPHY.logoText[id];
    tl.to(
      cursorSelector,
      { scaleX: Cursor.scales[id], duration: 0 },
      letter.phaseDash.start,
    );
  }

  tl.set(
    cursorSelector,
    {
      opacity: 0,
      visibility: 'hidden',
    },
    letterY.phaseDash.start,
  );

  return tl;
}
