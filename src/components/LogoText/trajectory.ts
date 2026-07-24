/**
 * Абстракция траектории частицы.
 *
 * Каждая искра владеет одной реализацией Trajectory, которая инкапсулирует
 * состояние и математику движения. На каждом кадре particle system вызывает
 * `trajectory.step(dt)`, после чего читает актуальную позицию через `pos`.
 */

import type { SinWaveConfig } from './sinwave/SinWaveConfig';
import type { SpiralConfig } from './spiral/SpiralConfig';
import { SinWaveTrajectory } from './sinwave/SinWaveTrajectory';
import { SpiralTrajectory } from './spiral/SpiralTrajectory';

type Vec2 = { x: number; y: number };

/** Тип паттерна траектории (используется в логах и live-индикаторе). */
export type TrajectoryKind = 'spiral' | 'sinwave';

/**
 * Унифицированный интерфейс траектории.
 *
 * Контракт:
 * — step(dt) продвигает внутреннее состояние на dt секунд и обновляет pos;
 * — pos — текущая позиция (viewBox-координаты), всегда не undefined;
 * — kind — статический идентификатор паттерна.
 */
export interface Trajectory {
  readonly kind: TrajectoryKind;
  step(dt: number): void;
  readonly pos: Vec2;
}

/**
 * Базовые параметры траекторий (радиус/частота/амплитуда).
 * Общие для обоих паттернов; различаются только активные поля.
 */
export interface TrajectoryParams {
  /** Радиус кольца для спирали (viewBox-px). */
  spiralRadius: number;
  /** Угловая скорость вращения для спирали (рад/сек). */
  spiralAngularSpeed: number;
  /** Амплитуда синусоиды (viewBox-px). */
  sinAmplitude: number;
  /** Частота синусоиды (рад/сек). */
  sinFrequency: number;
  /** Начальная фаза синусоиды (рад). */
  sinPhase: number;
}

/**
 * Диапазоны рандомизации, общие для обоих паттернов.
 * Используются в createTrajectory для каждой частицы.
 */
export interface TrajectoryRanges {
  /** ± отклонение направления запуска от вертикали (вверх = (0, -1)), в градусах. */
  launchAngleSpread: number;
  /** Минимальный множитель скорости (умножается на profile.speed). */
  speedMin: number;
  /** Максимальный множитель скорости. */
  speedMax: number;
  /** Минимальный множитель яркости (alpha). */
  brightnessMin: number;
  /** Максимальный множитель яркости. */
  brightnessMax: number;
  /**
   * Вероятность выбора `clockwise` для спиральной траектории (0–1).
   * 0.5 = равновероятно, 1.0 = всегда по часовой.
   */
  clockwiseProbability: number;
}

/** Веса выбора паттерна при эмиссии. */
export interface TrajectoryMix {
  /** Вес spiral (>= 0). */
  spiral: number;
  /** Вес sinwave (>= 0). */
  sinwave: number;
}

/** Результат createTrajectory: траектория + множители для Spark. */
export interface CreatedTrajectory {
  trajectory: Trajectory;
  /** Множитель, на который был умножен profile.speed (для отладки). */
  speedMul: number;
  /** Множитель яркости [brightnessMin, brightnessMax]. */
  brightnessMul: number;
}

/** Опции, передаваемые в createTrajectory. */
export interface CreateTrajectoryOptions {
  /** Базовая скорость (viewBox-px/сек). Обычно profile.speed. */
  baseSpeed: number;
  /** Точка эмиссии (viewBox-координаты). */
  origin: Vec2;
  /** Базовые параметры траекторий (из конфига). */
  params: TrajectoryParams;
  /** Диапазоны рандомизации (из конфига). */
  ranges: TrajectoryRanges;
  /** Веса выбора паттерна (из конфига). */
  mix: TrajectoryMix;
  /** Источник случайных чисел (для тестов). По умолчанию Math.random. */
  rng?: () => number;
}

/**
 * Создаёт траекторию с рандомизированными параметрами для одной частицы.
 *
 * Шаги:
 *  1. Выбирает kind по весам mix.
 *  2. Генерирует launch direction: отклонение от вертикали (0, -1) в пределах
 *     ranges.launchAngleSpread градусов по обе стороны.
 *  3. Выбирает speedMul ∈ [speedMin, speedMax] и brightnessMul ∈ [brightnessMin, brightnessMax].
 *  4. Для spiral дополнительно подбрасывает clockwise (50/50).
 *  5. Конструирует SpiralTrajectory или SinWaveTrajectory с подобранными параметрами.
 *
 * @returns объект с траекторией и множителями, которые нужно сохранить в Spark.
 */
export function createTrajectory(
  opts: CreateTrajectoryOptions,
): CreatedTrajectory {
  const rng = opts.rng ?? Math.random;
  const kind = pickKind(opts.mix, rng);
  const speedMul = lerp(opts.ranges.speedMin, opts.ranges.speedMax, rng());
  const brightnessMul = lerp(
    opts.ranges.brightnessMin,
    opts.ranges.brightnessMax,
    rng(),
  );
  const dir = randomLaunchDirection(opts.ranges.launchAngleSpread, rng);
  const speed = opts.baseSpeed * speedMul;

  if (kind === 'spiral') {
    const config: SpiralConfig = {
      radius: opts.params.spiralRadius,
      direction: dir,
      speed,
      angularSpeed: opts.params.spiralAngularSpeed,
      clockwise: rng() < opts.ranges.clockwiseProbability,
    };
    return {
      trajectory: new SpiralTrajectory(opts.origin, config),
      speedMul,
      brightnessMul,
    };
  }

  const config: SinWaveConfig = {
    amplitude: opts.params.sinAmplitude,
    frequency: opts.params.sinFrequency,
    direction: dir,
    speed,
    phase: opts.params.sinPhase,
  };
  return {
    trajectory: new SinWaveTrajectory(opts.origin, config),
    speedMul,
    brightnessMul,
  };
}

/**
 * Выбирает kind по весам. Если оба веса = 0 — fallback на 'spiral'
 * (не должно случаться при штатном конфиге, но защищает от деления на 0).
 */
function pickKind(mix: TrajectoryMix, rng: () => number): TrajectoryKind {
  const total = mix.spiral + mix.sinwave;
  if (total <= 0) return 'spiral';
  if (rng() * total < mix.spiral) return 'spiral';
  return 'sinwave';
}

/**
 * Случайный единичный вектор направления запуска.
 * Базовое направление — вверх: (0, -1) (SVG: Y растёт вниз).
 * Отклонение по X — в пределах ±launchAngleSpreadDeg градусов.
 */
function randomLaunchDirection(
  launchAngleSpreadDeg: number,
  rng: () => number,
): { dx: number; dy: number } {
  const angle = (rng() * 2 - 1) * launchAngleSpreadDeg * (Math.PI / 180);
  return { dx: Math.sin(angle), dy: -Math.cos(angle) };
}

/** Линейная интерполяция. */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
