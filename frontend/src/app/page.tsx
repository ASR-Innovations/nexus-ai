'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { Bot, TrendingUp, Shield, Zap, ArrowRight } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 overflow-hidden">
      {/* Subtle background gradient */}
      <div className="absolute inset-0 bg-linear-to-br from-gray-50 to-white dark:from-gray-950 dark:to-gray-900" />

      <div className="relative z-10 max-w-6xl mx-auto px-6 py-24">
        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center mb-24"
        >
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="text-5xl md:text-6xl font-bold text-gray-900 dark:text-white mb-6 leading-tight"
          >
            Autonomous DeFi
            <br />
            <span className="bg-linear-to-r from-purple-600 to-blue-600 dark:from-purple-400 dark:to-blue-400 bg-clip-text text-transparent">
              Agents
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-lg text-gray-600 dark:text-gray-400 mb-10 max-w-2xl mx-auto leading-relaxed"
          >
            Execute complex DeFi strategies across multiple chains with intelligent autonomous agents. Maximize yields, minimize risks.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="flex items-center justify-center gap-3"
          >
            <Link href="/chat">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="px-7 py-3 rounded-lg bg-linear-to-r from-purple-600 to-blue-600 text-white font-medium shadow-md hover:shadow-lg transition-shadow"
              >
                Get Started
              </motion.button>
            </Link>
            <Link href="/agents">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="px-7 py-3 rounded-lg border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white font-medium hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
              >
                Explore Agents
              </motion.button>
            </Link>
          </motion.div>
        </motion.div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-20">
          {[
            {
              icon: Bot,
              title: 'Autonomous Agents',
              description: 'AI-powered agents that execute complex DeFi strategies 24/7',
            },
            {
              icon: TrendingUp,
              title: 'Yield Optimization',
              description: 'Automatically discover and capture the best yield opportunities',
            },
            {
              icon: Shield,
              title: 'Security First',
              description: 'Multi-layer validation and comprehensive risk management',
            },
            {
              icon: Zap,
              title: 'Cross-Chain Ready',
              description: 'Seamless operation across the entire Polkadot ecosystem',
            },
          ].map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 + index * 0.1 }}
              className="flex gap-4"
            >
              <div className="shrink-0">
                <div className="flex items-center justify-center h-12 w-12 rounded-lg bg-purple-600/10 dark:bg-purple-500/10">
                  <feature.icon className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">{feature.title}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">{feature.description}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Stats Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.8 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-8 py-12 border-t border-gray-200 dark:border-gray-800"
        >
          {[
            { label: 'Total Value Locked', value: '$125M+' },
            { label: 'Active Agents', value: '1,234' },
            { label: 'Successful Executions', value: '50K+' },
          ].map((stat) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
              className="text-center"
            >
              <div className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                {stat.value}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">{stat.label}</div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </div>
  );
}
