# مِشوارك — Cloudflare Pages / Functions

مستودع مستقل جديد. لا يحتوي على أي ملفات أو مفاتيح أو قواعد بيانات من مشروع «توصيلها» السابق.

## المسارات
- `public/`: الواجهة العامة وملفات PWA.
- `public/admin/`: واجهة إدارة منفصلة عن واجهة PWA.
- `functions/api/`: Cloudflare Pages Functions؛ كل ملف يطابق مسار API حسب مكانه.
- `functions/_lib/`: أدوات مشتركة للسيرفر، وليست مسارات API.
- `db/schema.sql`: مخطط D1 الكامل الحالي.
- `wrangler.toml`: تعريف اسم المشروع وBindings.

مثال: `functions/api/auth/login.js` يخدم `POST /api/auth/login`.

## الخدمات والـ Bindings المطلوبة
1. **D1** binding اسمه `DB` وقاعدة بيانات جديدة باسم `mishwark-db`.
2. لا يوجد R2 أو KV أو Durable Object مطلوب لتشغيل نظام الحسابات والاشتراكات حاليًا. رفع وثائق الهوية والرخص متوقف لحين توفير تخزين خاص آمن. لا ترفع الوثائق إلى D1 أو ملفات الموقع العامة كحل مؤقت.

بعد إنشاء D1 انسخ `database_id` الحقيقي إلى `wrangler.toml` مكان `PASTE_YOUR_NEW_D1_DATABASE_ID`. اربط D1 في Cloudflare Pages > Settings > Functions > Bindings لبيئة Production، وكرر الربط لبيئة Preview عند الحاجة.

## إنشاء قاعدة البيانات
على قاعدة D1 جديدة نفّذ `db/schema.sql` مرة واحدة من Cloudflare Dashboard أو:

```bash
npx wrangler d1 execute mishwark-db --remote --file=./db/schema.sql
```

لو كنت نفذت النسخة السابقة من `schema.sql` بالفعل على نفس قاعدة البيانات، **لا تعِد تشغيل المخطط كاملًا**؛ نفّذ ترقية الاشتراكات مرة واحدة فقط:

```bash
npx wrangler d1 execute mishwark-db --remote --file=./db/migrations/0002_captain_subscriptions.sql
```

## Environment Variables
**Text variables** في Cloudflare Pages > Settings > Variables and Secrets:
- `APP_ENV` = `production`
- `APP_TIMEZONE` = `Africa/Cairo`

**Secrets** (لا تضعها في GitHub ولا ترسلها في المحادثة):
- `ADMIN_BOOTSTRAP_TOKEN` = قيمة عشوائية طويلة تُستخدم مرة واحدة لإنشاء أول أدمن، ثم احذفها من إعدادات Cloudflare.

مفاتيح VAPID وTelegram غير مطلوبة الآن؛ إرسال Push الفعلي وربط بوت Telegram واستعادة كلمة المرور لم يكتملوا بعد. لا تضف أي Tokens قديمة.

## أول تشغيل
1. أنشئ D1 جديدًا واربطه بالاسم `DB`.
2. نفّذ `db/schema.sql`.
3. أضف المتغيرات والأسرار.
4. انشر Pages من GitHub مع Root directory فارغ، Build output directory = `public`. لا تحتاج bundler build لهذه الملفات؛ يمكن استخدام `npm run check` كفحص قبل النشر.
5. افتح `/api/health` وتأكد من `database: ok`. ستظهر حالة `private_storage: not_configured` إلى أن نضيف تخزينًا خاصًا للوثائق.
6. أنشئ الأدمن مرة واحدة بطلب `POST /api/admin/bootstrap` مع Header اسمه `X-Admin-Bootstrap` وقيمة `ADMIN_BOOTSTRAP_TOKEN`، وJSON يحتوي `full_name`, `email`, `phone`, `password` (14 حرفًا على الأقل). بعد نجاح الإنشاء احذف السر فورًا.
7. افتح `/admin/` لتسجيل دخول الأدمن.

## API المتاحة حاليًا
- `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`
- `POST /api/admin/bootstrap`
- `GET/POST /api/admin/settings`
- `GET/POST /api/admin/routes`
- `GET/POST /api/admin/captains`
- `GET/POST /api/admin/document-review`, `GET /api/admin/documents?key=...`
- `GET /api/admin/stats`
- `POST /api/captain/documents`, `POST /api/captain/availability`, `GET /api/captain/summary`
- `POST /api/rides/create`, `GET /api/rides/list`, `POST /api/rides/offer`, `GET /api/rides/offers?ride_id=...`, `POST /api/rides/accept-offer`, `POST /api/rides/status`
- `POST /api/push/subscribe`
- `GET /api/captain/subscription`
- `GET/POST /api/admin/subscriptions` (إعدادات الاشتراك والعروض)

## الحالة بوضوح
هذه **نسخة تطوير وظيفية جزئية وليست إصدارًا نهائيًا جاهزًا لاستقبال ركاب حقيقيين**. تم تنفيذ أساس التسجيل والجلسات، إنشاء حسابات راكب/كابتن، مراجعة المستندات (تحتاج تخزينًا خاصًا غير مربوط حاليًا)، بعض عمليات الإدارة، إنشاء الرحلات والعروض وقبولها وحالات الرحلة والدفتر اليومي. لم يكتمل بعد: واجهات الرحلات الكاملة للراكب والكابتن، واجهات تشغيل الرحلات الكاملة للراكب والكابتن، التفاوض المتبادل من الراكب، Telegram linking/recovery، إرسال Web Push الفعلي (الموجود حاليًا مركز إشعارات داخل الحساب فقط)، rate limiting أوسع من حدّ المحاولات الأساسي على التسجيل والدخول، مقاومة الإساءة، اختبارات تكامل على Cloudflare، اختبارات حمل 1500 مستخدم، ومراجعة أمنية مستقلة. لا تعتبر نجاح فحص syntax أو SQL دليلًا على جاهزية الإنتاج.

## ملاحظات تشغيل وأمان
- حساب الراكب والكابتن منفصلان حسب `role` ويمكن استخدام الهاتف نفسه لكل دور.
- الكابتن يبدأ `pending` ولا يعمل قبل موافقة الإدارة واعتماد 6 صور/ملفات المستندات المطلوبة.
- رفع وثائق الهوية والرخص متوقف حاليًا لعدم ربط تخزين خاص. لا تستخدم D1 أو `public` أو KV لتخزين هذه الملفات.
- الجلسة في HttpOnly Secure cookie، وكلمة المرور PBKDF2-SHA256.
- المبالغ محفوظة بالقرش. دفتر الرحلات يمنع التكرار باستخدام `ride_id` فريد.
- لا تستقبل المنصة أموالًا ولا تتحقق من تحويلات المحافظ أو InstaPay؛ طريقة الدفع مجرد بيان مسجل.
- خيار المحفظة غير المحسوم «سالك كاش» غير مضمن كاسم مزود؛ المدعوم حاليًا في المخطط Vodafone Cash وOrange Cash وInstaPay، إلى أن تؤكد المقصود.


## حماية لوحة الإدارة

أضف في Cloudflare Pages → Settings → Variables and Secrets → Production Secret:

- `ADMIN_PIN` أو `ADMIN_PANEL_PASSWORD`: كلمة مرور قوية وفريدة لا تقل عن 16 حرفًا. الكود يقبل `ADMIN_PANEL_PASSWORD` أولًا ثم `ADMIN_PIN` للتوافق مع اسم السر الموجود في ملف `.env.example`. هذه هي كلمة المرور التي تظهر شاشة `/admin/`. لا تضعها في GitHub أو ملفات المشروع.

الدخول يتم عبر `POST /api/admin/login`، مع تحديد محاولات الدخول، وإنشاء جلسة HttpOnly/Secure لمدة 8 ساعات. جميع API الإدارة تستمر في التحقق من جلسة مستخدم بدور `admin` على السيرفر. تسجيل دخول الأدمن من مسار تسجيل الدخول العام مرفوض. يلزم إنشاء سجل الأدمن الأول مرة واحدة عبر `ADMIN_BOOTSTRAP_TOKEN` قبل استخدام شاشة الدخول.
