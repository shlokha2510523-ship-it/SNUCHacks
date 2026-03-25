import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";

interface LoadingScreenProps {
  step: string;
  subtext?: string;
}

export function LoadingScreen({ step, subtext }: LoadingScreenProps) {
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center relative overflow-hidden bg-background">
      {/* Background ambient glow */}
      <div className="absolute inset-0 z-0 flex items-center justify-center">
        <div className="w-[40rem] h-[40rem] bg-primary/10 rounded-full blur-[100px] animate-pulse" />
      </div>

      <div className="z-10 flex flex-col items-center max-w-md text-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 8, ease: "linear" }}
          className="relative w-32 h-32 mb-12 flex items-center justify-center"
        >
          <svg className="absolute inset-0 w-full h-full text-muted stroke-current" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="48" fill="none" strokeWidth="2" strokeDasharray="10 4" />
          </svg>
          <svg className="absolute inset-0 w-full h-full text-primary stroke-current" viewBox="0 0 100 100">
            <motion.circle 
              cx="50" cy="50" r="48" fill="none" strokeWidth="2" 
              initial={{ strokeDasharray: "0 300" }}
              animate={{ strokeDasharray: "150 150", rotate: 360 }}
              transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
            />
          </svg>
          <div className="bg-card rounded-full p-4 border border-border shadow-xl">
            <Loader2 className="w-10 h-10 text-primary animate-spin" />
          </div>
        </motion.div>

        <motion.h2 
          key={step}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-3xl font-display font-bold text-foreground mb-4"
        >
          {step}
        </motion.h2>
        
        {subtext && (
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-muted-foreground text-lg"
          >
            {subtext}
          </motion.p>
        )}

        <div className="w-64 h-1 bg-muted rounded-full mt-12 overflow-hidden">
          <motion.div 
            className="h-full bg-gradient-to-r from-primary to-secondary"
            initial={{ width: "0%" }}
            animate={{ width: "100%" }}
            transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
          />
        </div>
      </div>
    </div>
  );
}
