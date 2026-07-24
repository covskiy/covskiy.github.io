import StyleDictionary from 'style-dictionary';
import {
  transformTypes,
  formats,
  transformGroups,
  transforms,
} from 'style-dictionary/enums';

/** @typedef {import('style-dictionary/types').Config} Config */
/** @typedef {import('style-dictionary/types').Transform} Transform */

/** Кастомный трансформер для трансляции градиента в корректный css */
/** @type {Transform} */
const gradientTransform = {
  name: 'attribute/gradient-to-css',
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
};

/** Транслятор dimension значений */
/** @type {Transform} */
const pxToRemTransform = {
  name: 'value/px-to-rem-conditional',
  type: transformTypes.value,
  filter: (token) => {
    // Применяем только к токенам типа dimension (размеры, отступы, радиусы и т. д.)
    if (token.$type !== 'dimension') return false;
    // borderWidth оставляем в px — толщины рамок не масштабируются с размером шрифта
    if (token.attributes.category === 'borderWidth') return false;
    // beakpoints не транслируем в rem
    if (token.attributes.category === 'breakpoints') return false;
    // containerMaxWidth оставляем в px — это фиксированная ширина макета,
    // она не должна масштабироваться с размером шрифта пользователя
    if (
      token.attributes.category === 'layout' &&
      token.name === 'layout-container-max-width'
    ) {
      return false;
    }
    // Если в значении лежит "auto" или "normal", регулярное выражение вернет false,
    // и этот токен вообще не пойдет на этап transform.
    const valueStr = String(token.$value);
    const isNumericOrPx = /^[0-9.-]+(px)?$/.test(valueStr);

    return isNumericOrPx;
  },
  transform: (token, config) => {
    const value = token.$value;
    const baseFontSize = config.basePxFontSize || 16; // 16 — базовый размер шрифта (1rem = 16px)

    if (typeof value === 'string' && value.endsWith('px')) {
      // Конвертируем px в rem
      const pxValue = parseFloat(value);
      if (!isNaN(pxValue)) {
        return `${pxValue / baseFontSize}rem`;
      }
    }

    if (typeof value === 'number') {
      return `${value / baseFontSize}rem`;
    }

    return value;
  },
};

const customCSS = 'custom-css';
const customGroups = StyleDictionary.hooks.transformGroups[
  transformGroups.css
].filter((t) => t !== transforms.sizeRem);

/** @type {Config} */
export default {
  source: [`design-tokens/**/*.json`],
  hooks: {
    transformGroups: {
      [customCSS]: [...customGroups, pxToRemTransform.name],
    },
    transforms: {
      [gradientTransform.name]: gradientTransform,
      [pxToRemTransform.name]: pxToRemTransform,
    },
  },
  platforms: {
    css: {
      transformGroup: customCSS,
      transforms: [gradientTransform.name, pxToRemTransform.name],
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
            token.attributes.category === 'layout',
        },
      ],
    },
  },
};
