/**
 * Хореография анимации SplashPage.
 * Числовые значения — секунды.
 * labels — стартовые позиции на timeline, durations — длины анимаций.
 */
export const SPLASH_CHOREOGRAPHY = {
  /** Мастер-таймлайн: позиции, куда вкладываются таймлайны дочерних компонентов */
  master: {
    labels: {
      LOGO: 0,
      LOGO_TEXT: 0,
      TAGLINE: 1.0,
    },
  },

  /** Logo — анимация рисования SVG anvil */
  logo: {
    labels: {
      GLOW_START: 0,
      MAIN_PATH_START: 0.15,
      GLOW_FADE_START: 1.2,
    },
    durations: {
      GLOW_DRAW: 1.5,
      MAIN_PATH_DRAW: 1.2,
      GLOW_FADE: 0.5,
    },
  },

  /**
   * толщина заготовки -
   */

  /** LogoText — сборка букв "COVSKIY", гвоздь -> курсор */
  logoText: {
    start: 0,
    C: {
      phaseShoe: {
        start: 0,
        xPosition: -45,
        rotate: -90,
        duration: 0.5,
      },
      phaseLetter: {
        start: 1.9,
        duration: 0.5,
      },
    },
    Cursor: {
      phaseNail: {
        start: 0,
        rotation: -360,
        duration: 1,
      },
      phaseCaret: {
        start: 1.5,
        duration: 0.5,
      },
      phaseMoving: {
        start: 2.0,
        xPosition: 106,
        duration: 1.6,
      },
      scales: {
        O: 0.833,
        V: 0.667,
        S: 0.5,
        K: 0.333,
        I: 0.167,
        Y: 0,
      },
    },
    O: {
      phaseDash: {
        start: 2.09,
        duration: 0.3,
      },
      phaseLetter: {
        start: 2.9,
        delay: 0.5,
        duration: 0.5,
      },
    },
    V: {
      phaseDash: {
        start: 2.45,
        duration: 0.5,
      },
      phaseLetter: {
        start: 2.6,
        delay: 0.4,
        duration: 0.5,
      },
    },
    S: {
      phaseDash: {
        start: 2.77,
        duration: 0.5,
      },
      phaseLetter: {
        start: 3.2,
        delay: 0.3,
        duration: 0.5,
      },
    },
    K: {
      phaseDash: {
        start: 3.1,
        duration: 0.5,
      },
      phaseLetter: {
        start: 5.9,
        delay: 0.2,
        duration: 0.5,
      },
    },
    I: {
      phaseDash: {
        start: 3.35,
        duration: 0.5,
      },
      phaseLetter: {
        start: 6.9,
        delay: 0.1,
        duration: 0.5,
      },
    },
    Y: {
      phaseDash: {
        start: 3.6,
        duration: 0.5,
      },
      phaseLetter: {
        start: 3.7,
        delay: 0,
        duration: 0.5,
      },
    },
    /**
     * ═══════════════════════════════════════════════════════════════════════════
     * ИСКРЫ В КОНЦЕ ЛОГОТИПА
     * ═══════════════════════════════════════════════════════════════════════════
     *
     * ─── ОБЩАЯ АРХИТЕКТУРА ───
     * burst1/burst2 — позиции на локальном таймлайне LogoText (после сборки букв).
     * Один пучок = subSpawns порывов ветра через subSpawnInterval сек.
     * Один порыв = непрерывный поток count искр за burstDuration сек.
     * Итого искр в пучке = count × subSpawns.
     * На burst2 ко всем живым искрам применяется boost (см. LogoText.tsx, BURST_BOOST_FACTOR).
     *
     * ─── PER-BURST МНОЖИТЕЛИ ЯРКОСТИ ───
     * coreAlphaMultipliers.burst1 — для искр из burst1 (длиннее яркая фаза).
     * coreAlphaMultipliers.burst2 — для искр из burst2 (стандартно).
     * Формула: coreAlpha = min(1, life × multiplier).
     * Фаза полной яркости (alpha=1) = первые (1 - 1/multiplier) × 100% жизни.
     *   burst1: 2.5 → 60% peak-фаза, burst2: 1.4 → 29% peak-фаза.
     *
     * ─── КАРТА ТЮНИНГА (что крутить) ───
     * "Сделать искры крупнее"      → profile.sizeMin, sizeMax (px)
     * "Дольше живут"              → profile.lifetime, lifetimeJitter
     * "Быстрее летят"             → profile.initialSpeedMax, ↓ profile.friction
     * "Медленнее тормозят"        → ↑ profile.windX, ↓ profile.friction
     * "Дольше яркая фаза"         → coreAlphaMultipliers.burst1/2
     * "Больше искр"               → profile.count
     * "Длиннее хвост"             → profile.tailLength
     * "Сильнее порыв на burst2"   → BURST_BOOST_FACTOR (в LogoText.tsx)
     * "Больше порывов в пучке"    → profile.subSpawns, subSpawnInterval
     * "Круче наклон"              → profile.slopeMax
     * "Шире разброс в начале"     → shared.coneHalfAngle
     * "Сильнее рябь"              → profile.periodYJitter, ampYJitter
     * "Цвет хвоста"               → shared.tailColor
     * "Цвет halo"                 → shared.smokeHalo.color, .alpha, .radius
     * "Направление полёта"        → BASE_ANGLE (в sparks.ts)
     * "Тёмнее/ярче ядро"          → shared.colors (палитра, шкала остывания)
     *
     * ─── КАЖДОЕ ПОЛЕ (краткая справка) ───
     * profile.count — искр в одном sub-spawn. Итого на пучок: count × subSpawns.
     * profile.burstDuration — длительность одного непрерывного потока sub-spawn.
     * profile.windX — постоянное горизонтальное ускорение (<0 = влево). Терминал: windX/friction.
     * profile.friction — затухание vx (1/с). Баланс с windX даёт vx_terminal.
     * profile.ampY/periodY — амплитуда/период синусоиды y(t). Нет гравитации, нет шума —
     *   траектория каждой искры это чистая наклоненная синусоида.
     * profile.ampYJitter — разброс амплитуды по искрам (0 = одинаковые, 1 = ±100%).
     * profile.periodYJitter — разброс периода (0 = одинаковые, 1 = ±100%), чтобы
     *   траектории не копировали друг друга.
     * profile.slopeMax — макс |наклон| траектории. slope*dx добавляется к y за время жизни.
     *   Небольшое значение (0.18–0.22) — отклонение от горизонтали, но не парабола.
     * profile.lifetimeJitter — разброс lifetime. Длинноживущие долетают до C яркими.
     * profile.subSpawns/subSpawnInterval — кол-во/интервал порывов ветра внутри пучка.
     * profile.initialSpeedMin/Max — стартовый |vx| (px/s).
     * profile.sizeMin/Max — радиус ядра (px). Halo и хвост масштабируются от size.
     * profile.tailLength — кол-во точек в кометном хвосте.
     *
     * shared.coneHalfAngle — полуугол разброса стартового vx от BASE_ANGLE.
     * shared.colors — палитра core. Индекс = (1 - life) × length: 0 = свежее (белое),
     *   последний = тухлое (красное). 4 цвета = 4 фазы остывания.
     * shared.smokeHalo — тёмный ореол вокруг ядра, даёт «угольный» дымный шлейф.
     *   radius = размер halo относительно size (2.2 = в 2.2 раза больше ядра).
     *   alpha — прозрачность halo (0..1). color — тёмный «дымный» цвет.
     * shared.tailColor — фиксированный цвет кометного хвоста (source-over, не аддитивный).
     * shared.coreAlphaMultipliers — см. раздел «PER-BURST МНОЖИТЕЛИ ЯРКОСТИ» выше.
     */
    sparks: {
      burst1: 4.2,
      burst2: 4.7,
      coneHalfAngle: Math.PI * 0.1,
      colors: ['#fff7d6', '#ffd166', '#ff8c2a', '#ff4d1a'],
      smokeHalo: {
        radius: 2.2,
        alpha: 0.32,
        color: 'rgb(15, 12, 25)',
      },
      tailColor: 'rgb(255, 100, 0)',
      coreAlphaMultipliers: { burst1: 2.5, burst2: 1.4 },
      profiles: {
        mobile: {
          count: 30,
          sizeMin: 1.6,
          sizeMax: 3.0,
          lifetime: 1.8,
          lifetimeJitter: 0.5,
          friction: 0.5,
          initialSpeedMin: 70,
          initialSpeedMax: 150,
          windX: -30,
          ampY: 9,
          ampYJitter: 0.4,
          periodY: 0.55,
          periodYJitter: 0.25,
          slopeMax: 0.18,
          tailLength: 10,
          subSpawns: 1,
          subSpawnInterval: 0,
          burstDuration: 0.35,
        },
        tablet: {
          count: 30,
          sizeMin: 1.2,
          sizeMax: 2.2,
          lifetime: 2.2,
          lifetimeJitter: 0.5,
          friction: 0.55,
          initialSpeedMin: 90,
          initialSpeedMax: 200,
          windX: -50,
          ampY: 11,
          ampYJitter: 0.4,
          periodY: 0.5,
          periodYJitter: 0.25,
          slopeMax: 0.2,
          tailLength: 10,
          subSpawns: 1,
          subSpawnInterval: 0,
          burstDuration: 0.4,
        },
        desktop: {
          count: 33,
          sizeMin: 0.9,
          sizeMax: 1.8,
          lifetime: 2.6,
          lifetimeJitter: 0.5,
          friction: 0.6,
          initialSpeedMin: 120,
          initialSpeedMax: 260,
          windX: -75,
          ampY: 14,
          ampYJitter: 0.5,
          periodY: 0.45,
          periodYJitter: 0.3,
          slopeMax: 0.22,
          tailLength: 10,
          subSpawns: 3,
          subSpawnInterval: 0.15,
          burstDuration: 0.18,
        },
      },
    },
  },

  /** Tagline — клавиатура + текстовый слоган */
  tagline: {
    durations: {
      KEYBOARD_IN: 0.5,
      KEY_HIGHLIGHT: 0.3,
      KEYBOARD_OUT: 0.4,
      TEXT_REVEAL: 0.6,
      TEXT_STAGGER: 0.15,
    },
  },
} as const;
