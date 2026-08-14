import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@modules': resolve(import.meta.dirname, 'src/modules'),
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
});
