import { Link } from "wouter";
import { motion } from "framer-motion";
import { ArrowRight, Plus, Activity, Trophy, Crosshair } from "lucide-react";
import { useListCompanies } from "@workspace/api-client-react";

export default function Home() {
  const { data: companies, isLoading } = useListCompanies();

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/30">
      {/* Top nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 border-b border-border/40 bg-background/70 backdrop-blur-md">
        <span className="text-xl font-display font-extrabold tracking-tight text-gradient">ADSPYRE</span>
        <Link href="/setup" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity">
          <Plus className="w-4 h-4" /> New Analysis
        </Link>
      </nav>

      <div className="absolute inset-0 z-0">
        <img 
          src={`${import.meta.env.BASE_URL}images/data-mesh.png`} 
          alt="Data Mesh Background" 
          className="w-full h-[60vh] object-cover opacity-20 mask-image:linear-gradient(to_bottom,black,transparent)"
        />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6 pt-32 pb-24">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-3xl"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-6">
            <Activity className="w-4 h-4" /> Competitive Intelligence
          </div>
          <h1 className="text-6xl md:text-7xl font-display font-extrabold tracking-tight mb-6 leading-tight">
            Know where you <span className="text-gradient">stand.</span><br/>
            Know where they <span className="text-muted-foreground">fail.</span>
          </h1>
          <p className="text-xl text-muted-foreground mb-10 max-w-2xl leading-relaxed">
            Consolidate website UX, social sentiment, ad spend, and product features into a single, cinematic competitive report. Uncover missed opportunities instantly.
          </p>

          <Link href="/setup" className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-primary text-primary-foreground font-bold text-lg hover:shadow-[0_0_40px_rgba(6,182,212,0.4)] hover:-translate-y-1 transition-all duration-300">
            Start New Analysis <ArrowRight className="w-5 h-5" />
          </Link>
        </motion.div>

        <div className="mt-32">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-display font-bold">Recent Reports</h2>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-48 rounded-2xl bg-muted/20 animate-pulse border border-border" />
              ))}
            </div>
          ) : companies && companies.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {companies.map((set, i) => (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  key={set.id}
                >
                  <Link href={`/report/${set.id}`} className="block h-full group">
                    <div className="h-full glass-panel rounded-2xl p-6 hover:border-primary/50 transition-all duration-300 hover:shadow-2xl hover:shadow-primary/5 flex flex-col">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="text-xl font-bold mb-1 group-hover:text-primary transition-colors">{set.userCompany.name}</h3>
                          <p className="text-sm text-muted-foreground">vs {set.competitors.length} competitors</p>
                        </div>
                        <span className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${
                          set.status === 'complete' ? 'bg-green-500/10 text-green-500 border-green-500/20' : 
                          set.status === 'error' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                          'bg-primary/10 text-primary border-primary/20'
                        }`}>
                          {set.status.toUpperCase()}
                        </span>
                      </div>
                      
                      <div className="mt-auto pt-4 border-t border-border flex items-center text-sm text-muted-foreground">
                        <span>{new Date(set.createdAt).toLocaleDateString()}</span>
                        <ArrowRight className="w-4 h-4 ml-auto opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center py-20 glass-panel rounded-3xl border-dashed">
              <Trophy className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium text-foreground mb-2">No reports yet</h3>
              <p className="text-muted-foreground mb-6">Run your first competitive analysis to see how you stack up.</p>
              <Link href="/setup" className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-secondary text-secondary-foreground font-semibold hover:opacity-90 transition-opacity">
                <Plus className="w-4 h-4" /> Create Report
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
