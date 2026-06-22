import { logger } from '../../utils/logger';
import { SPLASH_CHOREOGRAPHY } from '../../pages/SplashPage/splashChoreography';
import type { SparksConfig } from './sparks.config';

const OVSKIY_LETTERS = ['O', 'V', 'S', 'K', 'I', 'Y'] as const;

type LetterId = 'C' | 'O' | 'V' | 'S' | 'K' | 'I' | 'Y';

/** CSS-селектор элемента буквы в SVG: C → .img-c, O → .img-o, ... */
const selectorFor = (id: LetterId): string => `.img-${id.toLowerCase()}`;

/** GSAP/morphSVG-селектор финального контура (с #): C → #morphPath-C. */
const morphSelectorFor = (id: LetterId): string => `#morphPath-${id}`;

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
 * Data-driven: итерация по OVSKIY_LETTERS, единый паттерн set(visible) → to(morphSVG).
 * @param tl timeline на который будет регистрироваться анимация
 * @returns timeline с добавленными анимациями
 */
export function createOVSKIYTimeline(
  tl: gsap.core.Timeline,
): gsap.core.Timeline {
  const logoText = SPLASH_CHOREOGRAPHY.logoText;

  const dashStarts: Record<string, number> = {};
  for (const id of OVSKIY_LETTERS) {
    dashStarts[id] = logoText[id].phaseDash.start;
  }
  logger.debug('LogoText', 'Letters phaseDash starts', dashStarts);

  for (const id of OVSKIY_LETTERS) {
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

  for (const id of OVSKIY_LETTERS) {
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

/**
 * Билдер твинов эмиссии искр (два пучка).
 *
 * Эмиссия растянута во времени: твин `progress.value: 0 → 1` дёргает
 * `onUpdate`, в котором считается дельта эмиссии за шаг и вызывается
 * `emitFn(delta, burstLabel)`. Это даёт «размазанный» по времени выброс,
 * а не мгновенный залп.
 *
 * Кол-во искр берётся из активного профиля на момент эмиссии
 * (`getProfile()[label].count`) — это позволяет per-profile варьировать
 * плотность выброса. Тайминги (start, duration) — глобальные.
 *
 * Поддерживает скраб GSDevTools: при движении tween-progress назад
 * `onClear()` вызывается и локальный `emitted` сбрасывается — иначе
 * повторный проход вперёд оставил бы «призраков».
 *
 * @param tl timeline, на который регистрируются твины
 * @param config конфиг эффекта (глобальные тайминги и визуал burst'ов)
 * @param getProfile getter активного профиля (читает count)
 * @param emitFn колбэк эмиссии: (delta, burstLabel) => void
 * @param onClear колбэк очистки системы при скрабе назад
 * @param onBurstStart колбэк старта пучка (например, дёрнуть RAF-цикл)
 * @returns тот же timeline с добавленными твинами burst1, burst2
 */
export function createSparksTimeline(
  tl: gsap.core.Timeline,
  config: SparksConfig,
  getProfile: () => SparksConfig['profiles']['mobile'],
  emitFn: (delta: number, burstLabel: 'burst1' | 'burst2') => void,
  onClear: () => void,
  onBurstStart: () => void,
): gsap.core.Timeline {
  function buildBurstTween(
    parent: gsap.core.Timeline,
    timing: SparksConfig['burst1'],
    burstLabel: 'burst1' | 'burst2',
  ): void {
    const progress = { value: 0 };
    let emitted = 0;
    let lastValue = 0;
    const duration = Math.max(0.01, timing.duration);
    const onUpdate = (): void => {
      const v = progress.value;
      if (v < lastValue) {
        onClear();
        emitted = 0;
      }
      lastValue = v;
      const count = getProfile()[burstLabel].count;
      if (count <= 0) return;
      const target = Math.floor(v * count);
      const delta = target - emitted;
      if (delta > 0) {
        emitted = target;
        emitFn(delta, burstLabel);
        logger.trace('LogoText', `${burstLabel} emit batch`, {
          delta,
          total: emitted,
        });
      }
    };
    parent.to(
      progress,
      {
        value: 1,
        duration,
        ease: 'none',
        onUpdate,
        onStart: () => {
          emitted = 0;
          lastValue = 0;
          onBurstStart();
        },
      },
      timing.start,
    );
  }

  buildBurstTween(tl, config.burst1, 'burst1');
  buildBurstTween(tl, config.burst2, 'burst2');

  return tl;
}

/**
 * Регистрирует на таймлайне одноразовый boostAll на позиции `burst2.start`.
 * «Пинок» всем ещё живым искрам из первого пучка при срабатывании второго.
 * Множитель берётся из активного профиля (per-profile).
 */
export function scheduleSparksBoost(
  tl: gsap.core.Timeline,
  config: SparksConfig,
  getProfile: () => SparksConfig['profiles']['mobile'],
  boostFn: (factor: number) => void,
): void {
  tl.call(
    () => {
      const factor = getProfile().boostFactor;
      boostFn(factor);
      logger.debug('LogoText', 'boostAll applied', { factor });
    },
    [],
    config.burst2.start,
  );
}
