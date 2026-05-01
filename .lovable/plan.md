# خطة الإصلاحات الشاملة

## السياق

عندك اتنين Backend جاهزين بيعملوا الشغل التقيل، والموقع ده مفروض يكون Frontend شفاف فقط:

| الـ Backend | URL | بيخدم |
|---|---|---|
| Webly | `wxphtsgezburjqoqiqqo.supabase.co/functions/v1/webly-*` | كل صفحة البرمجة |
| Docs Design Studio | `docs-design-studio.lovable.app/api/v1/*` | كل صفحة الملفات |

كل المشاكل دلوقتي بسبب إن الـ Frontend بيحاول يعمل شغل الـ Backend (نصوص ثابتة، fallback محلي، system prompts، مسح السجل، إلخ).

---

## 1) صفحة البرمجة (`CodeWorkspace.tsx`) — Pure pass-through

### المشاكل دلوقتي
- بيبعت `messages` array كامل + system prompt fake مع كل طلب → بيكسر Webly اللي عنده context engine جواه
- بيحط رسائل ثابتة بالعربي/الإنجليزي ("تمام بدأت الشغل") قبل وبعد كل طلب → غلط، Webly بيرجع رسائل status مفصلة بنفسه
- لو بعتت رسالة تانية بيعمل project جديد → المفروض يستخدم نفس `webly_project_id` ويبعت تعديل
- اسم المشروع = أول 60 حرف من الرسالة → المفروض كلمتين بالـ AI
- الرسائل القديمة من الـ DB بتتلودر بس بعد كده الـ steps القديمة بتختفي (بيمسح السجل)

### الإصلاح

**`handleSend(text, isFollowUp)`**:
1. لو في `weblyProjectId` موجود → استخدمه (مش يعمل واحد جديد). لو مفيش → ولّد ID مرة واحدة عند أول رسالة وبس.
2. ابعت لـ `webly-proxy` بس: `{ action, project_id, prompt }` — بدون `messages` وبدون system text.
3. **شيل** الـ `preMsg` الثابت (`"تمام، بدأت الشغل دلوقتي"`) — Webly بيبعت `event: status` بنفسه؛ خليه يظهر زي ما هو من الـ stream.
4. **شيل** الـ `replyMsg` الثابت في الآخر (`"تمام، خلصت!"`) — لو Webly بعت `text` events أو `done.summary` استخدمه؛ لو لأ، ما تكتبش حاجة من عندك. بس update الـ steps إنها خلصت.
5. **شيل** كل النصوص المترجمة/الـ fallback بالعربي. أي حاجة الـ user يشوفها لازم تيجي من السيرفر.

**اسم المشروع بـ AI (كلمتين)**:
- Edge function جديد صغير `name-project` بيستقبل `{ prompt }` وبيرجع `{ name }` كلمتين. بيستخدم نفس Lovable AI Gateway.
- بدلاً من ذلك (أبسط): استخدم endpoint `/webly-name` لو موجود في Webly backend، ولو لأ، اعمل الـ edge function الصغير ده عندنا.
- بيتنادى مرة واحدة عند إنشاء أول project، الاسم بيتحط في `projects.name`.

**حفظ السجل الكامل**:
- كل messages بتتحفظ في `messages` table مع `conversation_id`. ده شغال أصلاً.
- المشكلة: عند فتح المشروع تاني، بيلودر الرسائل من الـ DB بس الـ `weblyProjectId` بيبقى null → يعمل project جديد. الإصلاح: احفظ `webly_project_id` في `projects` row (موجود أصلاً) واقرأه أول ما الصفحة تفتح.
- عند فتح workspace بـ `project_id` param → اقرأ `projects.webly_project_id` و`conversation_id` و`name` وحط كله في الـ state قبل أي شغل.

**Refund logic**: ابقى محفوظ زي ما هو، بس الرسالة لو الـ stream رمى error هتبقى من Webly نفسه، مش ثابتة.

---

## 2) Publish Sheet في PreviewPage

### المشاكل
- زر النشر دلوقتي toast فقط، مفيش sheet.
- لو الـ deploy رجّع `skipped: true` (مفيش cloudflare_url) → toast "Publish failed" → مش واضح للمستخدم.
- Webly endpoint للـ deploy ممكن يكون اسمه مختلف (`webly-deploy` بيرجع 404 على المشاريع الـ fallback).

### الإصلاح

**Publish Bottom Sheet جديد** (`PublishSheet.tsx`):
- يفتح من الزر، نفس نمط liquid-glass + click-outside-to-close.
- يحتوي:
  - الرابط (لو منشور) كـ chip قابل للنسخ + زر "Open" يفتح في tab جديد
  - زر `Publish` أو `Republish` حسب الحالة
  - رسائل state من الـ stream (لو الـ deploy بيستغرق وقت)

**في الـ webly-proxy**:
- لما الـ deploy يرجع `skipped: true` بسبب fallback project: استخدم endpoint احتياطي `/webly-publish-static` لو موجود، ولو لأ ارفع الـ HTML من `files_snapshot` على Supabase Storage في bucket عام جديد `published-sites` ورجّع URL مباشر. ده يضمن إن أي مشروع ينفع ينشر.
- خزّن الـ URL في `projects.preview_url` + `status='published'`.

**في PreviewPage**:
- اقرأ الـ status والـ URL من الـ DB أول ما تفتح علشان الزر يعرض "Republish" مباشرة.

---

## 3) السجل في صفحة الشات الرئيسية (الـ Sidebar)

### المشكلة
السجل بيختفي/يتمسح بعد ما المستخدم يطلع من الشات ويرجع.

### الفحص المطلوب
- المسببات المحتملة: `key={currentUserId}` على `<ChatPage />` بيـ remount الصفحة كاملة لما الـ user يتبدل، وممكن state cache مش متخزن.
- ممكن AppSidebar بيعمل refetch فاضي.

### الإصلاح
- في AppSidebar، اعمل query واحد على `conversations` يـ subscribe على tab focus + on mount. خزّن النتيجة في `localStorage` كـ cache فوري (zero-lag) زي ما معمول في hubs تانية.
- تأكد إن المحادثات بتتعرض **فوق** الـ 3 أزرار (New chat / Search / Settings) وإن الـ scroll للسجل لوحده، الأزرار ثابتة في الأسفل.

---

## 4) صفحة الملفات (`FilesPage.tsx`) — إعادة تصميم كاملة

### الإستراتيجية
- **مسح** كل الـ builders المحلية (`SPECIALIZED_BUILDERS`, `getBuilder`, `filesHtmlBuilders.ts` الخ) وكل توليد PDF/PPTX على الـ client.
- التصميم: نفس فيب landing page و pricing — high-fidelity glassmorphism، gradients هادية، typography clean، floating elements.
- كل توليد عبر `https://docs-design-studio.lovable.app/api/v1/*`.

### العناصر

```
┌─────────────────────────────────────────────────┐
│ [☰]  Files                                      │ ← navbar زي اللي في landing
├─────────────────────────────────────────────────┤
│                                                 │
│             FILES                               │ ← Hero بـ gradient + animated headline
│         ANY FORMAT                              │
│   Slides, docs, sheets, mindmaps —              │
│   built by AI, exported beautifully.            │
│                                                 │
│   ┌─────────────────────────────────────┐       │
│   │ Describe what you need...      [↑] │       │ ← Input bar نفس بتاع البرمجة
│   └─────────────────────────────────────┘       │
│                                                 │
│   [Slides] [Resume] [Document] [Report] ...     │ ← chips للأنواع
│                                                 │
├─────────────────────────────────────────────────┤
│  Templates                                      │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐  →                │ ← horizontal scroll، صور من DB (لاحقاً من بوت تليجرام)
│  └────┘ └────┘ └────┘ └────┘                    │
├─────────────────────────────────────────────────┤
│  Your Files                                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐         │ ← grid بـ thumbnails من الـ generations
│  │ thumb    │ │ thumb    │ │ thumb    │         │
│  │ Title    │ │ Title    │ │ Title    │         │
│  └──────────┘ └──────────┘ └──────────┘         │
└─────────────────────────────────────────────────┘
```

### Workspace صفحة (نفس النمط)
- بنفس style بتاع `/code/workspace`: chat على اليسار + preview على اليمين.
- المعاينة: iframe بيرندّر `POST /api/v1/generations/:id/export?format=html`.
- زر Export → 3 خيارات: HTML / PDF / PPTX. الـ HTML من الـ API مباشرة. الـ PDF/PPTX يتم client-side من الـ HTML باستخدام jsPDF + pptxgenjs (المكتبات الموجودة).
- نوع الملف يتحدد بـ chip مختار قبل الإرسال (slides/document/...).

### Templates من Telegram Bot
- جدول `image_templates` موجود — استخدمه. ممكن نضيف عمود `kind` (slides/resume/...) لو محتاجين فلترة.
- لو فاضي، نقرأ من `GET /api/v1/templates` ونعرضها مع `preview` emoji كـ placeholder للحد ما البوت يضيف صور.

### History
- جدول `generation_jobs` موجود لكن ممكن نخزن metadata الملف (id من الـ docs-design-studio + thumbnail + kind + prompt + created_at) في جدول جديد `generated_documents` للحفاظ على سجل المستخدم نظيف.

---

## 5) E2E Test

### Setup
- إضافة Playwright (lightweight) لو مش موجود، أو استخدام `vitest + @testing-library` لاختبارات interaction أساسية.
- اختيار Playwright لأن السيناريوهات تحتاج preview حقيقي + iframes + SSE.

### السيناريوهات

| # | اختبار | المتوقع |
|---|---|---|
| 1 | افتح `/programming` → اكتب prompt → اضغط Send | يفتح workspace، رسالة المستخدم تظهر، Webly stream يبدأ، اسم المشروع يبقى كلمتين |
| 2 | بعت رسالة تانية في نفس الـ workspace | نفس الـ project_id يستخدم، ما يعملش project جديد |
| 3 | افتح Preview → اضغط Publish | Sheet يفتح، URL يظهر، الزر يبقى "Republish" |
| 4 | اضغط في أي مكان خارج الـ Publish Sheet | يقفل |
| 5 | روح للـ Chat → اعمل محادثة → ارجع للـ Programming → ارجع للـ Chat | السجل ظاهر فوق الـ 3 أزرار |
| 6 | افتح `/files` → اختر Slides chip → اكتب prompt → Send | يفتح workspace، يستلم SSE من docs-design-studio، الـ preview يظهر |
| 7 | اضغط Export → اختر PDF | ملف PDF يتنزل |
| 8 | افتح ملف موجود من history | المعاينة تتلودر فوراً من cache + refresh من الـ API |

النتيجة بتطلع مع report HTML يفتح في `/mnt/documents/`.

---

## التغييرات بالتفصيل (للمراجعة التقنية)

### Files بتتعدّل
- `src/pages/CodeWorkspace.tsx` — حذف كل النصوص الثابتة، fix project reuse, AI naming, persist webly_project_id
- `src/pages/PreviewPage.tsx` — Publish Sheet جديد بدل الـ toast
- `src/pages/FilesPage.tsx` — إعادة كتابة كاملة من الصفر
- `src/components/AppSidebar.tsx` — caching للسجل، تأكيد ترتيب فوق الأزرار

### Files جديدة
- `src/components/code/PublishSheet.tsx`
- `src/components/files/FilesHero.tsx`
- `src/components/files/FilesTemplateRow.tsx`
- `src/components/files/FilesWorkspace.tsx` — chat + preview workspace
- `src/lib/docsStudio.ts` — wrapper لـ docs-design-studio API
- `supabase/functions/name-project/index.ts` — AI naming (لو Webly مفيش endpoint جاهز)
- `supabase/functions/webly-proxy/index.ts` — fallback publish عبر Storage bucket
- `playwright.config.ts` + `tests/e2e/*.spec.ts`

### Files بتتشال
- `src/lib/filesHtmlBuilders.ts` (replaced by API)
- `src/lib/builders/*` (ميتشالش لو في صفحات تانية بتستخدمه — هتأكد قبل)
- نصوص العربي/الإنجليزي الثابتة من CodeWorkspace

### DB Migration
- إضافة عمود `kind text` لـ `image_templates` لفلترة قوالب الملفات
- جدول جديد `generated_documents (id, user_id, doc_id, kind, template, prompt, thumbnail_url, created_at)` لسجل ملفات المستخدم مع RLS صارمة
- bucket عام جديد `published-sites` لنشر مشاريع البرمجة fallback

### Bucket policy
`published-sites` public read، write service-role فقط (الـ webly-proxy بيكتب).

---

## ترتيب التنفيذ

1. تنظيف CodeWorkspace (إزالة النصوص الثابتة + project reuse + AI naming)
2. PublishSheet + fallback publish في webly-proxy
3. AppSidebar history caching
4. DB migration (table + bucket + column)
5. FilesPage إعادة تصميم + workspace + docsStudio wrapper
6. Playwright setup + 8 سيناريوهات
7. تشغيل الاختبارات وإصلاح أي failures

بعد الموافقة هابدأ بالخطوة 1 وأكمّل بالترتيب.