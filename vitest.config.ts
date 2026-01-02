import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: [
      // Main paths - for renderer tests, @ should point to renderer
      { find: '@', replacement: path.resolve(__dirname, './src/renderer/src') },
      // Shared paths
      { find: '@shared', replacement: path.resolve(__dirname, './src/shared') },
    ],
  },
  test: {
    watch: false,
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: ['node_modules', 'dist', 'out'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'html'],
      include: ['src/renderer/src/**/*.{ts,tsx}'],
      exclude: [
        'src/renderer/src/**/*.test.{ts,tsx}',
        'src/renderer/src/**/*.d.ts',
        'src/renderer/src/main.tsx',
        'src/renderer/src/routeTree.gen.ts',
      ],
    },
  },
});
