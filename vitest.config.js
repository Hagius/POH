import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    exclude: [
      '**/node_modules/**',
      '**/tests/**', // Exclude Playwright e2e tests
    ],
  },
});
