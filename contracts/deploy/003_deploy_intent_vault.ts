import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy, get } = deployments;

  const { deployer } = await getNamedAccounts();

  console.log("Deploying IntentVault with deployer:", deployer);

  // Get previously deployed AgentRegistry
  const agentRegistry = await get("AgentRegistry");

  // Deploy IntentVault with AgentRegistry and placeholder ExecutionManager address
  // We'll update the ExecutionManager address after it's deployed
  const placeholderExecutionManager = "0x0000000000000000000000000000000000000001";

  const intentVault = await deploy("IntentVault", {
    from: deployer,
    args: [agentRegistry.address, placeholderExecutionManager],
    log: true,
    waitConfirmations: 1,
  });

  console.log("IntentVault deployed to:", intentVault.address);
  console.log("AgentRegistry address:", agentRegistry.address);
  console.log("ExecutionManager placeholder address:", placeholderExecutionManager);

  // Verify contract on block explorer if not on local network
  if (hre.network.name !== "hardhat" && hre.network.name !== "localhost") {
    console.log("Waiting for block confirmations...");
    await new Promise(resolve => setTimeout(resolve, 30000)); // Wait 30 seconds
    
    try {
      await hre.run("verify:verify", {
        address: intentVault.address,
        constructorArguments: [agentRegistry.address, placeholderExecutionManager],
      });
      console.log("IntentVault verified on block explorer");
    } catch (error) {
      console.log("Verification failed:", error);
    }
  }
};

func.tags = ["IntentVault"];
func.dependencies = ["AgentRegistry"];
func.id = "deploy_intent_vault";

export default func;