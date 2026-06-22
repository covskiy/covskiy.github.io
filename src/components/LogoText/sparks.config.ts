/**
 * Конфигурация системы искр (Particle System).
 *
 * Mobile-first архитектура: MOBILE_PROFILE — самостоятельный base,
 * TABLET_PROFILE и DESKTOP_PROFILE наследуются от него через spread
 * и переопределяют только то, что должно отличаться (count, boost,
 * визуальный размер).
 *
 * Все «магические числа» эффекта собраны здесь. Логика частиц
 * (sparks.system.ts) и хук канваса (useSparkCanvas.ts) не должны
 * содержать литералов — только чтение из этого файла.
 *
 * Координаты в profile.* заданы в viewBox-пространстве SVG (200×150).
 * viewBox-координаты инвариантны к размеру канваса и DPR.
 */

const SPARKS_PROFILES_BREAKPOINTS = {
  /** < mobile_max — mobile-профиль */
  mobile_max: 768,
  /** < tablet_max и >= mobile_max — tablet-профиль */
  tablet_max: 1280,
  /** >= tablet_max — desktop-профиль */
} as const;

export type SparkBurstLabel = 'burst1' | 'burst2';

/** Тайминги пучка (одинаковые на всех устройствах — часть хореографии) */
export type SparkBurstTiming = {
  /** Локальная позиция старта на localTimeline (сек) */
  start: number;
  /** Длительность эмиссии (сек). 0 = мгновенный выброс */
  duration: number;
};

/** Визуальные параметры пучка (brightness/size — глобально по типу пучка) */
export type SparkBurstVisual = {
  /** Множитель яркости ядра и хвоста относительно профиля */
  brightnessMul: number;
  /** Множитель радиуса ядра относительно профиля */
  sizeMul: number;
};

/** Глобальный конфиг пучка: тайминги + визуал. Count — в профиле. */
export type SparkBurstConfig = SparkBurstTiming & SparkBurstVisual;

/** Per-profile override: сколько искр в пучке (зависит от мощности устройства) */
export type SparkBurstCount = {
  /** Кол-во искр в пучке (эмитится растянуто по duration) */
  count: number;
};

export type SparkJitter = {
  /** ± px по X вокруг origin.x (viewBox) */
  x: number;
  /** ± px по Y вокруг origin.y (viewBox) */
  y: number;
  /** ± рад отклонения вектора скорости от базового направления */
  angle: number;
  /** ± множитель разброса скорости (1 = базовая) */
  speed: number;
};

export type SparkPhysics = {
  /** Базовая скорость (viewBox-px/сек), направление: влево */
  baseSpeed: number;
  /** Трение: vel.x *= (1 - friction * dt). 0 = без трения, 1 = мгновенная остановка */
  friction: number;
  /** Постоянный горизонтальный ветер (вклад в vel.x, viewBox-px/сек²) */
  wind: number;
  /** Амплитуда синусоидального колебания Y (viewBox-px) */
  sinAmplitude: number;
  /** Частота синусоиды (рад/сек) */
  sinFrequency: number;
  /** Фаза (множитель, чтобы искры колебались несинхронно) */
  sinPhaseJitter: number;
};

export type SparkProfile = {
  /** Радиус ядра искры (viewBox-px) */
  baseRadius: number;
  /** Длина кометного хвоста (кол-во сегментов истории) */
  tailLength: number;
  /** Время жизни одной искры (сек) */
  lifetime: number;
  /** Цвет ядра (любой CSS-цвет, в draw передаётся в ctx.fillStyle) */
  coreColor: string;
  /** Цвет хвоста у основания (молодой хвост) */
  tailColorStart: string;
  /** Цвет хвоста у кончика (старый хвост, часто = smokeColor) */
  tailColorEnd: string;
  /** Цвет дымного halo (внешнее свечение) */
  smokeColor: string;
  /** Множитель альфы дымного halo (0..1) */
  smokeAlpha: number;
  /** Базовый множитель скорости (для разных профилей) */
  speedMul: number;
  /** Per-profile: кол-во искр в burst1 */
  burst1: SparkBurstCount;
  /** Per-profile: кол-во искр в burst2 */
  burst2: SparkBurstCount;
  /** Per-profile: множитель X-скорости для boostAll() (второй пучок «пинает» первый) */
  boostFactor: number;
} & SparkPhysics;

export type SparksConfig = {
  /** Точка эмиссии (viewBox-координаты) — район курсора на Y */
  emissionOrigin: { x: number; y: number };
  /** Разброс при эмиссии */
  jitter: SparkJitter;
  /** Глобальный конфиг пучка 1 (тайминги + визуал) */
  burst1: SparkBurstConfig;
  /** Глобальный конфиг пучка 2 */
  burst2: SparkBurstConfig;
  /** Профили по устройствам */
  profiles: {
    mobile: SparkProfile;
    tablet: SparkProfile;
    desktop: SparkProfile;
  };
};

const SHARED_JITTER: SparkJitter = {
  x: 4,
  y: 15,
  angle: 0.35,
  speed: 0.25,
};

const MOBILE_PROFILE: SparkProfile = {
  baseRadius: 1.1,
  tailLength: 11,
  lifetime: 1.5,
  coreColor: '#fff8e0',
  tailColorStart: '#ffb347',
  tailColorEnd: '#ff6a00',
  smokeColor: '#2a1810',
  smokeAlpha: 0.35,
  speedMul: 0.95,
  baseSpeed: 130,
  friction: 0.4,
  wind: 0,
  sinAmplitude: 2.0,
  sinFrequency: 6,
  sinPhaseJitter: 6.28,
  burst1: { count: 20 },
  burst2: { count: 15 },
  boostFactor: 1.4,
};

const TABLET_PROFILE: SparkProfile = {
  ...MOBILE_PROFILE,
  baseRadius: 1.4,
  tailLength: 14,
  speedMul: 1.0,
  burst1: { count: 30 },
  burst2: { count: 25 },
  boostFactor: 1.5,
};

const DESKTOP_PROFILE: SparkProfile = {
  ...MOBILE_PROFILE,
  baseRadius: 1.6,
  tailLength: 16,
  speedMul: 1.05,
  burst1: { count: 35 },
  burst2: { count: 28 },
  boostFactor: 1.7,
};

export const SPARKS_CONFIG: SparksConfig = {
  emissionOrigin: { x: 185, y: 113 },
  jitter: SHARED_JITTER,
  burst1: {
    start: 4.2,
    duration: 0.6,
    brightnessMul: 1.0,
    sizeMul: 1.0,
  },
  burst2: {
    start: 4.6,
    duration: 0.5,
    brightnessMul: 1.15,
    sizeMul: 1.1,
  },
  profiles: {
    mobile: MOBILE_PROFILE,
    tablet: TABLET_PROFILE,
    desktop: DESKTOP_PROFILE,
  },
};

/** Селектор профиля по ширине viewport. */
export function selectSparkProfile(width: number): SparkProfile {
  if (width < SPARKS_PROFILES_BREAKPOINTS.mobile_max) {
    return SPARKS_CONFIG.profiles.mobile;
  }
  if (width < SPARKS_PROFILES_BREAKPOINTS.tablet_max) {
    return SPARKS_CONFIG.profiles.tablet;
  }
  return SPARKS_CONFIG.profiles.desktop;
}

/** Имя профиля по ссылочной идентичности (профили — module-singletons). */
export function profileName(
  profile: SparkProfile,
): 'mobile' | 'tablet' | 'desktop' {
  if (profile === SPARKS_CONFIG.profiles.mobile) return 'mobile';
  if (profile === SPARKS_CONFIG.profiles.tablet) return 'tablet';
  return 'desktop';
}
