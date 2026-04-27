
# إعادة تصميم صفحة الأسعار + تحديث ربط Polar

## 1) إعادة تصميم `/pricing` بالكامل (`src/pages/PricingPage.tsx`)

**الهيكل الجديد:**

- خلفية بيضاء نقية `#FFFFFF` للصفحة كلها (override للثيم الداكن في هذه الصفحة فقط).
- Hero:
  - Headline: **One AI Platform. Infinite Possibilities.** — Extra Bold, حجم كبير جداً (`text-5xl md:text-7xl`).
  - Subheadline: **Simple, transparent pricing. No hidden fees. Pay only for real usage across the entire AI ecosystem.** — رمادي داكن احترافي.
- Toggle Monthly/Yearly:
  - إطار `bg-[#F1F5F9]` rounded-full.
  - النشط: `bg-[#D1FAE5]` + نص أسود Semi-Bold.
  - عند Yearly: badge بحدود سوداء رفيعة بنص: **20% off on yearly**.

**البطاقات (4 بطاقات Solid Color edge-to-edge، rounded-[24px]):**

| Plan | BG | Text | Label | CTA |
|---|---|---|---|---|
| Starter | `#D1FAE5` | `#1A1A1A` | BEST FOR BEGINNERS (glass) | زر أسود `#000` نص أبيض — Get Started |
| Pro | `#2563EB` | `#FFFFFF` | PROFESSIONAL CHOICE (glass) | زر أبيض نص أزرق — Get Started |
| Elite | `#7C3AED` | `#FFFFFF` | MOST POPULAR (فوق البطاقة) | زر ذهبي `#FFD700` نص أسود — Get Started |
| Business | `#D97706` | `#FFFFFF` | BEST VALUE (glass) | زر أبيض نص ذهبي — Get Started |

- بطاقة Elite مرفوعة `translate-y-[-12px]` مع Outer Glow بنفسجي (`shadow-[0_0_60px_rgba(124,58,237,0.5)]`).
- داخل كل بطاقة: 6–8 فقاعات CSS متحركة (bottom→top, 5s loop) بألوان متناسقة مع البطاقة.
- Enterprise card كاملة العرض تحت البطاقات: خلفية `#0F0F0F` matte، نص أبيض بإضاءات ذهبية، زر تدرج ذهبي **Contact Sales**.

**Responsive:**
- Mobile: Stacked عمودي، touch-friendly (py-4 على الأزرار).
- Tablet: `md:grid-cols-2`.
- Desktop: `lg:grid-cols-4`.
- Fluid typography باستخدام `clamp()` للعناوين.

**Footer داخل الصفحة:**
- روابط: Terms | Privacy | Cookie Policy.
- Copyright: © 2026 Megsy AI. All Rights Reserved.
- صف أيقونات دفع موحدة اللون (Visa, Mastercard, Amex, Discover, Apple Pay, UnionPay) — SVG inline.

**Final CTA Section:**
- Headline: **Ready to Own the Future?**
- Button: ذهبي متوهج `#FFD700` بنص: **Start Your Empire Now** → ينقل لـ `/auth`.

## 2) تحديث Polar Product IDs (Frontend)

استبدال `productMap` في `PricingPage.tsx` و `PRODUCT_IDS` في `src/components/landing/PricingPreview.tsx` بالـ IDs الجديدة:

| Plan | Monthly | Yearly |
|---|---|---|
| Starter | `c3483e63-7dbd-4214-bec2-894926f5590a` | `729d9b3d-1acc-4d58-8a39-49ab63330674` |
| Pro | `8da537b0-7192-46cd-b38a-bbe341febdf7` | `bcbd0c61-a5bd-4934-872a-7413324a330c` |
| Elite | `d212d1e6-4958-4329-a1f4-5b460886fc9d` | `0b8f0aa3-57a7-4dd5-9ab3-ce68cebec7f6` |
| Business | `1fb17ce3-5bb4-473e-8c67-e50a8ce927dd` | `39752b51-d4cd-4a03-9718-bb2b95f71084` |

- تفعيل زر **Business** ليفتح Polar Checkout بدلاً من التحويل لـ `/enterprise`.
- زر **Enterprise** فقط هو الذي يفتح `/enterprise` (Contact Sales).

## 3) تحديث `supabase/functions/polar-webhook/index.ts`

استبدال `PRODUCT_MAP` بالكامل بالـ 8 IDs الجديدة + كميات MC الصحيحة:

```ts
const PRODUCT_MAP = {
  "c3483e63-...": { plan: "starter",  credits: 80   },
  "729d9b3d-...": { plan: "starter",  credits: 880  },
  "8da537b0-...": { plan: "pro",      credits: 280  },
  "bcbd0c61-...": { plan: "pro",      credits: 2480 },
  "d212d1e6-...": { plan: "elite",    credits: 480  },
  "0b8f0aa3-...": { plan: "elite",    credits: 4980 },
  "1fb17ce3-...": { plan: "business", credits: 1480 },
  "39752b51-...": { plan: "business", credits: 12980 },
};
```

ثم إعادة نشر الويبهوك (`deploy_edge_functions`).

## 4) تحديث `PricingPreview` (Landing)

- إضافة Business لقائمة `PRODUCT_IDS` لتفعيل زر Get Started.
- لا تغيير في تصميم الـ Landing — التعديل فقط على ربط الـ IDs.

## ملاحظات تقنية

- صفحة الأسعار ستفرض white background عبر wrapper `<div className="bg-white min-h-screen">` بغض النظر عن ثيم التطبيق.
- الفقاعات CSS-only (لا حاجة لـ JS) باستخدام `@keyframes` في Tailwind arbitrary values أو inline `<style>`.
- لن نلمس أي تصميم آخر في المنصة (التزاماً بـ memory: `constraints/performance-optimization`).
