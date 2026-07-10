/**
 * Хук канваса для эффекта искр.
 *
 * Ответственность:
 * - Инициализация <canvas>, синхронизация с DPR и CSS-размером.
 * - Сборка Path2D-клипа из контуров букв (#morphPath-*) с учётом масштаба.
 * - Гибридный клиппинг: mobile = mask (destination-in + drawImage),
 *   tablet/desktop = ctx.clip(Path2D).
 * - Поддержка ResizeObserver: пересборка клипа, пересчёт профиля, ре-инит канваса.
 * - RAF-цикл: system.update + clearRect + system.draw.
 *   Цикл стартует при emit() и сам останавливается, когда aliveCount === 0.
 *   Цикл не зависит от GSAP-таймлайна (голый RAF), поэтому пауза мастера
 *   не глушит догорание частиц.
 * - Полный cleanup при unmount.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { logger } from '../../utils/logger';
import {
  SPARKS_CONFIG,
  VIEWBOX,
  profileName,
  selectSparkProfile,
  type SparkProfile,
  type SparksConfig,
} from './sparks.config';
import { createSparkSystem, type SparkSystem } from './sparks.system';

const MORPH_SELECTOR =
  '#morphPath-C, #morphPath-O, #morphPath-V, #morphPath-S, #morphPath-K, #morphPath-I, #morphPath-Y';

/**
 * Контроллер RAF-цикла отрисовки искр.
 *
 * Цикл стартует при первом {@link ensureRunning} и сам останавливается,
 * когда {@link SparkSystem.aliveCount} === 0. Не зависит от GSAP-таймлайна
 * (голый `requestAnimationFrame`), поэтому пауза мастера не глушит
 * догорание частиц.
 *
 * Контроллер спроектирован как объект с одним методом, а не голая функция,
 * по двум причинам:
 * 1. Семантика на месте вызова (`loop.ensureRunning()`) — читается
 *    как «контроллер, обеспечь выполнение», а не анонимный callback.
 * 2. Устойчивость к расширению — при необходимости можно добавить
 *    методы `pause()`, `restart()` и т.д. без изменения сигнатуры
 *    потребителей.
 */
type LoopController = {
  /** Запускает RAF-цикл, если он ещё не запущен. Безопасен для многократного вызова. */
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

  const systemRef = useRef<SparkSystem | null>(null);
  if (systemRef.current === null) {
    systemRef.current = createSparkSystem();
    logger.info('useSparkCanvas', 'SparkSystem created');
  }
  // eslint-disable-next-line react-hooks/refs
  const system = systemRef.current;

  const profileRef = useRef(profile);
  // eslint-disable-next-line react-hooks/refs
  profileRef.current = profile;

  const loopRef = useRef<LoopController>({
    ensureRunning: () => undefined,
  });

  useEffect(() => {
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
    const maskRef: { current: HTMLCanvasElement | null } = { current: null };
    const cullLineRef: { current: number } = { current: 0 };
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
      const dt = Math.min(
        config.stage.maxDt,
        (now - lastTimeRef.current) / 1000,
      );
      lastTimeRef.current = now;

      if (system.aliveCount() === 0) {
        ctx.clearRect(0, 0, VIEWBOX.w, VIEWBOX.h);
        runningRef.current = false;
        return;
      }

      system.update(dt);
      ctx.clearRect(0, 0, VIEWBOX.w, VIEWBOX.h);

      if (profileName(profileRef.current) === 'mobile') {
        system.draw(ctx, cullLineRef.current, profileRef.current);
        if (maskRef.current) {
          ctx.globalCompositeOperation = 'destination-in';
          ctx.drawImage(maskRef.current, 0, 0, VIEWBOX.w, VIEWBOX.h);
          ctx.globalCompositeOperation = 'source-over';
        }
      } else {
        if (clipRef.current) {
          ctx.save();
          ctx.clip(clipRef.current);
        }
        system.draw(ctx, cullLineRef.current, profileRef.current);
        if (clipRef.current) {
          ctx.restore();
        }
      }

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
      const scaleX = (cssW / VIEWBOX.w) * dpr;
      const scaleY = (cssH / VIEWBOX.h) * dpr;
      ctx.setTransform(scaleX, 0, 0, scaleY, 0, 0);
      ctxRef.current = ctx;
    }

    function rebuildMask(): void {
      if (!clipRef.current) {
        maskRef.current = null;
        return;
      }
      let mask = maskRef.current;
      if (!mask) {
        mask = document.createElement('canvas');
        mask.width = VIEWBOX.w;
        mask.height = VIEWBOX.h;
      }
      const mctx = mask.getContext('2d');
      if (!mctx) {
        logger.warn(
          'useSparkCanvas',
          'Mask canvas getContext("2d") returned null',
        );
        maskRef.current = null;
        return;
      }
      mctx.setTransform(1, 0, 0, 1, 0, 0);
      mctx.clearRect(0, 0, VIEWBOX.w, VIEWBOX.h);
      mctx.fillStyle = '#fff';
      mctx.globalAlpha = 1;
      mctx.fill(clipRef.current);
      maskRef.current = mask;
    }

    function rebuildClip(): void {
      if (!svg) return;
      const pathEls = svg.querySelectorAll<SVGPathElement>(MORPH_SELECTOR);
      if (pathEls.length === 0) {
        logger.warn('useSparkCanvas', 'No morphPath elements found');
        clipRef.current = null;
        maskRef.current = null;
        cullLineRef.current = 0;
        return;
      }
      const clip = new Path2D();
      let letterTopY = Infinity;
      for (const el of pathEls) {
        const d = el.getAttribute('d');
        if (d) clip.addPath(new Path2D(d));
        const bbox = el.getBBox();
        if (bbox.y < letterTopY) letterTopY = bbox.y;
      }
      clipRef.current = clip;
      rebuildMask();
      cullLineRef.current =
        letterTopY === Infinity ? 0 : letterTopY - config.stage.cullMargin;
    }

    function onResize(): void {
      syncCanvasSize();
      const w = window.innerWidth;
      const next = selectSparkProfile(w);
      if (
        next.baseRadius !== profileRef.current.baseRadius ||
        next.lifetime !== profileRef.current.lifetime ||
        next.speed !== profileRef.current.speed
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
      if (ctx) ctx.clearRect(0, 0, VIEWBOX.w, VIEWBOX.h);
      ctxRef.current = null;
      clipRef.current = null;
      maskRef.current = null;
      cullLineRef.current = 0;
    };
  }, [containerRef, canvasRef, system, config, reducedMotion]);

  // Стабилизированные ссылки через useCallback/useMemo с пустыми deps.
  // Это безопасно: getProfile и loop.ensureRunning читают refs в момент
  // вызова (не рендера), поэтому всегда возвращают актуальные значения
  // независимо от того, в каком рендере были созданы.
  const getProfileStable = useCallback(() => profileRef.current, []);
  const loopStable = useMemo<LoopController>(
    () => ({ ensureRunning: () => loopRef.current.ensureRunning() }),
    [],
  );

  // system тоже читается из ref (ленивый синглтон), нереактивное состояние —
  // намеренно вынесено из React-стейта, чтобы мутации SparkSystem
  // не вызывали ререндеры.
  // eslint-disable-next-line react-hooks/refs
  return {
    system,
    profile,
    getProfile: getProfileStable,
    loop: loopStable,
    reducedMotion,
  };
}
