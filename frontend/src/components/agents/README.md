# Agent Components

This directory contains components related to AI agent display and interaction.

## Components

### AgentCard

A card component that displays information about an AI agent with Apple-inspired design and glass morphism styling.

**Location**: `agent-card.tsx`

**Features**:
- Displays agent name (or "Agent" as fallback) and truncated address
- Shows reputation score with color-coded display (green for high, yellow for medium, red for low)
- Displays total executions and success rate
- Shows specialties as color-coded badges
- Active/inactive status indicator with visual dot
- Glass morphism styling with backdrop blur
- Hover animation with scale and shadow effects
- Click to navigate to agent detail page
- Fully accessible with ARIA labels and semantic HTML
- Responsive design

**Props**:
```typescript
interface AgentCardProps {
  agent: {
    address: string;
    name?: string;
    reputation: number;
    totalExecutions: number;
    successRate: number;
    specialties: string[];
    isActive: boolean;
  };
  className?: string;
}
```

**Usage**:
```tsx
import { AgentCard } from '@/components/agents';

function AgentList() {
  const agent = {
    address: '0x1234567890abcdef1234567890abcdef12345678',
    name: 'Yield Optimizer Pro',
    reputation: 95,
    totalExecutions: 1250,
    successRate: 98.5,
    specialties: ['yield', 'liquidity'],
    isActive: true,
  };

  return <AgentCard agent={agent} />;
}
```

**Reputation Color Coding**:
- >= 90: Success green
- >= 70: Primary blue
- >= 50: Yellow
- < 50: Error red

**Specialty Badge Colors**:
- `yield`: Green
- `liquidity`: Blue
- `arbitrage`: Purple
- `staking`: Orange
- `lending`: Pink
- Unknown: Gray

**Address Truncation**:
Addresses are automatically truncated to the format `0x1234...5678` (first 6 characters + last 4 characters).

**Navigation**:
Clicking the card navigates to `/agents/[address]` using Next.js router.

**Animations**:
- Entrance: Fade in with slide up (0.2s)
- Hover: Scale up (1.02x) and lift (-4px) with shadow increase
- Uses Framer Motion for smooth 60fps animations

**Accessibility**:
- Semantic HTML with `article` role
- Descriptive `aria-label` for the card
- Status indicators with `aria-label`
- Icons marked as `aria-hidden`
- Keyboard navigable (clickable via Enter/Space)

**Testing**:
Comprehensive test suite with 42 tests covering:
- Rendering of all data fields
- Navigation behavior
- Styling and glass morphism
- Reputation color coding
- Specialty badge colors
- Accessibility features
- Edge cases (empty data, extreme values)

Run tests:
```bash
npm test -- agent-card.test.tsx
```

**Visual Testing**:
See `__tests__/agent-card.visual.tsx` for visual test examples showing various agent states.

## Design System Compliance

All components in this directory follow the Apple-inspired design system specified in the frontend overhaul design document:

- Glass morphism with backdrop blur
- Consistent spacing (4px, 8px, 12px, 16px, 24px)
- Consistent border radius (rounded-2xl for cards)
- Smooth animations with easing curves
- Light and dark mode support
- Responsive design
- Accessibility-first approach
