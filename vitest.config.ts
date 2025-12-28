import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src/renderer/src'),
    },
  },
  test: {
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
