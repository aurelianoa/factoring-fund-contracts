import * as dotenv from "dotenv";
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

dotenv.config();

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {
      gas: "auto",
      forking: {
        url: process.env.BINANCE_TESTNET_URL || "",
        blockNumber: 48675307,
      },
    },
    sepolia: {
      chainId: 11155111,
      url: process.env.SEPOLIA_URL || "",
      accounts:
        process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
    },
    mainnet: {
      chainId: 1,
      url: process.env.MAINNET_URL || "", // Infura url with projectId
      accounts:
        process.env.PRIVATE_KEY_MAINNET !== undefined
          ? [process.env.PRIVATE_KEY_MAINNET]
          : [], // add the account that will deploy the contract (private key)
    },
    base: {
      chainId: 8453,
      url: process.env.BASE_URL || "", // Infura url with projectId
      accounts:
        process.env.PRIVATE_KEY_MAINNET !== undefined
          ? [process.env.PRIVATE_KEY_MAINNET]
          : [], // add the account that will deploy the contract (private key)
    },
    base_sepolia: {
      chainId: 84532,
      url: process.env.BASE_SEPOLIA_URL || "",
      accounts:
        process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
    },
    polygon: {
      chainId: 137,
      url: process.env.POLYGON_URL || "", // Infura url with projectId
      accounts:
        process.env.PRIVATE_KEY_MAINNET !== undefined
          ? [process.env.PRIVATE_KEY_MAINNET]
          : [], // add the account that will deploy the contract (private key)
    },
    polygon_amoy: {
      chainId: 80002,
      url: process.env.POLYGON_AMOY_URL || "",
      accounts:
        process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
    },
    arbitrum: {
      chainId: 42161,
      url: process.env.ARBITRUM_URL || "", // Infura url with projectId
      accounts:
        process.env.PRIVATE_KEY_MAINNET !== undefined
          ? [process.env.PRIVATE_KEY_MAINNET]
          : [], // add the account that will deploy the contract (private key)
    },
    arbitrum_sepolia: {
      chainId: 421614,
      url: process.env.ARBITRUM_SEPOLIA_URL || "",
      accounts:
        process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
    },
    avalanche: {
      chainId: 43114,
      url: process.env.AVALANCHE_URL || "", // Infura url with projectId
      accounts:
        process.env.PRIVATE_KEY_MAINNET !== undefined
          ? [process.env.PRIVATE_KEY_MAINNET]
          : [], // add the account that will deploy the contract (private key)
    },
    avalanche_fuji: {
      chainId: 43113,
      url: process.env.AVALANCHE_FUJI_URL || "",
      accounts:
        process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
    },
    binance: {
      chainId: 56,
      url: process.env.BINANCE_URL || "", // Infura url with projectId
      accounts:
        process.env.PRIVATE_KEY_MAINNET !== undefined
          ? [process.env.PRIVATE_KEY_MAINNET]
          : [], // add the account that will deploy the contract (private key)
    },
    binance_test: {
      chainId: 97,
      url: process.env.BINANCE_TESTNET_URL || "",
      accounts:
        process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
    },
    blast: {
      chainId: 81457,
      url: process.env.BLAST_URL || "", // Infura url with projectId
      accounts:
        process.env.PRIVATE_KEY_MAINNET !== undefined
          ? [process.env.PRIVATE_KEY_MAINNET]
          : [], // add the account that will deploy the contract (private key)
    },
    blast_sepolia: {
      chainId: 168587773,
      url: process.env.BLAST_SEPOLIA_URL || "",
      accounts:
        process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
    },
  },
  etherscan: {
    apiKey: {
      mainnet: process.env.ETHERSCAN_API_KEY || "",
      sepolia: process.env.ETHERSCAN_API_KEY || "",
      base: process.env.BASESCAN_API_KEY || "",
      base_sepolia: process.env.BASESCAN_API_KEY || "",
      polygon: process.env.POLYGONSCAN_API_KEY || "",
      polygon_amoy: process.env.POLYGONSCAN_API_KEY || "",
      arbitrum: process.env.ARBITRUMSCAN_API_KEY || "",
      arbitrum_sepolia: process.env.ARBITRUMSCAN_API_KEY || "",
      avalanche: process.env.AVALANCHESCAN_API_KEY || "",
      avalanche_fuji: process.env.AVALANCHESCAN_API_KEY || "",
      binance: process.env.BSCSCAN_API_KEY || "",
      binance_test: process.env.BSCSCAN_API_KEY || "",
      blast: process.env.BLASTSCAN_API_KEY || "",
      blast_test: process.env.BLASTSCAN_API_KEY || "",
    },
    customChains: [
      {
        network: "base",
        chainId: 8453,
        urls: {
          apiURL: "https://api.basescan.org/api",
          browserURL: "https://basescan.org/"
        }
      },
      {
        network: "base_sepolia",
        chainId: 84532,
        urls: {
          apiURL: "https://api-sepolia.basescan.org/api",
          browserURL: "https://sepolia.basescan.org/"
        }
      },
      {
        network: "polygon",
        chainId: 137,
        urls: {
          apiURL: "https://api.polygonscan.com/api",
          browserURL: "https://polygonscan.com/"
        }
      },
      {
        network: "polygon_amoy",
        chainId: 80002,
        urls: {
          apiURL: "https://api-amoy.polygonscan.com/api",
          browserURL: "https://amoy.polygonscan.com/"
        }
      },
      {
        network: "arbitrum",
        chainId: 42161,
        urls: {
          apiURL: "https://api.arbiscan.io/api",
          browserURL: "https://arbiscan.io/"
        }
      },
      {
        network: "arbitrum_sepolia",
        chainId: 421614,
        urls: {
          apiURL: "https://api-sepolia.arbiscan.io/api",
          browserURL: "https://sepolia.arbiscan.io/"
        }
      },
      {
        network: "avalanche",
        chainId: 43114,
        urls: {
          apiURL: "https://api.routescan.io/v2/network/mainnet/evm/43114/etherscan",
          browserURL: "https://snowtrace.io/"
        }
      },
      {
        network: "avalanche_fuji",
        chainId: 43113,
        urls: {
          apiURL: "https://api.routescan.io/v2/network/fuji/evm/43113/etherscan",
          browserURL: "https://testnet.snowtrace.io/"
        }
      },
      {
        network: "binance",
        chainId: 56,
        urls: {
          apiURL: "https://api.bscscan.com/api",
          browserURL: "https://bscscan.com/"
        }
      },
      {
        network: "binance_test",
        chainId: 97,
        urls: {
          apiURL: "https://api-testnet.bscscan.com/api",
          browserURL: "https://testnet.bscscan.com/"
        }
      },
      {
        network: "blast",
        chainId: 81457,
        urls: {
          apiURL: "https://api.blastscan.io/api",
          browserURL: "https://blastscan.io/"
        }
      },
      {
        network: "blast_sepolia",
        chainId: 168587773,
        urls: {
          apiURL: "https://api-sepolia.blastscan.io/api",
          browserURL: "https://sepolia.blastscan.io/"
        }
      },
    ]
  },
};

export default config;
