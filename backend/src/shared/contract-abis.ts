// Contract ABIs for NexusAI Protocol
// Extracted from compiled contract artifacts

export const INTENT_VAULT_ABI = [
  {
    "inputs": [
      { "internalType": "address", "name": "_agentRegistry", "type": "address" },
      { "internalType": "address", "name": "_executionManager", "type": "address" }
    ],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "inputs": [],
    "name": "ReentrancyGuardReentrantCall",
    "type": "error"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "uint256", "name": "intentId", "type": "uint256" },
      { "indexed": false, "internalType": "uint256", "name": "returnAmount", "type": "uint256" }
    ],
    "name": "ExecutionCompleted",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "uint256", "name": "intentId", "type": "uint256" }
    ],
    "name": "ExecutionDispatched",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "uint256", "name": "intentId", "type": "uint256" },
      { "indexed": false, "internalType": "string", "name": "reason", "type": "string" }
    ],
    "name": "ExecutionFailed",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "uint256", "name": "intentId", "type": "uint256" },
      { "indexed": true, "internalType": "address", "name": "user", "type": "address" },
      { "indexed": false, "internalType": "uint256", "name": "amount", "type": "uint256" }
    ],
    "name": "FundsReturned",
    "type": "event"
  }
] as const;
// Continue IntentVault ABI
export const INTENT_VAULT_ABI_EXTENDED = [
  ...INTENT_VAULT_ABI,
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "uint256", "name": "intentId", "type": "uint256" },
      { "indexed": true, "internalType": "address", "name": "agent", "type": "address" }
    ],
    "name": "IntentAssigned",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "uint256", "name": "intentId", "type": "uint256" },
      { "indexed": true, "internalType": "address", "name": "user", "type": "address" }
    ],
    "name": "IntentCancelled",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "uint256", "name": "intentId", "type": "uint256" },
      { "indexed": true, "internalType": "address", "name": "user", "type": "address" },
      { "indexed": false, "internalType": "uint256", "name": "amount", "type": "uint256" },
      { "indexed": false, "internalType": "bytes32", "name": "goalHash", "type": "bytes32" }
    ],
    "name": "IntentCreated",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "uint256", "name": "intentId", "type": "uint256" },
      { "indexed": false, "internalType": "uint256", "name": "protocolFee", "type": "uint256" }
    ],
    "name": "IntentExecuted",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "uint256", "name": "intentId", "type": "uint256" },
      { "indexed": true, "internalType": "address", "name": "user", "type": "address" }
    ],
    "name": "IntentExpired",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "uint256", "name": "intentId", "type": "uint256" }
    ],
    "name": "PlanApproved",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "uint256", "name": "intentId", "type": "uint256" },
      { "indexed": false, "internalType": "bytes32", "name": "executionPlanHash", "type": "bytes32" }
    ],
    "name": "PlanSubmitted",
    "type": "event"
  }
] as const;
// IntentVault Functions
export const INTENT_VAULT_FUNCTIONS = [
  {
    "inputs": [],
    "name": "MAX_SLIPPAGE_BPS",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "MIN_DEPOSIT",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "PROTOCOL_FEE_BPS",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "intentId", "type": "uint256" }],
    "name": "approvePlan",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "intentId", "type": "uint256" }],
    "name": "cancelIntent",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "intentId", "type": "uint256" }],
    "name": "claimIntent",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "intentId", "type": "uint256" },
      { "internalType": "uint256", "name": "returnAmount", "type": "uint256" }
    ],
    "name": "completeIntent",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  }
] as const;
// More IntentVault Functions
export const INTENT_VAULT_FUNCTIONS_2 = [
  {
    "inputs": [
      { "internalType": "bytes32", "name": "goalHash", "type": "bytes32" },
      { "internalType": "uint256", "name": "maxSlippageBps", "type": "uint256" },
      { "internalType": "uint256", "name": "deadline", "type": "uint256" },
      { "internalType": "uint256", "name": "minYieldBps", "type": "uint256" },
      { "internalType": "uint256", "name": "maxLockDuration", "type": "uint256" },
      { "internalType": "address[]", "name": "approvedProtocols", "type": "address[]" }
    ],
    "name": "createIntent",
    "outputs": [{ "internalType": "uint256", "name": "intentId", "type": "uint256" }],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "intentId", "type": "uint256" }],
    "name": "executeIntent",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "intentId", "type": "uint256" }],
    "name": "getIntent",
    "outputs": [{
      "components": [
        { "internalType": "address", "name": "user", "type": "address" },
        { "internalType": "uint256", "name": "amount", "type": "uint256" },
        { "internalType": "bytes32", "name": "goalHash", "type": "bytes32" },
        { "internalType": "uint256", "name": "maxSlippageBps", "type": "uint256" },
        { "internalType": "uint256", "name": "deadline", "type": "uint256" },
        { "internalType": "uint256", "name": "minYieldBps", "type": "uint256" },
        { "internalType": "uint256", "name": "maxLockDuration", "type": "uint256" },
        { "internalType": "address[]", "name": "approvedProtocols", "type": "address[]" },
        { "internalType": "enum IntentVault.IntentStatus", "name": "status", "type": "uint8" },
        { "internalType": "address", "name": "assignedAgent", "type": "address" },
        { "internalType": "bytes", "name": "executionPlan", "type": "bytes" },
        { "internalType": "bytes32", "name": "executionPlanHash", "type": "bytes32" },
        { "internalType": "uint256", "name": "createdAt", "type": "uint256" }
      ],
      "internalType": "struct IntentVault.Intent",
      "name": "",
      "type": "tuple"
    }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "address", "name": "user", "type": "address" }],
    "name": "getUserIntents",
    "outputs": [{ "internalType": "uint256[]", "name": "", "type": "uint256[]" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "nextIntentId",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  }
] as const;
// AgentRegistry ABI
export const AGENT_REGISTRY_ABI = [
  {
    "inputs": [],
    "name": "ReentrancyGuardReentrantCall",
    "type": "error"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "address", "name": "agent", "type": "address" }
    ],
    "name": "AgentDeactivated",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "address", "name": "agent", "type": "address" },
      { "indexed": false, "internalType": "uint256", "name": "stake", "type": "uint256" },
      { "indexed": false, "internalType": "string", "name": "metadataURI", "type": "string" }
    ],
    "name": "AgentRegistered",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "address", "name": "agent", "type": "address" },
      { "indexed": false, "internalType": "uint256", "name": "slashAmount", "type": "uint256" }
    ],
    "name": "AgentSlashed",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "address", "name": "agent", "type": "address" },
      { "indexed": false, "internalType": "uint256", "name": "newScore", "type": "uint256" }
    ],
    "name": "ReputationUpdated",
    "type": "event"
  },
  {
    "inputs": [],
    "name": "INITIAL_REPUTATION",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "MIN_STAKE",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "SLASH_PERCENT",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  }
] as const;
// AgentRegistry Functions
export const AGENT_REGISTRY_FUNCTIONS = [
  {
    "inputs": [{ "internalType": "address", "name": "agent", "type": "address" }],
    "name": "getAgent",
    "outputs": [{
      "components": [
        { "internalType": "uint256", "name": "stakeAmount", "type": "uint256" },
        { "internalType": "uint256", "name": "reputationScore", "type": "uint256" },
        { "internalType": "uint256", "name": "successCount", "type": "uint256" },
        { "internalType": "uint256", "name": "failCount", "type": "uint256" },
        { "internalType": "uint256", "name": "totalExecutions", "type": "uint256" },
        { "internalType": "bool", "name": "isActive", "type": "bool" },
        { "internalType": "string", "name": "metadataURI", "type": "string" },
        { "internalType": "uint256", "name": "registeredAt", "type": "uint256" }
      ],
      "internalType": "struct AgentRegistry.Agent",
      "name": "",
      "type": "tuple"
    }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "n", "type": "uint256" }],
    "name": "getTopAgents",
    "outputs": [{ "internalType": "address[]", "name": "addresses", "type": "address[]" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "address", "name": "agent", "type": "address" }],
    "name": "isActiveAgent",
    "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "address", "name": "agent", "type": "address" }],
    "name": "recordFailure",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "address", "name": "agent", "type": "address" }],
    "name": "recordSuccess",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "string", "name": "metadataURI", "type": "string" }],
    "name": "registerAgent",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  }
] as const;
// ExecutionManager ABI
export const EXECUTION_MANAGER_ABI = [
  {
    "inputs": [{ "internalType": "address", "name": "_intentVault", "type": "address" }],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "inputs": [],
    "name": "ExecutionNotFound",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "InvalidExecutionStatus",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "LocalExecutionFailed",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "OnlyIntentVault",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "XCMExecutionFailed",
    "type": "error"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "uint256", "name": "intentId", "type": "uint256" }
    ],
    "name": "ExecutionCompleted",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "uint256", "name": "intentId", "type": "uint256" }
    ],
    "name": "ExecutionDispatched",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "uint256", "name": "intentId", "type": "uint256" },
      { "indexed": false, "internalType": "string", "name": "reason", "type": "string" }
    ],
    "name": "ExecutionFailed",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "uint256", "name": "intentId", "type": "uint256" },
      { "indexed": false, "internalType": "uint256", "name": "totalSteps", "type": "uint256" }
    ],
    "name": "ExecutionStarted",
    "type": "event"
  }
] as const;
// ExecutionManager Functions
export const EXECUTION_MANAGER_FUNCTIONS = [
  {
    "inputs": [],
    "name": "XCM_PRECOMPILE",
    "outputs": [{ "internalType": "address", "name": "", "type": "address" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint32", "name": "paraId", "type": "uint32" },
      { "internalType": "address", "name": "beneficiary", "type": "address" },
      { "internalType": "uint256", "name": "amount", "type": "uint256" }
    ],
    "name": "buildTransferXCM",
    "outputs": [{ "internalType": "bytes", "name": "xcmMessage", "type": "bytes" }],
    "stateMutability": "pure",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "intentId", "type": "uint256" },
      { "internalType": "bytes", "name": "planData", "type": "bytes" }
    ],
    "name": "execute",
    "outputs": [{ "internalType": "bool", "name": "success", "type": "bool" }],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "intentId", "type": "uint256" }],
    "name": "getExecution",
    "outputs": [{
      "components": [
        { "internalType": "uint256", "name": "intentId", "type": "uint256" },
        { "internalType": "enum ExecutionManager.ExecutionStatus", "name": "status", "type": "uint8" },
        { "internalType": "uint256", "name": "totalSteps", "type": "uint256" },
        { "internalType": "uint256", "name": "completedSteps", "type": "uint256" },
        { "internalType": "uint256", "name": "startedAt", "type": "uint256" }
      ],
      "internalType": "struct ExecutionManager.Execution",
      "name": "execution",
      "type": "tuple"
    }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "bytes", "name": "xcmMessage", "type": "bytes" }],
    "name": "weighMessage",
    "outputs": [{ "internalType": "uint64", "name": "weight", "type": "uint64" }],
    "stateMutability": "view",
    "type": "function"
  }
] as const;

// Combined ABIs for contract initialization
export const COMPLETE_INTENT_VAULT_ABI = [
  ...INTENT_VAULT_ABI_EXTENDED,
  ...INTENT_VAULT_FUNCTIONS,
  ...INTENT_VAULT_FUNCTIONS_2
] as const;

export const COMPLETE_AGENT_REGISTRY_ABI = [
  ...AGENT_REGISTRY_ABI,
  ...AGENT_REGISTRY_FUNCTIONS
] as const;

export const COMPLETE_EXECUTION_MANAGER_ABI = [
  ...EXECUTION_MANAGER_ABI,
  ...EXECUTION_MANAGER_FUNCTIONS
] as const;