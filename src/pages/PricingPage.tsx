import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Check, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import FancyButton from "@/components/FancyButton";
import LandingNavbar from "@/components/landing/LandingNavbar";
import LandingFooter from "@/components/landing/LandingFooter";

type PlanTier = "starter" | "pro" | "elite" | "business";

const PRODUCT_MAP: Record<PlanTier, { monthly: string; yearly: string }> = {
  starter: {
    monthly: "c3483e63-7dbd-4214-bec2-894926f5590a",
    yearly: "729d9b3d-1acc-4d58-8a39-49ab63330674",
  },
  pro: {
    monthly: "8da537b0-7192-46cd-b38a-bbe341febdf7",
    yearly: "bcbd0c61-a5bd-4934-872a-7413324a330c",
  },
  elite: {
    monthly: "d212d1e6-4958-4329-a1f4-5b460886fc9d",
    yearly: "0b8f0aa3-57a7-4dd5-9ab3-ce68cebec7f6",
  },
  business: {
    monthly: "1fb17ce3-5bb4-473e-8c67-e50a8ce927dd",
    yearly: "39752b51-d4cd-4a03-9718-bb2b95f71084",
  },
};

interface PlanCardConfig {
  tier: PlanTier;
  name: string;
  monthlyPrice: number;
  yearlyPrice: number;
  monthlyCredits: string;
  yearlyCredits: string;
  description: string;
  features: string[];
  highlight?: boolean;
  cardBorder: string;
  cardBg: string;
  checkColor: string;
  nameColor: string;
}

const PLANS: PlanCardConfig[] = [
  {
    tier: "starter",
    name: "Starter",
    monthlyPrice: 9,
    yearlyPrice: 89,
    monthlyCredits: "80 MC / month",
    yearlyCredits: "880 MC / year",
    description: "Great for getting started with AI creation",
    features: [
      "All chat models",
      "50 images / month",
      "5 videos / month",
      "10 code builds / month",
      "Deploy & publish",
      "Standard support",
    ],
    cardBorder: "border-emerald-500/[0.12]",
    cardBg: "bg-gradient-to-b from-emerald-500/[0.06] to-transparent",
    checkColor: "text-emerald-400",
    nameColor: "text-emerald-400",
  },
  {
    tier: "pro",
    name: "Pro",
    monthlyPrice: 29,
    yearlyPrice: 249,
    monthlyCredits: "280 MC / month",
    yearlyCredits: "2,480 MC / year",
    description: "For creators who need more power",
    features: [
      "All AI models",
      "200 images / month",
      "20 videos / month",
      "40 code builds / month",
      "API access",
      "Priority support",
    ],
    cardBorder: "border-violet-500/[0.12]",
    cardBg: "bg-gradient-to-b from-violet-500/[0.06] to-transparent",
    checkColor: "text-violet-400",
    nameColor: "text-violet-400",
  },
  {
    tier: "elite",
    name: "Elite",
    monthlyPrice: 49,
    yearlyPrice: 499,
    monthlyCredits: "480 MC / month",
    yearlyCredits: "4,980 MC / year",
    description: "Maximum power for serious professionals",
    features: [
      "All models (priority speed)",
      "500 images / month",
      "50 videos / month",
      "80 code builds / month",
      "API + webhooks",
      "Dedicated support",
    ],
    highlight: true,
    cardBorder: "border-purple-500/30",
    cardBg: "bg-gradient-to-b from-purple-500/[0.12] to-purple-900/[0.06]",
    checkColor: "text-purple-400",
    nameColor: "text-purple-400",
  },
  {
    tier: "business",
    name: "Business",
    monthlyPrice: 149,
    yearlyPrice: 1299,
    monthlyCredits: "1,480 MC / month",
    yearlyCredits: "12,980 MC / year",
    description: "Dedicated infra, SLA & account manager",
    features: [
      "All models with priority speed",
      "2,000 images / month",
      "200 videos / month",
      "300 code builds / month",
      "Dedicated infrastructure",
      "SLA guarantees",
      "Dedicated account manager",
    ],
    cardBorder: "border-rose-500/20",
    cardBg: "bg-gradient-to-br from-rose-950/30 via-transparent to-pink-950/20",
    checkColor: "text-rose-400",
    nameColor: "text-rose-400",
  },
];

const TINY_BUBBLES = Array.from({ length: 10 });

const PaymentBrandIcons = () => {
  const base = "h-7 sm:h-8 w-auto opacity-80 hover:opacity-100 transition-opacity";
  return (
    <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-5">
      <img alt="Visa" className={base} src="https://upload.wikimedia.org/wikipedia/commons/5/5e/Visa_Inc._logo.svg" />
      <img alt="Mastercard" className={base} src="https://upload.wikimedia.org/wikipedia/commons/2/2a/Mastercard-logo.svg" />
      <img alt="American Express" className={base} src="https://upload.wikimedia.org/wikipedia/commons/f/fa/American_Express_logo_%282018%29.svg" />
      <img alt="Discover" className={base} src="https://upload.wikimedia.org/wikipedia/commons/5/57/Discover_Card_logo.svg" />
      <img alt="Apple Pay" className={base} src="https://upload.wikimedia.org/wikipedia/commons/b/b0/Apple_Pay_logo.svg" />
      <img alt="UnionPay" className={base} src="https://upload.wikimedia.org/wikipedia/commons/1/1b/UnionPay_logo.svg" />
    </div>
  );
};

const PricingPage = () => {
  const navigate = useNavigate();
  const [isYearly, setIsYearly] = useState(false);
  const [loadingTier, setLoadingTier] = useState<PlanTier | null>(null);

  const handleSubscribe = async (tier: PlanTier) => {
    const product_id = isYearly ? PRODUCT_MAP[tier].yearly : PRODUCT_MAP[tier].monthly;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth?redirect=/pricing");
      return;
    }
    setLoadingTier(tier);
    try {
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
      toast.error(e.message || "Failed to open checkout");
      setLoadingTier(null);
    }
  };

  return (
    <div data-theme="dark" className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <LandingNavbar />

      {/* Tiny bubbles styling — small but eye-catching */}
      <style>{`
        @keyframes tiny-bubble-rise {
          0%   { transform: translateY(0) scale(0.6); opacity: 0; }
          15%  { opacity: 0.9; }
          85%  { opacity: 0.5; }
          100% { transform: translateY(-140px) scale(1); opacity: 0; }
        }
        .tiny-bubble {
          position: absolute;
          border-radius: 9999px;
          pointer-events: none;
          will-change: transform, opacity;
          animation: tiny-bubble-rise 4.5s ease-in-out infinite;
          filter: blur(0.3px);
        }
      `}</style>

      <section className="relative overflow-hidden pt-28 md:pt-36 pb-10">
        <div className="mx-auto max-w-6xl px-6 text-center">
          <button
            onClick={() => navigate(-1)}
            className="mb-6 inline-flex items-center gap-2 text-white/50 hover:text-white transition-colors text-sm"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>

          <motion.h1
            initial={{ opacity: 0, y: 60 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9 }}
            className="font-display text-[10vw] font-black uppercase tracking-tighter leading-[0.85] text-white md:text-[8vw]"
          >
            ONE AI{" "}
            <span className="bg-gradient-to-r from-purple-400 to-fuchsia-400 bg-clip-text text-transparent">
              PLATFORM
            </span>
          </motion.h1>
          <p className="mx-auto mt-4 max-w-xl text-xl text-white/40">
            Simple, transparent pricing. No hidden fees. Pay only for real usage across the entire AI ecosystem.
          </p>

          {/* Toggle */}
          <div className="mt-8 inline-flex items-center gap-1 p-1 rounded-full border border-white/10 bg-white/[0.03] backdrop-blur-sm">
            <button
              onClick={() => setIsYearly(false)}
              className={`px-5 sm:px-7 py-2.5 rounded-full text-sm transition-all ${
                !isYearly
                  ? "bg-white text-black font-semibold shadow-sm"
                  : "text-white/50 hover:text-white font-medium"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setIsYearly(true)}
              className={`inline-flex items-center gap-2 px-5 sm:px-7 py-2.5 rounded-full text-sm transition-all ${
                isYearly
                  ? "bg-white text-black font-semibold shadow-sm"
                  : "text-white/50 hover:text-white font-medium"
              }`}
            >
              Yearly
              <span className={`text-[10px] sm:text-[11px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${
                isYearly ? "bg-emerald-500/20 text-emerald-700" : "bg-emerald-500/15 text-emerald-300"
              }`}>
                20% off
              </span>
            </button>
          </div>
        </div>
      </section>

      {/* Plans grid — first 3 */}
      <section className="mx-auto max-w-6xl px-6 pb-10">
        <div className="grid gap-6 md:grid-cols-3 pt-8">
          {PLANS.slice(0, 3).map((plan, i) => {
            const price = isYearly ? plan.yearlyPrice : plan.monthlyPrice;
            const credits = isYearly ? plan.yearlyCredits : plan.monthlyCredits;
            return (
              <motion.div
                key={plan.tier}
                initial={{ opacity: 0, y: 80 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.7, delay: i * 0.12 }}
                className={`relative rounded-2xl border p-6 transition-all duration-300 hover:scale-[1.02] md:rounded-3xl md:p-9 ${plan.cardBorder} ${plan.cardBg} ${
                  plan.highlight ? "shadow-xl shadow-purple-500/10 ring-1 ring-purple-500/20 md:mt-8" : ""
                }`}
              >
                {plan.highlight && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-20 rounded-full bg-purple-500 px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-lg shadow-purple-500/40 whitespace-nowrap">
                    Most Popular
                  </div>
                )}

                {/* Tiny bubbles inside the card */}
                <div className="absolute inset-0 overflow-hidden rounded-2xl md:rounded-3xl pointer-events-none">
                  {TINY_BUBBLES.map((_, b) => {
                    const size = 3 + ((b * 2) % 5);
                    const left = (b * 31) % 92;
                    const delay = (b * 0.55) % 4.5;
                    return (
                      <span
                        key={b}
                        className="tiny-bubble"
                        style={{
                          width: size,
                          height: size,
                          left: `${left}%`,
                          bottom: `-${size}px`,
                          background: plan.highlight
                            ? "rgba(192,132,252,0.7)"
                            : plan.tier === "starter"
                            ? "rgba(52,211,153,0.6)"
                            : "rgba(167,139,250,0.6)",
                          animationDelay: `${delay}s`,
                          animationDuration: `${4 + (b % 3)}s`,
                        }}
                      />
                    );
                  })}
                </div>

                <div className="relative z-10">
                  <h3 className={`text-lg font-bold ${plan.nameColor}`}>{plan.name}</h3>
                  <div className="mt-2 flex items-baseline gap-1 md:mt-3">
                    <span className="text-4xl font-black text-white md:text-5xl">${price}</span>
                    <span className="text-base text-white/40">/{isYearly ? "yr" : "mo"}</span>
                  </div>
                  <p className="mt-1.5 text-xs text-white/30">{credits}</p>
                  <p className="mt-3 text-sm leading-relaxed text-white/40">{plan.description}</p>

                  <ul className="mt-8 space-y-3">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-center gap-3 text-base text-white/60">
                        <Check size={16} className={`shrink-0 ${plan.checkColor}`} />
                        {f}
                      </li>
                    ))}
                  </ul>

                  <div className="mt-9">
                    {plan.highlight ? (
                      <FancyButton onClick={() => handleSubscribe(plan.tier)} className="w-full py-3 text-base">
                        {loadingTier === plan.tier ? (
                          <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                        ) : (
                          "Get Started"
                        )}
                      </FancyButton>
                    ) : (
                      <button
                        onClick={() => handleSubscribe(plan.tier)}
                        disabled={loadingTier === plan.tier}
                        className="w-full rounded-xl border border-white/15 py-3 text-base font-medium text-white/70 transition-all hover:border-white/30 hover:text-white disabled:opacity-50"
                      >
                        {loadingTier === plan.tier ? (
                          <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                        ) : (
                          "Get Started"
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Business + Enterprise */}
        <div className="grid gap-6 md:grid-cols-2 mt-8">
          {/* Business */}
          <motion.div
            initial={{ opacity: 0, y: 80 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.4 }}
            className="relative overflow-hidden rounded-2xl border border-rose-500/20 p-6 md:rounded-3xl md:p-9 bg-gradient-to-br from-rose-950/30 via-transparent to-pink-950/20"
          >
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(244,63,94,0.06),transparent_50%)] rounded-2xl md:rounded-3xl" />
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              {TINY_BUBBLES.map((_, b) => {
                const size = 3 + ((b * 2) % 5);
                const left = (b * 31) % 92;
                const delay = (b * 0.55) % 4.5;
                return (
                  <span
                    key={b}
                    className="tiny-bubble"
                    style={{
                      width: size,
                      height: size,
                      left: `${left}%`,
                      bottom: `-${size}px`,
                      background: "rgba(251,113,133,0.55)",
                      animationDelay: `${delay}s`,
                      animationDuration: `${4 + (b % 3)}s`,
                    }}
                  />
                );
              })}
            </div>
            <div className="relative z-10">
              <h3 className="text-lg font-bold text-rose-400">Business</h3>
              <div className="flex items-baseline gap-1 mt-2">
                <span className="text-4xl font-black text-white md:text-5xl">
                  ${isYearly ? PLANS[3].yearlyPrice : PLANS[3].monthlyPrice}
                </span>
                <span className="text-base text-white/40">/{isYearly ? "yr" : "mo"}</span>
              </div>
              <p className="mt-1.5 text-xs text-white/30">
                {isYearly ? PLANS[3].yearlyCredits : PLANS[3].monthlyCredits}
              </p>
              <p className="mt-3 text-sm leading-relaxed text-white/40">
                Dedicated infrastructure, SLA guarantees, and a dedicated account manager.
              </p>
              <button
                onClick={() => handleSubscribe("business")}
                disabled={loadingTier === "business"}
                className="mt-6 w-full rounded-xl border border-rose-500/20 bg-rose-500/10 px-8 py-3 text-base font-medium text-rose-300 transition-all hover:bg-rose-500/20 hover:border-rose-500/30 disabled:opacity-50"
              >
                {loadingTier === "business" ? (
                  <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                ) : (
                  "Get Started"
                )}
              </button>
            </div>
          </motion.div>

          {/* Enterprise */}
          <motion.div
            initial={{ opacity: 0, y: 80 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.5 }}
            className="relative rounded-2xl border border-cyan-500/20 p-6 md:rounded-3xl md:p-9 bg-gradient-to-br from-cyan-950/30 via-transparent to-indigo-950/20"
          >
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(6,182,212,0.06),transparent_50%)] rounded-2xl md:rounded-3xl" />
            <div className="relative z-10">
              <h3 className="text-lg font-bold text-cyan-400">Enterprise</h3>
              <p className="mt-3 text-sm leading-relaxed text-white/40 max-w-lg">
                Custom plans for large teams — dedicated infrastructure, advanced security, SLA, and everything your organization needs.
              </p>
              <button
                onClick={() => navigate("/enterprise")}
                className="mt-6 w-full rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-500 px-8 py-3 text-base font-medium text-white transition-all hover:opacity-90 shadow-lg shadow-cyan-500/20"
              >
                Contact Sales
              </button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="mx-auto max-w-4xl px-6 py-20 text-center">
        <motion.h3
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="font-display text-[8vw] md:text-[5vw] font-black uppercase tracking-tighter leading-[0.9] text-white"
        >
          READY TO OWN <span className="bg-gradient-to-r from-purple-400 to-fuchsia-400 bg-clip-text text-transparent">THE FUTURE?</span>
        </motion.h3>
        <div className="mt-8 inline-block">
          <FancyButton onClick={() => navigate("/auth")} className="px-10 py-4 text-lg">
            Start Your Empire Now
          </FancyButton>
        </div>
      </section>

      {/* Payment brand icons */}
      <section className="mx-auto max-w-5xl px-6 pb-14">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-sm p-6 md:p-8">
          <p className="text-center text-xs uppercase tracking-[0.2em] text-white/40 mb-5">
            Secure payments
          </p>
          <PaymentBrandIcons />
        </div>
      </section>

      <LandingFooter />
    </div>
  );
};

export default PricingPage;
