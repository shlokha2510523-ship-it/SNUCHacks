import { motion } from "framer-motion";
import { Users } from "lucide-react";

interface UnderservedSegment {
  segmentName: string;
  description: string;
  whyUnderserved: string;
  opportunityInsight: string;
}

interface Props {
  trends: any;
}

const ACCENT_COLORS = ["#06b6d4", "#a78bfa", "#34d399"];

export function WhitespacesSection({ trends }: Props) {
  const segments: UnderservedSegment[] = (trends as any)?.underservedSegments ?? [];

  if (!segments.length) return null;

  return (
    <section className="py-32 px-6 relative overflow-hidden">
      <div className="absolute top-0 right-1/3 w-[50rem] h-[20rem] bg-secondary/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-7xl mx-auto relative">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-16"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary/10 border border-secondary/20 text-secondary text-xs font-bold uppercase tracking-wider mb-5">
            <Users className="w-3.5 h-3.5" />
            Audience Intelligence
          </div>
          <h2 className="text-4xl md:text-5xl font-display font-bold border-l-4 border-secondary pl-6">
            Whitespaces You Can Focus On
          </h2>
          <p className="text-muted-foreground text-lg mt-4 pl-6 max-w-2xl">
            Underserved customer segments identified from competitor gaps, review data, and market trends — ready for you to own.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {segments.slice(0, 3).map((segment, i) => (
            <SegmentCard key={i} segment={segment} index={i} accentColor={ACCENT_COLORS[i]} />
          ))}
        </div>
      </div>
    </section>
  );
}

function SegmentCard({
  segment,
  index,
  accentColor,
}: {
  segment: UnderservedSegment;
  index: number;
  accentColor: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, delay: index * 0.15, ease: [0.16, 1, 0.3, 1] }}
      className="glass-panel rounded-3xl overflow-hidden flex flex-col group hover:-translate-y-1 transition-transform duration-300"
    >
      <div className="h-1 w-full" style={{ background: `linear-gradient(90deg, ${accentColor}99, ${accentColor}22)` }} />

      <div className="p-7 flex flex-col flex-1 gap-5">
        <div>
          <span
            className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full border mb-4 inline-block"
            style={{ color: accentColor, borderColor: `${accentColor}44`, background: `${accentColor}11` }}
          >
            Segment #{index + 1}
          </span>
          <h3 className="text-2xl font-display font-bold text-foreground leading-tight mt-3">
            {segment.segmentName}
          </h3>
          <p className="text-muted-foreground text-sm mt-2 leading-relaxed">
            {segment.description}
          </p>
        </div>

        <div className="space-y-4 flex-1">
          <div className="rounded-2xl p-4 border border-border bg-background/60">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Why Underserved</p>
            <p className="text-sm text-foreground/80 leading-relaxed">{segment.whyUnderserved}</p>
          </div>

          <div
            className="rounded-2xl p-4 border"
            style={{ borderColor: `${accentColor}33`, background: `${accentColor}0d` }}
          >
            <p
              className="text-[10px] font-bold uppercase tracking-wider mb-1.5"
              style={{ color: accentColor }}
            >
              Opportunity Insight
            </p>
            <p className="text-sm text-foreground/80 leading-relaxed">{segment.opportunityInsight}</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
