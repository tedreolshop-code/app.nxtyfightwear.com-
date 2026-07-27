import { defineConfig, devices } from '@playwright/test';

// Uji viewport HP. Dev server dijalankan sendiri oleh Playwright bila belum hidup.
export default defineConfig({
  testDir: './e2e',
  use: {
    baseURL: 'http://localhost:3000',
    ...devices['Pixel 5'], // 393x851, touch, mobile user agent
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
  },
});
