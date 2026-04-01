import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
    },
  },
  resolve: {
    alias: {
      '@core': './src/core',
      '@economy': './src/economy',
      '@identity': './src/identity',
      '@social': './src/social',
      '@tui': './src/tui',
    },
  },
});
