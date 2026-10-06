import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// NestJS dependency injection needs emitted decorator metadata, which esbuild
// does not produce; SWC does.
export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    projects: [
      {
        extends: true,
        test: { name: 'unit', include: ['src/**/*.test.ts'] },
      },
      {
        extends: true,
        test: {
          name: 'e2e',
          include: ['test/**/*.e2e.ts'],
          globalSetup: ['test/setup/global-setup.ts'],
          fileParallelism: false,
          testTimeout: 30_000,
          hookTimeout: 120_000,
        },
      },
    ],
  },
});
