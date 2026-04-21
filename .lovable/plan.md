

## الخطة النهائية: Files & Slides بلغات UI متخصصة + Pexels + 5 قوالب Premium

### 1) إصلاح Cleanup (الصور فقط، ليس التقرير)

تعديل `cleanup_old_research_reports` لتفريغ `images='[]'::jsonb` فقط بدلاً من `DELETE`. التقرير النصي + steps يبقوا للأبد. وفي `ResearchPreviewPage.tsx` تظهر شارة "الصور انتهت صلاحيتها — التقرير محفوظ" عند images فارغة.

---

### 2) Slides — بناء React/TypeScript أصلي + Reveal.js (لا HTML خام)

**التحول التقني**: نتخلى عن إرسال HTML خام إلى 2Slides لكل قالب. بدلاً منه:
- **محرك العرض**: `Reveal.js` (للعرض داخل الموقع) + `PptxGenJS` (للتصدير PPTX حقيقي قابل للتعديل في PowerPoint).
- **محرك السلايدات داخل التطبيق**: مكونات React مخصصة لكل قالب باستخدام:
  - `framer-motion` للأنيميشن.
  - `Recharts` للرسوم البيانية.
  - `lucide-react` للأيقونات.
  - `tsParticles` للخلفيات المتحركة.
  - Google Fonts (Inter, Playfair, Cairo, IBM Plex).
- كل قالب = مكون React منفصل في `src/lib/slides/templates/` يستقبل `slideData` ويرندر حسب نوع السلايد (cover/section/content/chart/quote/closing).

**5 قوالب Premium جديدة** (display_order سالب لتظهر أولاً):
1. **Aurora Keynote** — gradient متحرك + glassmorphism + framer-motion transitions (ستايل Apple Keynote).
2. **Editorial Noir** — أبيض/أسود فاخر + Playfair Display + خطوط رفيعة (ستايل NYT/Vogue).
3. **Neo Brutalist** — ألوان جريئة + ظلال صلبة + Inter Bold (ستايل Gumroad/Linear).
4. **Glass Pitch** — backdrop-blur + tsParticles + Recharts charts (ستايل YC pitch decks).
5. **Cairo Modern** — RTL أصلي + خط Cairo + ذهبي/كحلي (ستايل عربي راقٍ).

كل قالب له ملف `<TemplateName>.tsx` + thumbnail SVG + metadata في DB.

**دعم 50+ سلايد**: 
- `generate-slides/index.ts` يقبل `pageCount` (1..60) ويمرره لـ 2Slides API كـ `page: pageCount`.
- timeout الـedge function يرفع لـ 180s.
- لو القالب من الجديدة (Premium React)، **لا نستخدم 2Slides أصلاً** — نولد JSON منظم من AI ثم نرندره عبر مكون React → نصدره PPTX عبر PptxGenJS.

**تقرير قبل التوليد (Brief)**:
- edge function جديدة `generate-file-brief` ترجع: ملخص + outline لكل سلايد + اللون/الخط المختار + عدد السلايدات.
- يظهر داخل الـchat كـ`BriefCard` فيه: **"ابدأ التوليد"** أو **"تعديل"** (textarea لتعديل outline).
- بعد التعديل، outline المعدل يمرر للـbuilder.

---

### 3) Files — Builders متخصصة بلغات UI لكل نوع

**التخلي الكامل عن HTML خام**. كل نوع يصبح **مكون React + مكتبة متخصصة** + تصدير نظيف:

| النوع | اللغة/المكتبة | الإخراج | بيانات مطلوبة من المستخدم |
|---|---|---|---|
| **Document** | React + `@tiptap/react` (rich editor) + Tailwind typography | PDF (via jsPDF + html2canvas) | عنوان، أقسام، نبرة، طول |
| **Resume** | React مكونات + `react-pdf/renderer` (PDF أصلي vector) | PDF حقيقي vector | اسم، خبرة، تعليم، مهارات، لغات |
| **Report** | React + `Recharts` + `react-pdf/renderer` | PDF + charts | موضوع، KPIs، مصادر |
| **Spreadsheet** | `SheetJS (xlsx)` + JSON schema | XLSX حقيقي بصيغ | نوع جدول، أعمدة، صفوف |
| **Letter** | React + `react-pdf/renderer` | PDF رسمي | مرسل، مستلم، نبرة |
| **Roadmap** | React + `framer-motion` + SVG vector | PNG/PDF عبر html2canvas | هدف، مراحل، تواريخ |
| **Mindmap** | `@xyflow/react` (React Flow) interactive | PNG عبر html-to-image + JSON | فكرة مركزية، فروع |
| **Timeline** | React + `framer-motion` + SVG vector | PNG/PDF | أحداث (تاريخ + عنوان) |

**Pexels Integration** (للصور فقط):
- edge function جديدة `pexels-search` تستخدم `PEXELS_API_KEY`.
- عند ما builder يحتاج صورة (cover slide, document hero, report illustration)، يستدعي pexels بكلمة مفتاحية مستخرجة من المحتوى.
- لا نستخدم unsplash/pixabay لتجنب rate limits، Pexels فقط.
- الصور المختارة تخزن في `slide-images` bucket لتجنب hotlinking.

**Intake Flow**:
- مكون جديد `IntakeForm.tsx` يظهر كـsheet بعد اختيار النوع.
- 3-6 حقول minimal فقط (الإلزامي قليل، Optional يوضح بـ"تخطي = توليد ذكي").
- زر "تخطي + توليد سريع" متاح دوماً.
- بعد الإرسال → `BriefCard` (تقرير قبل التوليد) → "ابدأ".

---

### 4) الملفات والـ Dependencies

**Dependencies جديدة**:
- `reveal.js` + `@types/reveal.js`
- `pptxgenjs`
- `@react-pdf/renderer`
- `@tiptap/react` + `@tiptap/starter-kit`
- `xlsx` (SheetJS)
- `@xyflow/react`
- `tsparticles` + `@tsparticles/react`
- `html-to-image` (لتصدير mindmap/roadmap)
- (موجود: framer-motion, recharts, lucide-react, html2canvas, jspdf)

**Migrations**:
- `<new>.sql` — إصلاح cleanup ليفرغ images فقط.
- `<new>.sql` — إدراج 5 قوالب Premium بـdisplay_order = -5..-1، مع `template_engine='react-native'` (column جديد) + `component_name` لاستهداف المكون.

**Edge Functions**:
- `supabase/functions/generate-slides/index.ts` — دعم `pageCount` 60 + branching: قوالب Premium = توليد JSON بدلاً من PPTX من 2Slides.
- `supabase/functions/generate-file-brief/index.ts` (جديد) — توليد brief لكل نوع.
- `supabase/functions/pexels-search/index.ts` (جديد) — بحث صور + cache في storage bucket.

**Frontend جديد**:
- `src/lib/slides/templates/` — 5 مكونات React للقوالب الجديدة.
- `src/lib/slides/SlideRenderer.tsx` — renderer موحد يختار القالب + يصدر PPTX.
- `src/lib/slides/pptxExporter.ts` — تحويل React slides إلى PptxGenJS.
- `src/lib/builders/` — 8 builders متخصصة (document/resume/report/spreadsheet/letter/roadmap/mindmap/timeline).
- `src/lib/builders/schemas.ts` — JSON schemas لكل نوع (يجبر AI على إخراج منظم).
- `src/lib/builders/pexelsClient.ts` — wrapper للـedge function.
- `src/components/files/IntakeForm.tsx` — نماذج ديناميكية حسب النوع.
- `src/components/files/BriefCard.tsx` — بطاقة معاينة قبل التوليد.
- `src/components/files/SlidePreview.tsx` — معاينة Reveal.js للسلايدات داخل التطبيق.
- `src/pages/FilesPage.tsx` — flow جديد Intake → Brief → Generate → Preview.
- `src/pages/ResearchPreviewPage.tsx` — شارة "صور منتهية".

---

### 5) Secrets المطلوبة

- `PEXELS_API_KEY` — **يحتاج إضافة**. سأطلبه عند بدء التنفيذ.
- `TWOSLIDES_API_KEY` — موجود (للقوالب القديمة فقط).

---

### 6) ترتيب التنفيذ

1. Migration: إصلاح cleanup (images فقط).
2. Migration: إضافة column `template_engine` + `component_name` + إدراج 5 قوالب Premium.
3. طلب `PEXELS_API_KEY` من المستخدم.
4. edge function `pexels-search`.
5. تحديث `generate-slides` لدعم 60 + branching للقوالب Premium.
6. edge function `generate-file-brief`.
7. بناء 5 مكونات React للقوالب الجديدة + Reveal.js renderer + PptxGenJS exporter.
8. بناء 8 builders للملفات (document/resume/report/spreadsheet/letter/roadmap/mindmap/timeline) — كل واحد بمكتبته المتخصصة.
9. `IntakeForm` + `BriefCard` + ربط FilesPage بـflow الجديد.
10. شارة "صور منتهية" في ResearchPreview.

