

## خطة الإصلاح الشامل: محتوى عميق + صور Pexels حقيقية + بريفيو PDF + منع تكرار الأسئلة

### المشاكل الفعلية المكتشفة

1. **محتوى السلايدس فارغ**: `generate-slides` يستخدم `gemini-2.5-flash` بدون آلية بحث عميق، النموذج يكتب bullets قصيرة بدلاً من فقرات غنية.
2. **الصور خاطئة/مفقودة**: `image_query` يُولَّد ثم يُمرَّر لـ Pexels لكن النموذج يكتب كلمات عربية أو غامضة فلا تطابق المكتبة، والكثير من السلايدات لا يحصل على صورة أصلاً.
3. **Builders بدون بريفيو**: PDF يُحمَّل فقط ولا يُعرَض في `FilePreviewPanel` (الذي يدعم HTML iframe فقط، لا PDF).
4. **الأسئلة الذكية تتكرر**: `generate-file-questions` لا يحتوي seed/randomization، Gemini يعيد نفس الأسئلة لنفس النوع.
5. **Spreadsheet/Mindmap/Roadmap/Timeline** لا تنتج بريفيو لأن `previewHtml` مفقود.

---

### الإصلاحات

#### 1) محرّك سلايدس بـ "بحث عميق على مرحلتين"
داخل `generate-slides` (مسار React templates):
- **المرحلة A — Outline**: `gemini-2.5-flash` ينتج هيكل (titles + image_queries إنجليزية فقط + counts) في مكالمة سريعة.
- **المرحلة B — Deep Content**: `gemini-2.5-pro` (نموذج أقوى للمحتوى) يستقبل الـoutline + topic + reference content، ويولّد لكل سلايد:
  - `body`: فقرة 60-120 كلمة (إجباري)
  - `bullets`: 4-6 نقاط، كل واحدة 8-15 كلمة (لا 3 كلمات)
  - `stats` و`quote` بأرقام/اقتباسات حقيقية
- **إجبار الإنجليزية على image_query**: تحقق برمجي بعد parse — لو احتوى أحرف غير لاتينية، نعيد ترجمته عبر استدعاء AI سريع `"translate to 3 english visual keywords"`.

#### 2) إصلاح Pexels integration
- استدعاءات متوازية مع **fallback**: إن لم تعد Pexels نتيجة لـ`image_query`، نجرب أول كلمة فقط، ثم نستخدم صورة generic للقالب من DB.
- **تخزين الصور في الـSlide** بـ `image` و`image_thumb`، تمرير الأول للعرض والثاني للـlazy load.
- **logging**: نطبع كل failed query في edge logs لتشخيص لاحق.

#### 3) PDF Preview للملفات الأخرى
- إضافة `pdfPreviewUrl` لـ `BuilderResult`. عند توليد الـPDF، نحوّل الـblob لـ `URL.createObjectURL(blob)` ونمرّره.
- في `FilePreviewPanel` نضيف `pdfUrl` prop: لو موجود، نعرض `<iframe src={pdfUrl}>` بدلاً من `srcDoc`.
- يطبَّق على: `document`, `resume`, `report`, `letter`.
- لـ `spreadsheet`: نولّد HTML preview بسيط من الـschema (table بـTailwind inline) + رابط XLSX للتحميل.
- لـ `roadmap`, `mindmap`, `timeline`: نولّد HTML preview جميل من الـschema (موجود جزئياً، نتأكد من ملئه).

#### 4) منع تكرار الأسئلة
- `generate-file-questions` يستقبل `seed: Date.now()` ويُحقن في system prompt: `"Variation seed: ${seed} — produce a fresh angle different from previous runs."`
- نرفع `temperature: 0.9` (افتراضي 0.7) ليولّد تنوّعاً.
- نحفظ آخر 3 أسئلة في `localStorage` ونمررها للـedge: `"Avoid repeating these previous questions: [...]"`.

#### 5) تحسين system prompt للمحتوى العميق
استبدال الـsystem الحالي:
```
- Each "content" slide: body paragraph 60-120 words (REQUIRED, not optional)
  + 4-6 bullets each 8-15 words (NOT 3 words)
- Stats slides: 3-5 stats with real-looking numbers
- Quote slides: real-feel quote 15-30 words + plausible attribution
- Section slides: full kicker + 1-line description
- NEVER produce empty fields. If unsure, expand with relevant context.
- image_query: ALWAYS English, 3-5 visual keywords (e.g. "modern glass office skyline aerial")
```

---

### الملفات المتأثرة

```text
supabase/functions/generate-slides/index.ts        ← إعادة كتابة (two-stage)
supabase/functions/generate-file-questions/index.ts ← seed + temperature + avoid list
src/lib/builders/types.ts                          ← +pdfPreviewUrl, +previewHtml للجميع
src/lib/builders/documentBuilder.tsx               ← إنتاج blob URL
src/lib/builders/resumeBuilder.tsx                 ← إنتاج blob URL
src/lib/builders/reportBuilder.tsx                 ← إنتاج blob URL
src/lib/builders/letterBuilder.tsx                 ← إنتاج blob URL
src/lib/builders/spreadsheetBuilder.ts             ← +HTML table preview
src/lib/builders/roadmapBuilder.ts                 ← التأكد من previewHtml
src/lib/builders/mindmapBuilder.ts                 ← التأكد من previewHtml
src/lib/builders/timelineBuilder.ts                ← التأكد من previewHtml
src/components/files/FilePreviewPanel.tsx          ← دعم pdfUrl prop
src/pages/FilesPage.tsx                            ← تمرير pdfUrl + حفظ آخر أسئلة
```

### النتيجة المتوقعة
- سلايدس بمحتوى ضعف الحالي + صور Pexels صحيحة في كل سلايد.
- بريفيو PDF داخل التطبيق لـ4 أنواع ملفات + بريفيو HTML للباقي.
- أسئلة ذكية مختلفة في كل مرة، حتى لنفس الموضوع.

