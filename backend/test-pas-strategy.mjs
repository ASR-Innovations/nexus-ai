/**
 * Test: "Help me earn yield on 100 PAS"
 * Tests the full flow: AgentRegistry → getPasAgentStrategies → computed strategies
 */
import { ethers } from 'ethers';

const RPC = 'https://eth-rpc-testnet.polkadot.io/';
const AGENT_REGISTRY = '0xa68cd54231225cB0d9b9bf2839e63B155C41BC4E';
const INTENT_VAULT = '0x256BA31C7485918E1f21da6164C5E9a3300Cd50b';

const AGENT_REGISTRY_ABI = [
  {
    name: 'getTopAgents',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'n', type: 'uint256' }],
    outputs: [{ name: 'addresses', type: 'address[]' }],
  },
  {
    name: 'getAgent',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'agent', type: 'address' }],
    outputs: [{
      type: 'tuple',
      components: [
        { name: 'stakeAmount', type: 'uint256' },
        { name: 'reputationScore', type: 'uint256' },
        { name: 'successCount', type: 'uint256' },
        { name: 'failCount', type: 'uint256' },
        { name: 'totalExecutions', type: 'uint256' },
        { name: 'isActive', type: 'bool' },
        { name: 'metadataURI', type: 'string' },
        { name: 'registeredAt', type: 'uint256' },
      ],
    }],
  },
  {
    name: 'isActiveAgent',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'agent', type: 'address' }],
    outputs: [{ type: 'bool' }],
  },
];

const INTENT_VAULT_ABI = [
  {
    name: 'nextIntentId',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
];

// --- Simulated strategy computation (mirrors getPasAgentStrategies logic) ---
function computePasStrategy(agentData, tier) {
  const tierConfig = {
    'conservative':   { apyBps: 800,  lockDays: 0,  riskLevel: 'low',    name: 'Conservative Yield Agent' },
    'liquid-staking': { apyBps: 1000, lockDays: 14, riskLevel: 'low',    name: 'Liquid Staking Agent' },
    'high-yield':     { apyBps: 1500, lockDays: 0,  riskLevel: 'medium', name: 'High Yield Agent' },
  };
  const cfg = tierConfig[tier];

  if (!agentData || agentData.length === 0) {
    return { ...cfg, chain: 'Polkadot Hub Testnet (Paseo)', asset: 'PAS', usedFallback: true };
  }

  const best = agentData.sort((a, b) => {
    const rateA = a.totalExecutions > 0n ? Number(a.successCount) / Number(a.totalExecutions) : 0;
    const rateB = b.totalExecutions > 0n ? Number(b.successCount) / Number(b.totalExecutions) : 0;
    return rateB - rateA;
  })[0];

  const reputationScore = Number(best.reputationScore);
  const reputationMultiplier = Math.min(1.2, Math.max(0.8, reputationScore / 1000));
  const adjustedApyBps = Math.round(cfg.apyBps * reputationMultiplier);
  const stakeUsd = Number(best.stakeAmount) / 1e18 * 10;

  return {
    protocol: cfg.name,
    chain: 'Polkadot Hub Testnet (Paseo)',
    asset: 'PAS',
    apyBps: adjustedApyBps,
    apyPercent: (adjustedApyBps / 100).toFixed(2) + '%',
    lockDays: cfg.lockDays,
    riskLevel: cfg.riskLevel,
    agentReputation: reputationScore,
    agentSuccessCount: Number(best.successCount),
    agentTotalExecutions: Number(best.totalExecutions),
    stakeAmountUsd: stakeUsd.toFixed(2),
    usedFallback: false,
  };
}

async function main() {
  console.log('\n========================================');
  console.log('  TEST: "Help me earn yield on 100 PAS"');
  console.log('========================================\n');

  const provider = new ethers.JsonRpcProvider(RPC);

  // 1. Check chain connectivity
  const network = await provider.getNetwork();
  console.log(`✅ Connected to chain ID: ${network.chainId} (Paseo testnet = 420420417)`);

  // 2. Query IntentVault to show total intents on-chain
  const intentVault = new ethers.Contract(INTENT_VAULT, INTENT_VAULT_ABI, provider);
  const nextId = await intentVault.nextIntentId();
  console.log(`✅ IntentVault: ${nextId} total intents deployed on-chain\n`);

  // 3. Query AgentRegistry
  const registry = new ethers.Contract(AGENT_REGISTRY, AGENT_REGISTRY_ABI, provider);
  console.log('--- STEP 1: Query AgentRegistry.getTopAgents(5) ---');

  let topAddresses = [];
  try {
    topAddresses = await registry.getTopAgents(5);
    console.log(`  Found ${topAddresses.length} registered agents`);
    topAddresses.forEach((addr, i) => console.log(`  [${i+1}] ${addr}`));
  } catch (err) {
    console.log(`  No agents registered yet (${err.message})`);
  }

  // 4. Fetch agent details
  console.log('\n--- STEP 2: Query getAgent() for each active agent ---');
  const activeAgents = [];
  for (const addr of topAddresses) {
    try {
      const a = await registry.getAgent(addr);
      const isActive = a.isActive;
      const successRate = a.totalExecutions > 0n
        ? ((Number(a.successCount) / Number(a.totalExecutions)) * 100).toFixed(1) + '%'
        : 'N/A (no executions yet)';

      console.log(`  Agent: ${addr}`);
      console.log(`    Active:        ${isActive}`);
      console.log(`    Stake:         ${(Number(a.stakeAmount) / 1e18).toFixed(4)} PAS`);
      console.log(`    Reputation:    ${Number(a.reputationScore)}`);
      console.log(`    Success rate:  ${successRate} (${Number(a.successCount)}/${Number(a.totalExecutions)})`);
      console.log(`    Metadata URI:  ${a.metadataURI || '(empty)'}`);
      console.log('');

      if (isActive) activeAgents.push(a);
    } catch (err) {
      console.log(`  Failed to query agent ${addr}: ${err.message}`);
    }
  }

  // 5. Compute the three strategies for "100 PAS yield"
  console.log('--- STEP 3: Computed strategies for "Help me earn yield on 100 PAS" ---\n');
  const tiers = ['conservative', 'liquid-staking', 'high-yield'];
  const strategies = tiers.map(t => computePasStrategy([...activeAgents], t));

  const intentParams = { action: 'yield', asset: 'PAS', amount: '100', riskTolerance: 'medium' };
  console.log('  Intent parsed as:', JSON.stringify(intentParams, null, 2));
  console.log('\n  Strategies returned:\n');

  strategies.forEach((s, i) => {
    console.log(`  Strategy ${i+1}: ${s.protocol}`);
    console.log(`    Chain:       ${s.chain}`);
    console.log(`    APY:         ${s.apyPercent ?? (s.apyBps/100).toFixed(2) + '%'} (${s.apyBps} bps)`);
    console.log(`    Risk:        ${s.riskLevel}`);
    console.log(`    Lock:        ${s.lockDays} days`);
    if (!s.usedFallback) {
      console.log(`    Agent rep:   ${s.agentReputation}`);
      console.log(`    Agent wins:  ${s.agentSuccessCount}/${s.agentTotalExecutions}`);
    } else {
      console.log(`    Source:      Mock fallback (no agents registered)`);
    }
    console.log('');
  });

  const anyFallback = strategies.some(s => s.usedFallback);
  console.log(`✅ Real on-chain agent data: ${anyFallback ? 'NO (using mock fallback)' : 'YES'}`);
  console.log('========================================\n');
}

main().catch(e => { console.error('Test failed:', e.message); process.exit(1); });
