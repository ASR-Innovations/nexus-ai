"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { cn } from "@/lib/utils";

interface PortfolioDataPoint {
  timestamp: number;
  value: number;
  date: string;
}

interface PortfolioChartProps {
  data: PortfolioDataPoint[];
  className?: string;
}

export function PortfolioChart({ data, className }: PortfolioChartProps) {
  const formatValue = (value: number) => {
    return value.toLocaleString(undefined, {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  };

  // Generate sample data if no data provided
  const chartData = data.length > 0 ? data : generateSampleData();

  function generateSampleData(): PortfolioDataPoint[] {
    const now = Date.now();
    const sampleData: PortfolioDataPoint[] = [];
    
    for (let i = 29; i >= 0; i--) {
      const timestamp = now - (i * 24 * 60 * 60 * 1000);
      const baseValue = 1000;
      const variation = Math.sin(i * 0.2) * 100 + Math.random() * 50;
      const value = Math.max(0, baseValue + variation);
      
      sampleData.push({
        timestamp,
        value,
        date: formatDate(timestamp),
      });
    }
    
    return sampleData;
  }

  const currentValue = chartData[chartData.length - 1]?.value || 0;
  const previousValue = chartData[chartData.length - 2]?.value || 0;
  const change = currentValue - previousValue;
  const changePercent = previousValue > 0 ? (change / previousValue) * 100 : 0;
  const isPositive = change >= 0;

  return (
    <div className={cn("bg-card border border-border rounded-lg p-6", className)}>
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-2">Portfolio Performance</h2>
        <div className="flex items-center gap-4">
          <div className="text-2xl font-bold">
            {formatValue(currentValue)}
          </div>
          <div className={cn(
            "flex items-center gap-1 text-sm font-medium",
            isPositive ? "text-green-600" : "text-red-600"
          )}>
            <span>{isPositive ? "+" : ""}{formatValue(change)}</span>
            <span>({isPositive ? "+" : ""}{changePercent.toFixed(2)}%)</span>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Last 30 days
        </p>
      </div>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis 
              dataKey="date"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12 }}
              className="fill-muted-foreground"
            />
            <YAxis 
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12 }}
              className="fill-muted-foreground"
              tickFormatter={(value) => `$${(value / 1000).toFixed(1)}k`}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
                      <p className="text-sm font-medium">{label}</p>
                      <p className="text-sm text-primary">
                        {formatValue(payload[0].value as number)}
                      </p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, stroke: "hsl(var(--primary))", strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {data.length === 0 && (
        <div className="text-center mt-4">
          <p className="text-sm text-muted-foreground">
            Sample data shown. Connect your wallet to see actual portfolio performance.
          </p>
        </div>
      )}
    </div>
  );
}