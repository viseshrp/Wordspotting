import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.spec.ts'],
    exclude: ['tests/e2e/**/*.spec.ts'],
    environment: 'jsdom',
    setupFiles: ['tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: 'coverage',
      thresholds: {
        lines: 85,
        statements: 85,
        functions: 85,
        branches: 70,
      },
      include: ['entrypoints/shared/utils.ts', 'entrypoints/shared/settings.ts'],
    },
  },
});
