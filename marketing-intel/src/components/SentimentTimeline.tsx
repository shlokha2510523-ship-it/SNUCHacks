import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from "recharts";
import { TrendingUp, TrendingDown, Minus, Activity, Info, Sparkles } from "lucide-react";

const COMPANY_COLORS = ["#06b6d4", "#818cf8", "#f472b6", "#34d399", "#fb923c"];
const GRID_COLOR = "rgba(255,255,255,0.05)";
const AXIS_COLOR = "rgba(255,255,255,0.25)";

interface TimelinePoint {
  month: string;
  monthKey: string;
  sentimentScore: number;
  reviewCount: number;
  positivePercent: number;
  negativePercent: number;
  adActivity: number;
  priceSignal: "stable" | "increased" | "decreased";
  keyEvent: string | null;
}

interface CompanyTimeline {
  companyId: number;
  companyName: string;
  isUserCompany: boolean;
  sentimentTrend: "improving" | "declining" | "stable";
  correlationInsights: string[];
  timeline: TimelinePoint[];
}

interface TimelineData {
  companies: CompanyTimeline[];
  overallInsights: string[];
  dataNote: string;
  generatedAt: string;
}

function useTimeline(companySetId: number, enabled: boolean) {
  return useQuery<TimelineData>({
    queryKey: ["timeline", companySetId],
    queryFn: async () => {
      const res = await fetch(`/api/companies/${companySetId}/timeline`);
      if (!res.ok) throw new Error("Failed to fetch timeline");
      return res.json();
    },
    enabled,
    staleTime: 1000 * 60 * 10,
  });
}

function TrendBadge({ trend }: { trend: "improving" | "declining" | "stable" }) {
  if (trend === "improving") return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-500/10 text-green-400 border border-green-500/20">
      <TrendingUp className="w-3 h-3" /> Improving
    </span>
  );
  if (trend === "declining") return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-500/10 text-red-400 border border-red-500/20">
      <TrendingDown className="w-3 h-3" /> Declining
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-muted/30 text-muted-foreground border border-border">
      <Minus className="w-3 h-3" /> Stable
    </span>
  );
}

function PriceSignalDot({ signal }: { signal: "stable" | "increased" | "decreased" }) {
  if (signal === "increased") return <span className="text-red-400 font-bold text-xs">▲</span>;
  if (signal === "decreased") return <span className="text-green-400 font-bold text-xs">▼</span>;
  return null;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string;
  companies: CompanyTimeline[];
}

function CustomTooltip({ active, payload, label, companies }: CustomTooltipProps) {
  if (!active || !payload?.length || !label) return null;
  const monthData = companies[0]?.timeline.find((t) => t.month === label);

  return (
    <div className="bg-card/98 border border-border rounded-2xl p-4 shadow-2xl backdrop-blur-md text-sm min-w-[220px] max-w-xs">
      <p className="font-bold text-foreground mb-3 text-base border-b border-border pb-2">{label}</p>
      <div className="space-y-2">
        {payload.map((entry: any) => {
          const company = companies.find((c) => c.companyName === entry.name);
          const monthPt = company?.timeline.find((t) => t.month === label);
          return (
            <div key={entry.name} className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-1.5 flex-1">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: entry.color }} />
                <span className="text-muted-foreground truncate">{entry.name}</span>
                {monthPt?.priceSignal !== "stable" && (
                  <PriceSignalDot signal={monthPt?.priceSignal ?? "stable"} />
                )}
              </div>
              <span className="font-mono font-bold" style={{ color: entry.color }}>
                {entry.value}
              </span>
            </div>
          );
        })}
      </div>
      {monthData?.keyEvent && (
        <div className="mt-3 pt-2 border-t border-border text-xs text-muted-foreground leading-relaxed">
          <span className="text-primary font-semibold">Event: </span>
          {monthData.keyEvent}
        </div>
      )}
    </div>
  );
}

function buildChartData(companies: CompanyTimeline[]) {
  if (!companies.length || !companies[0].timeline.length) return [];
  return companies[0].timeline.map((pt, i) => {
    const point: Record<string, any> = { month: pt.month };
    for (const company of companies) {
      const cp = company.timeline[i];
      if (cp) {
        point[company.companyName] = cp.sentimentScore;
        point[`${company.companyName}_adActivity`] = cp.adActivity;
        point[`${company.companyName}_priceSignal`] = cp.priceSignal;
      }
    }
    return point;
  });
}

function buildEventsList(companies: CompanyTimeline[]) {
  const events: { month: string; companyName: string; event: string; isUser: boolean; color: string }[] = [];
  companies.forEach((c, ci) => {
    c.timeline.forEach((pt) => {
      if (pt.keyEvent) {
        events.push({
          month: pt.month,
          companyName: c.companyName,
          event: pt.keyEvent,
          isUser: c.isUserCompany,
          color: COMPANY_COLORS[ci % COMPANY_COLORS.length],
        });
      }
    });
  });
  return events;
}

interface Props {
  companySetId: number;
}

export function SentimentTimeline({ companySetId }: Props) {
  const { data, isLoading, isError } = useTimeline(companySetId, true);
  const [activeTab, setActiveTab] = useState<"sentiment" | "ad-activity">("sentiment");
  const [selectedCompany, setSelectedCompany] = useState<number | null>(null);

  const companies = data?.companies ?? [];
  const chartData = buildChartData(companies);
  const keyEvents = buildEventsList(companies);

  const displayedCompanies = selectedCompany === null
    ? companies
    : companies.filter((c) => c.companyId === selectedCompany);

  const focusedCompany = selectedCompany !== null
    ? companies.find((c) => c.companyId === selectedCompany)
    : null;

  return (
    <section className="py-32 px-6 relative overflow-hidden">
      <div className="absolute top-1/3 right-0 w-[50rem] h-[50rem] bg-primary/5 rounded-full blur-[150px] -z-10 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[40rem] h-[40rem] bg-secondary/5 rounded-full blur-[120px] -z-10 pointer-events-none" />

      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-14"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary/10 border border-secondary/20 text-secondary text-xs font-bold uppercase tracking-wider mb-5">
            <Activity className="w-3.5 h-3.5" />
            Sentiment Intelligence
          </div>
          <h2 className="text-4xl md:text-5xl font-display font-bold border-l-4 border-secondary pl-6 mb-4">
            12-Month Sentiment Timeline
          </h2>
          <p className="text-muted-foreground text-lg pl-6 max-w-3xl">
            AI-synthesized customer sentiment, ad campaign intensity, and pricing signals across all brands — correlating review trends with marketing activity.
          </p>
        </motion.div>

        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="glass-panel rounded-3xl p-16 text-center"
          >
            <div className="w-12 h-12 mx-auto mb-4 border-2 border-secondary border-t-transparent rounded-full animate-spin" />
            <p className="text-muted-foreground font-medium">Synthesizing sentiment intelligence...</p>
            <p className="text-muted-foreground/60 text-sm mt-2">AI is building 12-month timelines for all brands</p>
          </motion.div>
        )}

        {isError && (
          <div className="glass-panel rounded-3xl p-10 text-center text-muted-foreground">
            <p>Could not load timeline data. Please try refreshing.</p>
          </div>
        )}

        {data && !isLoading && (
          <>
            {/* Company selector */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="flex flex-wrap gap-3 mb-8"
            >
              <button
                onClick={() => setSelectedCompany(null)}
                className={`px-4 py-2 rounded-full text-sm font-semibold transition-all border ${
                  selectedCompany === null
                    ? "bg-foreground text-background border-foreground"
                    : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                }`}
              >
                All Brands
              </button>
              {companies.map((c, i) => {
                const color = COMPANY_COLORS[i % COMPANY_COLORS.length];
                const isActive = selectedCompany === c.companyId;
                return (
                  <button
                    key={c.companyId}
                    onClick={() => setSelectedCompany(isActive ? null : c.companyId)}
                    className={`px-4 py-2 rounded-full text-sm font-semibold transition-all border ${
                      isActive ? "text-background border-transparent" : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                    style={isActive ? { backgroundColor: color, borderColor: color } : { borderColor: undefined }}
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}88` }}
                      />
                      {c.companyName}
                      {c.isUserCompany && <span className="opacity-60 text-xs">(You)</span>}
                    </span>
                  </button>
                );
              })}
            </motion.div>

            {/* Chart Tabs */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="glass-panel rounded-3xl p-6 md:p-8 mb-8"
            >
              <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
                <div className="flex gap-1 p-1 bg-muted/30 rounded-xl border border-border">
                  <button
                    onClick={() => setActiveTab("sentiment")}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                      activeTab === "sentiment"
                        ? "bg-card text-foreground shadow-sm border border-border"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Review Sentiment
                  </button>
                  <button
                    onClick={() => setActiveTab("ad-activity")}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                      activeTab === "ad-activity"
                        ? "bg-card text-foreground shadow-sm border border-border"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Ad Activity
                  </button>
                </div>

                <div className="flex flex-wrap gap-4">
                  {displayedCompanies.map((c, i) => {
                    const color = COMPANY_COLORS[
                      companies.findIndex((cc) => cc.companyId === c.companyId) % COMPANY_COLORS.length
                    ];
                    return (
                      <div key={c.companyId} className="flex items-center gap-2">
                        <div className="w-3 h-0.5 rounded-full" style={{ backgroundColor: color }} />
                        <span className="text-xs text-muted-foreground font-medium">
                          {c.companyName}
                          {c.isUserCompany && <span className="text-primary ml-1">(You)</span>}
                        </span>
                        <TrendBadge trend={c.sentimentTrend} />
                      </div>
                    );
                  })}
                </div>
              </div>

              <ResponsiveContainer width="100%" height={380}>
                <AreaChart data={chartData} margin={{ top: 10, right: 20, bottom: 0, left: -10 }}>
                  <defs>
                    {displayedCompanies.map((c, i) => {
                      const color = COMPANY_COLORS[
                        companies.findIndex((cc) => cc.companyId === c.companyId) % COMPANY_COLORS.length
                      ];
                      return (
                        <linearGradient key={c.companyId} id={`gradient-${c.companyId}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={color} stopOpacity={0.25} />
                          <stop offset="95%" stopColor={color} stopOpacity={0.02} />
                        </linearGradient>
                      );
                    })}
                  </defs>
                  <CartesianGrid stroke={GRID_COLOR} strokeDasharray="3 6" />
                  <XAxis
                    dataKey="month"
                    tick={{ fill: AXIS_COLOR, fontSize: 11 }}
                    axisLine={{ stroke: AXIS_COLOR }}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fill: AXIS_COLOR, fontSize: 11 }}
                    axisLine={{ stroke: AXIS_COLOR }}
                    tickLine={false}
                    tickFormatter={(v) => `${v}`}
                  />
                  <ReferenceLine y={50} stroke="rgba(255,255,255,0.06)" strokeDasharray="6 4" />
                  <Tooltip content={<CustomTooltip companies={displayedCompanies} />} />
                  {displayedCompanies.map((c, i) => {
                    const globalIdx = companies.findIndex((cc) => cc.companyId === c.companyId);
                    const color = COMPANY_COLORS[globalIdx % COMPANY_COLORS.length];
                    const dataKey = activeTab === "sentiment"
                      ? c.companyName
                      : `${c.companyName}_adActivity`;
                    return (
                      <Area
                        key={c.companyId}
                        type="monotone"
                        dataKey={dataKey}
                        name={c.companyName}
                        stroke={color}
                        strokeWidth={c.isUserCompany ? 2.5 : 1.5}
                        fill={`url(#gradient-${c.companyId})`}
                        dot={false}
                        activeDot={{ r: 5, fill: color, strokeWidth: 0 }}
                        opacity={selectedCompany === null || selectedCompany === c.companyId ? 1 : 0.2}
                      />
                    );
                  })}
                </AreaChart>
              </ResponsiveContainer>

              <div className="mt-4 pt-4 border-t border-border flex items-start gap-2 text-xs text-muted-foreground/70">
                <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                <span>
                  {activeTab === "sentiment"
                    ? "Sentiment score 0–100. Higher = more positive customer reviews."
                    : "Ad activity 0–100. Higher = heavier ad campaign intensity that month."}
                  {" "}▲ = price increase  ▼ = price decrease (shown in tooltips)
                </span>
              </div>
            </motion.div>

            {/* Price signals + Key Events */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
              {/* Price signal calendar */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="glass-panel rounded-3xl p-6"
              >
                <h3 className="text-xl font-bold mb-5 flex items-center gap-2">
                  <span className="text-2xl">💰</span> Pricing Signal Map
                </h3>
                <div className="space-y-4">
                  {displayedCompanies.map((c, i) => {
                    const globalIdx = companies.findIndex((cc) => cc.companyId === c.companyId);
                    const color = COMPANY_COLORS[globalIdx % COMPANY_COLORS.length];
                    const priceChanges = c.timeline.filter((pt) => pt.priceSignal !== "stable");
                    return (
                      <div key={c.companyId}>
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                          <span className="text-sm font-semibold text-foreground/90">{c.companyName}</span>
                          {c.isUserCompany && <span className="text-xs text-primary">(You)</span>}
                        </div>
                        {priceChanges.length === 0 ? (
                          <p className="text-xs text-muted-foreground ml-4">No pricing changes detected this period</p>
                        ) : (
                          <div className="flex flex-wrap gap-2 ml-4">
                            {priceChanges.map((pt) => (
                              <span
                                key={pt.monthKey}
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold border ${
                                  pt.priceSignal === "increased"
                                    ? "bg-red-500/10 text-red-400 border-red-500/20"
                                    : "bg-green-500/10 text-green-400 border-green-500/20"
                                }`}
                              >
                                <PriceSignalDot signal={pt.priceSignal} />
                                {pt.month}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </motion.div>

              {/* Key Events */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="glass-panel rounded-3xl p-6"
              >
                <h3 className="text-xl font-bold mb-5 flex items-center gap-2">
                  <span className="text-2xl">📅</span> Key Events Timeline
                </h3>
                <div className="space-y-3 max-h-72 overflow-y-auto pr-1 scrollbar-thin">
                  {keyEvents
                    .filter((e) => selectedCompany === null || companies.find((c) => c.companyName === e.companyName)?.companyId === selectedCompany)
                    .slice(0, 20)
                    .map((e, i) => (
                      <div key={i} className="flex gap-3 items-start group">
                        <div className="flex flex-col items-center flex-shrink-0 pt-1">
                          <div
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: e.color, boxShadow: `0 0 6px ${e.color}66` }}
                          />
                          {i < keyEvents.length - 1 && <div className="w-px flex-1 bg-border min-h-[16px] mt-1" />}
                        </div>
                        <div className="pb-3">
                          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{e.month} · </span>
                          <span className="text-xs font-semibold" style={{ color: e.color }}>{e.companyName}</span>
                          <p className="text-sm text-foreground/80 mt-0.5 leading-relaxed">{e.event}</p>
                        </div>
                      </div>
                    ))}
                  {keyEvents.length === 0 && (
                    <p className="text-sm text-muted-foreground">No notable events detected in this period.</p>
                  )}
                </div>
              </motion.div>
            </div>

            {/* Correlation Insights */}
            {focusedCompany ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-panel rounded-3xl p-8 mb-8"
              >
                <h3 className="text-2xl font-bold mb-6 flex items-center gap-3">
                  <Sparkles className="w-6 h-6 text-secondary" />
                  Correlation Insights — {focusedCompany.companyName}
                  {focusedCompany.isUserCompany && <span className="text-primary text-lg">(You)</span>}
                </h3>
                <div className="space-y-4">
                  {focusedCompany.correlationInsights.map((insight, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.08 }}
                      className="flex gap-3 items-start p-4 bg-card/60 rounded-xl border border-border"
                    >
                      <span className="text-secondary font-bold text-lg flex-shrink-0">→</span>
                      <p className="text-sm text-foreground/85 leading-relaxed">{insight}</p>
                    </motion.div>
                  ))}
                  {focusedCompany.correlationInsights.length === 0 && (
                    <p className="text-muted-foreground text-sm">No correlation insights available for this brand.</p>
                  )}
                </div>
              </motion.div>
            ) : null}

            {/* Overall Cross-Brand Insights */}
            {data.overallInsights.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="glass-panel rounded-3xl p-8"
              >
                <h3 className="text-2xl font-bold mb-6 flex items-center gap-3">
                  <Sparkles className="w-6 h-6 text-primary" />
                  Cross-Brand Intelligence
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {data.overallInsights.map((insight, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 15 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: i * 0.1 }}
                      className="flex gap-3 items-start p-5 bg-card/60 rounded-2xl border border-border hover:border-primary/30 transition-colors"
                    >
                      <span className="w-6 h-6 flex-shrink-0 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-bold border border-primary/20">
                        {i + 1}
                      </span>
                      <p className="text-sm text-foreground/85 leading-relaxed">{insight}</p>
                    </motion.div>
                  ))}
                </div>

                <div className="mt-6 pt-5 border-t border-border flex items-start gap-2 text-xs text-muted-foreground/60">
                  <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                  <span>{data.dataNote}</span>
                </div>
              </motion.div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
