/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

// Served from genestjanramirez.com/fetch/ (customer) and /fetch/driver/ (driver).
export default defineConfig({
  base: process.env.FETCH_BASE ?? '/fetch/',
  plugins: [react()],
  build: {
    rollupOptions: {
      input: { customer: resolve(__dirname, 'index.html'), driver: resolve(__dirname, 'driver/index.html') },
    },
  },
  test: { environment: 'jsdom', globals: true, include: ['src/**/*.test.ts'] },
});
