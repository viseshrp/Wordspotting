import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.spec.ts'],
    exclude: ['tests/e2e/**/*.spec.ts'],
    environment: 'jsdom',
    globals: true,
    setupFiles: ['tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: 'coverage',
      thresholds: {
        statements: 85,
        branches: 70,
        functions: 85,
        lines: 85
      },
      include: ['entrypoints/shared/**/*.ts'],
      exclude: ['**/*.d.ts']
    }
  }
});
