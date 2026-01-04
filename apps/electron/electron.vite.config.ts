import { resolve } from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'electron-vite';

export default defineConfig({
  main: {
    build: {
      // ESM-only packages must be bundled (not externalized) so they get
      // converted to CJS format that Electron can use.
      // electron-store -> conf -> dot-prop, env-paths, atomically, etc.
      // conf -> ajv -> json-schema-traverse, fast-deep-equal, etc.
      externalizeDeps: {
        exclude: [
          'electron-store',
          'conf',
          'dot-prop',
          'env-paths',
          'atomically',
          'debounce-fn',
          'json-schema-typed',
          'uint8array-extras',
          'ajv',
          'ajv-formats',
          'json-schema-traverse',
          'fast-deep-equal',
          'fast-uri',
          'require-from-string',
          // electron-updater and its dependencies need to be bundled
          // to avoid pnpm symlink issues in packaged app
          'electron-updater',
          'builder-util-runtime',
          'lazy-val',
          'semver',
        ],
      },
    },
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src/main'),
        '@shared': resolve(__dirname, 'src/shared'),
      },
    },
  },
  preload: {
    build: {
      externalizeDeps: true,
    },
    resolve: {
      alias: {
        '@shared': resolve(__dirname, 'src/shared'),
      },
    },
  },
  renderer: {
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src/renderer/src'),
        '@shared': resolve(__dirname, 'src/shared'),
      },
    },
    plugins: [react(), tailwindcss()],
  },
});
