/// <reference types="vitest" />
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

/** The page may only talk to its own Supabase project (and the weather API): the exact origin goes into the CSP. */
function cspSupabase(url: string | undefined): Plugin {
  let allow = ''; let origin = '';
  if (url) { const u = new URL(url); allow = ` ${u.origin} ${u.origin.replace(/^http/, 'ws')}`; origin = ` ${u.origin}`; }
  return { name: 'csp-supabase', transformIndexHtml: (html) => html.replace(' __SUPABASE__', allow).replace(/ __SUPABASE_HTTP__/g, origin) };
}

export default defineConfig(({ mode }) => ({
  base: process.env.APP_BASE ?? '/',
  plugins: [
    cspSupabase(loadEnv(mode, process.cwd(), '').VITE_SUPABASE_URL),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Rangers FC', short_name: 'Rangers', start_url: '.', scope: '.',
        display: 'standalone', background_color: '#03080F', theme_color: '#05101F',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: { globPatterns: ['**/*.{js,css,html,png,svg,woff2,webmanifest}'], navigateFallback: 'index.html', importScripts: ['push-sw.js'] },
    }),
  ],
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
}));
