/**
 * Хук канваса для эффекта искр.
 *
 * Ответственность:
 * - Инициализация <canvas>, синхронизация с DPR и CSS-размером.
 * - Сборка Path2D-клипа из контуров букв (#morphPath-*) с учётом масштаба.
 * - Поддержка ResizeObserver: пересборка клипа, пересчёт профиля, ре-инит канваса.
 * - RAF-цикл: system.update + clearRect + system.draw.
 *   Цикл стартует при emit() и сам останавливается, когда aliveCount === 0.
 *   Цикл не зависит от GSAP-таймлайна (голый RAF), поэтому пауза мастера
 *   не глушит догорание частиц.
 * - Полный cleanup при unmount.
 */

import { useEffect, useRef, useState } from 'react';
import { logger } from '../../utils/logger';
import {
  SPARKS_CONFIG,
  profileName,
  selectSparkProfile,
  type SparkProfile,
  type SparksConfig,
} from './sparks.config';
import {
  createSparkSystem,
  type BBox,
  type SparkSystem,
} from './sparks.system';

const VIEWBOX_W = 200;
const VIEWBOX_H = 150;
const MORPH_SELECTOR =
  '#morphPath-C, #morphPath-O, #morphPath-V, #morphPath-S, #morphPath-K, #morphPath-I, #morphPath-Y';

const EMPTY_BBOX: BBox = {
  minX: 0,
  minY: 0,
  maxX: 0,
  maxY: 0,
};

type LoopController = {
  ensureRunning: () => void;
};

export type UseSparkCanvasResult = {
  system: SparkSystem;
  /** Свежий профиль, пересчитывается при resize */
  profile: SparkProfile;
  /** Всегда актуальный профиль через ref — без stale closure */
  getProfile: () => SparkProfile;
  /** Контроллер RAF-цикла. ensureRunning() нужно звать при каждой эмиссии */
  loop: LoopController;
  /** true, если пользователь предпочитает уменьшенное движение (эффект отключён) */
  reducedMotion: boolean;
};

export function useSparkCanvas(
  containerRef: React.RefObject<HTMLDivElement | null>,
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  config: SparksConfig = SPARKS_CONFIG,
): UseSparkCanvasResult {
  const [profile, setProfile] = useState<SparkProfile>(() =>
    selectSparkProfile(window.innerWidth),
  );

  const [reducedMotion] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  // Lazy init: создаём систему один раз и храним в ref, чтобы не терять
  // состояние частиц при ререндере.
  const systemRef = useRef<SparkSystem | null>(null);
  if (systemRef.current === null) {
    systemRef.current = createSparkSystem();
    logger.info('useSparkCanvas', 'SparkSystem created');
  }
  // eslint-disable-next-line react-hooks/refs
  const system = systemRef.current;

  // Синхронизация profile-state с ref для чтения из RAF-цикла.
  const profileRef = useRef(profile);
  // eslint-disable-next-line react-hooks/refs
  profileRef.current = profile;

  const loopRef = useRef<LoopController>({
    ensureRunning: () => undefined,
  });

  useEffect(() => {
    // Захватываем loopRef.current локально сразу — нужно и для раннего
    // return при reducedMotion, и для основной ветки.
    const loop = loopRef.current;

    if (reducedMotion) {
      logger.info('useSparkCanvas', 'Disabled by prefers-reduced-motion');
      loop.ensureRunning = () => undefined;
      return;
    }

    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) {
      logger.warn('useSparkCanvas', 'container or canvas is null');
      return;
    }

    const svg = container.querySelector('svg');
    if (!svg) {
      logger.warn('useSparkCanvas', 'SVG not found in container');
      return;
    }

    const clipRef: { current: Path2D | null } = { current: null };
    const bboxRef: { current: BBox } = { current: EMPTY_BBOX };
    const ctxRef: { current: CanvasRenderingContext2D | null } = {
      current: null,
    };
    const rafRef: { current: number | null } = { current: null };
    const lastTimeRef: { current: number } = { current: 0 };
    const runningRef: { current: boolean } = { current: false };

    const tick = (now: number): void => {
      rafRef.current = null;
      const ctx = ctxRef.current;
      if (!ctx) {
        runningRef.current = false;
        return;
      }
      if (lastTimeRef.current === 0) {
        lastTimeRef.current = now;
      }
      const dt = Math.min(0.05, (now - lastTimeRef.current) / 1000);
      lastTimeRef.current = now;

      if (system.aliveCount() === 0) {
        ctx.clearRect(0, 0, VIEWBOX_W, VIEWBOX_H);
        runningRef.current = false;
        return;
      }

      system.update(dt, profileRef.current, config);
      ctx.clearRect(0, 0, VIEWBOX_W, VIEWBOX_H);
      system.draw(ctx, clipRef.current, profileRef.current, bboxRef.current);

      rafRef.current = requestAnimationFrame(tick);
    };

    const ensureRunning = (): void => {
      if (runningRef.current) return;
      if (ctxRef.current === null) return;
      runningRef.current = true;
      rafRef.current = requestAnimationFrame(tick);
    };

    loop.ensureRunning = ensureRunning;

    function syncCanvasSize(): void {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const cssW = Math.max(1, rect.width);
      const cssH = Math.max(1, rect.height);
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const scaleX = (cssW / VIEWBOX_W) * dpr;
      const scaleY = (cssH / VIEWBOX_H) * dpr;
      ctx.setTransform(scaleX, 0, 0, scaleY, 0, 0);
      ctxRef.current = ctx;
    }

    function rebuildClip(): void {
      if (!svg) return;
      const pathEls = svg.querySelectorAll<SVGPathElement>(MORPH_SELECTOR);
      if (pathEls.length === 0) {
        logger.warn('useSparkCanvas', 'No morphPath elements found');
        clipRef.current = null;
        bboxRef.current = EMPTY_BBOX;
        return;
      }
      const clip = new Path2D();
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const el of pathEls) {
        const d = el.getAttribute('d');
        if (!d) continue;
        const p = new Path2D(d);
        clip.addPath(p);
        try {
          const bb = el.getBBox();
          if (bb.width > 0 && bb.height > 0) {
            minX = Math.min(minX, bb.x);
            minY = Math.min(minY, bb.y);
            maxX = Math.max(maxX, bb.x + bb.width);
            maxY = Math.max(maxY, bb.y + bb.height);
          }
        } catch {
          /* getBBox может бросить в edge-cases (detached) */
        }
      }
      if (minX === Infinity) {
        clipRef.current = null;
        bboxRef.current = EMPTY_BBOX;
        return;
      }
      clipRef.current = clip;
      bboxRef.current = { minX, minY, maxX, maxY };
    }

    function onResize(): void {
      syncCanvasSize();
      const w = window.innerWidth;
      const next = selectSparkProfile(w);
      if (
        next.baseRadius !== profileRef.current.baseRadius ||
        next.tailLength !== profileRef.current.tailLength ||
        next.lifetime !== profileRef.current.lifetime ||
        next.speedMul !== profileRef.current.speedMul
      ) {
        logger.debug('useSparkCanvas', 'Profile changed', {
          from: profileName(profileRef.current),
          to: profileName(next),
          width: w,
        });
        setProfile(next);
      }
    }

    syncCanvasSize();
    rebuildClip();
    onResize();

    const ro = new ResizeObserver(() => {
      onResize();
    });
    ro.observe(canvas);

    window.addEventListener('resize', onResize);

    logger.info('useSparkCanvas', 'Canvas initialized', {
      dpr: window.devicePixelRatio || 1,
      profile: profileName(profileRef.current),
      width: window.innerWidth,
    });
    logger.debug('useSparkCanvas', 'Initial profile params', {
      profile: profileName(profileRef.current),
      baseRadius: profileRef.current.baseRadius,
      tailLength: profileRef.current.tailLength,
      lifetime: profileRef.current.lifetime,
      speedMul: profileRef.current.speedMul,
    });

    return () => {
      ro.disconnect();
      window.removeEventListener('resize', onResize);
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      runningRef.current = false;
      loop.ensureRunning = () => undefined;
      system.clear();
      const ctx = ctxRef.current;
      if (ctx) ctx.clearRect(0, 0, VIEWBOX_W, VIEWBOX_H);
      ctxRef.current = null;
      clipRef.current = null;
      bboxRef.current = EMPTY_BBOX;
    };
  }, [containerRef, canvasRef, system, config, reducedMotion]);

  // getProfile и loop.ensureRunning читают refs в момент вызова (не рендера),
  // это callbacks, передаваемые в onUpdate/onStart.
  // eslint-disable-next-line react-hooks/refs
  return {
    system,
    profile,
    getProfile: () => profileRef.current,
    loop: { ensureRunning: () => loopRef.current.ensureRunning() },
    reducedMotion,
  };
}
