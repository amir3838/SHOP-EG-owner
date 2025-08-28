# بوابة تسجيل التجار - Luxbyte LLC

> **هنكبر مع بعض** - منصة تسجيل التجار لتطبيق SHOPEG

بوابة تسجيل احترافية للتجار الراغبين بالانضمام لمنصة SHOPEG (صيدليات/سوبرماركت/مطاعم) مع نظام إدارة متكامل للمراجعة والموافقة.

## 🚀 المزايا الرئيسية

- **واجهة عربية RTL** كاملة مع تصميم عصري وحديث
- **نظام متعدد الخطوات** لتسجيل بيانات التجار
- **Magic Link Authentication** عبر Supabase
- **رفع وإدارة المستندات** مع أمان عالي
- **لوحة إدارة متقدمة** لمراجعة والموافقة على الطلبات
- **تصدير البيانات** إلى CSV
- **نظام إشعارات متطور** مع Toast Messages
- **تصميم متجاوب** لجميع الأجهزة
- **وضعين داكن/فاتح** قابلين للتبديل

## 🛠️ التقنيات المستخدمة

### Frontend
- **Vanilla HTML/CSS/JavaScript** - بدون إطار عمل ثقيل
- **ES Modules** للتنظيم والكفاءة
- **CSS Custom Properties** للثيمات
- **Responsive Design** مع Mobile-First

### Backend & Services
- **Supabase** - قاعدة البيانات والمصادقة والتخزين
- **PostgreSQL** - قاعدة بيانات قوية مع RLS
- **Edge Functions** (Deno/TypeScript) للمعالجة الآمنة
- **S3-Compatible Storage** لحفظ المستندات

### Deployment
- **Vercel** - نشر سريع ومجاني
- **GitHub** - إدارة الكود المصدري
- **Custom Domain** - نطاق مخصص

## 📋 متطلبات النظام

- **Node.js** 16+ (للتطوير المحلي فقط)
- **Git** للتحكم بالإصدارات
- **Supabase CLI** لإدارة قاعدة البيانات
- **Vercel CLI** للنشر (اختياري)

## 🔧 الإعداد والتشغيل

### 1. إعداد المشروع المحلي

```bash
# استنساخ المشروع
git clone <repository-url> luxbyte-merchant-portal
cd luxbyte-merchant-portal

# تثبيت الأدوات العامة
npm install -g @supabase/cli vercel

# إعداد متغيرات البيئة
cp .env.example .env
# عدّل الملف .env بمفاتيح Supabase الصحيحة
```

### 2. إعداد Supabase

```bash
# تهيئة Supabase محلياً
supabase init

# بدء خدمات Supabase المحلية
supabase start

# تطبيق المخططات وسياسات الأمان
supabase db reset

# نشر وظائف الحافة
supabase functions deploy get-upload-url
supabase functions deploy get-download-url
```

### 3. إعداد قاعدة البيانات

سيتم تطبيق المخططات التالية تلقائياً:

- جدول `profiles` - ملفات تعريف المستخدمين
- جدول `admins` - قائمة المدراء
- جدول `applications` - طلبات التجار
- جدول `documents` - المستندات المرفقة
- سياسات RLS شاملة للأمان
- محفزات تلقائية لتوليد أرقام الطلبات

### 4. إعداد التخزين

```bash
# في لوحة تحكم Supabase، إنشاء Bucket
Bucket Name: merchant-documents
Policy: Private
Allowed File Types: PDF, JPG, PNG
Max File Size: 10MB
```

### 5. إعداد المدراء

```sql
-- إضافة بريد إلكتروني للمدير
INSERT INTO public.admins (email) VALUES ('admin@luxbyte.com');
```

### 6. التشغيل المحلي

```bash
# تشغيل الخادم المحلي
npm run dev

# الوصول للتطبيق
# http://localhost:3000 - الصفحة الرئيسية
# http://localhost:3000/admin.html - لوحة الإدارة
```

## 🌐 النشر على Vercel

### 1. النشر التلقائي

```bash
# ربط المشروع بـ Vercel
vercel link

# نشر للإنتاج
vercel --prod
```

### 2. إعداد متغيرات البيئة في Vercel

في لوحة تحكم Vercel، أضف:

```
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 3. إعداد Domain المخصص

في Supabase Dashboard → Authentication → URL Configuration:
```
Site URL: https://luxbyte.vercel.app
Redirect URLs: https://luxbyte.vercel.app/**
```

## 📊 استخدام النظام

### للتجار الجدد:
1. زيارة الموقع والنقر على "تسجيل دخول"
2. إدخال البريد الإلكتروني للحصول على Magic Link
3. تأكيد البريد والعودة للموقع
4. ملء نموذج التسجيل المتعدد الخطوات
5. رفع المستندات المطلوبة
6. إرسال الطلب والحصول على رقم مرجعي

### للمدراء:
1. الدخول للوحة الإدارة `/admin.html`
2. استعراض وفلترة الطلبات
3. عرض تفاصيل كل طلب والمستندات
4. قبول أو رفض الطلبات مع إضافة ملاحظات
5. تصدير التقارير بصيغة CSV

## 🔒 الأمان والحماية

### Row Level Security (RLS)
- **المستخدمون**: يصلون فقط لبياناتهم الخاصة
- **المدراء**: وصول كامل للطلبات المرسلة
- **المستندات**: محمية بصلاحيات متقدمة

### التحقق من الملفات
- أنواع مسموحة: PDF, JPG, PNG
- حد أقصى: 10 ميجابايت
- فحص MIME Type
- روابط مؤقتة للتحميل

### الحماية من الهجمات
- CORS محدد للنطاقات المصرحة
- Content Security Policy
- XSS Protection
- SQL Injection Prevention via Supabase

## 📈 المراقبة والصيانة

### إحصائيات النظام
- إجمالي الطلبات
- الطلبات قيد المراجعة
- معدلات القبول/الرفض
- توزيع التجار حسب النوع والمحافظة

### النسخ الاحتياطي
```bash
# نسخ احتياطي من قاعدة البيانات
supabase db dump --data-only > backup.sql

# استعادة من نسخة احتياطية
supabase db reset
psql -h localhost -p 54322 -U postgres -d postgres < backup.sql
```

### تحديث الكود
```bash
# سحب آخر التحديثات
git pull origin main

# تحديث قاعدة البيانات
supabase db push

# إعادة نشر وظائف الحافة
supabase functions deploy

# نشر للإنتاج
vercel --prod
```

## 🐛 استكشاف الأخطاء

### مشاكل شائعة وحلولها:

#### 1. خطأ في تسجيل الدخول
```bash
# التحقق من إعدادات Authentication في Supabase
# التأكد من Site URL صحيح
# فحص redirect URLs
```

#### 2. فشل رفع الملفات
```bash
# التحقق من إعدادات Storage bucket
# فحص صلاحيات RLS على جدول documents
# مراجعة وظيفة get-upload-url
```

#### 3. مشاكل الأداء
```bash
# فحص الفهارس في قاعدة البيانات
# مراقبة استخدام Edge Functions
# تحسين استعلامات SQL
```

## 🔄 تحديثات مستقبلية

### المرحلة القادمة:
- [ ] إشعارات البريد الإلكتروني التلقائية
- [ ] تتبع متقدم لحالة الطلبات
- [ ] واجهة برمجة تطبيقات API للتكامل
- [ ] تقارير تحليلية متقدمة
- [ ] دعم اللغة الإنجليزية

### تحسينات تقنية:
- [ ] PWA Support للعمل بدون إنترنت
- [ ] تحسين SEO وإمكانية الوصول
- [ ] اختبارات آلية شاملة
- [ ] CI/CD Pipeline متطور

## 📞 الدعم والتواصل

**شركة Luxbyte LLC**
- 📧 البريد الإلكتروني: admin@luxbyte.com
- 📱 الهاتف: +201148709609
- 📍 العنوان: 42 شارع البحر، شبراتون، القاهرة - الدور الخامس

**للمطورين:**
- 🐛 تبليغ الأخطاء: [GitHub Issues]
- 💡 الاقتراحات: [Feature Requests]
- 📖 الوثائق: [Documentation Wiki]

## 📄 الترخيص

هذا المشروع مرخص تحت رخصة MIT. راجع ملف [LICENSE](LICENSE) للمزيد من التفاصيل.

---

**تم تطوير هذا المشروع بـ ❤️ من فريق Luxbyte LLC**

*"هنكبر مع بعض"*