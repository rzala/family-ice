import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // The shared workspace package ships TypeScript source; inline it so vitest transforms it.
    server: { deps: { inline: ['@family-ice/shared'] } },
  },
});
