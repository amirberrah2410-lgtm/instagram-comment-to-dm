# Instagram: تعليق ← رابط تلقائي (Private Reply)

هذا مشروع Netlify Function بسيط: عندما يكتب أحدهم كلمة مفتاحية في تعليق
على منشور Instagram، يستلم رسالة خاصة (Private Reply) تلقائية تحتوي رابطًا.
**بدون** أي شرط للتحقق من المتابعة.

---

## 1) المتطلبات الأساسية على جانب Meta

قبل تشغيل الكود، يجب أن يكون لديك:

1. **حساب Instagram Business أو Creator** (وليس شخصي عادي)
2. **صفحة Facebook** مرتبطة بحساب الإنستغرام هذا
3. **تطبيق (App)** على [Meta for Developers](https://developers.facebook.com/)
   - أضف منتج **Instagram** + **Webhooks** للتطبيق
4. **صلاحيات (Permissions)** التالية مفعّلة على التطبيق:
   - `instagram_manage_messages`
   - `instagram_manage_comments`
   - `pages_manage_metadata`
   - هذه الصلاحيات تحتاج **App Review** من Meta قبل أن تعمل مع حسابات غير مرتبطة بفريق التطوير (أثناء التطوير تقدر تختبر على حسابك الخاص كـ "Tester" بدون مراجعة)

---

## 2) نشر المشروع على Netlify

1. ارفع هذا المجلد إلى GitHub (repo جديد)
2. من لوحة Netlify: **Add new site → Import from Git**
3. اختر الـ repo، اترك إعدادات البناء كما هي (لا يوجد build command مطلوب)
4. اذهب إلى **Site settings → Environment variables** وأضف القيم من ملف `.env.example`
5. بعد النشر، ستحصل على رابط الدالة بالشكل:
   ```
   https://your-site-name.netlify.app/.netlify/functions/instagram-webhook
   ```

---

## 3) ربط الـ Webhook بـ Meta

1. في لوحة تطبيقك على Meta for Developers → **Webhooks**
2. اختر منتج **Instagram**
3. ضع:
   - **Callback URL**: رابط الدالة من الخطوة السابقة
   - **Verify Token**: نفس القيمة التي وضعتها في `IG_VERIFY_TOKEN`
4. اضغط **Verify and Save** (Meta سترسل طلب GET للتحقق، والدالة تتعامل معه تلقائيًا)
5. اشترك (Subscribe) في حقل `comments`

---

## 4) الحصول على Page Access Token

من **Graph API Explorer** أو من إعدادات التطبيق:
- اختر صفحتك
- اطلب الصلاحيات المذكورة أعلاه
- انسخ الـ **Page Access Token** وضعه في `IG_PAGE_ACCESS_TOKEN`

⚠️ يفضّل استخدام **Token طويل الأمد (long-lived token)** حتى لا ينتهي كل ساعة.

---

## 5) الاختبار

1. اكتب تعليقًا يحتوي على الكلمة المفتاحية (مثل "رابط") على أحد منشوراتك
2. خلال ثوانٍ يجب أن تصلك رسالة خاصة (DM) من حسابك تحتوي الرابط
3. راقب الـ **Logs** في Netlify (Functions → Logs) لمتابعة أي أخطاء

---

## ملاحظات مهمة

- **Private Reply لها مهلة زمنية**: يجب إرسالها خلال فترة محددة بعد التعليق (توثيق Meta الرسمي يحدد المهلة الحالية - راجع صفحة Private Replies).
- هذا الكود **لا يمنع تكرار الإرسال** لنفس الشخص إذا علّق أكثر من مرة. لإضافة هذه الميزة تحتاج قاعدة بيانات بسيطة (مثل Supabase المجاني) لتخزين `comment_id` أو `user_id` الذين تم الرد عليهم.
- التزم بشروط استخدام Meta؛ الرسائل التلقائية المزعجة أو المخالفة لسياسات المنصة قد تعرض حسابك للتقييد.
