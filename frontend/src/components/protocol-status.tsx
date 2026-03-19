'use client';

import { motion } from 'framer-motion';
import { Activity, TrendingUp, Droplet, Zap } from 'lucide-react';
import { AnimatedCard } from './ui/animated-card';

interface ProtocolCardProps {
  name: string;
  status: 'healthy' | 'degraded' | 'down';
  tvl: string;
  apy: number;
  volume24h: string;
  icon: React.ReactNode;
  delay?: number;
}

function ProtocolCard({ name, status, tvl, apy, volume24h, icon, delay = 0 }: ProtocolCardProps) {
  const statusColors = {
    healthy: 'bg-green-500',
    degraded: 'bg-yellow-500',
    down: 'bg-red-500',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      whileHover={{ scale: 1.03, y: -5 }}
      className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 p-6 shadow-xl"
    >
      {/* Animated background gradient */}
      <motion.div
        animate={{
          scale: [1, 1.2, 1],
          rotate: [0, 90, 0],
        }}
        transition={{
          duration: 10,
          repeat: Infinity,
          ease: "linear",
        }}
        className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-purple-500/20 to-blue-500/20 rounded-full blur-3xl"
      />

      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/20">
              {icon}
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">{name}</h3>
              <div className="flex items-center gap-2 mt-1">
                <div className={`w-2 h-2 rounded-full ${statusColors[status]} animate-pulse`} />
                <span className="text-xs text-gray-400 capitalize">{status}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mt-6">
          <div>
            <p className="text-xs text-gray-400 mb-1">TVL</p>
            <p className="text-sm font-bold text-white">{tvl}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">APY</p>
            <p className="text-sm font-bold text-green-400">{apy}%</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">24h Vol</p>
            <p className="text-sm font-bold text-white">{volume24h}</p>
          </div>
        </div>

        {/* Activity indicator */}
        <motion.div
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="mt-4 flex items-center gap-2 text-xs text-purple-400"
        >
          <Activity className="w-3 h-3" />
          <span>Live data streaming</span>
        </motion.div>
      </div>
    </motion.div>
  );
}

export function ProtocolStatus() {
  const protocols = [
    {
      name: 'Hydration',
      status: 'healthy' as const,
      tvl: '$45.2M',
      apy: 12.5,
      volume24h: '$2.1M',
      icon: <Droplet className="w-5 h-5 text-blue-400" />,
    },
    {
      name: 'Bifrost',
      status: 'healthy' as const,
      tvl: '$32.8M',
      apy: 8.3,
      volume24h: '$1.5M',
      icon: <TrendingUp className="w-5 h-5 text-green-400" />,
    },
    {
      name: 'StellaSwap',
      status: 'healthy' as const,
      tvl: '$28.5M',
      apy: 15.2,
      volume24h: '$3.2M',
      icon: <Zap className="w-5 h-5 text-yellow-400" />,
    },
    {
      name: 'BeamSwap',
      status: 'healthy' as const,
      tvl: '$18.3M',
      apy: 11.8,
      volume24h: '$1.8M',
      icon: <Zap className="w-5 h-5 text-purple-400" />,
    },
  ];

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h2 className="text-2xl font-bold text-white">Protocol Status</h2>
          <p className="text-gray-400 mt-1">Real-time monitoring of integrated protocols</p>
        </div>
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full"
        />
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {protocols.map((protocol, index) => (
          <ProtocolCard key={protocol.name} {...protocol} delay={index * 0.1} />
        ))}
      </div>
    </div>
  );
}
