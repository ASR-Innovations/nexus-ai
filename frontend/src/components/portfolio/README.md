# Portfolio Components

This directory contains portfolio-related UI components for the NexusAI Protocol frontend.

## Components

### BalanceCard

A card component that displays individual asset balance information with glass morphism styling and hover animations.

**Features:**
- Asset symbol with icon
- Chain name with chain icon (Polkadot, Hydration, Bifrost, Moonbeam)
- Balance amount with appropriate decimal formatting
- USD value display
- Current price per token
- Glass morphism styling with backdrop blur
- Hover animation with scale and shadow increase
- Responsive design

**Usage:**

```tsx
import { BalanceCard } from '@/components/portfolio/balance-card';
import { Balance } from '@/types';

const balance: Balance = {
  asset: 'DOT',
  chain: 'Polkadot',
  amount: '100.5',
  valueUsd: 750.25,
};

export function MyPage() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <BalanceCard balance={balance} />
    </div>
  );
}
```

**Props:**
- `balance: Balance` - Balance object containing asset, chain, amount, and valueUsd

**Implementation Details:**
- Uses Card component with glass morphism effect
- Framer Motion for hover animations (scale: 1.02)
- Chain icon mapping for Polkadot, Hydration, Bifrost, Moonbeam
- Smart decimal formatting based on amount size
- Calculates price per token from amount and USD value
- Uses lucide-react icons (Coins, TrendingUp)

**Requirements Satisfied:**
- Requirement 3.2: Display asset balances with chain information
- Requirement 3.3: Show USD values and current prices

### PerformanceChart

A responsive line chart component that visualizes portfolio value over time with smooth animations and interactive features.

**Features:**
- Line chart showing portfolio value over time
- Time period selector (7d, 30d, 90d, 1y)
- Displays percentage change and absolute change
- Green for positive changes, red for negative
- Tooltips on hover with exact values and timestamps
- Smooth animations with Framer Motion
- Responsive sizing for mobile, tablet, and desktop
- Mock data generator for development

**Usage:**

```tsx
import { PerformanceChart } from '@/components/portfolio/performance-chart';

export function MyPage() {
  return (
    <div>
      <PerformanceChart />
    </div>
  );
}
```

**Props:**
- `className?: string` - Optional CSS class name for styling

**Implementation Details:**
- Uses Recharts library for chart rendering
- Integrates with design tokens from `@/styles/design-tokens.ts`
- Uses Card component for container
- Uses Tabs component for time period selector
- Generates mock historical data (backend endpoint not yet available)
- Responsive chart sizing: full width on mobile, constrained on desktop

**Requirements Satisfied:**
- Requirement 30.1: Line chart showing portfolio value over time
- Requirement 30.4: Time period toggle (7d, 30d, 90d, 1y)
- Requirement 30.5: Percentage and absolute change display
- Requirement 30.6: Green/red colors for positive/negative changes
- Requirement 30.7: Tooltips with exact values and timestamps
- Requirement 30.8: Smooth animation transitions
- Requirement 30.10: Responsive chart sizing

### PortfolioOverview

Overview component for displaying portfolio summary information.

## Testing

Tests are located in `__tests__/` directory.

Run tests:
```bash
npm test -- balance-card.test.tsx
npm test -- performance-chart.test.tsx
npm test -- portfolio-overview.test.tsx
```

## Design Tokens

The components use design tokens from `@/styles/design-tokens.ts` for consistent styling:
- Colors: positive/negative, text colors, borders
- Typography: heading and body styles
- Spacing: consistent padding and margins
- Animations: smooth transitions and easing
