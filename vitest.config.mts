import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import os from 'os';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    maxWorkers: process.env.CI ? 4 : Math.min(8, Math.max(1, os.availableParallelism())),
    testTimeout: 15000,
    hookTimeout: 15000,
    setupFiles: ['./src/test/setup.ts'],
    alias: {
      '@': path.resolve(process.cwd(), './src'),
    },
    css: false,
    coverage: {
      provider: 'v8',
      reportsDirectory: './coverage',
      reporter: ['text', 'json', 'json-summary', 'html'],
      thresholds: {
        lines: 95,
        functions: 92,
        branches: 85,
        statements: 95,
      },
      exclude: [
        'node_modules/**',
        '.next/**',
        'scripts/**',
        'src/mocks/**',
        'src/test/**',
        'src/types/**',
        'src/lib/gutenberg/types.ts',
        'src/lib/gutenberg-parser.ts',
        'src/lib/gutenberg/index.ts',
        '**/*.css',
        '**/*.d.ts',
        'next.config.ts',
        'postcss.config.mjs',
        'tailwind.config.ts',
        'eslint.config.mjs',
        'public/**',
      ],
    },
  },
});
