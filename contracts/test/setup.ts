import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

export interface TestSetup {
  deployer: SignerWithAddress;
  user1: SignerWithAddress;
  user2: SignerWithAddress;
  agent1: SignerWithAddress;
  agent2: SignerWithAddress;
}

export async function setupTest(): Promise<TestSetup> {
  const [deployer, user1, user2, agent1, agent2] = await ethers.getSigners();
  
  return {
    deployer,
    user1,
    user2,
    agent1,
    agent2,
  };
}

export const MIN_DEPOSIT = ethers.parseEther("1");
export const MIN_STAKE = ethers.parseEther("10");
export const MAX_SLIPPAGE_BPS = 1000;
export const PROTOCOL_FEE_BPS = 30;
export const INITIAL_REPUTATION = 5000;
export const SLASH_PERCENT = 10;