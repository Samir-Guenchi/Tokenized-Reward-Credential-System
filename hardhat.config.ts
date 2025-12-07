/**
 * @file hardhat.config.ts
 * @description Hardhat configuration for TRCS (Tokenized Reward & Credential System)
 * 
 * LEARNING PATH:
 * This configuration file is the heart of your Hardhat development environment.
 * It defines:
 * - Network connections (local, testnets, mainnet)
 * - Compiler settings (Solidity version, optimizer)
 * - Plugin configurations (gas reporting, coverage, contract sizing)
 * - API keys for verification and deployment
 * 
 * SECURITY NOTE:
 * Never commit actual private keys or API keys to version control.
 * Always use environment variables via a .env file (which is gitignored).
 * 
 * @see https://hardhat.org/hardhat-runner/docs/config
 */

import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@openzeppelin/hardhat-upgrades";
import "hardhat-contract-sizer";
import "hardhat-gas-reporter";
import * as dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

// Environment variable extraction with sensible defaults
// These are placeholders - replace with your actual keys in .env
const PRIVATE_KEY = process.env.PRIVATE_KEY || "0x0000000000000000000000000000000000000000000000000000000000000001";
const INFURA_API_KEY = process.env.INFURA_API_KEY || "";
const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY || "";
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || "";
const COINMARKETCAP_API_KEY = process.env.COINMARKETCAP_API_KEY || "";

/**
 * Gas Reporter Configuration
 * 
 * This reports gas usage for each function call during testing.
 * Useful for:
 * - Identifying expensive operations
 * - Optimizing contract code
 * - Estimating deployment and transaction costs
 */
const gasReporterConfig = {
  enabled: process.env.REPORT_GAS === "true",
  currency: "USD",
  coinmarketcap: COINMARKETCAP_API_KEY,
  outputFile: process.env.CI ? "gas-report.txt" : undefined,
  noColors: process.env.CI ? true : false,
  excludeContracts: ["test/", "mocks/"],
};

/**
 * Solidity Compiler Configuration
 * 
 * We use Solidity 0.8.22 which includes:
 * - Built-in overflow checks (no SafeMath needed)
 * - Custom errors (more gas efficient)
 * - User-defined value types
 * 
 * Optimizer settings:
 * - 200 runs is a good balance for contracts deployed once and called many times
 * - Higher runs = more gas efficient calls but larger deployment cost
 * - Lower runs = cheaper deployment but more expensive calls
 */
const solidityConfig = {
  version: "0.8.22",
  settings: {
    optimizer: {
      enabled: true,
      runs: 200,
    },
    viaIR: false, // Enable if you need Yul IR compilation (advanced)
    metadata: {
      bytecodeHash: "ipfs", // Store IPFS hash of source in bytecode
    },
    outputSelection: {
      "*": {
        "*": ["storageLayout"], // Required for upgradeable contracts
      },
    },
  },
};

const config: HardhatUserConfig = {
  // Default network for commands
  defaultNetwork: "hardhat",

  // Network configurations
  networks: {
    /**
     * Hardhat Network (Local)
     * 
     * An in-memory Ethereum network for testing.
     * Features:
     * - Instant mining
     * - Console.log support in Solidity
     * - Stack traces for debugging
     * - Forking mainnet state (optional)
     */
    hardhat: {
      chainId: 31337,
      // Uncomment to fork mainnet (useful for testing with real token balances)
      // forking: {
      //   url: `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
      //   blockNumber: 18000000, // Pin to specific block for deterministic tests
      // },
      accounts: {
        // Generate 10 accounts with 10000 ETH each
        count: 10,
        accountsBalance: "10000000000000000000000", // 10000 ETH in wei
      },
      mining: {
        auto: true,
        interval: 0,
      },
      gasPrice: 0, // Free gas for testing
      initialBaseFeePerGas: 0,
    },

    /**
     * Localhost Network
     * 
     * For connecting to a local Hardhat node running via `npx hardhat node`
     * Use this for:
     * - Frontend testing
     * - Backend integration
     * - Persistent local development
     */
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
      timeout: 60000,
    },

    /**
     * Sepolia Testnet
     * 
     * Ethereum's primary testnet (replaced Goerli).
     * Use for:
     * - Pre-production testing
     * - Integration testing with real infrastructure
     * - Getting testnet ETH from faucets
     * 
     * Faucet: https://sepoliafaucet.com/
     */
    sepolia: {
      url: INFURA_API_KEY 
        ? `https://sepolia.infura.io/v3/${INFURA_API_KEY}`
        : `https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
      chainId: 11155111,
      accounts: [PRIVATE_KEY],
      gasPrice: "auto",
      timeout: 120000,
    },

    /**
     * Ethereum Mainnet
     * 
     * Production network - USE WITH EXTREME CAUTION
     * 
     * Before deploying:
     * 1. Complete all testnet testing
     * 2. Get an external audit
     * 3. Set up a multi-sig for admin functions
     * 4. Have an incident response plan
     */
    mainnet: {
      url: INFURA_API_KEY
        ? `https://mainnet.infura.io/v3/${INFURA_API_KEY}`
        : `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
      chainId: 1,
      accounts: [PRIVATE_KEY],
      gasPrice: "auto",
      timeout: 300000, // 5 minutes for mainnet
    },

    /**
     * Polygon Mumbai Testnet (Alternative L2 testnet)
     * 
     * Useful for:
     * - Testing L2 deployments
     * - Lower gas costs in production
     */
    mumbai: {
      url: `https://polygon-mumbai.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
      chainId: 80001,
      accounts: [PRIVATE_KEY],
      gasPrice: "auto",
    },

    /**
     * Polygon Mainnet
     * 
     * Layer 2 network with lower gas costs.
     * Good for:
     * - High-frequency transactions
     * - Lower entry barrier for users
     */
    polygon: {
      url: `https://polygon-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
      chainId: 137,
      accounts: [PRIVATE_KEY],
      gasPrice: "auto",
    },
  },

  // Solidity compiler configuration
  solidity: solidityConfig,

  // TypeChain configuration for type-safe contract interactions
  typechain: {
    outDir: "typechain-types",
    target: "ethers-v6",
    alwaysGenerateOverloads: false,
    dontOverrideCompile: false,
  },

  // Paths configuration
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },

  // Gas reporter configuration
  gasReporter: gasReporterConfig,

  // Contract size reporter
  contractSizer: {
    alphaSort: true,
    disambiguatePaths: false,
    runOnCompile: true,
    strict: true,
    only: [], // Empty = all contracts
    except: ["test/", "mocks/"],
  },

  // Etherscan verification configuration
  etherscan: {
    apiKey: {
      mainnet: ETHERSCAN_API_KEY,
      sepolia: ETHERSCAN_API_KEY,
      polygon: process.env.POLYGONSCAN_API_KEY || "",
      polygonMumbai: process.env.POLYGONSCAN_API_KEY || "",
    },
  },

  // Source verification
  sourcify: {
    enabled: true,
  },

  // Mocha test configuration
  mocha: {
    timeout: 120000, // 2 minutes per test
    parallel: false, // Set to true if tests are independent
  },
};

export default config;
