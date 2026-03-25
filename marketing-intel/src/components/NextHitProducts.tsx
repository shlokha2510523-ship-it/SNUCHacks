import { useMemo } from "react";
import { motion } from "framer-motion";
import { Sparkles, DollarSign, TrendingUp, Zap } from "lucide-react";
import type { RankingsData, TrendsData, AnalysisResult } from "@workspace/api-client-react";

interface ProductIdea {
  name: string;
  tagline: string;
  strengthFeatures: string[];
  trendFeatures: string[];
  estimatedCost: number;
  suggestedPrice: number;
  profitPercent: number;
  accentColor: string;
  tier: string;
}

function buildProducts(
  rankings: RankingsData,
  trends: TrendsData,
  analysis: AnalysisResult,
  companyName: string
): ProductIdea[] {
  const strengths = rankings.userCompanyHighlights.leadingIn.slice(0, 4);
  const gaps = rankings.userCompanyHighlights.laggingIn.slice(0, 2);

  const sortedTrends = [...trends.industryTrends]
    .sort((a, b) => {
      const ra = a.relevance > 10 ? a.relevance / 10 : a.relevance;
      const rb = b.relevance > 10 ? b.relevance / 10 : b.relevance;
      return rb - ra;
    });

  const topTrendNames = sortedTrends.slice(0, 5).map((t) => t.name);
  const whitespace = trends.whitespaceOpportunities.slice(0, 3);
  const compTrendShifts = trends.competitorTrends
    .map((c) => c.recentShift)
    .filter(Boolean)
    .slice(0, 3);

  // Infer a rough price tier from the user's pricing metric score
  const pricingKey = Object.keys(rankings.byMetric).find((k) =>
    k.toLowerCase().includes("pric")
  );
  const userPricingScore = pricingKey
    ? rankings.byMetric[pricingKey]?.find((e) => e.isUserCompany)?.score ?? 50
    : 50;
  // Higher pricing score → user already sells premium → products go higher tier
  const priceTierMult = 0.7 + (userPricingScore / 100) * 0.6; // 0.7 – 1.3×

  // --- Product 1: AI-powered flagship (leverages top strengths + AI trends) ---
  const p1Cost = Math.round(195 * priceTierMult);
  const p1Price = Math.round(799 * priceTierMult);
  const p1Profit = Math.round(((p1Price - p1Cost) / p1Price) * 100);

  const product1: ProductIdea = {
    name: `${companyName} Nova AI`,
    tagline: "Your strengths, supercharged by artificial intelligence.",
    strengthFeatures: strengths.slice(0, 2).map((s) => `Industry-leading ${s}`),
    trendFeatures: [
      topTrendNames[0] ? `${topTrendNames[0]} integration` : "On-device AI engine",
      topTrendNames[1] ? `${topTrendNames[1]} suite` : "Real-time contextual intelligence",
      whitespace[0] ?? "Personalised adaptive interface",
    ],
    estimatedCost: p1Cost,
    suggestedPrice: p1Price,
    profitPercent: p1Profit,
    accentColor: "#06b6d4",
    tier: "Flagship",
  };

  // --- Product 2: Mid-range disruptor (covers gaps, rides competitor shifts) ---
  const p2Cost = Math.round(80 * priceTierMult);
  const p2Price = Math.round(349 * priceTierMult);
  const p2Profit = Math.round(((p2Price - p2Cost) / p2Price) * 100);

  const product2: ProductIdea = {
    name: `${companyName} Edge`,
    tagline: "Closing the gaps. Beating the competition where it hurts.",
    strengthFeatures: [
      strengths[0] ? `Proven ${strengths[0]} performance` : "Reliable core hardware",
      compTrendShifts[0] ? `Responds to: "${compTrendShifts[0]}"` : "Counters competitor momentum",
    ],
    trendFeatures: [
      gaps[0] ? `Rebuilt ${gaps[0]} — now best-in-class` : "Addressed key weakness",
      topTrendNames[2] ? `${topTrendNames[2]} ready` : "Future-proofed connectivity",
      whitespace[1] ?? "Untapped audience segment",
    ],
    estimatedCost: p2Cost,
    suggestedPrice: p2Price,
    profitPercent: p2Profit,
    accentColor: "#a78bfa",
    tier: "Mid-Range",
  };

  // --- Product 3: Eco / sustainability premium (future-looking) ---
  const p3Cost = Math.round(55 * priceTierMult);
  const p3Price = Math.round(249 * priceTierMult);
  const p3Profit = Math.round(((p3Price - p3Cost) / p3Price) * 100);

  const competitorInsightFeature =
    analysis.competitorInsights[0]?.trend ?? "Next-gen sustainable materials";

  const product3: ProductIdea = {
    name: `${companyName} Eco Plus`,
    tagline: "Built for tomorrow's consumer. Profitable today.",
    strengthFeatures: [
      strengths[strengths.length - 1]
        ? `Refined ${strengths[strengths.length - 1]} in an eco shell`
        : "Carbon-neutral hardware design",
      topTrendNames[3] ? `${topTrendNames[3]} built-in` : "Long-life battery ecosystem",
    ],
    trendFeatures: [
      `Leveraging competitor signal: "${competitorInsightFeature}"`,
      whitespace[2] ?? "Green-conscious positioning",
      topTrendNames[4] ? `${topTrendNames[4]} compatibility` : "Modular repairability",
    ],
    estimatedCost: p3Cost,
    suggestedPrice: p3Price,
    profitPercent: p3Profit,
    accentColor: "#34d399",
    tier: "Value / Eco",
  };

  return [product1, product2, product3];
}

interface Props {
  rankings: RankingsData;
  trends: TrendsData;
  analysis: AnalysisResult;
  companyName: string;
}

export function NextHitProducts({ rankings, trends, analysis, companyName }: Props) {
  const products = useMemo(
    () => buildProducts(rankings, trends, analysis, companyName),
    [rankings, trends, analysis, companyName]
  );

  return (
    <section className="py-32 px-6 bg-card/30 border-y border-border relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[60rem] h-[20rem] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-7xl mx-auto relative">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-16"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold uppercase tracking-wider mb-5">
            <Sparkles className="w-3.5 h-3.5" />
            AI Product Strategy
          </div>
          <h2 className="text-4xl md:text-5xl font-display font-bold border-l-4 border-primary pl-6">
            Next Hit Products
          </h2>
          <p className="text-muted-foreground text-lg mt-4 pl-6 max-w-2xl">
            Three product ideas engineered from your strengths, competitor signals, and live market trends — ready to build.
          </p>
        </motion.div>

        {/* Product cards grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {products.map((product, i) => (
            <ProductCard key={product.name} product={product} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

function ProductCard({ product, index }: { product: ProductIdea; index: number }) {
  const allFeatures = [
    ...product.strengthFeatures.map((f) => ({ text: f, type: "strength" as const })),
    ...product.trendFeatures.map((f) => ({ text: f, type: "trend" as const })),
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, delay: index * 0.15, ease: [0.16, 1, 0.3, 1] }}
      className="glass-panel rounded-3xl overflow-hidden flex flex-col group hover:-translate-y-1 transition-transform duration-300"
    >
      {/* Card top accent bar */}
      <div className="h-1 w-full" style={{ background: `linear-gradient(90deg, ${product.accentColor}99, ${product.accentColor}22)` }} />

      <div className="p-7 flex flex-col flex-1">
        {/* Tier badge */}
        <div className="flex items-center justify-between mb-5">
          <span
            className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full border"
            style={{ color: product.accentColor, borderColor: `${product.accentColor}44`, background: `${product.accentColor}11` }}
          >
            {product.tier}
          </span>
          <Zap
            className="w-4 h-4 opacity-40 group-hover:opacity-80 transition-opacity"
            style={{ color: product.accentColor }}
          />
        </div>

        {/* Product name & tagline */}
        <h3 className="text-2xl font-display font-bold text-foreground mb-2 leading-tight">
          {product.name}
        </h3>
        <p className="text-muted-foreground text-sm mb-7 leading-relaxed">
          {product.tagline}
        </p>

        {/* Feature list */}
        <div className="space-y-2.5 mb-8 flex-1">
          {allFeatures.map((feat, fi) => (
            <div key={fi} className="flex items-start gap-2.5">
              <span
                className="mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: feat.type === "strength" ? product.accentColor : "rgba(255,255,255,0.25)" }}
              />
              <span className="text-sm text-foreground/80 leading-snug">{feat.text}</span>
            </div>
          ))}
        </div>

        {/* Feature legend */}
        <div className="flex items-center gap-4 text-[10px] text-muted-foreground mb-6">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ backgroundColor: product.accentColor }} />
            Your strength
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full inline-block bg-white/25" />
            Market trend
          </span>
        </div>

        {/* Financials */}
        <div className="border-t border-border pt-5 grid grid-cols-3 gap-3">
          <FinancialStat
            icon={<DollarSign className="w-3.5 h-3.5" />}
            label="Est. Cost"
            value={`$${product.estimatedCost}`}
            color="text-muted-foreground"
          />
          <FinancialStat
            icon={<TrendingUp className="w-3.5 h-3.5" />}
            label="Sell Price"
            value={`$${product.suggestedPrice}`}
            color="text-foreground"
            accentColor={product.accentColor}
          />
          <FinancialStat
            icon={<Sparkles className="w-3.5 h-3.5" />}
            label="Profit"
            value={`${product.profitPercent}%`}
            color={product.profitPercent >= 60 ? "text-green-400" : "text-yellow-400"}
          />
        </div>
      </div>
    </motion.div>
  );
}

function FinancialStat({
  icon,
  label,
  value,
  color,
  accentColor,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
  accentColor?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold flex items-center gap-1">
        {icon}
        {label}
      </span>
      <span
        className={`text-lg font-mono font-bold ${color}`}
        style={accentColor ? { color: accentColor } : undefined}
      >
        {value}
      </span>
    </div>
  );
}
