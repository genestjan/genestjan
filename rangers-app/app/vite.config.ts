/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: process.env.APP_BASE ?? '/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Rangers FC', short_name: 'Rangers', start_url: '.', scope: '.',
        display: 'standalone', background_color: '#03080F', theme_color: '#05101F',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: { globPatterns: ['**/*.{js,css,html,png,svg,woff2,webmanifest}'], navigateFallback: 'index.html', importScripts: ['push-sw.js'] },
    }),
  ],
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
