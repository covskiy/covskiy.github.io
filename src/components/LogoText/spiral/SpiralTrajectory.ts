import type { SpiralConfig } from './SpiralConfig';

type Vec2 = { x: number; y: number };

/**
 * Траектория типа «спираль» для одной частицы.
 * — step(dt) принимает время в секундах;
 * — `speed` и `angularSpeed` теперь в единицах за секунду;
 * — позиция возвращается через геттер `pos`.
 *
 * Семантика шага сохранена как в оригинале:
 *   1. сместить центр по direction * speed * dt;
 *   2. вычислить точку на окружности при текущем t (cos/sin);
 *   3. инкрементировать t на angularSpeed * dt для следующего шага.
 *
 * Базовый вектор `(1, 0)` с `clockwise=true` даёт вращение по часовой стрелке
 * (cos/sin с инвертированным углом), `clockwise=false` — против часовой.
 */
export class SpiralTrajectory {
  readonly kind = 'spiral' as const;

  private readonly config: SpiralConfig;
  /** Нормализованный direction (dx, dy), кэшируется в конструкторе. */
  private readonly ndx: number;
  private readonly ndy: number;
  /** Текущий центр кольца. */
  private centerX: number;
  private centerY: number;
  /** Текущий угол (рад), на котором была вычислена `pos`. */
  private t: number;
  /** Кэш последней вычисленной точки. */
  private posX: number;
  private posY: number;

  constructor(origin: Vec2, config: SpiralConfig) {
    this.config = config;
    const len = Math.sqrt(config.direction.dx ** 2 + config.direction.dy ** 2);
    if (len === 0) {
      this.ndx = 0;
      this.ndy = -1;
    } else {
      this.ndx = config.direction.dx / len;
      this.ndy = config.direction.dy / len;
    }
    this.centerX = origin.x;
    this.centerY = origin.y;
    this.t = 0;
    this.posX = this.centerX + config.radius * 1;
    this.posY = this.centerY + config.radius * 0;
  }

  /**
   * Сдвигает центр по направлению, обновляет кэш позиции и инкрементирует угол.
   * @param dt — шаг времени (сек).
   */
  step(dt: number): void {
    const { speed, angularSpeed, radius, clockwise } = this.config;
    this.centerX += this.ndx * speed * dt;
    this.centerY += this.ndy * speed * dt;
    const dir = clockwise ? -1 : 1;
    const angle = this.t * dir;
    this.posX = this.centerX + radius * Math.cos(angle);
    this.posY = this.centerY + radius * Math.sin(angle);
    this.t += angularSpeed * dt;
  }

  /** Текущая позиция точки на окружности (viewBox-координаты). */
  get pos(): Vec2 {
    return { x: this.posX, y: this.posY };
  }
}
