import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Target, TrendingUp, AlertTriangle, Lightbulb } from "lucide-react";

interface AngleResult {
  angleId: string;
  angleName: string;
  icon: string;
  competitorsUsing: string[];
  totalCompetitors: number;
  usageRatio: number;
  category: "overused" | "balanced" | "whitespace";
  userCompanyUsesIt: boolean;
  insight: string;
  opportunityOrRisk: string;
}

interface PositioningAnalysisData {
  angles: AngleResult[];
  overused: AngleResult[];
  balanced: AngleResult[];
  whitespace: AngleResult[];
  summary: string;
  generatedAt: string;
}

function usePositioningAnalysis(companySetId: number, enabled: boolean) {
  return useQuery<PositioningAnalysisData>({
    queryKey: ["positioning-analysis", companySetId],
    queryFn: async () => {
      const res = await fetch(`/api/companies/${companySetId}/positioning-analysis`);
      if (!res.ok) throw new Error("Failed to fetch positioning analysis");
      return res.json();
    },
    enabled,
    staleTime: 1000 * 60 * 10,
  });
}

function UsageBar({ ratio, category }: { ratio: number; category: AngleResult["category"] }) {
  const pct = Math.round(ratio * 100);
  const color =
    category === "overused"
      ? "#ef4444"
      : category === "balanced"
      ? "#f59e0b"
      : "#22c55e";

  return (
    <div className="flex items-center gap-2.5 flex-1">
      <div className="flex-1 h-1.5 bg-muted/40 rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
          initial={{ width: 0 }}
          whileInView={{ width: `${pct}%` }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </div>
      <span className="text-xs font-mono font-bold tabular-nums" style={{ color }}>
        {pct}%
      </span>
    </div>
  );
}

function AngleCard({ angle, index }: { angle: AngleResult; index: number }) {
  const borderColor =
    angle.category === "overused"
      ? "border-red-500/20"
      : angle.category === "balanced"
      ? "border-amber-500/20"
      : "border-green-500/20";

  const bgGlow =
    angle.category === "overused"
      ? "bg-red-500/5"
      : angle.category === "balanced"
      ? "bg-amber-500/5"
      : "bg-green-500/5";

  const tagColor =
    angle.category === "overused"
      ? "bg-red-500/10 text-red-400 border-red-500/20"
      : angle.category === "balanced"
      ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
      : "bg-green-500/10 text-green-400 border-green-500/20";

  const tagLabel =
    angle.category === "overused"
      ? "Overused"
      : angle.category === "balanced"
      ? "Balanced"
      : "Whitespace";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: index * 0.06 }}
      className={`glass-panel rounded-2xl p-5 border ${borderColor} ${bgGlow} flex flex-col gap-3 hover:-translate-y-0.5 transition-transform duration-200`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="text-xl leading-none">{angle.icon}</span>
          <div>
            <p className="font-bold text-foreground text-sm leading-snug">{angle.angleName}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {angle.competitorsUsing.length} / {angle.totalCompetitors} competitors
            </p>
          </div>
        </div>
        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border flex-shrink-0 ${tagColor}`}>
          {tagLabel}
        </span>
      </div>

      {/* Usage bar */}
      <UsageBar ratio={angle.usageRatio} category={angle.category} />

      {/* User company indicator */}
      {angle.userCompanyUsesIt ? (
        <div className="flex items-center gap-1.5 text-[10px] font-semibold text-primary">
          <div className="w-1.5 h-1.5 rounded-full bg-primary" />
          You use this angle
        </div>
      ) : (
        <div className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground">
          <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40" />
          You don't use this angle
        </div>
      )}

      {/* Divider */}
      <div className="border-t border-border" />

      {/* Insight */}
      <p className="text-xs text-foreground/75 leading-relaxed">{angle.insight}</p>

      {/* Opportunity/Risk */}
      <div className={`rounded-xl p-3 border ${borderColor} ${bgGlow}`}>
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
          {angle.category === "whitespace" ? "Opportunity" : angle.category === "overused" ? "Risk" : "Advice"}
        </p>
        <p className="text-xs text-foreground/80 leading-relaxed">{angle.opportunityOrRisk}</p>
      </div>
    </motion.div>
  );
}

interface CategoryBlockProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  accentClass: string;
  angles: AngleResult[];
  startIndex: number;
}

function CategoryBlock({ title, description, icon, accentClass, angles, startIndex }: CategoryBlockProps) {
  if (angles.length === 0) return null;
  return (
    <div>
      <div className={`flex items-center gap-3 mb-5 pb-4 border-b border-border`}>
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${accentClass}`}>
          {icon}
        </div>
        <div>
          <h3 className="font-bold text-foreground text-lg leading-none">{title}</h3>
          <p className="text-muted-foreground text-xs mt-0.5">{description}</p>
        </div>
        <span className="ml-auto text-xs font-bold text-muted-foreground bg-muted/30 border border-border px-2 py-0.5 rounded-full">
          {angles.length}
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {angles.map((a, i) => (
          <AngleCard key={a.angleId} angle={a} index={startIndex + i} />
        ))}
      </div>
    </div>
  );
}

interface Props {
  companySetId: number;
}

export function PositioningAnalysis({ companySetId }: Props) {
  const { data, isLoading, isError } = usePositioningAnalysis(companySetId, true);

  return (
    <section className="py-32 px-6 relative overflow-hidden">
      <div className="absolute bottom-1/3 left-0 w-[45rem] h-[45rem] bg-primary/4 rounded-full blur-[140px] -z-10 pointer-events-none" />

      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-14"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold uppercase tracking-wider mb-5">
            <Target className="w-3.5 h-3.5" />
            Messaging Intelligence
          </div>
          <h2 className="text-4xl md:text-5xl font-display font-bold border-l-4 border-primary pl-6 mb-4">
            Positioning Analysis
          </h2>
          <p className="text-muted-foreground text-lg pl-6 max-w-3xl">
            Which messaging angles are saturated across competitors, which are contested, and where the untapped whitespace lies — derived from real competitor content.
          </p>
        </motion.div>

        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="glass-panel rounded-3xl p-16 text-center"
          >
            <div className="w-10 h-10 mx-auto mb-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-muted-foreground font-medium">Analyzing positioning angles...</p>
            <p className="text-muted-foreground/60 text-sm mt-1">Classifying competitor messaging across {10} angles</p>
          </motion.div>
        )}

        {isError && (
          <div className="glass-panel rounded-3xl p-10 text-center text-muted-foreground">
            <p>Could not load positioning analysis. Please try refreshing.</p>
          </div>
        )}

        {data && !isLoading && (
          <>
            {/* Summary bar */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="glass-panel rounded-2xl px-6 py-4 flex items-center gap-6 mb-10 flex-wrap"
            >
              <p className="text-sm text-muted-foreground flex-1">{data.summary}</p>
              <div className="flex items-center gap-5 flex-shrink-0">
                <Stat label="Saturated" value={data.overused.length} color="text-red-400" />
                <Stat label="Contested" value={data.balanced.length} color="text-amber-400" />
                <Stat label="Open" value={data.whitespace.length} color="text-green-400" />
              </div>
            </motion.div>

            <div className="space-y-14">
              <CategoryBlock
                title="🔴 Overused Angles"
                description="Messaging saturated across ≥60% of competitors — hard to stand out here"
                icon={<AlertTriangle className="w-4 h-4 text-red-400" />}
                accentClass="bg-red-500/10"
                angles={data.overused}
                startIndex={0}
              />
              <CategoryBlock
                title="🟡 Balanced Angles"
                description="Used by 30–60% of competitors — viable with a distinctive execution"
                icon={<TrendingUp className="w-4 h-4 text-amber-400" />}
                accentClass="bg-amber-500/10"
                angles={data.balanced}
                startIndex={data.overused.length}
              />
              <CategoryBlock
                title="🟢 Whitespace Opportunities"
                description="Underutilized across competitors — highest differentiation potential"
                icon={<Lightbulb className="w-4 h-4 text-green-400" />}
                accentClass="bg-green-500/10"
                angles={data.whitespace}
                startIndex={data.overused.length + data.balanced.length}
              />
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="text-center">
      <p className={`text-2xl font-bold font-display ${color}`}>{value}</p>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">{label}</p>
    </div>
  );
}
