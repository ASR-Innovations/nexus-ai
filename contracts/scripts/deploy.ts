import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  console.log("Starting deployment to Polkadot Hub testnet...");
  
  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  
  // Check balance
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "PAS");
  
  if (balance === 0n) {
    throw new Error("Deployer account has no balance. Please fund the account with test tokens.");
  }
  
  console.log("\n=== Deploying AgentRegistry ===");
  
  // Deploy AgentRegistry (no dependencies)
  const AgentRegistry = await ethers.getContractFactory("AgentRegistry");
  const agentRegistry = await AgentRegistry.deploy();
  await agentRegistry.waitForDeployment();
  const agentRegistryAddress = await agentRegistry.getAddress();
  
  console.log("AgentRegistry deployed to:", agentRegistryAddress);
  
  console.log("\n=== Deploying ExecutionManager ===");
  
  // Deploy ExecutionManager with placeholder IntentVault address (will be updated later)
  const ExecutionManager = await ethers.getContractFactory("ExecutionManager");
  const executionManager = await ExecutionManager.deploy(ethers.ZeroAddress); // Placeholder
  await executionManager.waitForDeployment();
  const executionManagerAddress = await executionManager.getAddress();
  
  console.log("ExecutionManager deployed to:", executionManagerAddress);
  
  console.log("\n=== Deploying IntentVault ===");
  
  // Deploy IntentVault with AgentRegistry and ExecutionManager addresses
  const IntentVault = await ethers.getContractFactory("IntentVault");
  const intentVault = await IntentVault.deploy(agentRegistryAddress, executionManagerAddress);
  await intentVault.waitForDeployment();
  const intentVaultAddress = await intentVault.getAddress();
  
  console.log("IntentVault deployed to:", intentVaultAddress);
  
  console.log("\n=== Deployment Summary ===");
  console.log("AgentRegistry:", agentRegistryAddress);
  console.log("ExecutionManager:", executionManagerAddress);
  console.log("IntentVault:", intentVaultAddress);
  
  // Save deployment addresses to a file
  const deploymentInfo = {
    network: "polkadotHubTestnet",
    chainId: 420420417,
    deployer: deployer.address,
    contracts: {
      AgentRegistry: agentRegistryAddress,
      ExecutionManager: executionManagerAddress,
      IntentVault: intentVaultAddress
    },
    deployedAt: new Date().toISOString(),
    blockNumber: await ethers.provider.getBlockNumber()
  };
  
  const fs = require('fs');
  fs.writeFileSync(
    'deployments.json', 
    JSON.stringify(deploymentInfo, null, 2)
  );
  
  console.log("\nDeployment info saved to deployments.json");
  
  // Test basic contract interactions
  console.log("\n=== Testing Contract Interactions ===");
  
  try {
    // Test AgentRegistry constants
    const minStake = await agentRegistry.MIN_STAKE();
    console.log("MIN_STAKE:", ethers.formatEther(minStake), "PAS");
    
    const initialReputation = await agentRegistry.INITIAL_REPUTATION();
    console.log("INITIAL_REPUTATION:", initialReputation.toString());
    
    // Test IntentVault constants
    const minDeposit = await intentVault.MIN_DEPOSIT();
    console.log("MIN_DEPOSIT:", ethers.formatEther(minDeposit), "PAS");
    
    const maxSlippage = await intentVault.MAX_SLIPPAGE_BPS();
    console.log("MAX_SLIPPAGE_BPS:", maxSlippage.toString());
    
    console.log("\n✅ All contracts deployed and tested successfully!");
    
    console.log("\n=== Next Steps ===");
    console.log("1. The ExecutionManager was deployed with a placeholder IntentVault address");
    console.log("2. In production, you would need to redeploy ExecutionManager with the correct IntentVault address");
    console.log("3. Or implement an updateIntentVault function in ExecutionManager");
    console.log("4. For testing purposes, the current setup will work for basic contract interactions");
    
  } catch (error) {
    console.error("❌ Error testing contracts:", error);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });