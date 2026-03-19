'use client';

import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string | number;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  icon: LucideIcon;
  delay?: number;
}

export function StatCard({ title, value, change, changeType = 'neutral', icon: Icon, delay = 0 }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, delay }}
      whileHover={{ scale: 1.05, y: -5 }}
      className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-500/10 to-blue-500/10 backdrop-blur-xl border border-white/20 p-6 shadow-xl"
    >
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-500/20 to-transparent rounded-full blur-3xl" />
      
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-medium text-gray-400">{title}</span>
          <div className="p-2 rounded-lg bg-purple-500/20">
            <Icon className="w-5 h-5 text-purple-400" />
          </div>
        </div>
        
        <div className="space-y-2">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: delay + 0.2 }}
            className="text-3xl font-bold text-white"
          >
            {value}
          </motion.div>
          
          {change && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: delay + 0.3 }}
              className={cn(
                'text-sm font-medium',
                changeType === 'positive' && 'text-green-400',
                changeType === 'negative' && 'text-red-400',
                changeType === 'neutral' && 'text-gray-400'
              )}
            >
              {change}
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
