import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Check, Building2, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import FancyButton from "@/components/FancyButton";

const plans = [
  {
    name: "Starter",
    monthlyPrice: 10,
    yearlyPrice: 99,
    monthlyCredits: "80",
    yearlyCredits: "880",
    tier: "starter" as const,
    color: "emerald",
    features: [
      "80 MC / month",
      "All chat models",
      "50 images / month",
      "5 videos / month",
      "10 code builds / month",
      "Deploy & publish",
      "GitHub sync",
      "File analysis",
      "Standard support",
    ],
    yearlyFeatures: [
      "880 MC / year",
      "All chat models",
      "50 images / month",
      "5 videos / month",
      "10 code builds / month",
      "Deploy & publish",
      "GitHub sync",
      "File analysis",
      "Standard support",
    ],
  },
  {
    name: "Pro",
    monthlyPrice: 29,
    yearlyPrice: 249,
    monthlyCredits: "280",
    yearlyCredits: "2,480",
    tier: "pro" as const,
    color: "violet",
    features: [
      "280 MC / month",
      "All AI models",
      "200 images / month",
      "20 videos / month",
      "40 code builds / month",
      "Deploy & publish",
      "GitHub sync + version control",
      "File analysis",
      "API access",
      "Priority support",
    ],
    yearlyFeatures: [
      "2,480 MC / year",
      "All AI models",
      "200 images / month",
      "20 videos / month",
      "40 code builds / month",
      "Deploy & publish",
      "GitHub sync + version control",
      "File analysis",
      "API access",
      "Priority support",
    ],
  },
  {
    name: "Elite",
    monthlyPrice: 49,
    yearlyPrice: 499,
    monthlyCredits: "480",
    yearlyCredits: "4,980",
    tier: "elite" as const,
    color: "purple",
    badge: "MOST POPULAR",
    featured: true,
    features: [
      "480 MC / month",
      "All models (priority speed)",
      "500 images / month",
      "50 videos / month",
      "80 code builds / month",
      "Deploy & publish",
      "GitHub sync + version control",
      "File analysis",
      "API access + webhooks",
      "Social publishing",
      "Dedicated support",
    ],
    yearlyFeatures: [
      "4,980 MC / year",
      "All models (priority speed)",
      "500 images / month",
      "50 videos / month",
      "80 code builds / month",
      "Deploy & publish",
      "GitHub sync + version control",
      "File analysis",
      "API access + webhooks",
      "Social publishing",
      "Dedicated support",
    ],
  },
  {
    name: "Business",
    monthlyPrice: 149,
    yearlyPrice: 1299,
    monthlyCredits: "1,480",
    yearlyCredits: "12,980",
    tier: "business" as const,
    color: "rose",
    badge: "BUSINESS",
    features: [
      "1,480 MC / month",
      "All models with priority speed",
      "2,000 images / month",
      "200 videos / month",
      "300 code builds / month",
      "Dedicated infrastructure",
      "SLA guarantees",
      "Custom API integrations",
      "Dedicated account manager",
      "Data privacy & compliance",
      "Advanced analytics",
      "Volume discounts",
    ],
    yearlyFeatures: [
      "12,980 MC / year",
      "All models with priority speed",
      "2,000 images / month",
      "200 videos / month",
      "300 code builds / month",
      "Dedicated infrastructure",
      "SLA guarantees",
      "Custom API integrations",
      "Dedicated account manager",
      "Data privacy & compliance",
      "Advanced analytics",
      "Volume discounts",
    ],
  },
];

const enterpriseFeatures = [
  "Custom MC Allocation",
  "All Models with Priority Speed",
  "Dedicated Infrastructure",
  "SLA Guarantees",
  "Custom API Access & Integrations",
  "Enterprise Security (SOC2, GDPR)",
  "Data Privacy & Compliance",
  "Early Access to New AI Models",
  "Advanced Analytics & Reporting",
  "Dedicated Account Manager",
  "24/7 Priority Support",
  "Priority Onboarding & Training",
  "Monthly Business Reviews",
  "Volume Discounts",
  "Custom Contract & Invoicing",
];

const tierStyles: Record<string, { gradient: string; check: string; border: string; glow: string }> = {
  starter: {
    gradient: "from-emerald-500/10 via-emerald-900/5 to-transparent",
    check: "text-emerald-400",
    border: "border-emerald-500/15 hover:border-emerald-500/30",
    glow: "rgba(16,185,129,0.06)",
  },
  pro: {
    gradient: "from-violet-500/10 via-violet-900/5 to-transparent",
    check: "text-violet-400",
    border: "border-violet-500/15 hover:border-violet-500/30",
    glow: "rgba(139,92,246,0.06)",
  },
  elite: {
    gradient: "from-purple-500/15 via-purple-900/8 to-transparent",
    check: "text-purple-300",
    border: "border-purple-500/30 hover:border-purple-500/50",
    glow: "rgba(168,85,247,0.1)",
  },
  business: {
    gradient: "from-rose-500/10 via-rose-900/5 to-transparent",
    check: "text-rose-400",
    border: "border-rose-500/15 hover:border-rose-500/30",
    glow: "rgba(244,63,94,0.06)",
  },
};

const PricingPage = () => {
  const navigate = useNavigate();
  const [isYearly, setIsYearly] = useState(false);
  const [loadingTier, setLoadingTier] = useState<string | null>(null);

  const handleSubscribe = async (tier: string) => {
    if (tier === "business") {
      navigate("/enterprise");
      return;
    }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth?redirect=/pricing");
      return;
    }
    setLoadingTier(tier);
    try {
      const productMap: Record<string, { monthly?: string; yearly?: string }> = {
        starter: {
          monthly: import.meta.env.VITE_POLAR_STARTER_MONTHLY,
          yearly: import.meta.env.VITE_POLAR_STARTER_YEARLY,
        },
        pro: {
          monthly: import.meta.env.VITE_POLAR_PRO_MONTHLY,
          yearly: import.meta.env.VITE_POLAR_PRO_YEARLY,
        },
        elite: {
          monthly: import.meta.env.VITE_POLAR_ELITE_MONTHLY,
          yearly: import.meta.env.VITE_POLAR_ELITE_YEARLY,
        },
      };
      const product_id = isYearly ? productMap[tier]?.yearly : productMap[tier]?.monthly;
      if (!product_id) {
        toast.error("هذا المنتج غير مفعّل في Polar بعد. أنشئه من لوحة Polar وأضف الـ Product ID.");
        setLoadingTier(null);
        return;
      }
      const { data, error } = await supabase.functions.invoke("polar-checkout", {
        body: { product_id, plan: tier },
      });
      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data?.error || "Checkout failed");
      }
    } catch (e: any) {
      toast.error(e.message || "حدث خطأ أثناء فتح صفحة الدفع");
      setLoadingTier(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="flex items-center gap-3 px-4 py-4 max-w-7xl mx-auto">
        <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-display text-lg font-bold text-foreground">Pricing</h1>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-12">
          <h2 className="font-display text-4xl md:text-5xl font-black mb-3 text-foreground tracking-tight">
            Simple, Transparent Pricing
          </h2>
          <p className="text-muted-foreground text-base mb-8 max-w-lg mx-auto">
            Every MC is real value. No hidden fees. No "unlimited" gimmicks.
          </p>

          <div className="inline-flex items-center gap-1 bg-secondary rounded-full p-1">
            <button
              onClick={() => setIsYearly(false)}
              className={`px-6 py-2.5 rounded-full text-sm font-medium transition-all ${!isYearly ? "bg-primary text-primary-foreground shadow-lg" : "text-muted-foreground hover:text-foreground"}`}
            >
              Monthly
            </button>
            <button
              onClick={() => setIsYearly(true)}
              className={`inline-flex items-center gap-1.5 px-6 py-2.5 rounded-full text-sm font-medium transition-all ${isYearly ? "bg-primary text-primary-foreground shadow-lg" : "text-muted-foreground hover:text-foreground"}`}
            >
              Yearly
              <span className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 leading-none whitespace-nowrap font-bold">
                Save ~17%
              </span>
            </button>
          </div>
        </motion.div>

        {/* Plan Cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5 items-start">
          {plans.map((plan, i) => {
            const style = tierStyles[plan.tier];
            const price = isYearly ? plan.yearlyPrice : plan.monthlyPrice;
            const features = isYearly ? plan.yearlyFeatures : plan.features;
            const isFeatured = plan.featured;

            return (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                className={`relative rounded-2xl border p-6 flex flex-col gap-4 transition-all duration-300 bg-gradient-to-b ${style.gradient} ${style.border} ${
                  isFeatured ? "md:scale-105 z-10 shadow-xl ring-1 ring-purple-500/20" : ""
                }`}
                style={{ backgroundImage: `radial-gradient(ellipse at top right, ${style.glow}, transparent 60%)` }}
              >
                {plan.badge && (
                  <span className={`absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] font-bold px-4 py-1 rounded-full uppercase tracking-wider ${
                    isFeatured ? "bg-purple-500 text-white shadow-lg shadow-purple-500/30" : "bg-rose-500/20 text-rose-300 border border-rose-500/20"
                  }`}>
                    {plan.badge}
                  </span>
                )}

                <div>
                  <h3 className="font-display font-bold text-foreground text-lg">{plan.name}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {isYearly ? plan.yearlyCredits : plan.monthlyCredits} MC
                  </p>
                </div>

                <div className="flex items-baseline gap-1">
                  <span className="font-display text-4xl font-black text-foreground">${price}</span>
                  <span className="text-sm text-muted-foreground">/{isYearly ? "year" : "month"}</span>
                </div>

                {isFeatured ? (
                  <FancyButton
                    onClick={() => handleSubscribe(plan.tier)}
                    disabled={loadingTier === plan.tier}
                    className="w-full py-3 text-sm"
                  >
                    {loadingTier === plan.tier ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Get Started"}
                  </FancyButton>
                ) : (
                  <button
                    onClick={() => handleSubscribe(plan.tier)}
                    disabled={loadingTier === plan.tier}
                    className="w-full py-3 rounded-xl font-medium text-sm transition-all border border-border bg-secondary/50 hover:bg-secondary text-foreground disabled:opacity-50"
                  >
                    {loadingTier === plan.tier ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : (plan.tier === "business" ? "Contact Sales" : "Get Started")}
                  </button>
                )}

                <ul className="space-y-2.5 mt-2">
                  {features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <Check className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${style.check}`} />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            );
          })}
        </div>

        {/* Enterprise */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-10"
        >
          <div className="relative rounded-3xl border border-cyan-500/20 p-8 md:p-10 overflow-hidden bg-gradient-to-br from-cyan-950/30 via-background to-indigo-950/20">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_rgba(6,182,212,0.08),transparent_50%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_rgba(99,102,241,0.06),transparent_50%)]" />

            <div className="relative z-10">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-8 mb-8">
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-400 to-indigo-500 flex items-center justify-center">
                      <Building2 className="w-4 h-4 text-white" />
                    </div>
                    <h3 className="font-display text-2xl font-black text-foreground">Enterprise</h3>
                  </div>
                  <p className="text-muted-foreground max-w-xl">
                    Custom plans for large teams — dedicated infrastructure, advanced security, SLA guarantees, and a dedicated account manager.
                  </p>
                </div>
                <button
                  onClick={() => navigate("/enterprise")}
                  className="shrink-0 px-8 py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-500 text-white font-semibold text-sm hover:opacity-90 transition-opacity shadow-lg shadow-cyan-500/20"
                >
                  Contact Sales
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {enterpriseFeatures.map((text, i) => (
                  <div key={i} className="flex items-center gap-2.5 text-sm text-muted-foreground">
                    <Check className="w-3.5 h-3.5 shrink-0 text-cyan-400" />
                    <span>{text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default PricingPage;
