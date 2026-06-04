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

  /** LogoText — сборка букв "COVSKIY", гвоздь -> курсор */
  logoText: {
    labels: {
      C_LETTER: 0,
      NAIL_FLY: 0,
    },
    durations: {
      C_LETTER_FROM: 0.5,
      C_LETTER_MORPH: 0.5,
      NAIL_FLY: 1.2,
      NAIL_MORPH: 0.5,
      LETTER_MORPH: 0.4,
      CURSOR_MOVE: 2,
    },
  },

  /** Tagline — клавиатура + текстовый слоган */
  tagline: {
    labels: {
      KEYBOARD_IN: 0,
    },
    durations: {
      KEYBOARD_IN: 0.5,
      KEY_HIGHLIGHT: 0.3,
      KEY_STAGGER_GAP: 0.3,
      ENTER_KEY_OFFSET: 0.5,
      KEYBOARD_OUT: 0.4,
      TEXT_REVEAL: 0.6,
      TEXT_STAGGER: 0.15,
    },
  },
} as const;
