import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "hardhat-deploy";
import * as dotenv from "dotenv";

dotenv.config();

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {
      chainId: 31337,
    },
    polkadotHub: {
      url: process.env.POLKADOT_HUB_RPC_URL || "https://eth-rpc.polkadot.io/",
      chainId: 420420419, // Actual Polkadot Hub mainnet chain ID (corrected from network response)
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      gasPrice: "auto",
      gas: "auto",
    },
    polkadotHubTestnet: {
      url: process.env.POLKADOT_HUB_TESTNET_RPC_URL || "https://eth-rpc-testnet.polkadot.io/",
      chainId: 420420417, // Actual Polkadot Hub testnet chain ID (corrected from network response)
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      gasPrice: "auto",
      gas: "auto",
    },
  },
  namedAccounts: {
    deployer: {
      default: 0,
    },
    protocolOwner: {
      default: 1,
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
    deploy: "./deploy",
  },
  etherscan: {
    // Add block explorer API key when available
    apiKey: {
      polkadotHub: process.env.POLKADOT_HUB_API_KEY || "",
    },
    customChains: [
      {
        network: "polkadotHub",
        chainId: 420420419,
        urls: {
          apiURL: "https://blockscout.polkadot.io/api",
          browserURL: "https://blockscout.polkadot.io/",
        },
      },
      {
        network: "polkadotHubTestnet",
        chainId: 420420417,
        urls: {
          apiURL: "https://blockscout-testnet.polkadot.io/api",
          browserURL: "https://blockscout-testnet.polkadot.io/",
        },
      },
    ],
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD",
  },
  typechain: {
    outDir: "typechain-types",
    target: "ethers-v6",
  },
};

export default config;