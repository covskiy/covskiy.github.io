import { useEffect, useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { logger } from '../../utils/logger';
import type { AnimationComponentProps } from '../../types/splash.types';
import { SPLASH_CHOREOGRAPHY } from '../../pages/SplashPage/splashChoreography';
import {
  createSparkSystem,
  type SparkProfile,
  type SparkSystem,
} from './sparks';
import LogoSvg from './LogoText.svg?react';
import styles from './LogoText.module.css';

type ProfileKey =
  keyof (typeof SPLASH_CHOREOGRAPHY)['logoText']['sparks']['profiles'];

/**
 * Y-диапазон эмиссии на правой границе канваса (доля высоты канваса).
 * 0.6..0.92 = нижняя половина, в районе полосы текста.
 * ↑ EMIT_Y_MIN_FRAC = эмиссия поднимается выше; ↓ = опускается ниже.
 */
const EMIT_Y_MIN_FRAC = 0.6;
const EMIT_Y_MAX_FRAC = 0.92;
/** X — у самой правой границы канваса, отступ 4px (искры сразу летят влево, не залипают на краю). */
const EMIT_X_OFFSET = 4;

/** viewBox LogoText.svg — для пересчёта Path2D (в SVG-юнитах) → CSS-пиксели канваса. */
const SVG_VIEW_W = 200;
const SVG_VIEW_H = 150;

/**
 * id финальных контуров букв в #logoLetters — единый источник истины
 * для morphSVG и для Path2D-клиппинга искр. d читается из DOM при монтировании.
 * Порядок = порядок букв в слове COVSKIY (для логов и предсказуемости).
 */
const LETTER_PATH_IDS = [
  'morphPath-C',
  'morphPath-O',
  'morphPath-V',
  'morphPath-S',
  'morphPath-K',
  'morphPath-I',
  'morphPath-Y',
] as const;

/**
 * Множитель vx для уже летящих искр при выходе второго пучка.
 * ↑ = сильнее рывок (визуально ярче, но менее натурально).
 */
const BURST_BOOST_FACTOR = 1.7;

/**
 * Брейкпоинты выбора профиля. Совпадают с design-tokens breakpoints
 * (481 = tablet, 1025 = desktop), laptop объединён с tablet.
 */
function getActiveProfileKey(): ProfileKey {
  const w = window.innerWidth;
  if (w < 481) return 'mobile';
  if (w < 1025) return 'tablet';
  return 'desktop';
}

export function LogoText({ onRegisterTimeline }: AnimationComponentProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ w: 0, h: 0 });
  const systemRef = useRef<SparkSystem | null>(null);
  const profileRef = useRef<SparkProfile | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const clipPathRef = useRef<Path2D | null>(null);
  const dprRef = useRef(1);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;

    // Синхронизация размера канваса с контейнером (с учётом device pixel ratio).
    // canvas.width/height — физические пиксели (× dpr для Retina).
    // ctx.setTransform(dpr,0,0,dpr,0,0) — все draw-команды в CSS-пикселях.
    // sizeRef хранит CSS-размеры для использования в step().
    const sync = () => {
      canvas.width = Math.max(1, Math.round(container.clientWidth * dpr));
      canvas.height = Math.max(1, Math.round(container.clientHeight * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      dprRef.current = dpr;
      sizeRef.current = { w: canvas.width / dpr, h: canvas.height / dpr };
    };
    sync();

    // ResizeObserver — наблюдаем за канвасом (а не за контейнером), потому что
    // канвас теперь меньше контейнера (только SVG-зона, для выравнивания mask).
    // При ресайзе sync() подхватывает новые clientWidth/Height канваса.
    const ro = new ResizeObserver(sync);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, []);

  useGSAP(
    () => {
      const container = containerRef.current;
      const canvas = canvasRef.current;
      if (!container || !canvas) {
        logger.warn(
          'LogoText',
          'container or canvas is null, skipping animation',
        );
        return;
      }

      // === Сборка Path2D для клиппинга искр по контурам букв ===
      // Берём d у финальных morphPath-* в #logoLetters (display:none, но в DOM).
      // Эти же пути используются для morphSVG — единый источник истины.
      // Семь subpath'ов объединяются в один Path2D, потому что повторный
      // ctx.clip() даёт ПЕРЕСЕЧЕНИЕ, а нам нужен UNION контуров букв.
      const clipPath = new Path2D();
      let clipFound = 0;
      for (const id of LETTER_PATH_IDS) {
        const el = document.getElementById(id);
        if (el instanceof SVGPathElement) {
          const d = el.getAttribute('d');
          if (d) {
            clipPath.addPath(new Path2D(d));
            clipFound++;
          }
        }
      }
      clipPathRef.current =
        clipFound === LETTER_PATH_IDS.length ? clipPath : null;
      if (clipFound !== LETTER_PATH_IDS.length) {
        logger.warn('LogoText', 'clip path incomplete, sparks may bleed', {
          found: clipFound,
          total: LETTER_PATH_IDS.length,
        });
      } else {
        logger.info('LogoText', 'clip path built', { subpaths: clipFound });
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

      const SPARKS = SPLASH_CHOREOGRAPHY.logoText.sparks;
      const profileKey = getActiveProfileKey();
      const profile = SPARKS.profiles[profileKey];
      profileRef.current = profile;
      const system = createSparkSystem(profile, {
        coneHalfAngle: SPARKS.coneHalfAngle,
        colors: SPARKS.colors,
        smokeHalo: SPARKS.smokeHalo,
        tailColor: SPARKS.tailColor,
        coreAlphaMultipliers: SPARKS.coreAlphaMultipliers,
      });
      systemRef.current = system;
      logger.info('LogoText', 'Spark profile locked', {
        key: profileKey,
        count: profile.count,
        subSpawns: profile.subSpawns,
      });

      const ctx2d = canvas.getContext('2d');
      if (!ctx2d) {
        logger.warn(
          'LogoText',
          'canvas 2d context unavailable, sparks disabled',
        );
      } else {
        // === Главный rAF-цикл отрисовки искр ===
        // dt clamp 0.1 — защита от огромных скачков при переключении вкладки
        // (иначе за время простоя накопится огромный dt и физика взорвётся).
        const loop = (t: number) => {
          const dt = lastTimeRef.current
            ? Math.min(0.1, (t - lastTimeRef.current) / 1000)
            : 0;
          lastTimeRef.current = t;
          const { w, h } = sizeRef.current;
          // === Клиппинг по контурам букв через Path2D ===
          // Техника: setTransform(масштабированный) → clip → setTransform(dpr) → draw.
          // 1) Под масштабированным CTM (dpr*w/200, dpr*h/150) viewBox-юниты Path2D
          //    мапятся на device-координаты всего канваса (0..dpr*w × 0..dpr*h),
          //    клип устанавливается в device-space как контуры букв.
          // 2) Сброс CTM к dpr перед step() — step() рисует в CSS-пикселях
          //    (clearRect, arc), как и задумано.
          // 3) Клип переживает setTransform (clip region хранится в user-agent
          //    coordinate system, не зависит от CTM), а restore() в конце
          //    корректно сбрасывает и CTM, и клип для следующего кадра.
          // Канвас имеет aspect-ratio: SVG_VIEW_W/SVG_VIEW_H → scaleX === scaleY.
          if (w > 0 && h > 0) {
            const dpr = dprRef.current;
            ctx2d.save();
            ctx2d.setTransform(
              dpr * (w / SVG_VIEW_W),
              0,
              0,
              dpr * (h / SVG_VIEW_H),
              0,
              0,
            );
            const clip = clipPathRef.current;
            if (clip) ctx2d.clip(clip);
            ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
            system.step(dt, ctx2d, w, h);
            ctx2d.restore();
          }
          if (system.isAlive()) {
            rafRef.current = requestAnimationFrame(loop);
          } else {
            // Все искры потухли — стоп цикл до следующего burst'а.
            rafRef.current = null;
            lastTimeRef.current = 0;
          }
        };

        // Идемпотентный запуск rAF: если уже идёт — ничего не делаем.
        // Нужен потому что первый emit может произойти из любого sub-spawn'а.
        const ensureRaf = () => {
          if (rafRef.current === null) {
            lastTimeRef.current = 0;
            rafRef.current = requestAnimationFrame(loop);
          }
        };

        // Эмиссия одной искры в случайной Y правой границы.
        // burst передаётся в system.emit — определяет per-burst множитель яркости.
        const emitOne = (ox: number, oy: number, burst: 1 | 2) => {
          if (!systemRef.current) return;
          systemRef.current.emit(ox, oy, 1, burst);
          ensureRaf();
        };

        // Запускает GSAP-твин на burstDuration секунд.
        // Каждый кадр твина проверяет, какие из N заранее сгенерированных
        // scheduled times уже прошли, и эмитит соответствующие искры.
        // Сортированные случайные времена = искры распределены примерно
        // равномерно, но не строго по сетке (нет «армейского» строя).
        const startStream = (
          ox: number,
          oyMin: number,
          oyMax: number,
          total: number,
          duration: number,
          burst: 1 | 2,
        ) => {
          const scheduled: number[] = [];
          for (let i = 0; i < total; i++) {
            scheduled.push(Math.random() * duration);
          }
          scheduled.sort((a, b) => a - b);

          const state = { progress: 0, emitted: 0 };
          gsap.to(state, {
            progress: 1,
            duration,
            ease: 'none',
            onUpdate: () => {
              const currentTime = state.progress * duration;
              while (
                state.emitted < total &&
                scheduled[state.emitted] <= currentTime
              ) {
                const oy = oyMin + Math.random() * (oyMax - oyMin);
                emitOne(ox, oy, burst);
                state.emitted++;
              }
            },
          });
        };

        // Один sub-spawn = один непрерывный поток count искр за burstDuration.
        // Координаты эмиссии: правая граница канваса, случайный Y в заданном диапазоне.
        const startSubSpawn = (burst: 1 | 2) => {
          const { w, h } = sizeRef.current;
          const ox = w - EMIT_X_OFFSET;
          const oyMin = h * EMIT_Y_MIN_FRAC;
          const oyMax = h * EMIT_Y_MAX_FRAC;
          startStream(
            ox,
            oyMin,
            oyMax,
            profile.count,
            profile.burstDuration,
            burst,
          );
        };

        // === BURST 1: только эмиссия, без boost'а ===
        for (let i = 0; i < profile.subSpawns; i++) {
          localTimeline.call(
            () => startSubSpawn(1),
            [],
            SPARKS.burst1 + i * profile.subSpawnInterval,
          );
        }
        // === BURST 2: эмиссия + boost уже летящих искр ===
        // boostAll(1.7) — все живые vx *= 1.7, визуально «порыв ветра»
        // подхватывает уже летящий рой. Ступенчато по sub-spawn'ам на десктопе.
        for (let i = 0; i < profile.subSpawns; i++) {
          localTimeline.call(
            () => {
              startSubSpawn(2);
              systemRef.current?.boostAll(BURST_BOOST_FACTOR);
            },
            [],
            SPARKS.burst2 + i * profile.subSpawnInterval,
          );
        }
      }

      logger.debug('LogoText', 'Registering local timeline on master');
      onRegisterTimeline(localTimeline);

      return () => {
        if (rafRef.current !== null) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
        if (systemRef.current) {
          systemRef.current.destroy();
          systemRef.current = null;
        }
        profileRef.current = null;
        clipPathRef.current = null;
      };
    },
    { dependencies: [onRegisterTimeline], scope: containerRef },
  );

  return (
    <div ref={containerRef} className={styles.container}>
      <LogoSvg className={styles.svg} />
      <canvas ref={canvasRef} className={styles.canvas} />
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
