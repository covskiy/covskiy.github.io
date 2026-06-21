import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { logger } from '../../utils/logger';
import { SPLASH_CHOREOGRAPHY } from '../../pages/SplashPage/splashChoreography';
import { createSparkSystem, type BurstId, type SparkProfile } from './sparks';
import { LETTER_IDS, pathIdFor, SVG_VIEW_H, SVG_VIEW_W } from './constants';

type ProfileKey =
  keyof (typeof SPLASH_CHOREOGRAPHY)['logoText']['sparks']['profiles'];

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

export type SparkCanvasApi = {
  /** Эмиссия одной искры в заданных координатах. No-op если canvas не готов. */
  emitOne: (ox: number, oy: number, burst: BurstId) => void;
  /** Разовый множитель vx для всех живых искр («порыв ветра»). */
  boostAll: (factor: number) => void;
  /** CSS-размеры канваса (обновляются через ResizeObserver). */
  sizeRef: RefObject<{ w: number; h: number }>;
  /** Активный профиль искр (mobile/tablet/desktop). */
  profile: SparkProfile;
};

/**
 * Инкапсулирует canvas-setup, Path2D-клиппинг по контурам букв,
 * rAF-цикл отрисовки искр и API эмиссии.
 *
 * Система искр создаётся один раз (lazy useState) на основе профиля
 * для текущего брейкпоинта. rAF-цикл самоостанавливается, когда все
 * искры потухли, и перезапускается при следующей эмиссии.
 */
export function useSparkCanvas(
  canvasRef: RefObject<HTMLCanvasElement | null>,
): SparkCanvasApi {
  const sizeRef = useRef({ w: 0, h: 0 });
  const dprRef = useRef(1);
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef(0);
  const clipPathRef = useRef<Path2D | null>(null);
  const loopRef = useRef<FrameRequestCallback | null>(null);

  const [state] = useState(() => {
    const SPARKS = SPLASH_CHOREOGRAPHY.logoText.sparks;
    const profileKey = getActiveProfileKey();
    const profile = SPARKS.profiles[profileKey];
    const system = createSparkSystem(profile, {
      coneHalfAngle: SPARKS.coneHalfAngle,
      colors: SPARKS.colors,
      smokeHalo: SPARKS.smokeHalo,
      tailColor: SPARKS.tailColor,
      coreAlphaMultipliers: SPARKS.coreAlphaMultipliers,
    });
    logger.info('LogoText', 'Spark profile locked', {
      key: profileKey,
      count: profile.count,
      subSpawns: profile.subSpawns,
    });
    return { system, profile };
  });

  const { system, profile } = state;

  // Синхронизация размера канваса с CSS-размером (с учётом device pixel ratio).
  // canvas.width/height — физические пиксели (× dpr для Retina).
  // ctx.setTransform(dpr,0,0,dpr,0,0) — все draw-команды в CSS-пикселях.
  // sizeRef хранит CSS-размеры для использования в step() и startSubSpawn().
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;

    const sync = () => {
      canvas.width = Math.max(1, Math.round(canvas.clientWidth * dpr));
      canvas.height = Math.max(1, Math.round(canvas.clientHeight * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      dprRef.current = dpr;
      sizeRef.current = { w: canvas.width / dpr, h: canvas.height / dpr };
    };
    sync();

    // ResizeObserver — наблюдаем за канвасом (а не за контейнером), потому что
    // канвас меньше контейнера (только SVG-зона, для выравнивания mask).
    const ro = new ResizeObserver(sync);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [canvasRef]);

  // === Сборка Path2D для клиппинга искр по контурам букв ===
  // Берём d у финальных morphPath-* в #logoLetters (display:none, но в DOM).
  // Эти же пути используются для morphSVG — единый источник истины.
  // Семь subpath'ей объединяются в один Path2D, потому что повторный
  // ctx.clip() даёт ПЕРЕСЕЧЕНИЕ, а нам нужен UNION контуров букв.
  //
  // rAF-цикл отрисовки: dt clamp 0.1 — защита от огромных скачков при
  // переключении вкладки (иначе физика взорвётся от накопленного dt).
  //
  // Клиппинг: setTransform(масштабированный) → clip → setTransform(dpr) → draw.
  // 1) Под масштабированным CTM (dpr*w/200, dpr*h/150) viewBox-юниты Path2D
  //    мапятся на device-координаты канваса, клип = контуры букв.
  // 2) Сброс CTM к dpr перед step() — step() рисует в CSS-пикселях.
  // 3) Клип переживает setTransform, restore() сбрасывает CTM и клип.
  // Канвас имеет aspect-ratio: SVG_VIEW_W/SVG_VIEW_H → scaleX === scaleY.
  useEffect(() => {
    const clipPath = new Path2D();
    let clipFound = 0;
    for (const id of LETTER_IDS) {
      const el = document.getElementById(pathIdFor(id));
      if (el instanceof SVGPathElement) {
        const d = el.getAttribute('d');
        if (d) {
          clipPath.addPath(new Path2D(d));
          clipFound++;
        }
      }
    }
    if (clipFound === LETTER_IDS.length) {
      clipPathRef.current = clipPath;
      logger.info('LogoText', 'clip path built', { subpaths: clipFound });
    } else {
      clipPathRef.current = null;
      logger.warn('LogoText', 'clip path incomplete, sparks may bleed', {
        found: clipFound,
        total: LETTER_IDS.length,
      });
    }

    const canvas = canvasRef.current;
    const ctx2d = canvas?.getContext('2d');
    if (!ctx2d) {
      logger.warn('LogoText', 'canvas 2d context unavailable, sparks disabled');
      return;
    }

    const loop: FrameRequestCallback = (t) => {
      const dt = lastTimeRef.current
        ? Math.min(0.1, (t - lastTimeRef.current) / 1000)
        : 0;
      lastTimeRef.current = t;
      const { w, h } = sizeRef.current;
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
    loopRef.current = loop;

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      // clear() вместо destroy(): StrictMode double-invokes эффекты
      // (mount → cleanup → mount), и destroy() ставит флаг destroyed=true
      // в системе, которая хранится в useState и переживает cleanup.
      // На повторный mount искры бы не эмитились. clear() только обнуляет
      // массив искр — система остаётся жива для re-mount. На реальном
      // unmount система GC'ится вместе с компонентом.
      system.clear();
      clipPathRef.current = null;
      loopRef.current = null;
    };
  }, [canvasRef, system]);

  // Идемпотентный запуск rAF: если уже идёт — ничего не делаем.
  // Нужен потому что первый emit может произойти из любого sub-spawn'а.
  const emitOne = useCallback(
    (ox: number, oy: number, burst: BurstId) => {
      const loop = loopRef.current;
      if (!loop) return; // canvas не готов
      system.emit(ox, oy, 1, burst);
      if (rafRef.current === null) {
        lastTimeRef.current = 0;
        rafRef.current = requestAnimationFrame(loop);
      }
    },
    [system],
  );

  const boostAll = useCallback(
    (factor: number) => {
      system.boostAll(factor);
    },
    [system],
  );

  return { emitOne, boostAll, sizeRef, profile };
}
