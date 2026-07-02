/**
 * Конфигурация системы искр (Particle System).
 *
 * Искры летают по одной из двух траекторий (spiral / sinwave), адаптированных под dt-based шаги. См. подробнее
 * trajectory.ts.
 *
 * Все координаты заданы в viewBox-пространстве SVG (200×150).
 * viewBox-координаты инвариантны к размеру канваса и DPR.
 *
 * Mobile-first архитектура: MOBILE_PROFILE — самостоятельный base,
 * TABLET_PROFILE и DESKTOP_PROFILE наследуются от него через spread
 * и переопределяют только то, что должно отличаться (количество искр,
 * базовая скорость).
 *
 * Все «магические числа» эффекта собраны здесь. Логика частиц
 * (sparks.system.ts) и хук канваса (useSparkCanvas.ts) не должны
 * содержать литералов — только чтение из этого файла.
 */

const SPARKS_PROFILES_BREAKPOINTS = {
  /** < mobile_max — mobile-профиль */
  mobile_max: 768,
  /** < tablet_max и >= mobile_max — tablet-профиль */
  tablet_max: 1280,
  /** >= tablet_max — desktop-профиль */
} as const;

/**
 * Конфигурация шлейфа (трейла) позади искры.
 * Шлейф рисуется как последовательность затухающих кругов по истории позиций.
 * Если length = 0 — шлейф отключён, система работает как без него.
 */
export type TailConfig = {
  /**
   * Максимальное количество точек истории на одну искру.
   * 0 = шлейф отключён (обратная совместимость).
   * Разумные границы: [0, 20].
   */
  length: number;
  /** Цвет точек шлейфа (любой CSS-цвет). */
  color: string;
  /**
   * Прозрачность самой старой точки шлейфа (0–1).
   * Самая новая точка (ближайшая к голове) всегда с alpha = 1.
   * Разумные границы: [0.1, 0.8].
   */
  startAlpha: number;
  /**
   * Размер самой старой точки относительно coreRadius (0–1).
   * Самая новая точка (ближайшая к голове) всегда с размером = coreRadius.
   * Разумные границы: [0.1, 0.8].
   */
  startSize: number;
};

/**
 * Разброс начальной позиции искры относительно точки эмиссии.
 * Все значения — в viewBox-пикселях.
 */
export type SparkJitter = {
  /** ± px по X вокруг origin.x. Разумные границы: [0, 20]. 0 = строго в точку. */
  x: number;
  /** ± px по Y вокруг origin.y. */
  y: number;
};

/**
 * Профиль искры — базовые параметры визуала и движения.
 *
 * Скорость здесь — это базовая «вертикальная» скорость носителя траектории
 * (viewBox-px/сек). Итоговая скорость каждой искры = `speed × speedMul`,
 * где speedMul рандомизируется в [ranges.speedMin, ranges.speedMax]
 * при эмиссии.
 */
export type SparkProfile = {
  /**
   * Радиус ядра искры (viewBox-px).
   * Разумные границы: [0.6, 3.0]. < 0.6 — пикселизация, > 3.0 — «капли» вместо искр.
   */
  baseRadius: number;
  /**
   * Время жизни одной искры (сек).
   * Разумные границы: [0.5, 3.0]. < 0.5 — искра гаснет на взлёте, > 3.0 — долгая «пауза».
   */
  lifetime: number;
  /** Цвет свечения (внешний слой, полупрозрачный). */
  glowColor: string;
  /** Цвет ядра (средний слой). */
  coreColor: string;
  /** Цвет центра (горячая точка). */
  centerColor: string;
  /**
   * Базовая скорость носителя (viewBox-px/сек).
   * Направление — случайное в пределах ranges.launchAngleSpread от вертикали.
   * Разумные границы: [40, 200].
   */
  speed: number;
  /**
   * Количество искр, эмитируемых за один вызов fire.
   * Зависит от мощности устройства.
   */
  emitCount: number;
  /**
   * Коэффициенты визуальных слоёв и случайности при эмиссии.
   * Позволяют дифференцировать «толщину»/яркость искр по профилям,
   * не затрагивая логику system.update/draw.
   */
  visual: SparkVisual;
};

/**
 * Визуальные коэффициенты одной искры: размеры слоёв при отрисовке
 * и диапазоны рандомизации при эмиссии.
 *
 * Все мультипликаторы применяются к базовым значениям (baseRadius, alpha).
 */
export type SparkVisual = {
  /**
   * Множитель `lifetime` при эмиссии: реальное lifetime искры =
   * `profile.lifetime * random(profile.visual.lifetimeMul)`.
   * Разумные границы: min ∈ [0.5, 1.0], max ∈ [1.0, 1.5], min < max.
   */
  lifetimeMul: { min: number; max: number };
  /**
   * Множитель `baseRadius` при эмиссии: реальный радиус =
   * `profile.baseRadius * random(profile.visual.sizeMul)`.
   * Разумные границы: min ∈ [0.5, 1.0], max ∈ [1.0, 1.5], min < max.
   */
  sizeMul: { min: number; max: number };
  /**
   * Коэффициент быстрого набора alpha в начале жизни искры:
   * `alpha = min(1, life * alphaAttack) * brightnessMul`.
   * 1.0 — линейный набор, > 1.0 — быстрый «вспыхивающий» набор.
   * Разумные границы: [1.0, 3.0].
   */
  alphaAttack: number;
  /** Слой свечения (внешний, самый размытый). */
  glow: { alphaMul: number; radiusMul: number };
  /** Слой ядра (промежуточный, основная масса искры). */
  core: { radiusMul: number };
  /** Слой центра (горячая точка). */
  center: { radiusMul: number };
};

/**
 * Базовые параметры траекторий (радиус/частота/амплитуда).
 * Спираль использует spiralRadius/spiralAngularSpeed,
 * синусоида — sinAmplitude/sinFrequency/sinPhase.
 */
export type TrajectoryParams = {
  /** Радиус кольца для спирали (viewBox-px). */
  spiralRadius: number;
  /** Угловая скорость вращения точки на кольце (рад/сек). */
  spiralAngularSpeed: number;
  /** Амплитуда синусоиды (viewBox-px). */
  sinAmplitude: number;
  /** Частота синусоиды (рад/сек). */
  sinFrequency: number;
  /** Начальная фаза синусоиды (рад). */
  sinPhase: number;
};

/**
 * Диапазоны рандомизации, общие для обеих траекторий.
 * Применяются на каждую искру в момент эмиссии.
 */
export type TrajectoryRanges = {
  /**
   * ± отклонение направления запуска от вертикали (вверх = (0, -1)),
   * в градусах. 0 — все искры летят строго вверх, 25 — заметный «веер».
   */
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
   * 0.5 = равновероятно по/против часовой. 1.0 = всегда по часовой.
   * Разумные границы: [0, 1].
   */
  clockwiseProbability: number;
};

/** Веса выбора паттерна траектории при эмиссии. */
export type TrajectoryMix = {
  /** Вес spiral (>= 0). */
  spiral: number;
  /** Вес sinwave (>= 0). */
  sinwave: number;
};

/** Размеры viewBox SVG: все координаты частиц заданы в этих единицах. */
export type ViewBox = {
  /** Ширина viewBox (viewBox-px). */
  w: number;
  /** Высота viewBox (viewBox-px). */
  h: number;
};

/** Параметры точки эмиссии (относительно viewBox). */
export type SpawnConfig = {
  /**
   * Смещение точки эмиссии вверх от нижней границы viewBox (viewBox-px).
   * Искры появляются с y = viewbox.h - yOffset, чтобы быть сразу в зоне букв.
   */
  yOffset: number;
};

/** Параметры stage-уровня: кулинг и защита от длинных пауз. */
export type StageConfig = {
  /**
   * Запас от верхней кромки букв (viewBox-юниты) для кулинга искр.
   * Искры и шлейф, улетевшие выше `cullLineY = letterTopY - cullMargin`, не рисуются.
   */
  cullMargin: number;
  /**
   * Максимальный шаг dt (сек). Защищает от скачков при свёрнутой вкладке
   * или длительной паузе — физика не «телепортирует» искры.
   */
  maxDt: number;
};

/** Тайминги пучка (одинаковые на всех устройствах — часть хореографии) */
export type SparkBurstTiming = {
  /** Локальная позиция старта на localTimeline (сек) */
  start: number;
  /** Длительность эмиссии (сек). 0 = мгновенный выброс */
  duration: number;
};

/** Глобальный конфиг эффекта: размеры + джиттер + шлейф + точка спавна + stage + траектории + профили + burst-тайминги. */
export type SparksConfig = {
  /** Размеры viewBox SVG (200×150 по умолчанию). */
  viewbox: ViewBox;
  jitter: SparkJitter;
  /** Настройки шлейфа (трейла) позади искр. length: 0 = без шлейфа. */
  tail: TailConfig;
  /** Точка эмиссии (отступ от низа viewBox). */
  spawn: SpawnConfig;
  /** Параметры stage-уровня. */
  stage: StageConfig;
  /** Глобальные настройки траекторий. */
  trajectory: {
    mix: TrajectoryMix;
    params: TrajectoryParams;
    ranges: TrajectoryRanges;
  };
  profiles: {
    mobile: SparkProfile;
    tablet: SparkProfile;
    desktop: SparkProfile;
  };
  /** Тайминги пучка 1 (GSAP-хореография) */
  burst1: SparkBurstTiming;
  /** Тайминги пучка 2 (GSAP-хореография) */
  burst2: SparkBurstTiming;
};

/** Общий джиттер для всех профилей (позиционный разброс). */
const SHARED_JITTER: SparkJitter = {
  x: 8,
  y: 4,
};

/** Шлейф по умолчанию (умеренная длина, оранжевые тона). */
export const DEFAULT_TAIL: TailConfig = {
  length: 10,
  color: '#ff9147',
  startAlpha: 0.3,
  startSize: 0.3,
};

/**
 * Базовые параметры траекторий по умолчанию.
 * Подобраны под viewBox 200×150 и базовую скорость 80 viewBox-px/сек.
 *
 * Спираль: радиус 8 px (4% ширины viewBox) при angularSpeed 6 рад/сек даёт
 * один оборот за ≈1.05 с, за это время носитель проходит ≈84 viewBox-px.
 * Соотношение «диаметр спирали / вертикальный пробег за оборот» ≈ 19% —
 * спираль отчётливо видна как спираль, а не как дрожание.
 *
 * Синусоида: амплитуда 2.5 px, частота 8 рад/сек — заметное колебание
 * (полупериод ≈0.4 с), но без «змейки». Спираль и синусоида должны быть
 * визуально различимы: спираль — круг/петля вокруг траектории носителя,
 * синусоида — плоское колебание вбок.
 */
const DEFAULT_TRAJECTORY_PARAMS: TrajectoryParams = {
  spiralRadius: 8.0,
  spiralAngularSpeed: 6.0,
  sinAmplitude: 2.5,
  sinFrequency: 8.0,
  sinPhase: 0,
};

/**
 * Диапазоны рандомизации по умолчанию.
 * Скорость: ±20% от базы; яркость: 0.6–1.0 (нет совсем тусклых);
 * отклонение от вертикали: ±25°.
 */
const DEFAULT_TRAJECTORY_RANGES: TrajectoryRanges = {
  launchAngleSpread: 25,
  speedMin: 0.8,
  speedMax: 1.2,
  brightnessMin: 0.6,
  brightnessMax: 1.0,
  clockwiseProbability: 0.5,
};

/** Веса выбора паттерна: 35/65. */
const DEFAULT_TRAJECTORY_MIX: TrajectoryMix = {
  spiral: 0.35,
  sinwave: 0.65,
};

/**
 * Размеры viewBox SVG. Все координаты искр заданы в этих единицах;
 * viewBox-координаты инвариантны к размеру канваса и DPR.
 */
export const VIEWBOX: ViewBox = {
  w: 200,
  h: 150,
};

/**
 * Точка эмиссии по умолчанию: отступ 14 viewBox-px от низа.
 * Искры появляются с y = viewbox.h - yOffset = 136, сразу в зоне букв COVSKIY.
 */
const DEFAULT_SPAWN: SpawnConfig = {
  yOffset: 14,
};

/**
 * Параметры stage-уровня.
 *  - cullMargin: 5 viewBox-px запаса от верхней кромки букв (анти-«нож» на CSS-клипе);
 *  - maxDt: 50 мс — потолок dt, защита от скачков при свёрнутой вкладке.
 */
const DEFAULT_STAGE: StageConfig = {
  cullMargin: 5,
  maxDt: 0.05,
};

/**
 * Mobile-профиль (< 768px viewport).
 * Меньше искр, меньше скорость и радиус — экономия батареи и CPU
 * на мобильных устройствах.
 */
const MOBILE_PROFILE: SparkProfile = {
  baseRadius: 1.9,
  lifetime: 2.0,
  glowColor: '#fed85d2b',
  coreColor: '#ff9447',
  centerColor: '#fff',
  speed: 30,
  emitCount: 30,
  /**
   * Визуальные коэффициенты. Унаследуются tablet/desktop через spread.
   * Значения подобраны под исходные литералы из sparks.system.ts (draw/makeSpark),
   * поведение эффекта не меняется.
   */
  visual: {
    lifetimeMul: { min: 0.8, max: 1.2 },
    sizeMul: { min: 0.7, max: 1.3 },
    alphaAttack: 1.5,
    glow: { alphaMul: 0.5, radiusMul: 1.8 },
    core: { radiusMul: 1.0 },
    center: { radiusMul: 0.6 },
  },
};

/**
 * Tablet-профиль (768–1279px viewport).
 * Компромисс между Mobile и Desktop.
 */
const TABLET_PROFILE: SparkProfile = {
  ...MOBILE_PROFILE,
  baseRadius: 2.2,
  lifetime: 2.0,
  speed: 30,
  emitCount: 40,
};

/**
 * Desktop-профиль (>= 1280px viewport).
 * Максимальное количество искр, скорость и радиус.
 */
const DESKTOP_PROFILE: SparkProfile = {
  ...MOBILE_PROFILE,
  baseRadius: 2.2,
  lifetime: 2.5,
  speed: 30,
  emitCount: 65,
};

/** Единый экземпляр конфига для всего приложения. */
export const SPARKS_CONFIG: SparksConfig = {
  viewbox: VIEWBOX,
  jitter: SHARED_JITTER,
  tail: DEFAULT_TAIL,
  spawn: DEFAULT_SPAWN,
  stage: DEFAULT_STAGE,
  trajectory: {
    mix: DEFAULT_TRAJECTORY_MIX,
    params: DEFAULT_TRAJECTORY_PARAMS,
    ranges: DEFAULT_TRAJECTORY_RANGES,
  },
  profiles: {
    mobile: MOBILE_PROFILE,
    tablet: TABLET_PROFILE,
    desktop: DESKTOP_PROFILE,
  },
  burst1: {
    start: 4.2,
    duration: 0.6,
  },
  burst2: {
    start: 4.6,
    duration: 0.5,
  },
};

/**
 * Селектор профиля по ширине viewport.
 * Вызывается при инициализации и на resize (через ResizeObserver).
 *
 * @param width — window.innerWidth
 * @returns объект профиля (один из трёх синглтонов)
 */
export function selectSparkProfile(width: number): SparkProfile {
  if (width < SPARKS_PROFILES_BREAKPOINTS.mobile_max) {
    return SPARKS_CONFIG.profiles.mobile;
  }
  if (width < SPARKS_PROFILES_BREAKPOINTS.tablet_max) {
    return SPARKS_CONFIG.profiles.tablet;
  }
  return SPARKS_CONFIG.profiles.desktop;
}

/**
 * Определяет имя профиля по ссылочной идентичности.
 * Профили — module-singletons, поэтому сравнение через === работает.
 */
export function profileName(
  profile: SparkProfile,
): 'mobile' | 'tablet' | 'desktop' {
  if (profile === SPARKS_CONFIG.profiles.mobile) return 'mobile';
  if (profile === SPARKS_CONFIG.profiles.tablet) return 'tablet';
  return 'desktop';
}
