import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    globals: true,
    root: './',
    include: ['test/**/*.e2e-spec.ts'],
    exclude: ['**/.trunk/**', '**/node_modules/**', '**/dist/**'],
    hookTimeout: 180_000,
    testTimeout: 60_000,
    fileParallelism: false,
    dangerouslyIgnoreUnhandledErrors: true,
  },
});