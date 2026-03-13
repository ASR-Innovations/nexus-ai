# NexusAI Frontend

Modern React/Next.js frontend for NexusAI Protocol - Cross-chain AI intent resolution for Polkadot ecosystem.

## Features

- **AI Chat Interface**: Natural language intent processing with real-time responses
- **Cross-Chain Portfolio**: Multi-parachain asset tracking and visualization
- **Agent Leaderboard**: Community-driven agent reputation and performance metrics
- **Real-Time Execution**: WebSocket-powered live execution tracking
- **Wallet Integration**: Support for MetaMask, SubWallet, and Talisman
- **Responsive Design**: Mobile-first UI with dark/light theme support

## Architecture

- **Next.js 14**: App Router with React Server Components
- **TypeScript**: Full type safety across the application
- **Tailwind CSS**: Utility-first styling with custom design system
- **React Query**: Efficient data fetching and caching
- **WebSocket**: Real-time updates for execution tracking
- **Wallet Integration**: Multi-wallet support for Polkadot ecosystem

## Setup

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Environment Configuration**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your configuration
   ```

3. **Development**
   ```bash
   npm run dev
   ```

4. **Build for Production**
   ```bash
   npm run build
   npm start
   ```

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── agents/            # Agent leaderboard and details
│   ├── portfolio/         # Portfolio management
│   └── page.tsx           # Main chat interface
├── components/            # Reusable UI components
│   ├── chat-interface.tsx # AI chat component
│   ├── portfolio-view.tsx # Portfolio dashboard
│   ├── agent-leaderboard.tsx # Agent rankings
│   └── execution-tracker.tsx # Real-time tracking
├── hooks/                 # Custom React hooks
│   ├── use-wallet.tsx     # Wallet connection logic
│   ├── use-portfolio.tsx  # Portfolio data management
│   └── use-execution-tracking.tsx # Execution updates
├── lib/                   # Utility functions
└── types/                 # TypeScript type definitions
```

## Key Components

### Chat Interface
- Natural language intent processing
- Real-time AI responses with DeepSeek integration
- Execution plan approval workflow
- Message history with persistent memory

### Portfolio Dashboard
- Cross-chain balance aggregation
- Interactive charts and visualizations
- Asset allocation breakdown
- Historical performance tracking

### Agent Leaderboard
- Community agent rankings
- Performance metrics and statistics
- Agent detail pages with execution history
- Reputation scoring system

### Execution Tracker
- Real-time execution status updates
- Step-by-step progress visualization
- XCM message tracking across parachains
- Success/failure notifications

## Wallet Integration

Supports multiple Polkadot ecosystem wallets:
- **MetaMask**: For EVM-compatible interactions
- **SubWallet**: Native Polkadot wallet
- **Talisman**: Multi-chain wallet support

## API Integration

Connects to NexusAI backend services:
- **Chat API**: Intent processing and AI responses
- **Portfolio API**: Cross-chain balance aggregation
- **Agent API**: Leaderboard and reputation data
- **Execution API**: Real-time execution tracking
- **WebSocket**: Live updates and notifications

## Environment Variables

See `.env.example` for all required configuration variables including:
- API endpoints and WebSocket URLs
- Blockchain RPC endpoints
- Contract addresses
- Wallet configuration
- Feature flags

## Development

```bash
# Start development server
npm run dev

# Type checking
npm run type-check

# Linting
npm run lint

# Build for production
npm run build
```

## Deployment

The frontend is optimized for deployment on:
- **Vercel**: Recommended for Next.js applications
- **Netlify**: Static site deployment
- **Docker**: Containerized deployment

## Browser Support

- Chrome/Chromium 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Dependencies

### Core Framework
- Next.js 14 with App Router
- React 18 with Concurrent Features
- TypeScript for type safety

### UI & Styling
- Tailwind CSS for styling
- Radix UI for accessible components
- Lucide React for icons

### Data Management
- React Query for server state
- Zustand for client state
- WebSocket for real-time updates

### Blockchain Integration
- Ethers.js for EVM interactions
- Polkadot.js API for parachain integration
- Wallet connection libraries