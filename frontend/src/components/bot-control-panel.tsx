'use client';

import { motion } from 'framer-motion';
import { Play, Pause, Settings, RefreshCw } from 'lucide-react';
import { useBotStatus, useStartMonitoring, useStopMonitoring } from '@/hooks/use-bot';
import { AnimatedCard } from './ui/animated-card';

export function BotControlPanel() {
  const { data: status, isLoading, refetch } = useBotStatus();
  const startMonitoring = useStartMonitoring();
  const stopMonitoring = useStopMonitoring();

  const handleToggleMonitoring = () => {
    if (status?.isMonitoring) {
      stopMonitoring.mutate();
    } else {
      startMonitoring.mutate();
    }
  };

  return (
    <AnimatedCard className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white">Bot Control</h2>
          <p className="text-sm text-gray-400 mt-1">Manage your autonomous agent</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.1, rotate: 180 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => refetch()}
          className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
        >
          <RefreshCw className="w-5 h-5 text-white" />
        </motion.button>
      </div>

      {/* Status Display */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="p-4 rounded-lg bg-white/5">
          <p className="text-xs text-gray-400 mb-1">Status</p>
          <div className="flex items-center gap-2">
            <motion.div
              animate={{
                scale: status?.isMonitoring ? [1, 1.2, 1] : 1,
              }}
              transition={{ duration: 1, repeat: status?.isMonitoring ? Infinity : 0 }}
              className={`w-2 h-2 rounded-full ${
                status?.isMonitoring ? 'bg-green-400' : 'bg-gray-400'
              }`}
            />
            <span className="text-sm font-medium text-white">
              {status?.isMonitoring ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>

        <div className="p-4 rounded-lg bg-white/5">
          <p className="text-xs text-gray-400 mb-1">Health</p>
          <span className={`text-sm font-medium ${
            status?.health?.status === 'healthy' ? 'text-green-400' :
            status?.health?.status === 'degraded' ? 'text-yellow-400' :
            'text-red-400'
          }`}>
            {status?.health?.status || 'Unknown'}
          </span>
        </div>
      </div>

      {/* Control Buttons */}
      <div className="grid grid-cols-2 gap-4">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleToggleMonitoring}
          disabled={startMonitoring.isPending || stopMonitoring.isPending}
          className={`p-4 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors ${
            status?.isMonitoring
              ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
              : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {status?.isMonitoring ? (
            <>
              <Pause className="w-5 h-5" />
              Stop
            </>
          ) : (
            <>
              <Play className="w-5 h-5" />
              Start
            </>
          )}
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="p-4 rounded-lg bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 font-medium flex items-center justify-center gap-2 transition-colors"
        >
          <Settings className="w-5 h-5" />
          Configure
        </motion.button>
      </div>

      {/* Bot Configuration */}
      {status?.config && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="mt-6 pt-6 border-t border-white/10 space-y-3"
        >
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">Risk Tolerance</span>
            <span className="text-white font-medium capitalize">{status.config.riskTolerance}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">Max Active Intents</span>
            <span className="text-white font-medium">{status.config.maxActiveIntents}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">Auto Execute</span>
            <span className={`font-medium ${status.config.autoExecute ? 'text-green-400' : 'text-gray-400'}`}>
              {status.config.autoExecute ? 'Enabled' : 'Disabled'}
            </span>
          </div>
          <div className="text-sm">
            <span className="text-gray-400 block mb-2">Specialties</span>
            <div className="flex flex-wrap gap-2">
              {status.config.specialties.map((specialty) => (
                <span
                  key={specialty}
                  className="px-2 py-1 rounded-full bg-purple-500/20 text-purple-400 text-xs"
                >
                  {specialty}
                </span>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatedCard>
  );
}
