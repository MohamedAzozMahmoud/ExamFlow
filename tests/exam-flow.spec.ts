import { test, expect, Page } from '@playwright/test';

test.describe('ExamFlow Authentication Stress Test', () => {
  test('should login and complete exam successfully with matrix user', async ({
    page,
  }: {
    page: Page;
  }) => {
    // 1. قراءة قائمة الحسابات ورقم الجهاز (Index) من db.json
    let users: any[] = [];
    try {
      const dbContent = require('fs').readFileSync(
        require('path').resolve(__dirname, '../.github/workflows/db.json'),
        'utf-8',
      );
      users = JSON.parse(dbContent).users || [];
    } catch (e) {
      console.error('Error reading db.json:', e);
    }

    const indexStr = process.env['USER_INDEX'] || '0';
    const rawIndex = parseInt(indexStr);

    let currentUser = users[rawIndex];

    // حماية لتشغيل الاختبار محلياً أو إذا كان عدد الحسابات أقل من الـ Matrix
    if (!currentUser) {
      if (users.length > 0) {
        currentUser = users[rawIndex % users.length]; // الدوران على الحسابات المتوفرة
      } else {
        currentUser = { user: 'test-student', pass: 'test-password' }; // حساب وهمي للتيست المحلي
      }
    }

    console.log(`🚀 بدء محاكاة الدخول للطالب: ${currentUser.user}`);

    // 2. تنفيذ سيناريو الدخول
    await page.goto('/login');

    await page.fill('input[formControlName="identifier"]', currentUser.user);
    await page.fill('input[formControlName="password"]', currentUser.pass);

    await page.click('button[type="submit"]');

    // 3. التأكد من الوصول للداشبورد بدلاً من شاشة تسجيل الدخول
    await expect(page).toHaveURL(/.*student.*/, { timeout: 5000 });

    // 4. انتظار تحميل زر الانضمام للامتحان والتأكد من أنه مفعل (غير معطل)
    console.log('⏳ في انتظار ظهور امتحان متاح وتفعيل زر الانضمام...');
    const joinBtn = page.locator('app-active-exams-card .join-btn').first();

    // الانتظار حتى يظهر الزر في الشاشة
    await expect(joinBtn).toBeVisible({ timeout: 30000 });

    // الأهم: الانتظار حتى يصبح الزر مفعلاً (أي أن فترة السماح بالدخول قد بدأت)
    console.log('⏳ في انتظار تفعيل زر الانضمام (بناءً على التوقيت)...');
    await expect(joinBtn).toBeEnabled({ timeout: 300000 }); // قد ننتظر عدة دقائق حسب إعدادات الامتحان

    await joinBtn.click();

    // 5. نتأكد من الوصول لجلسة الامتحان
    console.log('✅ تم الدخول لجلسة الامتحان بنجاح!');
    await expect(page).toHaveURL(/.*exam.*/, { timeout: 20000 });

    // 6. انتظار ظهور مساحة الأسئلة لبدء الحل
    await page.waitForSelector('.question-card', { timeout: 20000 });

    // 7. محاكاة حل الأسئلة (20 سؤال) بشكل متتالي وسريع يمثل ضغطاً
    const totalQuestions = 20;

    for (let i = 0; i < totalQuestions; i++) {
      // التأكد من أن الكارد الخاص بالسؤال ظاهر تماماً
      await expect(page.locator('.question-card')).toBeVisible();

      // فاصل زمني صغير لمحاكاة التدفق الطبيعي للطالب ولتحديث السيرفر (debounce)
      await page.waitForTimeout(200);

      const essayArea = page.locator('textarea[name="answer"]');
      const isEssay = (await essayArea.count()) > 0;

      if (isEssay) {
        // حل سؤال المقال
        await essayArea.fill(
          `إجابة آلية للاختبار المكثف (Stress Test) للطالب ${currentUser.user} للسؤال رقم ${i + 1}.`,
        );

        // التأكد من تفعيل زر الحفظ والضغط عليه
        const saveEssayBtn = page.locator('button', { hasText: 'Save Answer' });
        await expect(saveEssayBtn).toBeEnabled({ timeout: 5000 });
        await saveEssayBtn.click();

        // الانتظار لحظة لضمان تسجيل الإجابة قبل الانتقال للسؤال التالي
        await page.waitForTimeout(500);
      } else {
        // حل سؤال الاختيار من متعدد
        const options = page.locator('.option-label');
        if ((await options.count()) > 0) {
          // يمكن تغيير index للإختيار العشوائي ولكن نختار الأول لتسريع الاختبار
          await options.first().click();
        }
      }

      // الانتقال للسؤال التالي إن لم نكن في الأخير
      if (i < totalQuestions - 1) {
        const nextBtn = page.getByRole('button', { name: 'Next' });
        if ((await nextBtn.isVisible()) && (await nextBtn.isEnabled())) {
          await nextBtn.click();
        } else {
          console.log(`⚠️ الزر 'Next' غير متوفر في السؤال رقم ${i + 1}`);
          break; // نخرج من الحلقة إذا انتهت الأسئلة قبل الـ 20
        }
      }
    }

    console.log('🎯 تم الانتهاء من حل جميع الأسئلة!');

    // 8. الانتظار حتى تفعيل زر التسليم (بعد مرور ثلثي الوقت) ثم التسليم
    const submitBtn = page.locator('.submit-btn');
    console.log('⏳ تم حل جميع الأسئلة، في انتظار تفعيل زر التسليم (بمرور 2/3 من الوقت)...');

    // الانتظار حتى يصبح الزر مفعلاً (قد يصل إلى عدة دقائق حسب مدة الامتحان)
    await expect(submitBtn).toBeEnabled({ timeout: 650000 });

    await submitBtn.click();
    console.log('📤 تم ضغط زر التسليم بنجاح!');

    // 9. التأكد من التحويل التلقائي لصفحة past-results
    console.log('⏳ في انتظار التحويل التلقائي لصفحة النتائج السابقة...');
    await expect(page).toHaveURL(/.*past-results.*/, { timeout: 1500 });
    console.log('✅ اكتمل السيناريو بنجاح (تسجيل دخول، حل الامتحان، الحفظ، التسليم، والتوجيه)!');
  });
});
