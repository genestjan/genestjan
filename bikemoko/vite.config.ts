/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// Web build is served from genestjanramirez.com/bikemoko/.
// "app" mode (Android APK and Windows EXE) loads from the file system, so it needs a relative base.
export default defineConfig(({ mode }) => ({
  base: mode === 'app' ? './' : process.env.BIKEMOKO_BASE ?? '/bikemoko/',
  plugins: [react()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
}));
