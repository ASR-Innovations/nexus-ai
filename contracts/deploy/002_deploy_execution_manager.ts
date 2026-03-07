import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, ethers } = hre;
  const { deploy, get } = deployments;
  const { deployer } = await getNamedAccounts();

  console.log("Deploying ExecutionManager with deployer:", deployer);

  // Get the deployed IntentVault address
  const intentVault = await get("IntentVault");

  const executionManager = await deploy("ExecutionManager", {
    from: deployer,
    args: [intentVault.address],
    log: true,
    waitConfirmations: 1,
  });

  console.log("ExecutionManager deployed to:", executionManager.address);
  console.log("IntentVault address:", intentVault.address);

  // Update IntentVault with the correct ExecutionManager address
  console.log("Updating IntentVault with ExecutionManager address...");
  const intentVaultContract = await ethers.getContractAt("IntentVault", intentVault.address);
  const updateTx = await intentVaultContract.updateExecutionManager(executionManager.address);
  await updateTx.wait();
  console.log("IntentVault updated with ExecutionManager address:", executionManager.address);

  // Verify contract on block explorer if not on local network
  if (hre.network.name !== "hardhat" && hre.network.name !== "localhost") {
    console.log("Waiting for block confirmations...");
    await new Promise(resolve => setTimeout(resolve, 30000)); // Wait 30 seconds
    
    try {
      await hre.run("verify:verify", {
        address: executionManager.address,
        constructorArguments: [intentVault.address],
      });
      console.log("ExecutionManager verified on block explorer");
    } catch (error) {
      console.log("Verification failed:", error);
    }
  }
};

func.tags = ["ExecutionManager"];
func.dependencies = ["IntentVault"];
func.id = "deploy_execution_manager";

export default func;