import { defineConfig, devices } from '@playwright/test';
import fs from 'node:fs';

// Use the container's preinstalled Chromium when present; otherwise Playwright's own.
const localChromium = '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome';
const executablePath = fs.existsSync(localChromium) ? localChromium : undefined;

export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4173/ridewise/',
    ...devices['Pixel 5'],
    launchOptions: { executablePath },
    timezoneId: 'Asia/Manila',
    locale: 'en-PH',
  },
  webServer: {
    command: 'npm run build && npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173/ridewise/',
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
