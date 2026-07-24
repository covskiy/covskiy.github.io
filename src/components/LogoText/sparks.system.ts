/**
 * Система частиц для эффекта искр.
 *
 * Не знает ни про React, ни про DOM, ни про GSAP — только Canvas 2D context
 * и числовые параметры профиля. Это позволяет юнит-тестировать физику
 * изолированно и подменять профиль на лету (resize, смена device).
 *
 * Координаты везде в viewBox-пространстве (200×150) — инвариант к размеру
 * канваса и DPR. Преобразование в CSS-пиксели — снаружи, в хуке канваса.
 *
 * Каждая искра летит по одной из двух траекторий (spiral / sinwave),
 * выбор траектории и параметров случаен на каждую искру в момент эмиссии.
 * Подробности — в trajectory.ts.
 */

import {
  DEFAULT_TAIL,
  type SparkProfile,
  type SparksConfig,
} from './sparks.config';
import {
  createTrajectory,
  lerp,
  type Trajectory,
  type TrajectoryKind,
} from './trajectory';

type Vec2 = { x: number; y: number };

/**
 * Внутреннее состояние одной искры.
 * Создаётся в makeSpark(), умирает когда age >= lifetime.
 */
type Spark = {
  /** Текущая позиция (viewBox-координаты). Копия trajectory.pos на момент update(). */
  pos: Vec2;
  /** Траектория, по которой летит искра (spiral или sinwave). */
  trajectory: Trajectory;
  /** Прожитое время (сек). Растёт в update(). */
  age: number;
  /** Полное время жизни (сек). Рандомизировано при создании. */
  lifetime: number;
  /**
   * Множитель радиуса для разнообразия размеров искр.
   * Рандомизируется в profile.visual.sizeMul при создании.
   */
  sizeMul: number;
  /**
   * Множитель яркости (alpha) для разнообразия искр.
   * Рандомизируется в [brightnessMin, brightnessMax] из trajectory.ranges.
   */
  brightnessMul: number;
  /**
   * История позиций для шлейфа (трейла).
   * Заполняется в update() после перемещения.
   * Размер ограничен config.tail.length.
   */
  history: Vec2[];
};

export type BBox = { minX: number; minY: number; maxX: number; maxY: number };

/**
 * Создаёт SparkSystem с пустым массивом частиц.
 * Аллокации ленивые: новые Spark создаются по мере эмиссии.
 */
export function createSparkSystem(): {
  emit: (
    origin: Vec2,
    count: number,
    profile: SparkProfile,
    config: SparksConfig,
  ) => void;
  update: (dt: number) => void;
  /** draw — отрисовка всех живых искр на Canvas 2D. cullLineY — отсечение по y (0 = выключено). */
  draw: (
    ctx: CanvasRenderingContext2D,
    cullLineY: number,
    profile: SparkProfile,
  ) => void;
  /** Мгновенно удаляет все искры (без затухания). */
  clear: () => void;
  /** Количество живых искр в данный момент. */
  aliveCount: () => number;
  /**
   * Тип траектории последней эмитированной искры (для live-индикатора и отладки).
   * null, если ни одной искры ещё не было.
   */
  readonly lastKind: TrajectoryKind | null;
  /** Только для отладки/тестов: snapshot текущего массива. */
  readonly sparks: readonly Spark[];
} {
  const sparks: Spark[] = [];
  let lastEmittedKind: TrajectoryKind | null = null;

  let currentTail = { ...DEFAULT_TAIL, length: 0 };

  function makeSpark(
    origin: Vec2,
    profile: SparkProfile,
    config: SparksConfig,
  ): Spark {
    const jitter = config.jitter;
    const startPos: Vec2 = {
      x: origin.x + (Math.random() - 0.5) * 2 * jitter.x,
      y: origin.y + (Math.random() - 0.5) * 2 * jitter.y,
    };
    const created = createTrajectory({
      baseSpeed: profile.speed,
      origin: startPos,
      params: config.trajectory.params,
      ranges: config.trajectory.ranges,
      mix: config.trajectory.mix,
    });
    return {
      pos: created.trajectory.pos,
      trajectory: created.trajectory,
      age: 0,
      lifetime:
        profile.lifetime *
        lerp(
          profile.visual.lifetimeMul.min,
          profile.visual.lifetimeMul.max,
          Math.random(),
        ),
      sizeMul:
        profile.baseRadius *
        lerp(
          profile.visual.sizeMul.min,
          profile.visual.sizeMul.max,
          Math.random(),
        ),
      brightnessMul: created.brightnessMul,
      history: [],
    };
  }

  function emit(
    origin: Vec2,
    count: number,
    profile: SparkProfile,
    config: SparksConfig,
  ): void {
    currentTail = config.tail;
    for (let i = 0; i < count; i++) {
      const spark = makeSpark(origin, profile, config);
      lastEmittedKind = spark.trajectory.kind;
      sparks.push(spark);
    }
  }

  function update(dt: number): void {
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      s.age += dt;
      if (s.age >= s.lifetime) {
        sparks.splice(i, 1);
        continue;
      }
      s.trajectory.step(dt);
      s.pos.x = s.trajectory.pos.x;
      s.pos.y = s.trajectory.pos.y;
      if (currentTail.length > 0) {
        s.history.push({ x: s.pos.x, y: s.pos.y });
        if (s.history.length > currentTail.length) {
          s.history.shift();
        }
      }
    }
  }

  function draw(
    ctx: CanvasRenderingContext2D,
    cullLineY: number,
    profile: SparkProfile,
  ): void {
    if (sparks.length === 0) return;

    for (const s of sparks) {
      const life = 1 - s.age / s.lifetime;
      if (life <= 0) continue;
      if (cullLineY > 0 && s.pos.y < cullLineY) continue;

      const coreRadius = s.sizeMul * life;
      const v = profile.visual;
      const alpha = Math.min(1, life * v.alphaAttack) * s.brightnessMul;

      if (currentTail.length > 0 && s.history.length > 0) {
        for (let i = 0; i < s.history.length; i++) {
          const t = i / s.history.length;
          const trailAlpha =
            (currentTail.startAlpha + (1 - currentTail.startAlpha) * t) * life;
          const trailSize =
            coreRadius *
            (currentTail.startSize + (1 - currentTail.startSize) * t);

          ctx.globalAlpha = trailAlpha;
          ctx.fillStyle = currentTail.color;
          ctx.beginPath();
          ctx.arc(s.history[i].x, s.history[i].y, trailSize, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.globalAlpha = alpha * v.glow.alphaMul;
      ctx.fillStyle = profile.glowColor;
      ctx.beginPath();
      ctx.arc(s.pos.x, s.pos.y, coreRadius * v.glow.radiusMul, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = alpha;
      ctx.fillStyle = profile.coreColor;
      ctx.beginPath();
      ctx.arc(s.pos.x, s.pos.y, coreRadius * v.core.radiusMul, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = alpha;
      ctx.fillStyle = profile.centerColor;
      ctx.beginPath();
      ctx.arc(
        s.pos.x,
        s.pos.y,
        coreRadius * v.center.radiusMul,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }

    ctx.globalAlpha = 1;
  }

  function clear(): void {
    sparks.length = 0;
  }

  return {
    emit,
    update,
    draw,
    clear,
    aliveCount: () => sparks.length,
    get lastKind(): TrajectoryKind | null {
      return lastEmittedKind;
    },
    sparks,
  };
}

export type SparkSystem = ReturnType<typeof createSparkSystem>;
