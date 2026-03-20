'use client';

import { useState, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

// Time period types
type TimePeriod = '7d' | '30d' | '90d' | '1y';

interface PerformanceDataPoint {
  timestamp: number;
  value: number;
  date: string;
}

interface PerformanceChartProps {
  className?: string;
}

// Mock data generator for portfolio value over time
function generateMockData(period: TimePeriod): PerformanceDataPoint[] {
  const now = Date.now();
  const dataPoints: PerformanceDataPoint[] = [];
  
  let days: number;
  let interval: number;
  
  switch (period) {
    case '7d':
      days = 7;
      interval = 4 * 60 * 60 * 1000; // 4 hours
      break;
    case '30d':
      days = 30;
      interval = 24 * 60 * 60 * 1000; // 1 day
      break;
    case '90d':
      days = 90;
      interval = 24 * 60 * 60 * 1000; // 1 day
      break;
    case '1y':
      days = 365;
      interval = 7 * 24 * 60 * 60 * 1000; // 1 week
      break;
  }
  
  const startTime = now - days * 24 * 60 * 60 * 1000;
  const baseValue = 10000;
  
  // Generate data points with some randomness
  for (let time = startTime; time <= now; time += interval) {
    const progress = (time - startTime) / (now - startTime);
    const trend = baseValue * (1 + progress * 0.15); // 15% growth trend
    const volatility = Math.sin(progress * Math.PI * 4) * baseValue * 0.05; // 5% volatility
    const random = (Math.random() - 0.5) * baseValue * 0.02; // 2% random noise
    
    dataPoints.push({
      timestamp: time,
      value: Math.round(trend + volatility + random),
      date: new Date(time).toISOString(),
    });
  }
  
  return dataPoints;
}

// Format currency
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

// Format date based on period
function formatDate(timestamp: number, period: TimePeriod): string {
  const date = new Date(timestamp);
  
  switch (period) {
    case '7d':
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit' });
    case '30d':
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    case '90d':
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    case '1y':
      return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  }
}

// Custom tooltip component
interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    value: number;
    payload: PerformanceDataPoint;
  }>;
  period: TimePeriod;
}

function CustomTooltip({ active, payload, period }: CustomTooltipProps) {
  if (!active || !payload || !payload.length) {
    return null;
  }

  const data = payload[0].payload;
  const date = new Date(data.timestamp);
  
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="rounded-lg p-3 shadow-lg border bg-light-surface dark:bg-dark-surface border-light-border dark:border-dark-border"
    >
      <p className="text-label-sm text-light-textSecondary dark:text-dark-textSecondary mb-1">
        {date.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: period === '7d' ? '2-digit' : undefined,
          minute: period === '7d' ? '2-digit' : undefined,
        })}
      </p>
      <p className="text-body-md font-semibold text-light-textPrimary dark:text-dark-textPrimary">
        {formatCurrency(data.value)}
      </p>
    </motion.div>
  );
}

export function PerformanceChart({ className }: PerformanceChartProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('7d');
  
  // Generate data for selected period
  const data = useMemo(() => generateMockData(selectedPeriod), [selectedPeriod]);
  
  // Calculate change metrics
  const { percentageChange, absoluteChange, isPositive } = useMemo(() => {
    if (data.length < 2) {
      return { percentageChange: 0, absoluteChange: 0, isPositive: true };
    }
    
    const firstValue = data[0].value;
    const lastValue = data[data.length - 1].value;
    const change = lastValue - firstValue;
    const percentage = (change / firstValue) * 100;
    
    return {
      percentageChange: percentage,
      absoluteChange: change,
      isPositive: change >= 0,
    };
  }, [data]);
  
  // Get current value
  const currentValue = data.length > 0 ? data[data.length - 1].value : 0;
  
  // Determine line color based on performance
  const lineColor = isPositive
    ? 'var(--color-positive, #34C759)'
    : 'var(--color-negative, #FF3B30)';
  
  return (
    <Card className={cn('p-6', className)} hover={false}>
      {/* Header */}
      <div className="mb-6">
        <h3 className="text-h4 font-semibold text-light-textPrimary dark:text-dark-textPrimary mb-2">
          Portfolio Performance
        </h3>
        
        {/* Current value and change */}
        <div className="flex items-baseline gap-3">
          <span className="text-display-small font-bold text-light-textPrimary dark:text-dark-textPrimary">
            {formatCurrency(currentValue)}
          </span>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'text-body-large font-semibold',
                isPositive
                  ? 'text-light-positive dark:text-dark-positive'
                  : 'text-light-negative dark:text-dark-negative'
              )}
            >
              {isPositive ? '+' : ''}
              {percentageChange.toFixed(2)}%
            </span>
            <span
              className={cn(
                'text-body-md',
                isPositive
                  ? 'text-light-positive dark:text-dark-positive'
                  : 'text-light-negative dark:text-dark-negative'
              )}
            >
              ({isPositive ? '+' : ''}
              {formatCurrency(absoluteChange)})
            </span>
          </div>
        </div>
      </div>
      
      {/* Time period selector */}
      <Tabs
        defaultValue="7d"
        value={selectedPeriod}
        onValueChange={(value) => setSelectedPeriod(value as TimePeriod)}
        className="mb-6"
      >
        <TabsList>
          <TabsTrigger value="7d">7D</TabsTrigger>
          <TabsTrigger value="30d">30D</TabsTrigger>
          <TabsTrigger value="90d">90D</TabsTrigger>
          <TabsTrigger value="1y">1Y</TabsTrigger>
        </TabsList>
      </Tabs>
      
      {/* Chart */}
      <div className="w-full" style={{ height: '300px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
          >
            <defs>
              <linearGradient id="lineGradient" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor={lineColor}
                  stopOpacity={0.3}
                />
                <stop
                  offset="100%"
                  stopColor={lineColor}
                  stopOpacity={0}
                />
              </linearGradient>
            </defs>
            
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--color-border, #D2D2D7)"
              opacity={0.3}
              vertical={false}
            />
            
            <XAxis
              dataKey="timestamp"
              tickFormatter={(timestamp) => formatDate(timestamp, selectedPeriod)}
              stroke="var(--color-text-secondary, #6E6E73)"
              style={{ fontSize: '12px' }}
              tickLine={false}
              axisLine={false}
              dy={10}
            />
            
            <YAxis
              tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
              stroke="var(--color-text-secondary, #6E6E73)"
              style={{ fontSize: '12px' }}
              tickLine={false}
              axisLine={false}
              dx={-10}
              width={60}
            />
            
            <Tooltip
              content={<CustomTooltip period={selectedPeriod} />}
              cursor={{
                stroke: 'var(--color-border, #D2D2D7)',
                strokeWidth: 1,
                strokeDasharray: '5 5',
              }}
            />
            
            <Line
              type="monotone"
              dataKey="value"
              stroke={lineColor}
              strokeWidth={2}
              dot={false}
              activeDot={{
                r: 6,
                fill: lineColor,
                stroke: 'var(--color-surface, #FFFFFF)',
                strokeWidth: 2,
              }}
              animationDuration={800}
              animationEasing="ease-in-out"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
