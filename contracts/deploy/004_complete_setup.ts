import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, ethers } = hre;
  const { get } = deployments;

  console.log("=== NexusAI Protocol Deployment Complete ===");

  // Get all deployed contracts
  const agentRegistry = await get("AgentRegistry");
  const intentVault = await get("IntentVault");
  const executionManager = await get("ExecutionManager");

  console.log("\n📋 Deployed Contract Addresses:");
  console.log("AgentRegistry:", agentRegistry.address);
  console.log("IntentVault:", intentVault.address);
  console.log("ExecutionManager:", executionManager.address);

  // Verify contract connections
  console.log("\n🔗 Verifying Contract Connections:");
  
  const intentVaultContract = await ethers.getContractAt("IntentVault", intentVault.address);
  const executionManagerContract = await ethers.getContractAt("ExecutionManager", executionManager.address);

  const connectedAgentRegistry = await intentVaultContract.agentRegistry();
  const connectedExecutionManager = await intentVaultContract.executionManager();
  const connectedIntentVault = await executionManagerContract.intentVault();

  console.log("IntentVault -> AgentRegistry:", connectedAgentRegistry);
  console.log("IntentVault -> ExecutionManager:", connectedExecutionManager);
  console.log("ExecutionManager -> IntentVault:", connectedIntentVault);

  // Verify connections are correct
  const agentRegistryCorrect = connectedAgentRegistry.toLowerCase() === agentRegistry.address.toLowerCase();
  const executionManagerCorrect = connectedExecutionManager.toLowerCase() === executionManager.address.toLowerCase();
  const intentVaultCorrect = connectedIntentVault.toLowerCase() === intentVault.address.toLowerCase();

  console.log("\n✅ Connection Verification:");
  console.log("AgentRegistry connection:", agentRegistryCorrect ? "✅ Correct" : "❌ Incorrect");
  console.log("ExecutionManager connection:", executionManagerCorrect ? "✅ Correct" : "❌ Incorrect");
  console.log("IntentVault connection:", intentVaultCorrect ? "✅ Correct" : "❌ Incorrect");

  if (agentRegistryCorrect && executionManagerCorrect && intentVaultCorrect) {
    console.log("\n🎉 All contracts deployed and connected successfully!");
  } else {
    console.log("\n❌ Some connections are incorrect. Please check the deployment.");
  }

  // Display network information
  console.log("\n🌐 Network Information:");
  console.log("Network:", hre.network.name);
  console.log("Chain ID:", hre.network.config.chainId);

  // Display next steps
  console.log("\n📝 Next Steps:");
  console.log("1. Update backend environment variables with contract addresses");
  console.log("2. Update frontend configuration with contract addresses");
  console.log("3. Test contract interactions on testnet");
  console.log("4. Register test agents for development");

  // Save deployment info to file
  const deploymentInfo = {
    network: hre.network.name,
    chainId: hre.network.config.chainId,
    contracts: {
      AgentRegistry: agentRegistry.address,
      IntentVault: intentVault.address,
      ExecutionManager: executionManager.address,
    },
    deployedAt: new Date().toISOString(),
  };

  console.log("\n💾 Deployment info saved for backend/frontend configuration:");
  console.log(JSON.stringify(deploymentInfo, null, 2));
};

func.tags = ["CompleteSetup"];
func.dependencies = ["AgentRegistry", "IntentVault", "ExecutionManager"];
func.id = "complete_setup";
func.runAtTheEnd = true;

export default func;