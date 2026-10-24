import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    maxWorkers: 4,
    setupFiles: ['./src/test/setup.ts'],
    alias: {
      '@': path.resolve(process.cwd(), './src'),
    },
    css: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'json-summary', 'html'],
      thresholds: {
        lines: 85,
        functions: 85,
        branches: 85,
        statements: 85,
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
