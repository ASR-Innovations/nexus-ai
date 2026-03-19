'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle, Clock, ArrowRight, Loader2 } from 'lucide-react';
import { AnimatedCard } from './ui/animated-card';

interface ExecutionStep {
  id: string;
  name: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  timestamp?: number;
  details?: string;
}

interface ExecutionTrackerProps {
  intentId: number;
  steps: ExecutionStep[];
  overallStatus: 'pending' | 'in_progress' | 'completed' | 'failed';
}

export function ExecutionTracker({ intentId, steps, overallStatus }: ExecutionTrackerProps) {
  const getStatusIcon = (status: ExecutionStep['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-400" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-400" />;
      case 'in_progress':
        return <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />;
      default:
        return <Clock className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusColor = (status: ExecutionStep['status']) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500';
      case 'failed':
        return 'bg-red-500';
      case 'in_progress':
        return 'bg-blue-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <AnimatedCard className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-bold text-white">Intent #{intentId}</h3>
          <p className="text-sm text-gray-400 mt-1">Execution Progress</p>
        </div>
        <motion.div
          animate={{
            scale: overallStatus === 'in_progress' ? [1, 1.1, 1] : 1,
          }}
          transition={{ duration: 1, repeat: overallStatus === 'in_progress' ? Infinity : 0 }}
          className={`px-4 py-2 rounded-full ${
            overallStatus === 'completed' ? 'bg-green-500/20 text-green-400' :
            overallStatus === 'failed' ? 'bg-red-500/20 text-red-400' :
            overallStatus === 'in_progress' ? 'bg-blue-500/20 text-blue-400' :
            'bg-gray-500/20 text-gray-400'
          } font-medium text-sm`}
        >
          {overallStatus.replace('_', ' ').toUpperCase()}
        </motion.div>
      </div>

      <div className="space-y-4">
        <AnimatePresence>
          {steps.map((step, index) => (
            <motion.div
              key={step.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ delay: index * 0.1 }}
              className="relative"
            >
              {/* Connection line */}
              {index < steps.length - 1 && (
                <div className="absolute left-[18px] top-10 w-0.5 h-8 bg-gradient-to-b from-purple-500/50 to-transparent" />
              )}

              <div className="flex items-start gap-4 p-4 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
                <motion.div
                  animate={{
                    scale: step.status === 'in_progress' ? [1, 1.2, 1] : 1,
                  }}
                  transition={{ duration: 1, repeat: step.status === 'in_progress' ? Infinity : 0 }}
                  className="flex-shrink-0"
                >
                  {getStatusIcon(step.status)}
                </motion.div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="text-sm font-medium text-white">{step.name}</h4>
                    {step.timestamp && (
                      <span className="text-xs text-gray-400">
                        {new Date(step.timestamp).toLocaleTimeString()}
                      </span>
                    )}
                  </div>
                  {step.details && (
                    <p className="text-xs text-gray-400">{step.details}</p>
                  )}

                  {/* Progress bar for in-progress steps */}
                  {step.status === 'in_progress' && (
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: '100%' }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="mt-2 h-1 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"
                    />
                  )}
                </div>

                {index < steps.length - 1 && (
                  <ArrowRight className="w-4 h-4 text-gray-600 flex-shrink-0" />
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Overall progress */}
      <div className="mt-6 pt-6 border-t border-white/10">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-400">Overall Progress</span>
          <span className="text-sm font-medium text-white">
            {steps.filter(s => s.status === 'completed').length} / {steps.length}
          </span>
        </div>
        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${(steps.filter(s => s.status === 'completed').length / steps.length) * 100}%` }}
            transition={{ duration: 0.5 }}
            className="h-full bg-gradient-to-r from-purple-500 to-blue-500"
          />
        </div>
      </div>
    </AnimatedCard>
  );
}
