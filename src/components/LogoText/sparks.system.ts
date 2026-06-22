/**
 * Чистая система частиц для эффекта искр.
 *
 * Не знает ни про React, ни про GSAP, ни про DOM — только Canvas 2D context
 * и числовые параметры профиля. Это позволяет юнит-тестировать физику
 * изолированно и подменять профиль на лету (resize, смена device).
 *
 * Координаты везде в viewBox-пространстве (200×150) — инвариант к размеру
 * канваса и DPR. Преобразование в CSS-пиксели — снаружи, в хуке канваса.
 */

import type {
  SparkBurstConfig,
  SparkProfile,
  SparksConfig,
} from './sparks.config';

type Vec2 = { x: number; y: number };

type Spark = {
  pos: Vec2;
  vel: Vec2;
  age: number;
  lifetime: number;
  /** Фаза синусоиды (для рассинхрона колебаний между искрами) */
  sinPhase: number;
  /** Множитель яркости (из burst-конфига) */
  brightnessMul: number;
  /** Множитель радиуса ядра (из burst-конфига) */
  sizeMul: number;
  /** Кольцевой буфер позиций для кометного хвоста: позиции [0..head-1] валидны */
  history: Float32Array;
  /** Длина заполненной части буфера (растёт до tailLength) */
  historyFilled: number;
  /** Указатель записи в кольцевой буфер (0..tailLength-1) */
  historyHead: number;
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
    burst: SparkBurstConfig,
    profile: SparkProfile,
    config: SparksConfig,
  ) => void;
  update: (dt: number, profile: SparkProfile, config: SparksConfig) => void;
  draw: (
    ctx: CanvasRenderingContext2D,
    clip: Path2D | null,
    profile: SparkProfile,
    bbox: BBox,
  ) => void;
  boostAll: (factor: number) => void;
  clear: () => void;
  aliveCount: () => number;
  /** Только для отладки/тестов: snapshot текущего массива */
  readonly sparks: readonly Spark[];
} {
  const sparks: Spark[] = [];

  function makeSpark(
    origin: Vec2,
    burst: SparkBurstConfig,
    profile: SparkProfile,
    config: SparksConfig,
  ): Spark {
    const jitter = config.jitter;
    const angleBase = Math.PI;
    const angle = angleBase + (Math.random() - 0.5) * 2 * jitter.angle;
    const speedMul =
      profile.speedMul * (1 + (Math.random() - 0.5) * 2 * jitter.speed);
    const speed = profile.baseSpeed * speedMul;
    const tailLen = Math.max(2, Math.floor(profile.tailLength));
    return {
      pos: {
        x: origin.x + (Math.random() - 0.5) * 2 * jitter.x,
        y: origin.y + (Math.random() - 0.5) * 2 * jitter.y,
      },
      vel: {
        x: Math.cos(angle) * speed,
        y: Math.sin(angle) * speed,
      },
      age: 0,
      lifetime: profile.lifetime * (0.85 + Math.random() * 0.3),
      sinPhase: Math.random() * profile.sinPhaseJitter,
      brightnessMul: burst.brightnessMul,
      sizeMul: burst.sizeMul,
      history: new Float32Array(tailLen * 2),
      historyFilled: 0,
      historyHead: 0,
    };
  }

  function pushHistory(spark: Spark): void {
    const len = spark.history.length / 2;
    const i = spark.historyHead;
    spark.history[i * 2] = spark.pos.x;
    spark.history[i * 2 + 1] = spark.pos.y;
    spark.historyHead = (i + 1) % len;
    if (spark.historyFilled < len) spark.historyFilled++;
  }

  function emit(
    origin: Vec2,
    count: number,
    burst: SparkBurstConfig,
    profile: SparkProfile,
    config: SparksConfig,
  ): void {
    for (let i = 0; i < count; i++) {
      sparks.push(makeSpark(origin, burst, profile, config));
    }
  }

  function update(
    dt: number,
    profile: SparkProfile,
    config: SparksConfig,
  ): void {
    const frictionFactor = Math.max(0, 1 - profile.friction * dt);
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      s.age += dt;
      if (s.age >= s.lifetime) {
        sparks.splice(i, 1);
        continue;
      }
      s.vel.x = s.vel.x * frictionFactor + config.jitter.x * 0 + profile.wind;
      const t = s.age * profile.sinFrequency + s.sinPhase;
      const sinOffset = Math.sin(t) * profile.sinAmplitude;
      s.pos.x += s.vel.x * dt;
      s.pos.y += s.vel.y * dt + sinOffset * dt;
      pushHistory(s);
    }
  }

  function isInBBox(p: Vec2, bbox: BBox): boolean {
    return (
      p.x >= bbox.minX &&
      p.x <= bbox.maxX &&
      p.y >= bbox.minY &&
      p.y <= bbox.maxY
    );
  }

  function draw(
    ctx: CanvasRenderingContext2D,
    clip: Path2D | null,
    profile: SparkProfile,
    bbox: BBox,
  ): void {
    if (sparks.length === 0) return;

    if (clip) {
      ctx.save();
      ctx.clip(clip);
    }

    const smokeAlpha = profile.smokeAlpha;

    for (const s of sparks) {
      const life = 1 - s.age / s.lifetime;
      if (life <= 0) continue;
      const inBBox = isInBBox(s.pos, bbox);

      if (s.historyFilled >= 2) {
        const len = s.history.length / 2;
        const baseTailAlpha = 0.75 * life * s.brightnessMul;
        const tailWidth = profile.baseRadius * s.sizeMul * 0.9 * (0.4 + life);
        ctx.lineWidth = tailWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        for (let i = 1; i < s.historyFilled; i++) {
          const fromIdx = (s.historyHead - i + len) % len;
          const toIdx = (s.historyHead - i - 1 + len) % len;
          const fx = s.history[fromIdx * 2];
          const fy = s.history[fromIdx * 2 + 1];
          const tx = s.history[toIdx * 2];
          const ty = s.history[toIdx * 2 + 1];
          const segProgress = i / s.historyFilled;
          const segAlpha =
            baseTailAlpha * (1 - segProgress) * (1 - segProgress);
          if (segAlpha < 0.01) continue;
          ctx.strokeStyle = profile.tailColorStart;
          ctx.globalAlpha = segAlpha;
          ctx.beginPath();
          ctx.moveTo(fx, fy);
          ctx.lineTo(tx, ty);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }

      if (inBBox) {
        const haloRadius =
          profile.baseRadius * s.sizeMul * (3.5 + 3 * (1 - life));
        const haloAlpha = smokeAlpha * life * life * s.brightnessMul;
        if (haloAlpha > 0.02) {
          ctx.fillStyle = profile.smokeColor;
          ctx.globalAlpha = haloAlpha;
          ctx.beginPath();
          ctx.arc(s.pos.x, s.pos.y, haloRadius, 0, Math.PI * 2);
          ctx.fill();
        }

        const coreRadius =
          profile.baseRadius * s.sizeMul * (0.55 + 0.45 * life);
        const coreAlpha = Math.min(1, life * 1.4) * s.brightnessMul;
        ctx.fillStyle = profile.coreColor;
        ctx.globalAlpha = coreAlpha;
        ctx.beginPath();
        ctx.arc(s.pos.x, s.pos.y, coreRadius, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.globalAlpha = 1;
    if (clip) ctx.restore();
  }

  function boostAll(factor: number): void {
    for (const s of sparks) {
      s.vel.x *= factor;
    }
  }

  function clear(): void {
    sparks.length = 0;
  }

  return {
    emit,
    update,
    draw,
    boostAll,
    clear,
    aliveCount: () => sparks.length,
    sparks,
  };
}

export type SparkSystem = ReturnType<typeof createSparkSystem>;
