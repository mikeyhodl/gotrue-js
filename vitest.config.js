import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/*.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'lcov'],
    },
  },
});
