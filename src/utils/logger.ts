export type LogLevel = 'error' | 'warn' | 'info' | 'debug' | 'trace';

export const LOG_LEVELS: LogLevel[] = [
  'error',
  'warn',
  'info',
  'debug',
  'trace',
];

const LEVEL_WEIGHT: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
  trace: 4,
};

const MODULE_COLORS: Record<string, string> = {
  IntroAnimation: '#6866d4',
  LogoText: '#04bf8a',
  PageTransition: '#f59e0b',
  App: '#344054',
  Logo: '#04bf8a',
  Tagline: '#60b527',
  useSparkCanvas: '#04b3bf',
  NavigationBar: '#8b5cf6',
  HomePage: '#ec4899',
  navbarEventBus: '#58bb5a',
};

const warnedModules = new Set<string>();

function hashToColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++)
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return `hsl(${Math.abs(hash) % 360}, 55%, 55%)`;
}

function getModuleColor(module: string): string {
  if (MODULE_COLORS[module]) return MODULE_COLORS[module];

  if (!warnedModules.has(module)) {
    warnedModules.add(module);
    console.warn(
      `%c[logger] Module "${module}" has no registered color, using auto-generated hsl`,
      'color:#888;font-weight:bold',
    );
  }

  const color = hashToColor(module);
  MODULE_COLORS[module] = color;
  return color;
}

function getInitialLevel(): LogLevel {
  if (!import.meta.env.DEV) return 'warn';

  try {
    const stored = localStorage.getItem('loggerLevel');
    if (stored && stored in LEVEL_WEIGHT) return stored as LogLevel;
  } catch {
    /* localStorage not available */
  }

  return 'debug';
}

/**
 * Легковесный логгер с цветными тегами и фильтрацией по уровню.
 *
 * В production работают только `error` и `warn`.
 * Уровень можно переопределить через `localStorage.setItem('loggerLevel', ...)`.
 *
 * @example
 * ```ts
 * logger.info('IntroAnimation', 'Master timeline created');
 * logger.debug('LogoText', 'C phaseShoe', { x: -45, duration: 0.5 });
 * ```
 */
class Logger {
  private level: LogLevel;

  constructor(level: LogLevel) {
    this.level = level;
  }

  /**
   * Устанавливает порог логирования.
   * Вызовы с уровнем выше порога игнорируются.
   */
  setLevel(level: LogLevel): void {
    this.level = level;
  }

  /** Возвращает текущий порог логирования. */
  getLevel(): LogLevel {
    return this.level;
  }

  /**
   * Проверяет, должен ли сработать указанный уровень при текущем пороге.
   * @internal
   */
  private canLog(level: LogLevel): boolean {
    return LEVEL_WEIGHT[level] <= LEVEL_WEIGHT[this.level];
  }

  /**
   * Критическая ошибка. Работает во всех режимах (DEV + PROD).
   * Используй при сбоях анимации, исключениях в useGSAP, невызове коллбеков.
   */
  error(module: string, ...args: unknown[]): void {
    if (!this.canLog('error')) return;
    console.error(
      `%c[${module}]`,
      `color:${getModuleColor(module)};font-weight:bold`,
      ...args,
    );
  }

  /**
   * Предупреждение. Работает во всех режимах (DEV + PROD).
   * Используй при fallback-состояниях, missing ref, условных байпасах.
   */
  warn(module: string, ...args: unknown[]): void {
    if (!this.canLog('warn')) return;
    console.warn(
      `%c[${module}]`,
      `color:${getModuleColor(module)};font-weight:bold`,
      ...args,
    );
  }

  /**
   * Информационное сообщение. Работает только в DEV.
   * Используй для lifecycle: монтирование, onComplete, смена роута.
   */
  info(module: string, ...args: unknown[]): void {
    if (!this.canLog('info')) return;
    console.info(
      `%c[${module}]`,
      `color:${getModuleColor(module)};font-weight:bold`,
      ...args,
    );
  }

  /**
   * Отладочное сообщение. Работает только в DEV.
   * Используй для параметров анимаций: start, duration, position, easing.
   */
  debug(module: string, ...args: unknown[]): void {
    if (!this.canLog('debug')) return;
    console.debug(
      `%c[${module}]`,
      `color:${getModuleColor(module)};font-weight:bold`,
      ...args,
    );
  }

  /**
   * Максимальная детализация. Работает только в DEV при уровне `trace`.
   * Используй для диагностики — включай через localStorage при необходимости.
   */
  trace(module: string, ...args: unknown[]): void {
    if (!this.canLog('trace')) return;
    console.debug(
      `%c[${module}]`,
      `color:${getModuleColor(module)};font-weight:bold`,
      ...args,
    );
  }
}

const logger = new Logger(getInitialLevel());

export { logger, Logger };
