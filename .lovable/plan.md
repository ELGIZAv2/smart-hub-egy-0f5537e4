

## خطة شاملة: قوالب سلايدس فاخرة + Builders ذكية + محادثة تفاعلية

### 1) إصلاحات السلايدس الفورية

**المشاكل الحالية في 5 قوالب React**: نصوص بـ`text-2xl/3xl` (صغيرة على 1920×1080)، لا توجد صور، لا توجد thumbnails، شريط القوالب بسيط.

**الحلول**:
- **رفع أحجام النصوص**: العنوان الرئيسي `text-8xl/9xl` (140-180px)، العناوين الفرعية `text-5xl/6xl`، المحتوى `text-3xl/4xl`. تطبيق scale موحد عبر CSS class `.slide-content` مع `font-size` floor 28px للجسم.
- **محتوى عملاق + صور**: كل سلايد content يأخذ صورة من Pexels تلقائياً (حقل `image_query` في schema). الـcover slide يصبح half-bleed image (نصف الشاشة صورة، نصف نص). slides من نوع `stats` تعرض أرقام بحجم 200px+.
- **استدعاء Pexels داخل generate-slides**: بعد توليد JSON من Gemini، loop على slides واستدعاء `pexels-search` للحصول على URL لكل `image_query`. الصور تُحقن في الـdeck قبل إرساله للفرونت.
- **حذف زر "معاينة" العائم**: إزالة الـfloating preview button من `FilesPage.tsx`.

### 2) معرض قوالب فاخر iOS 26 + thumbnails حقيقية

- **حذف كلمة "Premium"** من badges في `FilesPage.tsx`.
- **شريط القوالب الجديد**: `TemplateGallery.tsx` بستايل iOS 26 — بطاقات أفقية بـ`backdrop-blur-3xl`, `border-white/10`, gradient overlay، ثمبنيل صورة فعلية للقالب، اسم القالب أسفل، scroll أفقي ناعم بـsnap-x.
- **Thumbnails حقيقية**: لكل قالب صورة JPG مولدة بـhtml-to-image من السلايد الأول (cover) ومخزنة في `slide-images` bucket. سأولد 25 thumbnail (5 موجودة + 20 جديدة) برمجياً عبر سكريبت رفع لـ DB.

### 3) إضافة 20 قالب جديد متنوع

كل قالب = مكون React جديد في `src/lib/slides/templates/` + إدخال DB:

| # | القالب | الستايل |
|---|---|---|
| 1 | **SketchHand** | خطوط يدوية (Rough.js)، خط Caveat، ورقة beige |
| 2 | **Cinema3D** | Three.js gradient mesh background، depth layers |
| 3 | **iOSGlass** | iOS 26 liquid glass، SF Pro، depth blur |
| 4 | **TerminalDev** | مونوسبيس JetBrains Mono، أخضر/أسود hacker |
| 5 | **MagazineFold** | تخطيط مجلة (CSS columns)، Playfair + Lora |
| 6 | **NeonCyber** | cyberpunk، neon glow، Orbitron font |
| 7 | **PaperOrigami** | folded paper shadows، CSS clip-path |
| 8 | **MinimalSwiss** | Helvetica Neue، grid system، أبيض نقي |
| 9 | **GradientWave** | SVG wave dividers، pastel gradients |
| 10 | **DarkLuxe** | أسود مخملي + ذهبي، Bodoni font |
| 11 | **KidsPlayful** | Comic Neue، أيقونات ملونة كبيرة، فقاعات |
| 12 | **CorporateNavy** | navy/أبيض شركاتي، Inter |
| 13 | **NatureOrganic** | ألوان طبيعية، أوراق SVG، Source Serif |
| 14 | **GlitchArt** | RGB shift، CSS distortions |
| 15 | **IsometricTech** | isometric SVG illustrations |
| 16 | **WatercolorSoft** | watercolor backgrounds (PNG)، Dancing Script |
| 17 | **RetroArcade** | 80s، Press Start 2P font، CRT scanlines |
| 18 | **ScientificPaper** | LaTeX-style، Computer Modern، figures |
| 19 | **PitchYC** | YC pitch deck، Inter، charts (Recharts) |
| 20 | **ArabesqueGold** | زخارف عربية SVG، خط Amiri، ذهبي/أزرق |

**أيقونات ضخمة من 4 مكتبات**:
- `lucide-react` (موجودة)
- `react-icons` (يضم: Font Awesome, Material, Bootstrap, Heroicons, Phosphor, Feather, Tabler, Remix, Ionicons, Octicons — 100,000+ أيقونة في مكتبة واحدة)
- `@phosphor-icons/react` (تنوع weights)
- `lottie-react` (للأنيميشنات داخل السلايدات)

كل قالب يستخدم مكتبة الأيقونات المناسبة لطابعه (مثلاً TerminalDev = Octicons, Cinema3D = Phosphor duotone).

**Engine اختيار الأيقونة**: `iconRegistry.ts` يستقبل `keyword` ويعيد component أيقونة من المكتبة المناسبة.

### 4) الاستبيان الذكي بدلاً من Form

- **حذف `IntakeForm.tsx`** من تجربة المستخدم.
- **`SmartQuestionCard.tsx` (موجود بالفعل)**: استخدامه داخل المحادثة. عند طلب توليد ملف، edge function `generate-file-questions` (جديدة) يولد 3-5 أسئلة ذكية قصيرة بلغة المستخدم (مكتشفة من النص أو من `navigator.language`).
- **مثال (طلب Resume)**: يطرح: "ما اسمك الكامل؟" → "ما تخصصك؟" → "أبرز 3 إنجازات؟" → كل سؤال بطاقة منفصلة، خيارات سريعة + حقل نص حر + زر "تخطي".
- بعد الانتهاء، تجمع الإجابات في `brief context` يمر للـbuilder.

### 5) BriefCard بدون أيقونات + لغة المستخدم

- إزالة جميع الأيقونات من `BriefCard.tsx` و`SmartQuestionCard.tsx`.
- `generate-file-brief` يستقبل `userLanguage` ويولد التقرير بنفس اللغة (auto-detect من نص المحادثة).
- استبدال الأيقونات بأرقام/نقاط نصية أنيقة.

### 6) إصلاح Builders المعطلة (Document/Resume/Report/Spreadsheet/Letter)

**السبب الجذري**: `aiSchema.ts` يستدعي edge function `generate-file-brief` بدور مزدوج (brief + schema). يحتاج فصل + JSON mode صارم + معالجة أخطاء واضحة.

**الإصلاحات لكل builder**:
- **`generate-builder-schema` (edge function جديدة)**: تستقبل `type` و`brief` وتعيد JSON صارم باستخدام `responseFormat: json_schema` على Gemini مع schema لكل نوع.
- **التخلص الكامل من HTML**: كل builder يبني الإخراج برمجياً:
  - **Document**: `@react-pdf/renderer` ينتج PDF vector حقيقي (لا html2canvas، لا jsPDF خام).
  - **Resume**: `@react-pdf/renderer` بقالب modern، صورة hero من Pexels.
  - **Report**: `@react-pdf/renderer` + `Recharts` → SVG → PDF embed.
  - **Spreadsheet**: `xlsx` (موجودة) + cell styling + formulas — يعمل، يحتاج فقط إصلاح الـschema.
  - **Letter**: `@react-pdf/renderer` بترويسة رسمية.
- **Preview داخل التطبيق**: لكل ملف، iframe يعرض blob URL من PDF (PDF.js عبر متصفح).
- **Logging**: كل builder يطبع logs في console + يعرض رسائل خطأ واضحة في الـchat إن فشل.

### 7) ترتيب التنفيذ

1. **DB Migration**: إضافة 20 قالب جديد (display_order = -25..-6)، حذف عمود `name` المتكرر إن لزم، إضافة `thumbnail_url`.
2. **Edge Functions**:
   - تحديث `generate-slides` → استدعاء Pexels لكل سلايد + حقن صور.
   - `generate-file-questions` (جديدة) → أسئلة ذكية بلغة المستخدم.
   - `generate-builder-schema` (جديدة) → JSON صارم لكل نوع ملف.
   - `generate-file-brief` → دعم `userLanguage`.
3. **Frontend Components**:
   - 20 مكون قالب جديد في `src/lib/slides/templates/`.
   - تكبير نصوص 5 قوالب موجودة + إضافة صور Pexels لها.
   - `iconRegistry.ts` (موحد لـ 100k+ أيقونة).
   - `TemplateGallery.tsx` (iOS 26 style).
   - `SmartQuestionFlow.tsx` (يستبدل IntakeForm).
   - تنظيف `BriefCard` و`SmartQuestionCard` من الأيقونات.
4. **Builders Rewrite**: إعادة كتابة 5 builders بـ `@react-pdf/renderer` (Document, Resume, Report, Letter) و`xlsx` نظيف (Spreadsheet).
5. **FilesPage Integration**: حذف floating preview button، حذف IntakeForm overlay، توصيل SmartQuestionFlow.
6. **Thumbnails**: سكريبت يولد 25 صورة JPG ويرفعها لـ`slide-images/templates/`، update DB rows.

### 8) Dependencies جديدة
- `react-icons` (100k+ أيقونة)
- `@phosphor-icons/react`
- `lottie-react`
- `roughjs` (للـSketchHand)
- `three` + `@react-three/fiber` (للـCinema3D)

PEXELS_API_KEY موجود ✓.

