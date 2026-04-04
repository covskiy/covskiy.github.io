import { defineConfig } from "vite";
import browserslist from "browserslist";
import { browserslistToTargets } from "lightningcss";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    target: ["es2020"],
    cssMinify: "lightningcss",
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              test: /node_modules/,
              name: 'vendor',
              priority: 10
            }
          ],
        },
      }
    }
  },
  css: {
    transformer: 'lightningcss',
    lightningcss: {
      targets: browserslistToTargets(browserslist('baseline 2020')),
    }
  },
  server: {
    port: 3005,
    host: "0.0.0.0"
  }
});
