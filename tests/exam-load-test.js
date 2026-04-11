import http from 'k6/http';
import { browser } from 'k6/browser';
import { check, sleep } from 'k6';
import { vu } from 'k6/execution';

// ====================== إعدادات عامة ======================
const BASE_URL = __ENV['BASE_URL'] || 'https://examflowv2.netlify.app';
const dbContent = JSON.parse(open('../.github/workflows/db.json')); // نسبياً لمكان الـ script
const users = dbContent.users || [];

export const options = {
  scenarios: {
    // 1. HTTP Load (83 VU) - خفيف ويولد load كبير على الباك اند
    heavy_load: {
      executor: 'constant-vus',
      vus: 83,
      duration: '10m',
      exec: 'httpFlow',
    },
    // 2. Browser Experience (3 VU فقط) - يقيس Angular frontend
    browser_experience: {
      executor: 'constant-vus',
      vus: 3,
      duration: '10m',
      exec: 'browserFlow',
      options: {
        browser: {
          type: 'chromium',
        },
      },
    },
  },
  thresholds: {
    'http_req_duration': ['p(95)<800'],
    'browser_page_load_time': ['p(95)<5000'],
    'browser_web_vital_lcp': ['p(95)<4000'],
  },
};

// ====================== HTTP Flow (الأغلبية) ======================
export function httpFlow() {
  const vuId = vu.idInTest - 1;
  const user = users[vuId % users.length] || { user: 'test', pass: 'test' };

  // Login API (غير الـ endpoint حسب الـ backend بتاعك)
  const loginRes = http.post(`${BASE_URL}/api/auth/login`, {
    identifier: user.user,
    password: user.pass,
  }, { tags: { type: 'login' } });

  check(loginRes, { 'Login successful': (r) => r.status === 200 || r.status === 201 });

  sleep(2);

  // باقي الـ API calls (مثال: جلب الامتحانات، حفظ إجابة، submit)
  // أضف هنا الـ endpoints اللي Angular بيضربها أثناء حل الامتحان
  // مثال:
  // http.get(`${BASE_URL}/api/exams/active`);
  // http.post(`${BASE_URL}/api/answers`, payload);

  sleep(3); // pacing طبيعي
}

// ====================== Browser Flow (قليل جداً) ======================
export async function browserFlow() {
  const page = await browser.newPage();
  const vuId = vu.idInTest - 1;
  const user = users[vuId % users.length] || { user: 'test', pass: 'test' };

  try {
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });

    await page.locator('input[formcontrolname="identifier"]').fill(user.user);
    await page.locator('input[formcontrolname="password"]').fill(user.pass);
    await page.locator('button[type="submit"]').click();

    await page.waitForNavigation({ waitUntil: 'networkidle' });

    // انتظار زر الانضمام
    await page.waitForSelector('app-active-exams-card .join-btn:not([disabled])', { timeout: 180000 });
    await page.locator('app-active-exams-card .join-btn:not([disabled])').click();

    await page.waitForNavigation({ waitUntil: 'networkidle' });

    // حل بعض الأسئلة (مختصر عشان ما يطولش)
    await page.waitForSelector('.question-card', { timeout: 30000 });
    sleep(3);

    // مثال: اختيار أول خيار أو كتابة إجابة
    const options = page.locator('.option-label');
    if (await options.count() > 0) {
      await options.first().click();
    }

    console.log(`✅ Browser VU ${vu.idInTest} اكتمل جزء من الامتحان`);
  } finally {
    await page.close();
  }
}