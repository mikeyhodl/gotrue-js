import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/*.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'lcov'],
    },
  },
});
