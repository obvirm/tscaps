import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

// Kept apart from `vite.config.ts` so the dev-server plugins never load
// for a test run. Only the aliases tests actually resolve are listed; an
// unlisted one fails loudly at import rather than silently resolving
// somewhere else.
export default defineConfig({
  resolve: {
    alias: {
      '@tscaps/engine': resolve(import.meta.dirname, '../../packages/engine/src/index.ts'),
      '@modules': resolve(import.meta.dirname, '../../packages/engine/src/modules'),
      '@bootstrap': resolve(import.meta.dirname, 'src/bootstrap'),
      '@core': resolve(import.meta.dirname, 'src/core'),
      '@presentation': resolve(import.meta.dirname, 'src/presentation'),
      '@ui': resolve(import.meta.dirname, 'src/ui'),
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
    // A test whose oracle is a browser launches one itself, and a cold
    // Chromium start costs more than the default allows.
    testTimeout: 20_000,
  },
});
