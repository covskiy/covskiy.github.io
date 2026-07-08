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
      TAGLINE: 0,
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
    sparks: {
      burst1: 4.5,
      burst2: 4.9,
    },
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
        C: 1,
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
  },

  /** Tagline — клавиатура + текстовый слоган */
  tagline: {
    enterKey: {
      start: 4.2,
    },
    text: {
      lineOne: 4.0,
      lineTwo: 4.4,
    },
    durations: {
      KEYBOARD_IN: 0.5,
      KEY_HIGHLIGHT: 0.3,
      KEYBOARD_OUT: 0.4,
      TEXT_REVEAL: 1,
      TEXT_STAGGER: 0.15,
    },
  },
} as const;
