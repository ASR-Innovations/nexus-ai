import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();

  console.log("Deploying AgentRegistry with deployer:", deployer);

  const agentRegistry = await deploy("AgentRegistry", {
    from: deployer,
    args: [], // No constructor arguments
    log: true,
    waitConfirmations: 1,
  });

  console.log("AgentRegistry deployed to:", agentRegistry.address);

  // Verify contract on block explorer if not on local network
  if (hre.network.name !== "hardhat" && hre.network.name !== "localhost") {
    console.log("Waiting for block confirmations...");
    await new Promise(resolve => setTimeout(resolve, 30000)); // Wait 30 seconds
    
    try {
      await hre.run("verify:verify", {
        address: agentRegistry.address,
        constructorArguments: [],
      });
      console.log("AgentRegistry verified on block explorer");
    } catch (error) {
      console.log("Verification failed:", error);
    }
  }
};

func.tags = ["AgentRegistry"];
func.id = "deploy_agent_registry";

export default func;