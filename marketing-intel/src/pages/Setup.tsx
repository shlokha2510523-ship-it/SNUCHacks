import { useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Search, Zap, Shield, Activity, ChevronRight } from "lucide-react";
import { useAutoDiscoverCompanies } from "@workspace/api-client-react";

const DISCOVERY_STEPS = [
  { icon: Search,    label: "Identifying key competitors by market share & positioning..." },
  { icon: Shield,    label: "Validating official websites & social profiles..." },
  { icon: Activity,  label: "Mapping ad library presence & spend signals..." },
  { icon: Zap,       label: "Structuring intelligence pipeline..." },
];

const EXAMPLE_BRANDS = ["Apple", "Samsung", "OnePlus", "Xiaomi", "Sony", "Google", "Motorola", "Realme"];

export default function Setup() {
  const [, setLocation] = useLocation();
  const [companyName, setCompanyName] = useState("");
  const [stepIndex, setStepIndex] = useState(0);
  const { mutate, isPending, isError, error } = useAutoDiscoverCompanies();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim() || isPending) return;

    // Cycle through discovery steps while waiting
    const interval = setInterval(() => {
      setStepIndex((i) => (i + 1) % DISCOVERY_STEPS.length);
    }, 2200);

    mutate(
      { data: { companyName: companyName.trim() } },
      {
        onSuccess: (res) => {
          clearInterval(interval);
          setLocation(`/report/${res.id}?orchestrate=true`);
        },
        onError: () => {
          clearInterval(interval);
          setStepIndex(0);
        },
      }
    );
  };

  const CurrentStepIcon = DISCOVERY_STEPS[stepIndex].icon;

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 py-20 relative overflow-hidden">
      {/* Ambient background */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[60rem] h-[30rem] bg-primary/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-0 w-[30rem] h-[30rem] bg-secondary/5 rounded-full blur-[100px]" />
      </div>

      <div className="relative z-10 w-full max-w-2xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-14"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-6">
            <Zap className="w-3.5 h-3.5" /> Fully Automated Intelligence Engine
          </div>
          <h1 className="text-5xl md:text-6xl font-display font-extrabold tracking-tight mb-5 leading-tight">
            Enter your <span className="text-gradient">brand.</span><br />
            <span className="text-muted-foreground text-4xl md:text-5xl font-bold">We handle the rest.</span>
          </h1>
          <p className="text-muted-foreground text-lg max-w-lg mx-auto leading-relaxed">
            Type your consumer electronics brand name. Our engine auto-identifies competitors, fetches their web presence, social data, and ad intelligence — no manual input needed.
          </p>
        </motion.div>

        {/* Main Input Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-panel rounded-3xl p-8 border border-border/60 relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent" />

          <AnimatePresence mode="wait">
            {!isPending ? (
              <motion.form
                key="form"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onSubmit={handleSubmit}
                className="space-y-6"
              >
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                    <Search className="w-4 h-4" /> Company Name
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="e.g. Apple, Samsung, OnePlus..."
                      className="w-full bg-background/50 border border-border focus:border-primary focus:ring-4 focus:ring-primary/20 rounded-2xl px-5 py-5 text-xl text-foreground placeholder:text-muted-foreground/40 focus:outline-none transition-all"
                      autoFocus
                    />
                  </div>
                  {isError && (
                    <p className="text-sm text-destructive mt-1">
                      {(error as any)?.message || "Discovery failed. Please try again."}
                    </p>
                  )}
                </div>

                {/* Example brands */}
                <div className="flex flex-wrap gap-2">
                  <span className="text-xs text-muted-foreground/60 self-center">Try:</span>
                  {EXAMPLE_BRANDS.map((brand) => (
                    <button
                      key={brand}
                      type="button"
                      onClick={() => setCompanyName(brand)}
                      className="px-3 py-1 text-sm rounded-full bg-muted/50 hover:bg-primary/10 hover:text-primary border border-border/50 hover:border-primary/30 text-muted-foreground transition-all"
                    >
                      {brand}
                    </button>
                  ))}
                </div>

                <button
                  type="submit"
                  disabled={!companyName.trim()}
                  className="w-full py-5 rounded-2xl font-bold text-lg bg-gradient-to-r from-primary to-primary/80 hover:from-primary hover:to-secondary text-primary-foreground shadow-[0_0_40px_rgba(6,182,212,0.25)] hover:shadow-[0_0_60px_rgba(168,85,247,0.35)] hover:-translate-y-1 transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-3"
                >
                  Launch Intelligence Engine <ArrowRight className="w-5 h-5" />
                </button>
              </motion.form>
            ) : (
              /* Discovery in progress */
              <motion.div
                key="loading"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="py-8 flex flex-col items-center text-center gap-6"
              >
                <div className="relative w-20 h-20 flex items-center justify-center">
                  <motion.div
                    className="absolute inset-0 rounded-full border-2 border-primary/30"
                    animate={{ scale: [1, 1.4, 1], opacity: [0.5, 0, 0.5] }}
                    transition={{ repeat: Infinity, duration: 2 }}
                  />
                  <div className="w-14 h-14 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center">
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={stepIndex}
                        initial={{ opacity: 0, scale: 0.6, rotate: -15 }}
                        animate={{ opacity: 1, scale: 1, rotate: 0 }}
                        exit={{ opacity: 0, scale: 0.6, rotate: 15 }}
                        transition={{ duration: 0.3 }}
                      >
                        <CurrentStepIcon className="w-6 h-6 text-primary" />
                      </motion.div>
                    </AnimatePresence>
                  </div>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground/60 uppercase tracking-widest mb-2 font-medium">
                    Analyzing: <span className="text-primary">{companyName}</span>
                  </p>
                  <AnimatePresence mode="wait">
                    <motion.p
                      key={stepIndex}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.35 }}
                      className="text-lg font-semibold text-foreground"
                    >
                      {DISCOVERY_STEPS[stepIndex].label}
                    </motion.p>
                  </AnimatePresence>
                </div>

                {/* Step dots */}
                <div className="flex gap-2">
                  {DISCOVERY_STEPS.map((_, i) => (
                    <motion.div
                      key={i}
                      className={`h-1.5 rounded-full transition-all duration-500 ${
                        i === stepIndex ? "w-6 bg-primary" : i < stepIndex ? "w-3 bg-primary/40" : "w-3 bg-muted"
                      }`}
                    />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* What gets auto-detected */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-3"
        >
          {[
            { label: "4–5 Competitors", sub: "Auto-identified" },
            { label: "Web Presence", sub: "Websites & UX" },
            { label: "Social Profiles", sub: "Instagram & FB" },
            { label: "Ad Intelligence", sub: "Spend & copy" },
          ].map((item) => (
            <div key={item.label} className="glass-panel rounded-2xl p-4 text-center border border-border/40">
              <ChevronRight className="w-4 h-4 text-primary mx-auto mb-2" />
              <p className="text-sm font-semibold text-foreground">{item.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{item.sub}</p>
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  );
}
