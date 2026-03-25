import { useEffect, useState } from "react";
import { useRoute, useLocation, useSearch } from "wouter";
import { motion, useScroll, useTransform } from "framer-motion";
import { 
  useGetCompanySet, 
  useScrapeCompanyData, 
  useAnalyzeCompanies,
  useGetCompanyRankings,
  useGetActionPlan,
  useGetMarketingTrends
} from "@workspace/api-client-react";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { MetricBar } from "@/components/MetricBar";
import { QuickFixPanel } from "@/components/QuickFixPanel";
import { Trophy, Target, TrendingUp, AlertTriangle, Lightbulb, Activity, ChevronDown } from "lucide-react";
import { getSeverityColor, getEffortColor } from "@/lib/utils";
import { StrategicPositioning } from "@/components/StrategicPositioning";
import { NextHitProducts } from "@/components/NextHitProducts";
import { WhitespacesSection } from "@/components/WhitespacesSection";
import { SentimentTimeline } from "@/components/SentimentTimeline";
import { PositioningAnalysis } from "@/components/PositioningAnalysis";

export default function Report() {
  const [, params] = useRoute("/report/:id");
  const search = useSearch();
  const id = params?.id ? parseInt(params.id) : 0;
  
  const orchestrate = new URLSearchParams(search).get("orchestrate") === "true";
  const [loadingStep, setLoadingStep] = useState<string>("Initializing...");

  const { data: companySet, refetch: refetchSet } = useGetCompanySet(id, {
    query: {
      refetchInterval: (query) => {
        const status = query.state.data?.status;
        return (status === 'pending' || status === 'scraping' || status === 'analyzing') ? 3000 : false;
      }
    }
  });

  const { mutateAsync: doScrape } = useScrapeCompanyData();
  const { mutateAsync: doAnalyze } = useAnalyzeCompanies();

  const { data: rankings } = useGetCompanyRankings(id, { query: { enabled: companySet?.status === 'complete' }});
  const { data: actionPlan } = useGetActionPlan(id, { query: { enabled: companySet?.status === 'complete' }});
  const { data: trends } = useGetMarketingTrends(id, { query: { enabled: companySet?.status === 'complete' }});

  // Client-side orchestration logic if triggered from Setup
  useEffect(() => {
    if (!orchestrate || !companySet || companySet.status === 'complete' || companySet.status === 'error') return;

    const runFlow = async () => {
      try {
        if (companySet.status === 'pending') {
          setLoadingStep("Crawling competitor websites & social profiles...");
          await doScrape({ id });
          refetchSet();
        } else if (companySet.status === 'scraping') {
          setLoadingStep("Extracting ad library data & copy patterns...");
        } else if (companySet.status === 'analyzing') {
          setLoadingStep("Running Deep AI Competitive Analysis...");
          // In a real app, backend might auto-trigger this after scrape, 
          // but based on API spec we trigger it. We'll fire and forget, polling handles the rest.
          await doAnalyze({ id }).catch(() => {}); 
        }
      } catch (e) {
        console.error("Flow error", e);
      }
    };

    runFlow();
  }, [companySet?.status, orchestrate, id, doScrape, doAnalyze, refetchSet]);


  const { scrollYProgress } = useScroll();
  const heroOpacity = useTransform(scrollYProgress, [0, 0.2], [1, 0]);
  const heroScale = useTransform(scrollYProgress, [0, 0.2], [1, 0.9]);

  if (!companySet) return <LoadingScreen step="Loading Intelligence Data..." />;
  
  if (companySet.status !== 'complete') {
    return <LoadingScreen step={loadingStep} subtext="Processing vast amounts of unstructured data." />;
  }

  const analysis = companySet.analysis;
  if (!analysis || !rankings || !actionPlan || !trends) return <LoadingScreen step="Finalizing visuals..." />;

  const userRank = rankings.overall.find(r => r.isUserCompany)?.rank || 1;

  return (
    <div className="bg-background text-foreground overflow-x-hidden">
      <QuickFixPanel companySetId={id} />

      {/* HERO SECTION */}
      <motion.section 
        style={{ opacity: heroOpacity, scale: heroScale }}
        className="relative h-screen flex flex-col items-center justify-center p-6 text-center"
      >
        <div className="absolute inset-0 z-0">
          <img 
            src={`${import.meta.env.BASE_URL}images/hero-abstract.png`} 
            alt="Hero Background" 
            className="w-full h-full object-cover opacity-40 mix-blend-screen"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
        </div>

        <div className="z-10 mt-20">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", bounce: 0.5, duration: 1, delay: 0.2 }}
            className="w-32 h-32 mx-auto bg-gradient-to-br from-primary to-secondary rounded-full flex items-center justify-center shadow-[0_0_100px_rgba(6,182,212,0.5)] mb-8"
          >
            <Trophy className="w-16 h-16 text-white" />
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.8 }}>
            <p className="text-primary font-bold tracking-widest uppercase mb-4">Final Results Are In</p>
            <h1 className="text-6xl md:text-8xl font-display font-extrabold mb-6 leading-none">
              You rank <span className="text-gradient">#{userRank}</span> <br/>
              out of {analysis.totalCompanies}
            </h1>
            <p className="text-2xl text-muted-foreground max-w-2xl mx-auto">
              Overall Marketing Power Score: <span className="text-foreground font-mono font-bold">{analysis.overallScore.toFixed(1)}/100</span>
            </p>
          </motion.div>
        </div>

        <motion.div 
          animate={{ y: [0, 10, 0] }} 
          transition={{ repeat: Infinity, duration: 2 }}
          className="absolute bottom-12 text-muted-foreground flex flex-col items-center gap-2"
        >
          <span className="text-sm uppercase tracking-widest">Scroll to dive deep</span>
          <ChevronDown className="w-6 h-6" />
        </motion.div>
      </motion.section>

      {/* METRICS COMPARISON */}
      <section className="min-h-screen py-32 px-6 relative">
        <div className="max-w-6xl mx-auto">
          <motion.div 
            initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }}
            variants={{
              visible: { opacity: 1, y: 0, transition: { staggerChildren: 0.2 } },
              hidden: { opacity: 0, y: 50 }
            }}
          >
            <h2 className="text-4xl md:text-5xl font-display font-bold mb-16 border-l-4 border-primary pl-6">
              The Battlefield Matrix
            </h2>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
              {Object.entries(rankings.byMetric).map(([metricName, ranks], idx) => (
                <motion.div 
                  key={metricName}
                  variants={{ visible: { opacity: 1, y: 0 }, hidden: { opacity: 0, y: 20 } }}
                  className="glass-panel p-8 rounded-3xl"
                >
                  <h3 className="text-xl font-bold mb-6 capitalize text-foreground/90">{metricName.replace(/([A-Z])/g, ' $1').trim()}</h3>
                  <div className="space-y-4">
                    {ranks.sort((a,b) => b.score - a.score).map((entry, i) => (
                      <MetricBar 
                        key={entry.companyId}
                        label={entry.companyName}
                        score={entry.score}
                        isUser={entry.isUserCompany}
                        delay={idx * 0.1 + i * 0.1}
                      />
                    ))}
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* STRENGTHS & WEAKNESSES */}
      <section className="min-h-screen py-32 bg-card/50 relative border-y border-border">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            
            <motion.div 
              initial={{ opacity: 0, x: -50 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.8 }}
            >
              <div className="flex items-center gap-4 mb-8">
                <div className="p-3 bg-green-500/10 rounded-xl text-green-500"><TrendingUp className="w-8 h-8" /></div>
                <h2 className="text-4xl font-display font-bold">Where You Lead</h2>
              </div>
              <div className="space-y-6">
                <div className="p-8 rounded-3xl bg-green-500/5 border border-green-500/20">
                  <h4 className="text-green-500 font-bold uppercase tracking-wider text-sm mb-2">Biggest Advantage</h4>
                  <p className="text-2xl font-medium text-foreground leading-tight">{rankings.userCompanyHighlights.biggestAdvantage}</p>
                </div>
                <div className="flex flex-wrap gap-3">
                  {rankings.userCompanyHighlights.leadingIn.map(item => (
                    <span key={item} className="px-4 py-2 rounded-full bg-card border border-border text-sm font-medium">{item}</span>
                  ))}
                </div>
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, x: 50 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.8 }}
            >
              <div className="flex items-center gap-4 mb-8">
                <div className="p-3 bg-destructive/10 rounded-xl text-destructive"><AlertTriangle className="w-8 h-8" /></div>
                <h2 className="text-4xl font-display font-bold">Where You Bleed</h2>
              </div>
              <div className="space-y-6">
                <div className="p-8 rounded-3xl bg-destructive/5 border border-destructive/20">
                  <h4 className="text-destructive font-bold uppercase tracking-wider text-sm mb-2">Critical Gap</h4>
                  <p className="text-2xl font-medium text-foreground leading-tight">{rankings.userCompanyHighlights.biggestGap}</p>
                </div>
                <div className="flex flex-wrap gap-3">
                  {rankings.userCompanyHighlights.laggingIn.map(item => (
                    <span key={item} className="px-4 py-2 rounded-full bg-card border border-border text-sm font-medium text-muted-foreground">{item}</span>
                  ))}
                </div>
              </div>
            </motion.div>

          </div>
        </div>
      </section>

      {/* NEXT HIT PRODUCTS */}
      <NextHitProducts
        rankings={rankings}
        trends={trends}
        analysis={analysis}
        companyName={companySet.userCompany.name}
      />

      {/* WHITESPACES YOU CAN FOCUS ON */}
      <div className="border-t border-border/50">
        <PositioningAnalysis companySetId={id} />
      </div>

      <WhitespacesSection trends={trends} />

      {/* STRATEGIC POSITIONING */}
      <StrategicPositioning rankings={rankings} />

      {/* AI ANALYSIS: REASONS FOR FAILURE */}
      <section className="py-32 px-6">
        <div className="max-w-7xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-display font-bold mb-4">Reasons For Failure</h2>
            <p className="text-xl text-muted-foreground">AI synthesis of why you are losing market share.</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
            {analysis.reasonsForFailure.map((reason, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
                className="glass-panel rounded-3xl p-6 relative overflow-hidden group hover:-translate-y-2 transition-transform duration-300"
              >
                <div className={`absolute top-0 right-0 w-24 h-24 blur-3xl opacity-20 transition-opacity group-hover:opacity-40 ${
                  reason.severity === 'critical' ? 'bg-destructive' : 'bg-primary'
                }`} />
                <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-4 border ${getSeverityColor(reason.severity)}`}>
                  {reason.severity}
                </span>
                <h3 className="text-xl font-bold mb-3">{reason.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{reason.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* MISSED OPPORTUNITIES & TRENDS */}
      <section className="py-32 bg-secondary/5 border-y border-secondary/10 relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-1/2 left-1/4 w-[40rem] h-[40rem] bg-secondary/10 rounded-full blur-[120px] -translate-y-1/2 -z-10" />
        
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-20">
          
          <div>
            <div className="flex items-center gap-4 mb-10">
              <Lightbulb className="w-8 h-8 text-secondary" />
              <h2 className="text-4xl font-display font-bold">Missed Opportunities</h2>
            </div>
            <div className="space-y-6">
              {analysis.missedOpportunities.map((opp, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                  className="bg-background rounded-2xl p-6 border border-border shadow-lg"
                >
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="text-lg font-bold">{opp.title}</h3>
                    <span className={`text-xs font-bold uppercase ${getEffortColor(opp.effort)} bg-background border border-border px-2 py-1 rounded`}>
                      {opp.effort} Effort
                    </span>
                  </div>
                  <p className="text-muted-foreground text-sm mb-4">{opp.description}</p>
                  <div className="text-sm font-medium text-secondary bg-secondary/10 inline-block px-3 py-1.5 rounded-lg">
                    Impact: {opp.potentialImpact}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center gap-4 mb-10">
              <Activity className="w-8 h-8 text-primary" />
              <h2 className="text-4xl font-display font-bold">Industry Trends</h2>
            </div>
            <div className="space-y-6">
              {trends.industryTrends.map((trend, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                  className="bg-background rounded-2xl p-6 border border-border shadow-lg"
                >
                  <h3 className="text-lg font-bold mb-2">{trend.name}</h3>
                  <p className="text-muted-foreground text-sm mb-4">{trend.description}</p>
                  <div className="w-full bg-muted rounded-full h-1.5 mb-2 overflow-hidden">
                    <div className="bg-gradient-to-r from-primary to-secondary h-1.5 rounded-full max-w-full" style={{ width: `${Math.min(100, Math.max(0, (trend.relevance > 10 ? trend.relevance / 10 : trend.relevance) * 10))}%` }} />
                  </div>
                  <p className="text-xs text-muted-foreground text-right uppercase font-bold tracking-wider">Relevance {trend.relevance > 10 ? (trend.relevance / 10).toFixed(1) : trend.relevance}/10</p>
                </motion.div>
              ))}
            </div>
          </div>

        </div>
      </section>

      {/* ACTION PLAN */}
      <section className="py-32 px-6">
        <div className="max-w-7xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-16">
            <h2 className="text-4xl md:text-6xl font-display font-bold mb-6">The Action Plan</h2>
            <p className="text-xl text-primary font-medium max-w-3xl mx-auto p-6 bg-primary/5 rounded-2xl border border-primary/20">
              {actionPlan.marketingGapSummary}
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Immediate */}
            <div className="space-y-6">
              <h3 className="text-2xl font-bold border-b-2 border-primary pb-4">Immediate <span className="text-muted-foreground text-sm font-normal ml-2">This Week</span></h3>
              {actionPlan.immediateActions.map((action, i) => (
                <ActionCard key={i} action={action} idx={i} />
              ))}
            </div>

            {/* Short Term */}
            <div className="space-y-6">
              <h3 className="text-2xl font-bold border-b-2 border-secondary pb-4">Short-term <span className="text-muted-foreground text-sm font-normal ml-2">30 Days</span></h3>
              {actionPlan.shortTermActions.map((action, i) => (
                <ActionCard key={i} action={action} idx={i} />
              ))}
            </div>

            {/* Long Term */}
            <div className="space-y-6">
              <h3 className="text-2xl font-bold border-b-2 border-muted pb-4 text-muted-foreground">Long-term <span className="text-muted-foreground text-sm font-normal ml-2">90+ Days</span></h3>
              {actionPlan.longTermActions.map((action, i) => (
                <ActionCard key={i} action={action} idx={i} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* SENTIMENT INTELLIGENCE TIMELINE */}
      <div className="border-t border-border/50">
        <SentimentTimeline companySetId={id} />
      </div>
      
    </div>
  );
}

function ActionCard({ action, idx }: { action: any, idx: number }) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: idx * 0.1 }}
      className="bg-card rounded-2xl p-6 border border-border hover:border-primary/50 transition-colors shadow-sm"
    >
      <div className="flex items-center gap-2 mb-3">
        <span className="w-2 h-2 rounded-full bg-primary" />
        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{action.category}</span>
      </div>
      <h4 className="text-lg font-bold text-foreground mb-2">{action.title}</h4>
      <p className="text-muted-foreground text-sm mb-4 leading-relaxed">{action.description}</p>
      <div className="text-xs font-semibold text-primary bg-primary/10 inline-block px-2 py-1 rounded">
        Expected Impact: {action.expectedImpact}
      </div>
    </motion.div>
  );
}
