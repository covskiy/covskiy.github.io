import StyleDictionary from 'style-dictionary';
import {
  transformTypes,
  transforms,
  formats,
  transformGroups,
  commentPositions,
} from 'style-dictionary/enums';

/** Кастомный трансформер для трансляции градиента в корректный css */
const gradientTransform = 'attribute/gradient-to-css';
StyleDictionary.registerTransform({
  name: gradientTransform,
  type: transformTypes.value,
  filter: (token) => {
    return token.$type === 'custom-gradient';
  },
  transform: (token) => {
    const gradient = token.$value;

    if (gradient.gradientType === 'linear') {
      // Конвертируем градусы в deg
      const rotation = `${gradient.rotation}deg`;
      // Обрабатываем остановки градиента
      const colorStops = gradient.stops
        .map((stop) => {
          const alpha = parseInt(stop.color.slice(-2), 16) / 255;
          const rgb = stop.color.slice(0, 7);
          return `${rgb} ${stop.position * 100}%`;
        })
        .join(', ');

      return `linear-gradient(${rotation}, ${colorStops})`;
    }

    // Поддержка радиальных градиентов
    if (gradient.gradientType === 'radial') {
      const colorStops = gradient.stops
        .map((stop) => {
          const alpha = parseInt(stop.color.slice(-2), 16) / 255;
          const rgb = stop.color.slice(0, 7);
          return `${rgb} ${stop.position * 100}%`;
        })
        .join(', ');

      return `radial-gradient(${colorStops})`;
    }

    throw new Error(`Unsupported gradient type: ${gradient.gradientType}`);
  },
});

/** Транслятор dimension значений */
const pxToRemTransform = 'value/px-to-rem-conditional';
StyleDictionary.registerTransform({
  name: pxToRemTransform,
  type: transformTypes.value,
  filter: (token) => {
    // Применяем только к токенам типа dimension (размеры, отступы, радиусы и т. д.)
    if (token.$type !== 'dimension') return false;
    // borderWidth оставляем в px — толщины рамок не масштабируются с размером шрифта
    if (token.attributes.category === 'borderWidth') return false;
    // containerMaxWidth оставляем в px — это фиксированная ширина макета,
    // она не должна масштабироваться с размером шрифта пользователя
    if (
      token.attributes.category === 'layout' &&
      token.name === 'container-max-width'
    ) {
      return false;
    }
    return true;
  },
  transform: (token, config) => {
    const value = token.$value;

    // beakpoints не транслируем в rem
    if (token.attributes.category === 'breakpoints') {
      return value;
    }

    if (typeof value === 'string') {
      // Конвертируем px в rem
      if (value.endsWith('px')) {
        const pxValue = parseInt(value.slice(0, -2), 10);
        if (pxValue === '0') {
          console.log('hit');
        }
        const remValue = pxValue / config.basePxFontSize; // 16 — базовый размер шрифта (1rem = 16px)
        return `${remValue}rem`;
      }

      // Если значение уже в rem/em/auto и т. д. — возвращаем как есть
      return value;
    }

    // Для числовых значений (например, line-height) возвращаем как есть
    return value;
  },
});

export default {
  source: [`design-tokens/**/*.json`],
  platforms: {
    css: {
      transformGroup: transformGroups.css,
      transforms: [gradientTransform, pxToRemTransform],
      basePxFontSize: 16,
      buildPath: 'src/styles',
      files: [
        {
          destination: 'colors.css',
          format: formats.cssVariables,
          filter: (token) =>
            token.attributes.category === 'color' ||
            token.attributes.category === 'color-gradient',
        },
        {
          destination: 'typography.css',
          format: formats.cssVariables,
          filter: (token) =>
            token.attributes.category === 'fontFamilies' ||
            token.attributes.category === 'fontSizes' ||
            token.attributes.category === 'lineHeights' ||
            token.attributes.category === 'fontWeights' ||
            token.attributes.category === 'letterSpacings' ||
            token.attributes.category === 'typography',
        },
        {
          destination: 'spacing.css',
          format: formats.cssVariables,
          filter: (token) => token.attributes.category === 'spacing',
        },
        {
          destination: 'breakpoints.css',
          format: formats.cssVariables,
          filter: (token) => token.attributes.category === 'breakpoints',
        },
        {
          destination: 'shadows.css',
          format: formats.cssVariables,
          filter: (token) => token.attributes.category === 'shadows',
        },
        {
          destination: 'transitions.css',
          format: formats.cssVariables,
          filter: (token) => token.attributes.category === 'transitions',
        },
        {
          destination: 'sizing.css',
          format: formats.cssVariables,
          filter: (token) =>
            token.attributes.category === 'borderRadius' ||
            token.attributes.category === 'borderWidth' ||
            token.attributes.category === 'controlElementHeight' ||
            token.attributes.category === 'iconSize' ||
            token.attributes.category === 'avatarSize' ||
            token.attributes.category === 'sizing',
        },
      ],
    },
  },
};
