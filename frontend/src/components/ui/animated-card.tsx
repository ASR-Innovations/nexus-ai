'use client';

import { motion } from 'framer-motion';
import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface AnimatedCardProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  hover?: boolean;
}

export function AnimatedCard({ children, className, delay = 0, hover = true }: AnimatedCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      whileHover={hover ? { scale: 1.02, y: -5 } : undefined}
      className={cn(
        'rounded-xl bg-gradient-to-br from-white/10 to-white/5',
        'backdrop-blur-xl border border-white/20',
        'shadow-2xl shadow-purple-500/10',
        'transition-all duration-300',
        className
      )}
    >
      {children}
    </motion.div>
  );
}
