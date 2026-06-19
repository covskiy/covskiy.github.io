/**
 * Система частиц «искры». Один createSparkSystem() — одна конфигурация.
 * Искры живут в локальных пиксельных координатах канваса (не в viewBox SVG).
 * Три слоя отрисовки на искру: TAIL (комета) → HALO (дым) → CORE (горящее ядро).
 */

type Spark = {
  /** Текущая позиция X (пиксели канваса). Интегрируется из vx. */
  x: number;
  /** Текущая позиция Y. Вычисляется напрямую через наклоненный синус, не интегрируется. */
  y: number;
  /** X в момент эмиссии — опорная точка для расчёта наклона траектории. */
  x0: number;
  /** Y в момент эмиссии — центр синусоиды. */
  y0: number;
  /** Горизонтальная скорость (px/s, отрицательная = влево). Подвержена windX и friction. */
  vx: number;
  /** Фаза синуса Y(t) (0..2π) — разные искры в разных точках волны. */
  phase: number;
  /** Период синуса Y(t) per-spark (сек) — даёт разнообразие траекторий. */
  periodY: number;
  /** Амплитуда синуса Y (px) — размах колебаний по вертикали. */
  ampY: number;
  /** Линейный наклон траектории: y += slope * (x - x0). 0 = строго горизонтально. */
  slope: number;
  /** Кольцевой буфер последних позиций для кометного хвоста (длина = profile.tailLength). */
  history: { x: number; y: number }[];
  /** 1.0 = только что зажглась, 0 = потухла. Линейный спад. */
  life: number;
  /** Общая длительность жизни этой искры (с джиттером от profile.lifetimeJitter). */
  lifetime: number;
  /** Базовый радиус ядра (px). Halo и хвост масштабируются от него. */
  size: number;
  /** Какой пучок выпустил искру (1 или 2) — определяет множитель яркости. */
  burst: 1 | 2;
};

export type SparkProfile = {
  /** Искр в одном sub-spawn. Итого на пучок = count × subSpawns. ↑ = гуще рой. */
  count: number;
  /** Минимальный радиус ядра (px). ↑ = крупнее все искры. */
  sizeMin: number;
  /** Максимальный радиус ядра (px). Разброс sizeMin..sizeMax per-spark. */
  sizeMax: number;
  /** Базовая длительность жизни (сек). С джиттером = (1 ± lifetimeJitter) × lifetime. */
  lifetime: number;
  /** Разброс lifetime ±N% (0 = одинаковые, 1 = ±100%). ↑ = сильнее разброс жизни. */
  lifetimeJitter: number;
  /** Затухание vx: vx *= (1 - friction*dt). ↑ = быстрее тормозит. */
  friction: number;
  /** Минимальная стартовая |vx| (px/s). ↑ = быстрее стартуют. */
  initialSpeedMin: number;
  /** Максимальная стартовая |vx| (px/s). Разброс per-spack. */
  initialSpeedMax: number;
  /** Постоянное горизонтальное ускорение (px/s², <0 = влево). Баланс с friction даёт vx_terminal = windX / friction. */
  windX: number;
  /** Амплитуда синуса Y (px). ↑ = больше вертикальный размах. */
  ampY: number;
  /** Разброс амплитуды per-spark (0..1). ↑ = разнообразнее. */
  ampYJitter: number;
  /** Период синуса Y(t) (сек на полное колебание). ↓ = чаще колебания. */
  periodY: number;
  /** Разброс периода per-spark (0..1) — чтобы траектории не были копией друг друга. */
  periodYJitter: number;
  /** Макс |наклон| траектории. 0.2 ≈ ±11° от горизонтали. ↑ = круче наклон. */
  slopeMax: number;
  /** Кол-во точек в кометном хвосте. ↑ = длиннее хвост, но больше draw-нагрузки. */
  tailLength: number;
  /** Кол-во порывов ветра внутри одного пучка. ↑ = больше «пульсаций». */
  subSpawns: number;
  /** Секунд между sub-spawn'ами в пучке. 0 = один непрерывный поток. */
  subSpawnInterval: number;
  /** Длительность одного непрерывного потока sub-spawn (сек). */
  burstDuration: number;
};

export type SparkShared = {
  /** Полуугол разброса начального vx от BASE_ANGLE. 0 = все строго влево. ↑ = шире конус. */
  coneHalfAngle: number;
  /** Палитра core. Индекс = (1 - life) × length: [0] = свежее (белое), [N-1] = тухлое (красное). 4 цвета = 4 фазы остывания. */
  colors: readonly string[];
  /** Тёмный ореол вокруг ядра, даёт «угольный» дымный шлейф. */
  smokeHalo: {
    /** Радиус halo = size × radius. 2.2 = в 2.2 раза больше ядра. */
    radius: number;
    /** Прозрачность halo (0..1). ↑ = плотнее дым. */
    alpha: number;
    /** Цвет halo — тёмный, «дымный» (должен быть темнее фона сплэша). */
    color: string;
  };
  /** Фиксированный цвет кометного хвоста (source-over, не аддитивный). */
  tailColor: string;
  /** Множитель life→alpha для ядра. Выше = дольше фаза полной яркости (alpha=1.0).
   *  Формула: coreAlpha = min(1, life × multiplier).
   *  Фаза alpha=1 = первые (1 - 1/multiplier) × 100% жизни. */
  coreAlphaMultipliers: {
    /** Первый пучок — длиннее яркая фаза, искры дольше привлекают внимание. */
    burst1: number;
    /** Второй пучок — стандартно. */
    burst2: number;
  };
};

export type SparkSystem = {
  emit: (originX: number, originY: number, n?: number, burst?: 1 | 2) => void;
  step: (
    dt: number,
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
  ) => void;
  isAlive: () => boolean;
  clear: () => void;
  destroy: () => void;
  boostAll: (factor: number) => void;
};

/** Базовое направление вылета: π = чисто влево. 0 = вправо, π/2 = вниз, -π/2 = вверх. */
const BASE_ANGLE = Math.PI;

export function createSparkSystem(
  profile: SparkProfile,
  shared: SparkShared,
): SparkSystem {
  const sparks: Spark[] = [];
  const COLORS = shared.colors;
  const HALO = shared.smokeHalo;
  let destroyed = false;

  return {
    emit(originX, originY, n = 1, burst = 1) {
      if (destroyed) return;
      for (let i = 0; i < n; i++) {
        // Случайное отклонение угла внутри конуса от BASE_ANGLE.
        // Чем больше coneHalfAngle — тем шире разброс стартовых vx.
        const angleOffset = (Math.random() - 0.5) * 2 * shared.coneHalfAngle;
        const angle = BASE_ANGLE + angleOffset;
        // Стартовая скорость: случайная в [min, max].
        const speed =
          profile.initialSpeedMin +
          Math.random() * (profile.initialSpeedMax - profile.initialSpeedMin);
        // Jitters: per-spark множители базовых параметров (1 ± jitter*random).
        // Дают «разношёрстный» рой вместо одинаковых искр.
        const ampJitter = 1 + (Math.random() - 0.5) * 2 * profile.ampYJitter;
        const periodJitter =
          1 + (Math.random() - 0.5) * 2 * profile.periodYJitter;

        sparks.push({
          x: originX,
          y: originY,
          x0: originX, // Запоминаем стартовый X для расчёта наклона (y - y0 = slope * (x - x0))
          y0: originY, // Центр синусоиды Y(t)
          vx: Math.cos(angle) * speed, // Горизонтальная скорость
          phase: Math.random() * Math.PI * 2, // Случайная фаза синуса — разные искры в разных точках волны
          periodY: profile.periodY * periodJitter, // Per-spack период — разные длины волн
          ampY: profile.ampY * ampJitter, // Per-spack амплитуда — разные размахи
          slope: (Math.random() - 0.5) * 2 * profile.slopeMax, // Случайный наклон ±slopeMax
          history: [], // Заполняется в step()
          life: 1, // Полная жизнь
          lifetime:
            profile.lifetime *
            (1 + (Math.random() - 0.5) * 2 * profile.lifetimeJitter),
          size:
            profile.sizeMin +
            Math.random() * (profile.sizeMax - profile.sizeMin),
          burst, // 1 или 2 — для per-burst множителя яркости
        });
      }
    },

    step(dt, ctx, w, h) {
      if (destroyed) return;

      // === ЧИСТАЯ ОЧИСТКА КАНВАСА ===
      // Каждый кадр начинаем с чистого листа — никакого motion-blur.
      // Хвост рисуется явно из history[], поэтому destination-out не нужен.
      ctx.clearRect(0, 0, w, h);

      const t = performance.now() / 1000; // Глобальное время для фазы синуса
      const alive: Spark[] = [];
      const lastColorIdx = COLORS.length - 1;

      // === CULL: пропуск draw для sparks вне зоны букв ===
      // Y-зона букв в viewBox: 94-140, X-зона: 18-186. Sparks за её пределами
      // скрыты mask целиком — пропускаем draw (12 circles на искру = заметная экономия).
      // Физика/жизнь продолжают идти: spark, вылетевший за зону, может вернуться.
      // Зазоры между буквами (внутри зоны) НЕ отсекаются — для точного cull
      // нужны 7 per-letter rects, это уже over-engineering.
      const X_MIN = w * 0.09; // 18/200
      const X_MAX = w * 0.93; // 186/200
      const Y_MIN = h * 0.627; // 94/150
      const Y_MAX = h * 0.933; // 140/150

      for (const s of sparks) {
        // === СОХРАНЕНИЕ ПОЗИЦИИ В ИСТОРИЮ ===
        // Пуш текущей позиции ДО обновления — history[0] = самая старая, history[end] = предыдущий кадр.
        // shift при превышении tailLength — кольцевой буфер.
        s.history.push({ x: s.x, y: s.y });
        if (s.history.length > profile.tailLength) s.history.shift();

        // === ФИЗИКА ===
        // 1. Горизонтальный ветер: постоянное ускорение.
        s.vx += profile.windX * dt;
        // 2. Трение: vx *= (1 - friction*dt) — экспоненциальное затухание к 0.
        //    Баланс с windX даёт терминальную скорость: vx_term = windX / friction.
        s.vx *= 1 - profile.friction * dt;
        // 3. Интегрирование позиции X.
        s.x += s.vx * dt;

        // === Y: НАКЛОНЕННАЯ СИНУСОИДА ===
        // y = y0 + slope * (x - x0) + ampY * sin(omega * t + phase)
        // - slope: линейный дрейф (наклон траектории)
        // - sin: колебание вокруг линии наклона
        // omega = 2π / periodY — per-spark, поэтому траектории не копируются.
        const omega = (2 * Math.PI) / s.periodY;
        s.y =
          s.y0 +
          (s.x - s.x0) * s.slope +
          s.ampY * Math.sin(omega * t + s.phase);

        // === LIFE ===
        // Линейный спад: за `lifetime` секунд life проходит от 1 до 0.
        s.life -= dt / s.lifetime;

        if (s.life <= 0) continue; // Искра потухла — пропускаем отрисовку

        // Cull: если искра за пределами bounding box букв, mask всё равно
        // её скроет — не тратим draw calls. Физика/жизнь уже отработали,
        // оставляем в alive (может залететь обратно в следующем кадре).
        if (s.x < X_MIN || s.x > X_MAX || s.y < Y_MIN || s.y > Y_MAX) {
          alive.push(s);
          continue;
        }

        // === ОТРИСОВКА: 3 СЛОЯ ===

        // Слой 1: ХВОСТ (комета)
        // source-over + фиксированный цвет. Цикл по history от старых к новым.
        // alpha и size растут с i (от прозрачного мелкого к яркому крупному) — комета с хвостом.
        ctx.globalCompositeOperation = 'source-over';
        for (let i = 0; i < s.history.length; i++) {
          const h = s.history[i];
          const factor = i / s.history.length; // 0 (oldest) → ~1 (newest)
          ctx.globalAlpha = factor * s.life;
          ctx.fillStyle = shared.tailColor;
          ctx.beginPath();
          ctx.arc(h.x, h.y, s.size * factor, 0, Math.PI * 2);
          ctx.fill();
        }

        // Слой 2: HALO (тёмный дымный ореол)
        // source-over + тёмный цвет + большой радиус — даёт «угольный» ореол вокруг искры.
        // Тот же composite что и хвост — слой под ядром.
        ctx.globalAlpha = HALO.alpha * s.life;
        ctx.fillStyle = HALO.color;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size * HALO.radius, 0, Math.PI * 2);
        ctx.fill();

        // Слой 3: CORE (горящее ядро)
        // lighter + color-shift — аддитивное свечение, цвет меняется по life.
        // hueIdx: 0 (свежее, белое) → lastColorIdx (тухлое, красное).
        // coreAlpha: per-burst множитель. Выше = дольше фаза полной яркости (alpha=1.0).
        const hueIdx = Math.min(
          lastColorIdx,
          Math.floor((1 - s.life) * COLORS.length),
        );
        const coreMult =
          s.burst === 2
            ? shared.coreAlphaMultipliers.burst2
            : shared.coreAlphaMultipliers.burst1;
        const coreAlpha = Math.min(1, s.life * coreMult);

        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = coreAlpha;
        ctx.fillStyle = COLORS[hueIdx];
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fill();

        alive.push(s);
      }

      // Восстановление дефолтного состояния канваса
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';

      // Компактный in-place фильтр: убираем мёртвых.
      sparks.length = 0;
      if (alive.length > 0) sparks.push(...alive);
    },

    isAlive() {
      return sparks.length > 0;
    },

    clear() {
      sparks.length = 0;
    },

    /**
     * Разовый множитель vx для всех живых искр. Вызывается на burst2 sub-spawn'ах
     * (см. LogoText.tsx) — даёт «порыв ветра» уже летящему рою.
     * ↑ factor = сильнее рывок, но визуально менее натурально.
     */
    boostAll(factor) {
      for (const s of sparks) {
        s.vx *= factor;
      }
    },

    destroy() {
      destroyed = true;
      sparks.length = 0;
    },
  };
}
