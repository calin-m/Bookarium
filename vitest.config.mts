import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    alias: {
      '@': path.resolve(process.cwd(), './src'),
    },
    css: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'json-summary', 'html'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
      exclude: [
        'node_modules/**',
        '.next/**',
        'scripts/**',
        'src/mocks/**',
        'src/test/**',
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
