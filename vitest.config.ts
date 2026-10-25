import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    globals: true,
    root: './',
    include: ['**/*.spec.ts'],
    testTimeout: 10000,
    hookTimeout: 10000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.spec.ts',
        'src/**/*.d.ts',
        // Nest wiring / DI modules
        'src/**/*.module.ts',
        // Bootstrap entry
        'src/main.ts',
        // TypeORM datasource factory
        'src/common/database/database.ts',
        // GraphQL resolvers — exercised end-to-end via test/e2e
        'src/**/*.resolver.ts',
        // Type-only files (DTOs, interfaces, entities, enums)
        'src/**/*.types.ts',
        'src/**/*.interface.ts',
        'src/**/*.entity.ts',
        'src/common/constant/**',
      ],
      thresholds: {
        statements: 95,
        branches: 90,
        functions: 90,
        lines: 97,
      },
    },
  },
});
