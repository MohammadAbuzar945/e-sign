import path from 'node:path';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['**/*.test.ts'],
    setupFiles: ['./vitest.setup.ts'],
  },
  resolve: {
    alias: {
      '@documenso/lib': path.resolve(__dirname, '.'),
      '@documenso/prisma': path.resolve(__dirname, '../prisma'),
      '@documenso/email': path.resolve(__dirname, '../email'),
      '@documenso/ee': path.resolve(__dirname, '../ee'),
      '@documenso/assets': path.resolve(__dirname, '../assets'),
    },
  },
});
