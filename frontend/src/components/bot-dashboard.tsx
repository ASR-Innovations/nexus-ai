'use client';

import { motion } from 'framer-motion';
import { Activity, DollarSign, Clock, CheckCircle } from 'lucide-react';
import { useBotStatus, useBotDashboard, useBotMetrics } from '@/hooks/use-bot';
import { StatCard } from './ui/stat-card';
import { AnimatedCard } from './ui/animated-card';
import { BotControlPanel } from './bot-control-panel';
import { ProtocolStatus } from './protocol-status';
import { ExecutionTracker } from './execution-tracker';

export function BotDashboard() {
  const { data: status, isLoading: statusLoading } = useBotStatus();
  const { data: dashboard, isLoading: dashboardLoading } = useBotDashboard();
  const { data: metrics, isLoading: metricsLoading } = useBotMetrics();

  if (statusLoading || dashboardLoading || metricsLoading) {
    return <DashboardSkeleton />;
  }

  // Mock execution data for demo
  const mockExecution = {
    intentId: 12345,
    steps: [
      { id: '1', name: 'Validate Intent', status: 'completed' as const, timestamp: Date.now() - 5000, details: 'Intent validated successfully' },
      { id: '2', name: 'Check Balances', status: 'completed' as const, timestamp: Date.now() - 4000, details: 'Sufficient balance confirmed' },
      { id: '3', name: 'Execute Swap', status: 'in_progress' as const, details: 'Swapping PAS to USDT on Hydration' },
      { id: '4', name: 'Confirm Transaction', status: 'pending' as const },
      { id: '5', name: 'Update Records', status: 'pending' as const },
    ],
    overallStatus: 'in_progress' as const,
  };

  return (
    <div className="min-h-full bg-white dark:bg-black overflow-auto">
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-1">
              Bot Dashboard
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Real-time monitoring and control of your DeFi agent
            </p>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
            <div className={`w-2 h-2 rounded-full ${status?.isMonitoring ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
              {status?.isMonitoring ? 'Active' : 'Inactive'}
            </span>
          </div>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Executions"
            value={metrics?.totalExecutions || 0}
            change="+12% from last week"
            changeType="positive"
            icon={Activity}
            delay={0}
          />
          <StatCard
            title="Success Rate"
            value={`${metrics?.successRate || 0}%`}
            change="+5% improvement"
            changeType="positive"
            icon={CheckCircle}
            delay={0.1}
          />
          <StatCard
            title="Avg Execution Time"
            value={`${metrics?.avgExecutionTime || 0}s`}
            change="-2s faster"
            changeType="positive"
            icon={Clock}
            delay={0.2}
          />
          <StatCard
            title="Total Value"
            value={metrics?.totalValueProcessed || '$0'}
            change="+$50K this week"
            changeType="positive"
            icon={DollarSign}
            delay={0.3}
          />
        </div>

        {/* Control Panel and Execution Tracker */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <BotControlPanel />
          <div className="lg:col-span-2">
            <ExecutionTracker {...mockExecution} />
          </div>
        </div>

        {/* Protocol Status */}
        <ProtocolStatus />

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Activity */}
          <AnimatedCard className="lg:col-span-2 p-6" delay={0.4}>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Recent Activity</h2>
            <div className="space-y-2">
              {dashboard?.recentActivity?.slice(0, 5).map((activity, index) => (
                <motion.div
                  key={activity.intentId}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 + index * 0.1 }}
                  className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-900/50 hover:bg-gray-100 dark:hover:bg-gray-800/60 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${
                      activity.status === 'completed' ? 'bg-green-500' :
                      activity.status === 'failed' ? 'bg-red-500' :
                      'bg-yellow-500'
                    }`} />
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        Intent #{activity.intentId}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{activity.type}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{activity.value}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {new Date(activity.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </AnimatedCard>

          {/* Protocol Distribution */}
          <AnimatedCard className="p-6" delay={0.5}>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Protocol Distribution</h2>
            <div className="space-y-4">
              {dashboard?.protocolDistribution?.map((protocol, index) => (
                <motion.div
                  key={protocol.protocol}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.6 + index * 0.1 }}
                  className="space-y-1.5"
                >
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">{protocol.protocol}</span>
                    <span className="text-gray-900 dark:text-white font-medium">{protocol.count}</span>
                  </div>
                  <div className="h-1.5 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(protocol.count / (dashboard?.overview?.totalExecutions || 1)) * 100}%` }}
                      transition={{ duration: 1, delay: 0.7 + index * 0.1 }}
                      className="h-full bg-purple-500 rounded-full"
                    />
                  </div>
                </motion.div>
              ))}
            </div>
          </AnimatedCard>
        </div>

        {/* Performance Chart */}
        <AnimatedCard className="p-6" delay={0.6}>
          <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Performance Over Time</h2>
          <div className="h-48 flex items-end justify-between gap-1">
            {dashboard?.performanceChart?.map((data, index) => (
              <motion.div
                key={data.timestamp}
                initial={{ height: 0 }}
                animate={{ height: `${data.successRate}%` }}
                transition={{ duration: 0.5, delay: 0.7 + index * 0.05 }}
                className="flex-1 bg-purple-500/60 dark:bg-purple-500/80 rounded-t hover:bg-purple-500 transition-colors cursor-pointer relative group"
                title={`${data.executions} executions - ${data.successRate}% success`}
              >
                <div className="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 bg-gray-900 dark:bg-gray-700 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                  {data.executions} exec · {data.successRate}%
                </div>
              </motion.div>
            ))}
          </div>
        </AnimatedCard>
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="min-h-full bg-white dark:bg-black overflow-auto">
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        <div className="h-14 bg-gray-100 dark:bg-gray-900 rounded-lg animate-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 bg-gray-100 dark:bg-gray-900 rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="h-80 bg-gray-100 dark:bg-gray-900 rounded-xl animate-pulse" />
          <div className="lg:col-span-2 h-80 bg-gray-100 dark:bg-gray-900 rounded-xl animate-pulse" />
        </div>
      </div>
    </div>
  );
}
