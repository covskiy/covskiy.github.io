import type { SinWaveConfig } from './SinWaveConfig';

type Vec2 = { x: number; y: number };

/**
 * Траектория типа «синусоида» для одной частицы.
 * — step(dt) принимает время в секундах;
 * — `speed` в viewBox-px/сек, `frequency` в рад/сек;
 * — позиция возвращается через геттер `pos`.
 *
 * Семантика шага сохранена как в оригинале:
 *   1. сместить несущую по direction * speed * dt;
 *   2. вычислить перпендикуляр и offset = amplitude * sin(frequency * t + phase);
 *   3. pos = carrier + perp * offset;
 *   4. инкрементировать t на dt.
 */
export class SinWaveTrajectory {
  readonly kind = 'sinwave' as const;

  private readonly config: SinWaveConfig;
  /** Нормализованный direction. */
  private readonly ndx: number;
  private readonly ndy: number;
  /** Перпендикуляр к direction, вычисляется один раз. */
  private readonly perpX: number;
  private readonly perpY: number;
  /** Текущая позиция несущей. */
  private carrierX: number;
  private carrierY: number;
  /** Текущее время (сек). Используется в синусе и для инкремента. */
  private t: number;
  /** Кэш последней вычисленной точки. */
  private posX: number;
  private posY: number;

  constructor(origin: Vec2, config: SinWaveConfig) {
    this.config = config;
    const len = Math.sqrt(config.direction.dx ** 2 + config.direction.dy ** 2);
    if (len === 0) {
      this.ndx = 0;
      this.ndy = -1;
    } else {
      this.ndx = config.direction.dx / len;
      this.ndy = config.direction.dy / len;
    }
    this.perpX = -this.ndy;
    this.perpY = this.ndx;

    this.carrierX = origin.x;
    this.carrierY = origin.y;
    this.t = 0;

    const offset =
      config.amplitude * Math.sin(config.frequency * this.t + config.phase);
    this.posX = this.carrierX + this.perpX * offset;
    this.posY = this.carrierY + this.perpY * offset;
  }

  /**
   * Сдвигает несущую, пересчитывает смещение и кэширует новую позицию.
   * @param dt — шаг времени (сек).
   */
  step(dt: number): void {
    const { speed, frequency, phase, amplitude } = this.config;
    this.carrierX += this.ndx * speed * dt;
    this.carrierY += this.ndy * speed * dt;
    const offset = amplitude * Math.sin(frequency * this.t + phase);
    this.posX = this.carrierX + this.perpX * offset;
    this.posY = this.carrierY + this.perpY * offset;
    this.t += dt;
  }

  /** Текущая позиция точки (viewBox-координаты). */
  get pos(): Vec2 {
    return { x: this.posX, y: this.posY };
  }
}
