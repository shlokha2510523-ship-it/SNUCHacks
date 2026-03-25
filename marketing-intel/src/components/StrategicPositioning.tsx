import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  ReferenceLine,
} from "recharts";
import type { RankingsData } from "@workspace/api-client-react";

interface BrandPoint {
  name: string;
  isUser: boolean;
  x: number;
  y: number;
  initials: string;
}

function avg(scores: number[]): number {
  if (!scores.length) return 50;
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

const COMPETITOR_COLORS = ["#818cf8", "#f472b6", "#34d399", "#fb923c", "#a78bfa"];
const USER_COLOR = "#06b6d4";
const GRID_COLOR = "rgba(255,255,255,0.06)";
const AXIS_COLOR = "rgba(255,255,255,0.2)";

function buildPoints(rankings: RankingsData, yMetrics: string[]): BrandPoint[] {
  const byMetric = rankings.byMetric;
  const pricingKey = Object.keys(byMetric).find((k) =>
    k.toLowerCase().includes("pric")
  ) ?? "";
  const yKeys = yMetrics.map(
    (m) => Object.keys(byMetric).find((k) => k.toLowerCase().includes(m.toLowerCase())) ?? ""
  ).filter(Boolean);

  const companies = rankings.overall.map((e) => e.companyName);

  return companies.map((name) => {
    const isUser = rankings.overall.find((e) => e.companyName === name)?.isUserCompany ?? false;
    const pricingEntry = byMetric[pricingKey]?.find((e) => e.companyName === name);
    const xScore = pricingEntry?.score ?? 50;

    const yScores = yKeys.map(
      (k) => byMetric[k]?.find((e) => e.companyName === name)?.score ?? 50
    );
    const yScore = avg(yScores);

    return { name, isUser, x: Math.round(xScore), y: Math.round(yScore), initials: getInitials(name) };
  });
}

interface CustomDotProps {
  cx?: number;
  cy?: number;
  payload?: BrandPoint;
  userColor?: string;
  colorPool?: string[];
  namesIndex?: Map<string, number>;
}

function CustomDot({ cx = 0, cy = 0, payload, userColor = USER_COLOR, colorPool = COMPETITOR_COLORS, namesIndex }: CustomDotProps) {
  if (!payload) return null;
  const color = payload.isUser ? userColor : (colorPool[(namesIndex?.get(payload.name) ?? 0) % colorPool.length]);
  const r = payload.isUser ? 22 : 16;

  return (
    <g className="recharts-scatter-dot-group" style={{ cursor: "pointer" }}>
      <style>{`
        .recharts-scatter-dot-group .dot-circle {
          transition: r 0.2s ease, opacity 0.2s ease;
        }
        .recharts-scatter-dot-group:hover .dot-circle {
          opacity: 1 !important;
        }
        .recharts-scatter-dot-group .dot-label {
          transition: opacity 0.2s ease;
        }
        .recharts-scatter-dot-group:hover .dot-label {
          opacity: 1 !important;
        }
      `}</style>
      {payload.isUser && (
        <circle
          cx={cx}
          cy={cy}
          r={r + 9}
          fill="none"
          stroke={color}
          strokeWidth={1.5}
          opacity={0.35}
          style={{ filter: `drop-shadow(0 0 8px ${color})` }}
        />
      )}
      <circle
        className="dot-circle"
        cx={cx}
        cy={cy}
        r={r}
        fill={color}
        opacity={0.88}
        style={{ filter: `drop-shadow(0 0 ${payload.isUser ? 14 : 7}px ${color}99)` }}
      />
      <text
        x={cx}
        y={cy + 1}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={payload.isUser ? 11 : 9}
        fontWeight="700"
        fill="#fff"
        style={{ pointerEvents: "none", userSelect: "none" }}
      >
        {payload.initials}
      </text>
      <text
        className="dot-label"
        x={cx}
        y={cy - r - 9}
        textAnchor="middle"
        fontSize={10}
        fontWeight="600"
        fill={color}
        opacity={payload.isUser ? 1 : 0.75}
        style={{ pointerEvents: "none", userSelect: "none" }}
      >
        {payload.name}
      </text>
    </g>
  );
}

interface TooltipProps {
  active?: boolean;
  payload?: { payload: BrandPoint }[];
  yLabel: string;
}

function CustomTooltip({ active, payload, yLabel }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-card/95 border border-border rounded-xl p-4 shadow-2xl backdrop-blur-md text-sm min-w-[160px]">
      <p className="font-bold text-foreground mb-2 text-base">{d.name}</p>
      <div className="space-y-1">
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Pricing</span>
          <span className="font-mono font-semibold text-primary">{d.x}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">{yLabel}</span>
          <span className="font-mono font-semibold text-primary">{d.y}</span>
        </div>
        {d.isUser && (
          <div className="mt-2 pt-2 border-t border-border">
            <span className="text-xs text-primary font-semibold uppercase tracking-wider">Your Brand</span>
          </div>
        )}
      </div>
    </div>
  );
}

interface GraphProps {
  points: BrandPoint[];
  title: string;
  subtitle: string;
  xLeft: string;
  xRight: string;
  yBottom: string;
  yTop: string;
  yLabel: string;
  quadrants?: boolean;
  quadrantLabels?: [string, string, string, string];
}

function PositioningGraph({
  points,
  title,
  subtitle,
  xLeft,
  xRight,
  yBottom,
  yTop,
  yLabel,
  quadrants = false,
  quadrantLabels,
}: GraphProps) {
  const namesIndex = useMemo(() => {
    const m = new Map<string, number>();
    let idx = 0;
    points.forEach((p) => {
      if (!p.isUser) { m.set(p.name, idx++); }
    });
    return m;
  }, [points]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      className="glass-panel rounded-3xl p-6 md:p-10 relative overflow-hidden"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-primary/3 via-transparent to-secondary/3 pointer-events-none rounded-3xl" />

      <div className="mb-8">
        <h3 className="text-2xl md:text-3xl font-display font-bold text-foreground">{title}</h3>
        <p className="text-muted-foreground mt-1 text-sm">{subtitle}</p>
      </div>

      <div className="relative">
        {quadrants && quadrantLabels && (
          <>
            <div className="absolute top-2 left-[8%] z-10 text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider pointer-events-none hidden sm:block">
              {quadrantLabels[0]}
            </div>
            <div className="absolute top-2 right-[4%] z-10 text-[10px] font-semibold text-primary/60 uppercase tracking-wider pointer-events-none hidden sm:block">
              {quadrantLabels[1]}
            </div>
            <div className="absolute bottom-[60px] left-[8%] z-10 text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wider pointer-events-none hidden sm:block">
              {quadrantLabels[2]}
            </div>
            <div className="absolute bottom-[60px] right-[4%] z-10 text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wider pointer-events-none hidden sm:block">
              {quadrantLabels[3]}
            </div>
          </>
        )}

        <ResponsiveContainer width="100%" height={420}>
          <ScatterChart margin={{ top: 30, right: 40, bottom: 40, left: 20 }}>
            <defs>
              {quadrants && (
                <>
                  <linearGradient id="q1" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.04" />
                    <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.01" />
                  </linearGradient>
                  <linearGradient id="q2" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.04" />
                    <stop offset="100%" stopColor="#a78bfa" stopOpacity="0.01" />
                  </linearGradient>
                </>
              )}
            </defs>

            <CartesianGrid stroke={GRID_COLOR} strokeDasharray="4 4" />

            {quadrants && (
              <>
                <ReferenceLine x={50} stroke="rgba(255,255,255,0.1)" strokeWidth={1} strokeDasharray="6 3" />
                <ReferenceLine y={50} stroke="rgba(255,255,255,0.1)" strokeWidth={1} strokeDasharray="6 3" />
              </>
            )}

            <XAxis
              dataKey="x"
              type="number"
              domain={[0, 100]}
              tick={{ fill: AXIS_COLOR, fontSize: 10 }}
              axisLine={{ stroke: AXIS_COLOR }}
              tickLine={false}
              label={{
                value: `← ${xLeft}    ${xRight} →`,
                position: "insideBottom",
                offset: -20,
                fill: "rgba(255,255,255,0.4)",
                fontSize: 11,
                fontWeight: 500,
              }}
            />
            <YAxis
              dataKey="y"
              type="number"
              domain={[0, 100]}
              tick={{ fill: AXIS_COLOR, fontSize: 10 }}
              axisLine={{ stroke: AXIS_COLOR }}
              tickLine={false}
              label={{
                value: `${yBottom} ↑ ${yTop}`,
                angle: -90,
                position: "insideLeft",
                offset: 15,
                fill: "rgba(255,255,255,0.4)",
                fontSize: 11,
                fontWeight: 500,
              }}
            />
            <Tooltip content={<CustomTooltip yLabel={yLabel} />} cursor={false} />

            <Scatter
              data={points}
              shape={(props: any) => (
                <CustomDot
                  {...props}
                  userColor={USER_COLOR}
                  colorPool={COMPETITOR_COLORS}
                  namesIndex={namesIndex}
                />
              )}
              isAnimationActive
              animationBegin={200}
              animationDuration={1000}
              animationEasing="ease-out"
            />
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      <div className="flex flex-wrap gap-3 mt-6 pt-5 border-t border-border">
        {points.map((p, i) => {
          const color = p.isUser ? USER_COLOR : COMPETITOR_COLORS[(namesIndex.get(p.name) ?? 0) % COMPETITOR_COLORS.length];
          return (
            <div key={p.name} className="flex items-center gap-2">
              <div
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}88` }}
              />
              <span className="text-xs text-muted-foreground font-medium">
                {p.name}
                {p.isUser && <span className="text-primary ml-1">(You)</span>}
              </span>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

interface Props {
  rankings: RankingsData;
}

const PERFORMANCE_METRICS = ["battery", "camera", "gaming", "durability", "sustainability", "ai feature"];
const VISIBILITY_METRICS = ["social", "ad strength", "website ux", "website"];

export function StrategicPositioning({ rankings }: Props) {
  const perfPoints = useMemo(
    () => buildPoints(rankings, PERFORMANCE_METRICS),
    [rankings]
  );
  const visPoints = useMemo(
    () => buildPoints(rankings, VISIBILITY_METRICS),
    [rankings]
  );

  return (
    <section className="py-32 px-6">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-16"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold uppercase tracking-wider mb-5">
            Strategic Intelligence
          </div>
          <h2 className="text-4xl md:text-5xl font-display font-bold border-l-4 border-primary pl-6">
            Strategic Positioning
          </h2>
          <p className="text-muted-foreground text-lg mt-4 pl-6 max-w-2xl">
            See exactly where your brand sits in the competitive landscape — across price, performance, and market visibility.
          </p>
        </motion.div>

        <div className="space-y-10">
          <PositioningGraph
            points={perfPoints}
            title="Price vs Performance Positioning"
            subtitle="How brands balance product pricing against feature performance"
            xLeft="More Affordable"
            xRight="More Premium"
            yBottom="Lower Performance"
            yTop="Higher Performance"
            yLabel="Performance"
          />

          <PositioningGraph
            points={visPoints}
            title="Market Positioning Map"
            subtitle="Brand visibility versus pricing competitiveness across the market"
            xLeft="Budget"
            xRight="Premium"
            yBottom="Low Visibility"
            yTop="High Visibility"
            yLabel="Visibility"
            quadrants
            quadrantLabels={[
              "Mass Market Leaders",
              "Premium Dominators",
              "Underdog Value Brands",
              "Niche Premium Players",
            ]}
          />
        </div>
      </div>
    </section>
  );
}
