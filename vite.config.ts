import { defineConfig } from 'vite';
import browserslist from 'browserslist';
import { browserslistToTargets } from 'lightningcss';
import react from '@vitejs/plugin-react';
import svgr from 'vite-plugin-svgr';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    svgr({
      svgrOptions: {
        plugins: ['@svgr/plugin-svgo', '@svgr/plugin-jsx'],
        svgoConfig: {
          plugins: [
            {
              name: 'preset-default',
              params: {
                overrides: {
                  cleanupAttrs: false, // не удаляем при импорте svg файла css class
                  cleanupIds: false,
                  removeHiddenElems: {
                    displayNone: false, // morph пути скрытыми элементами лежат, их чистить не надо
                  },
                },
              },
            },
          ],
        },
      },
    }),
  ],
  build: {
    target: ['es2020'],
    sourcemap: true,
    cssMinify: 'lightningcss',
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              test: /node_modules/,
              name: 'vendor',
              priority: 10,
            },
          ],
        },
      },
    },
  },
  css: {
    transformer: 'lightningcss',
    lightningcss: {
      targets: browserslistToTargets(browserslist('baseline 2020')),
      // cssModules: true,
    },
  },
  server: {
    port: 3005,
    host: '0.0.0.0',
  },
  base: '/',
});
