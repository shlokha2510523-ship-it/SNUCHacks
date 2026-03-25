import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface MetricBarProps {
  label: string;
  score: number; // 0 to 10
  isUser: boolean;
  delay?: number;
}

export function MetricBar({ label, score, isUser, delay = 0 }: MetricBarProps) {
  const percentage = (score / 10) * 100;
  
  return (
    <div className="flex items-center gap-4 group">
      <div className={cn(
        "w-32 text-sm font-medium truncate text-right transition-colors",
        isUser ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
      )}>
        {label}
      </div>
      
      <div className="flex-1 h-8 bg-muted/30 rounded-r-lg rounded-l-sm relative overflow-hidden flex items-center border border-white/5">
        <motion.div
          initial={{ width: 0 }}
          whileInView={{ width: `${percentage}%` }}
          viewport={{ once: true }}
          transition={{ duration: 1, delay, ease: [0.16, 1, 0.3, 1] }}
          className={cn(
            "absolute inset-y-0 left-0 rounded-r-lg",
            isUser 
              ? "bg-gradient-to-r from-primary/80 to-primary" 
              : "bg-gradient-to-r from-muted to-muted-foreground/40"
          )}
        />
        <motion.span 
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: delay + 0.5 }}
          className={cn(
            "relative z-10 ml-3 font-mono text-sm font-bold mix-blend-difference",
            percentage > 15 ? "text-white" : "text-foreground ml-full pl-2"
          )}
        >
          {score.toFixed(1)}
        </motion.span>
      </div>
    </div>
  );
}
