import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 120000,
  retries: 1,
  fullyParallel: true, // مهم جداً للأداء عند الضغط
  use: {
    baseURL: process.env['E2E_BASE_URL'] || 'https://examflowapp.netlify.app',
    headless: true,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  reporter: [['list'], ['html', { open: 'never' }]],
}); 