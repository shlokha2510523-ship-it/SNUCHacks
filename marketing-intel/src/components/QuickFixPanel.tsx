import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Wand2, X, ChevronRight, Copy, CheckCircle2, Loader2 } from "lucide-react";
import { useApplyQuickFix } from "@workspace/api-client-react";
import { QuickFixRequestFixType } from "@workspace/api-client-react/src/generated/api.schemas";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface QuickFixPanelProps {
  companySetId: number;
}

export function QuickFixPanel({ companySetId }: QuickFixPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [fixType, setFixType] = useState<QuickFixRequestFixType>("ad_caption");
  const [content, setContent] = useState("");
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  
  const { toast } = useToast();
  const { mutate, isPending, data } = useApplyQuickFix();

  const handleFix = () => {
    if (!content.trim()) return;
    mutate({
      id: companySetId,
      data: {
        fixType,
        currentContent: content,
        tone: "professional, engaging",
      }
    });
  };

  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    toast({ title: "Copied to clipboard!" });
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-8 right-8 z-40 px-6 py-4 rounded-full bg-primary text-primary-foreground font-semibold shadow-[0_0_30px_rgba(6,182,212,0.4)] hover:shadow-[0_0_40px_rgba(6,182,212,0.6)] hover:-translate-y-1 transition-all duration-300 flex items-center gap-2"
      >
        <Wand2 className="w-5 h-5" />
        AI Quick Fix
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 right-0 w-full max-w-xl bg-card border-l border-border z-50 shadow-2xl flex flex-col"
            >
              <div className="p-6 border-b border-border flex items-center justify-between bg-background/50">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/20 rounded-lg">
                    <Wand2 className="w-5 h-5 text-primary" />
                  </div>
                  <h2 className="text-xl font-display font-bold">Marketing Quick Fix</h2>
                </div>
                <button 
                  onClick={() => setIsOpen(false)}
                  className="p-2 hover:bg-muted rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">What needs fixing?</label>
                  <select 
                    value={fixType}
                    onChange={(e) => setFixType(e.target.value as QuickFixRequestFixType)}
                    className="w-full bg-background border border-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all appearance-none"
                  >
                    <option value="ad_caption">Ad Caption</option>
                    <option value="instagram_bio">Instagram Bio</option>
                    <option value="website_headline">Website Headline</option>
                    <option value="ad_cta">Call to Action (CTA)</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Paste your current content</label>
                  <textarea 
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="E.g., Buy our new phone. It has a good battery."
                    className="w-full bg-background border border-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all min-h-[120px] resize-none"
                  />
                </div>

                <button
                  onClick={handleFix}
                  disabled={!content.trim() || isPending}
                  className="w-full py-4 rounded-xl font-bold bg-gradient-to-r from-primary to-secondary text-white shadow-lg disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Generating Magic...
                    </>
                  ) : (
                    <>
                      Improve with AI <ChevronRight className="w-5 h-5" />
                    </>
                  )}
                </button>

                {data && (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-8 space-y-6 border-t border-border pt-6"
                  >
                    <div className="bg-primary/5 border border-primary/20 rounded-xl p-5">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-primary font-semibold flex items-center gap-2">
                          <Zap className="w-4 h-4" /> Best Option
                        </h3>
                        <button onClick={() => handleCopy(data.improved, -1)} className="text-muted-foreground hover:text-primary transition-colors">
                          {copiedIndex === -1 ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                      <p className="text-foreground text-lg leading-relaxed">{data.improved}</p>
                    </div>

                    <div className="space-y-3">
                      <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Alternatives</h4>
                      {data.alternatives.map((alt, i) => (
                        <div key={i} className="group bg-muted/30 border border-border hover:border-primary/30 rounded-xl p-4 transition-all">
                          <div className="flex items-start justify-between gap-4">
                            <p className="text-foreground">{alt}</p>
                            <button 
                              onClick={() => handleCopy(alt, i)} 
                              className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-primary transition-all shrink-0"
                            >
                              {copiedIndex === i ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="bg-background rounded-xl p-4 border border-border text-sm">
                      <strong className="text-foreground block mb-1">Why this works better:</strong>
                      <p className="text-muted-foreground leading-relaxed">{data.explanation}</p>
                    </div>
                  </motion.div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

// Missing icon from lucide-react in the file context
function Zap(props: any) {
  return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
}
