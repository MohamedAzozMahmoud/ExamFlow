import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 600000, // 10 دقائق لضمان القدرة على الانتظار حتى ثلثي الوقت
  retries: 1,
  fullyParallel: true, // مهم جداً للأداء عند الضغط
  use: {
    baseURL: 'https://examflowv2.netlify.app',
    headless: true,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  reporter: [['list'], ['html', { open: 'never' }]],
});
