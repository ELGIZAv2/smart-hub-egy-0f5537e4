

## فحص شامل + إصلاح ملفات + Claude Code Bot للبرمجة

### السبب الجذري للملفات (مؤكد من اللوغز)

```
schema upstream 402 {"type":"payment_required","message":"Not enough credits"}
brief upstream error: 402 ...
questions upstream 402 ...
```

`z-ai/glm-4.5-air:free` على OpenRouter ضرب سقف الكوتا اليومية (rate limit للـ free tier). الكود يستدعي OpenRouter مباشرة لكن الكوتا المجانية انتهت. الحل: **Auto-fallback صامت لنماذج OpenRouter رخيصة بدون تغيير النموذج الأساسي المطلوب**.

---

### 1) إصلاح وظائف الملفات الأربع

أضيف داخل كل من `generate-builder-schema`, `generate-file-questions`, `generate-file-brief`, `generate-slides`:

```ts
const FILES_MODEL_CHAIN = [
  "z-ai/glm-4.5-air:free",         // مطلوب أولاً (مجاني)
  "deepseek/deepseek-chat-v3.1:free", // مجاني آخر
  "google/gemini-2.5-flash-lite",   // مدفوع رخيص جداً
  "google/gemini-2.0-flash-001",    // احتياط أخير
];
```

عند 402/429/5xx من نموذج، ينتقل للتالي تلقائياً بنفس مفتاح OpenRouter. المستخدم لا يرى تغيير. لا Lovable AI، لا LemonData — فقط OpenRouter كما طلبت.

تحسينات إضافية:
- إعادة محاولة JSON parse فاشل بـ system prompt مشدد
- تنظيف code fences (` ```json `) قبل parse
- timeout 45 ثانية لكل محاولة

---

### 2) Claude Code Bot للبرمجة (نظام متكامل)

**ما هو:** بدلاً من توليد كود مباشر، نبني وكيل برمجة على نمط `claude-code` / `clow` كنظام إيجنت كامل:

**الوظائف الجديدة:**
- `code-agent/index.ts` — orchestrator رئيسي يستخدم `z-ai/glm-4.5-air:free` فقط (كما طلبت) مع نفس fallback chain
- `github-tree/index.ts` — جلب شجرة المستودع كاملة + قراءة ملفات محددة عبر `GITHUB_PAT`
- يدعم tool-calling داخلي:
  - `read_file(path)` — قراءة ملف من repo
  - `list_dir(path)` — استعراض مجلد
  - `search_code(query)` — بحث نصي في repo
  - `write_file(path, content)` — كتابة/تعديل
  - `run_preview()` — بناء معاينة على الكومبيوتر

**واجهة CodeWorkspace:**
- شريط أدوات جديد: **GitHub repo selector** (يجلب repos المستخدم تلقائياً)
- لوحة "Agent Activity" تعرض كل خطوة (read → analyze → write → verify) بنفس نمط Build Workflow الحالي
- زر **"Open in Computer Preview"** — يفتح iframe بحجم 1440×900 مع تكبير ذكي ليتسع في الشاشة (يحاكي شاشة كومبيوتر حقيقية)

---

### 3) قالب Megsy جديد كلياً (إصلاح التكرار)

القالب الحالي يشبه GlassPitch (radial glows + headline). إعادة كتابة كاملة:

**التصميم الجديد المستوحى مباشرة من landing page:**
- خلفية `#08070d` + dot grid pattern (نفس HeroSection)
- **Hero typography**: Space Grotesk Black uppercase 200px على الغلاف، gradient متحرك (أزرق→بنفسجي→وردي)
- **Floating glass bullet cards** بدل قائمة عادية — كل bullet في بطاقة `backdrop-blur-3xl` معلقة
- **Number badges دائرية** 96px بـ gradient عند الترقيم
- **Marquee أفقي** للـ kicker (نفس ModelsMarquee)
- **Floating particles** متحركة (نفس HeroSection)
- شريط سفلي: شعار "MEGSY" ضخم يساراً + رقم سلايد monospace يميناً
- 5 layouts مختلفة كلياً عن GlassPitch (cover/section/content/quote/stats)

---

### 4) Auto-screenshot لكل ملف منشأ

- وظيفة جديدة `screenshot-preview/index.ts` تستخدم `ScreenshotOne_Access Key` (متوفرة)
- تُستدعى تلقائياً بعد كل توليد سلايد/ملف
- تحفظ في bucket `slide-images`
- تُرفق `preview_image_url` مع المرسلة + في `saved_files`
- Recent files cards تعرض الـ screenshot بحجم كبير (180px) فوق الاسم

---

### 5) Preview Images لقوالب السلايدس

كل قالب من القوالب التسعة يحصل على preview image في DB:
- نولّد slide demo واحد لكل قالب → screenshot → حفظ في `slide-images/template-previews/`
- تحديث `slide_templates.preview_url` بـ migration
- منتقي القوالب يعرض الصورة فقط بدون مساحات (compact grid) + ترتيب عشوائي client-side

---

### 6) إصلاح overflow في القوالب التسعة

تطبيق على كل قالب:
```tsx
className="break-words line-clamp-{N}"
style={{ overflowWrap: "anywhere", wordBreak: "break-word" }}
```
حدود: title=2 أسطر، subtitle=3، body=6، bullet=2 لكل عنصر. تقليل أحجام الخطوط الكبيرة عند طول > 40 حرف.

---

### 7) E2E Test محسّن

`_e2e_test/index.ts` يفحص:
- 8 أنواع schema (تأكيد content غير فارغ)
- 9 قوالب slides (≥70% slides ممتلئة)
- fallback chain يعمل
- screenshot generation
- تقرير مفصل بكل اختبار فشل + سبب

سأشغّله بعد الإصلاحات وأكرر حتى pass كامل.

---

### الملفات المتأثرة

```text
تعديل:
  supabase/functions/generate-builder-schema/index.ts   ← OpenRouter chain
  supabase/functions/generate-file-questions/index.ts   ← OpenRouter chain
  supabase/functions/generate-file-brief/index.ts       ← OpenRouter chain
  supabase/functions/generate-slides/index.ts           ← OpenRouter chain + Megsy palette
  supabase/functions/_e2e_test/index.ts                 ← شامل
  src/lib/slides/templates/Megsy.tsx                    ← إعادة كتابة كاملة
  src/lib/slides/templates/{Sketch,Cinema3D,Glass,...}.tsx ← line-clamp
  src/pages/CodeWorkspace.tsx                           ← repo picker + Computer preview + Agent Activity
  src/pages/FilesPage.tsx                               ← preview screenshots للـ recent
  src/components/files/FilePreviewPanel.tsx             ← screenshot display

إنشاء:
  supabase/functions/code-agent/index.ts                ← Claude Code-style orchestrator (glm-4.5-air)
  supabase/functions/github-tree/index.ts               ← فحص شجرة GitHub
  supabase/functions/screenshot-preview/index.ts        ← ScreenshotOne integration
  src/components/code/AgentActivity.tsx                 ← لوحة نشاط الإيجنت
  src/components/code/ComputerPreview.tsx               ← iframe بحجم desktop
  supabase/migrations/<new>.sql                         ← preview_url لكل قالب
```

### النتيجة المتوقعة
- ملفات تعمل 100% (4 نماذج OpenRouter بالتتابع)
- قالب Megsy مميز كلياً يحاكي landing
- Claude Code-style agent للبرمجة مع فحص GitHub repos
- Computer preview حقيقي للكود
- screenshot كبير لكل ملف في قائمة recent
- لا overflow في أي قالب

