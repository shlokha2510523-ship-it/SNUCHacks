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
  labelDx: number;
  labelDy: number;
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

function computeDomain(values: number[], pad = 20): [number, number] {
  if (!values.length) return [0, 100];
  const mn = Math.min(...values);
  const mx = Math.max(...values);
  const range = mx - mn;
  const p = range < 20 ? pad + 10 : pad;
  return [Math.max(0, Math.floor(mn - p)), Math.min(100, Math.ceil(mx + p))];
}

function attachLabelOffsets(points: { x: number; y: number; name: string; isUser: boolean; initials: string }[]): BrandPoint[] {
  if (!points.length) return [];
  const cx = points.reduce((s, p) => s + p.x, 0) / points.length;
  const cy = points.reduce((s, p) => s + p.y, 0) / points.length;

  return points.map((p) => {
    const dx = p.x - cx;
    const dy = p.y - cy;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 1) {
      return { ...p, labelDx: 0, labelDy: -1 };
    }
    return { ...p, labelDx: dx / len, labelDy: dy / len };
  });
}

const COMPETITOR_COLORS = ["#818cf8", "#f472b6", "#34d399", "#fb923c", "#a78bfa"];
const USER_COLOR = "#06b6d4";
const GRID_COLOR = "rgba(255,255,255,0.05)";
const AXIS_COLOR = "rgba(255,255,255,0.18)";

function buildRawPoints(
  rankings: RankingsData,
  yMetrics: string[]
): { x: number; y: number; name: string; isUser: boolean; initials: string }[] {
  const byMetric = rankings.byMetric;
  const pricingKey =
    Object.keys(byMetric).find((k) => k.toLowerCase().includes("pric")) ?? "";
  const yKeys = yMetrics
    .map((m) => Object.keys(byMetric).find((k) => k.toLowerCase().includes(m.toLowerCase())) ?? "")
    .filter(Boolean);

  return rankings.overall.map((entry) => {
    const { companyName: name, isUserCompany: isUser } = entry;
    const xScore = byMetric[pricingKey]?.find((e) => e.companyName === name)?.score ?? 50;
    const yScores = yKeys.map((k) => byMetric[k]?.find((e) => e.companyName === name)?.score ?? 50);
    return {
      name,
      isUser,
      x: Math.round(xScore),
      y: Math.round(avg(yScores)),
      initials: getInitials(name),
    };
  });
}

interface CustomDotProps {
  cx?: number;
  cy?: number;
  payload?: BrandPoint;
  namesIndex?: Map<string, number>;
}

function CustomDot({ cx = 0, cy = 0, payload, namesIndex }: CustomDotProps) {
  if (!payload) return null;
  const color = payload.isUser
    ? USER_COLOR
    : COMPETITOR_COLORS[(namesIndex?.get(payload.name) ?? 0) % COMPETITOR_COLORS.length];
  const r = payload.isUser ? 20 : 15;

  // Position label using pre-computed direction vector (radiates away from cluster centroid)
  const LABEL_DIST = r + 14;
  const rawLx = cx + payload.labelDx * LABEL_DIST;
  const rawLy = cy - payload.labelDy * LABEL_DIST; // SVG y is inverted vs data y

  // Anchor based on horizontal direction
  const anchor =
    payload.labelDx > 0.35 ? "start" : payload.labelDx < -0.35 ? "end" : "middle";

  return (
    <g style={{ cursor: "pointer" }}>
      {payload.isUser && (
        <circle
          cx={cx}
          cy={cy}
          r={r + 8}
          fill="none"
          stroke={color}
          strokeWidth={1.5}
          opacity={0.3}
          style={{ filter: `drop-shadow(0 0 10px ${color})` }}
        />
      )}
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill={color}
        opacity={0.9}
        style={{
          filter: `drop-shadow(0 0 ${payload.isUser ? 16 : 8}px ${color}99)`,
          transition: "opacity 0.2s ease",
        }}
      />
      <text
        x={cx}
        y={cy + 1}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={payload.isUser ? 10 : 9}
        fontWeight="700"
        fill="#fff"
        style={{ pointerEvents: "none", userSelect: "none" }}
      >
        {payload.initials}
      </text>
      {/* Label line */}
      <line
        x1={cx + (payload.labelDx * (r + 2))}
        y1={cy - (payload.labelDy * (r + 2))}
        x2={cx + (payload.labelDx * (LABEL_DIST - 4))}
        y2={cy - (payload.labelDy * (LABEL_DIST - 4))}
        stroke={color}
        strokeWidth={0.8}
        opacity={0.4}
        style={{ pointerEvents: "none" }}
      />
      <text
        x={rawLx}
        y={rawLy}
        textAnchor={anchor}
        dominantBaseline="middle"
        fontSize={10}
        fontWeight="600"
        fill={color}
        opacity={payload.isUser ? 1 : 0.85}
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
      <div className="space-y-1.5">
        <div className="flex justify-between gap-6">
          <span className="text-muted-foreground">Pricing score</span>
          <span className="font-mono font-semibold text-primary">{d.x}</span>
        </div>
        <div className="flex justify-between gap-6">
          <span className="text-muted-foreground">{yLabel} score</span>
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
  xDomain: [number, number];
  yDomain: [number, number];
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
  xDomain,
  yDomain,
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
    points.forEach((p) => { if (!p.isUser) m.set(p.name, idx++); });
    return m;
  }, [points]);

  const xMid = Math.round((xDomain[0] + xDomain[1]) / 2);
  const yMid = Math.round((yDomain[0] + yDomain[1]) / 2);

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      className="glass-panel rounded-3xl p-6 md:p-10 relative overflow-hidden"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-primary/3 via-transparent to-secondary/3 pointer-events-none rounded-3xl" />

      <div className="mb-6">
        <h3 className="text-2xl md:text-3xl font-display font-bold text-foreground">{title}</h3>
        <p className="text-muted-foreground mt-1 text-sm">{subtitle}</p>
      </div>

      <div className="relative">
        {quadrants && quadrantLabels && (
          <>
            <div className="absolute top-4 left-[10%] z-10 text-[9px] font-semibold text-muted-foreground/50 uppercase tracking-widest pointer-events-none hidden sm:block">
              {quadrantLabels[0]}
            </div>
            <div className="absolute top-4 right-[6%] z-10 text-[9px] font-semibold text-primary/50 uppercase tracking-widest pointer-events-none hidden sm:block">
              {quadrantLabels[1]}
            </div>
            <div className="absolute bottom-[68px] left-[10%] z-10 text-[9px] font-semibold text-muted-foreground/40 uppercase tracking-widest pointer-events-none hidden sm:block">
              {quadrantLabels[2]}
            </div>
            <div className="absolute bottom-[68px] right-[6%] z-10 text-[9px] font-semibold text-muted-foreground/40 uppercase tracking-widest pointer-events-none hidden sm:block">
              {quadrantLabels[3]}
            </div>
          </>
        )}

        <ResponsiveContainer width="100%" height={460}>
          <ScatterChart margin={{ top: 50, right: 80, bottom: 56, left: 60 }}>
            <CartesianGrid stroke={GRID_COLOR} strokeDasharray="3 6" />

            {quadrants && (
              <>
                <ReferenceLine x={xMid} stroke="rgba(255,255,255,0.08)" strokeWidth={1} strokeDasharray="8 4" />
                <ReferenceLine y={yMid} stroke="rgba(255,255,255,0.08)" strokeWidth={1} strokeDasharray="8 4" />
              </>
            )}

            <XAxis
              dataKey="x"
              type="number"
              domain={xDomain}
              tick={{ fill: AXIS_COLOR, fontSize: 10 }}
              axisLine={{ stroke: AXIS_COLOR }}
              tickLine={false}
              tickCount={5}
              label={{
                value: `← ${xLeft}   ·   ${xRight} →`,
                position: "insideBottom",
                offset: -36,
                fill: "rgba(255,255,255,0.35)",
                fontSize: 11,
                fontWeight: 500,
              }}
            />
            <YAxis
              dataKey="y"
              type="number"
              domain={yDomain}
              tick={{ fill: AXIS_COLOR, fontSize: 10 }}
              axisLine={{ stroke: AXIS_COLOR }}
              tickLine={false}
              tickCount={5}
              label={{
                value: `${yBottom}  ↑  ${yTop}`,
                angle: -90,
                position: "insideLeft",
                offset: -44,
                fill: "rgba(255,255,255,0.35)",
                fontSize: 11,
                fontWeight: 500,
              }}
            />
            <Tooltip content={<CustomTooltip yLabel={yLabel} />} cursor={false} />

            <Scatter
              data={points}
              shape={(props: any) => (
                <CustomDot {...props} namesIndex={namesIndex} />
              )}
              isAnimationActive
              animationBegin={200}
              animationDuration={900}
              animationEasing="ease-out"
            />
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      <div className="flex flex-wrap gap-4 mt-4 pt-5 border-t border-border">
        {points.map((p) => {
          const color = p.isUser
            ? USER_COLOR
            : COMPETITOR_COLORS[(namesIndex.get(p.name) ?? 0) % COMPETITOR_COLORS.length];
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
  const perfPoints = useMemo(() => {
    const raw = buildRawPoints(rankings, PERFORMANCE_METRICS);
    return attachLabelOffsets(raw);
  }, [rankings]);

  const visPoints = useMemo(() => {
    const raw = buildRawPoints(rankings, VISIBILITY_METRICS);
    return attachLabelOffsets(raw);
  }, [rankings]);

  const perfXDomain = useMemo(() => computeDomain(perfPoints.map((p) => p.x)), [perfPoints]);
  const perfYDomain = useMemo(() => computeDomain(perfPoints.map((p) => p.y)), [perfPoints]);
  const visXDomain  = useMemo(() => computeDomain(visPoints.map((p) => p.x)), [visPoints]);
  const visYDomain  = useMemo(() => computeDomain(visPoints.map((p) => p.y)), [visPoints]);

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
            xDomain={perfXDomain}
            yDomain={perfYDomain}
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
            xDomain={visXDomain}
            yDomain={visYDomain}
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
