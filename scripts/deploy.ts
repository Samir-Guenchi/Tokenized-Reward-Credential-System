/**
 * @file deploy.ts
 * @description Comprehensive deployment script for TRCS contracts
 *
 * =============================================================================
 * LEARNING PATH - Understanding Smart Contract Deployment
 * =============================================================================
 *
 * DEPLOYMENT OVERVIEW:
 * -------------------
 * This script deploys all TRCS contracts in the correct order:
 * 1. AccessControlManager - Foundation for all permissions
 * 2. TRCSToken - The reward token (depends on ACM)
 * 3. TRCSCredential - NFT credentials (depends on ACM)
 * 4. RewardDistributor - Distribution logic (depends on ACM + Token)
 *
 * NETWORK SELECTION:
 * -----------------
 * The script automatically detects the network from hardhat.config.ts:
 * - localhost: Local Hardhat node
 * - sepolia: Ethereum testnet
 * - mainnet: Ethereum mainnet (be careful!)
 *
 * DEPLOYMENT SAFETY:
 * -----------------
 * 1. Always test on localhost first
 * 2. Deploy to testnet and verify all functions work
 * 3. Get an audit before mainnet
 * 4. Use a multi-sig for mainnet admin roles
 *
 * VERIFICATION:
 * ------------
 * After deployment, contracts are automatically verified on Etherscan.
 * This allows users to read/write directly from block explorer.
 *
 * =============================================================================
 */

import { ethers, network, run } from "hardhat";
import * as fs from "fs";
import * as path from "path";

// =============================================================================
// CONFIGURATION
// =============================================================================

/**
 * Deployment configuration per network
 */
interface DeploymentConfig {
  tokenName: string;
  tokenSymbol: string;
  initialSupply: bigint;
  maxCap: bigint;
  credentialName: string;
  credentialSymbol: string;
  baseUri: string;
  verifyContracts: boolean;
  confirmations: number;
}

const DEPLOYMENT_CONFIGS: Record<string, DeploymentConfig> = {
  hardhat: {
    tokenName: "TRCS Reward Token",
    tokenSymbol: "TRCS",
    initialSupply: ethers.parseEther("1000000"), // 1M tokens
    maxCap: ethers.parseEther("100000000"), // 100M cap
    credentialName: "TRCS Credential",
    credentialSymbol: "TCRED",
    baseUri: "ipfs://",
    verifyContracts: false,
    confirmations: 1,
  },
  localhost: {
    tokenName: "TRCS Reward Token",
    tokenSymbol: "TRCS",
    initialSupply: ethers.parseEther("1000000"),
    maxCap: ethers.parseEther("100000000"),
    credentialName: "TRCS Credential",
    credentialSymbol: "TCRED",
    baseUri: "ipfs://",
    verifyContracts: false,
    confirmations: 1,
  },
  sepolia: {
    tokenName: "TRCS Reward Token",
    tokenSymbol: "TRCS",
    initialSupply: ethers.parseEther("1000000"),
    maxCap: ethers.parseEther("100000000"),
    credentialName: "TRCS Credential",
    credentialSymbol: "TCRED",
    baseUri: "ipfs://",
    verifyContracts: true,
    confirmations: 3, // Wait for 3 confirmations
  },
  mainnet: {
    tokenName: "TRCS Reward Token",
    tokenSymbol: "TRCS",
    initialSupply: ethers.parseEther("10000000"), // 10M initial
    maxCap: ethers.parseEther("1000000000"), // 1B cap
    credentialName: "TRCS Credential",
    credentialSymbol: "TCRED",
    baseUri: "ipfs://",
    verifyContracts: true,
    confirmations: 5, // Wait for 5 confirmations
  },
};

// =============================================================================
// TYPES
// =============================================================================

interface DeployedContracts {
  accessControlManager: string;
  token: string;
  credential: string;
  rewardDistributor: string;
  deployer: string;
  network: string;
  chainId: number;
  timestamp: string;
  blockNumber: number;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get deployment configuration for current network
 */
function getConfig(): DeploymentConfig {
  const networkName = network.name;
  const config = DEPLOYMENT_CONFIGS[networkName];
  
  if (!config) {
    console.log(`⚠️  No config for network "${networkName}", using localhost config`);
    return DEPLOYMENT_CONFIGS.localhost;
  }
  
  return config;
}

/**
 * Save deployment addresses to file
 */
function saveDeployment(contracts: DeployedContracts): void {
  const deploymentsDir = path.join(__dirname, "..", "deployments");
  
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }
  
  const filename = path.join(deploymentsDir, `${network.name}.json`);
  fs.writeFileSync(filename, JSON.stringify(contracts, null, 2));
  
  console.log(`\n📁 Deployment saved to: ${filename}`);
}

/**
 * Verify contract on Etherscan
 */
async function verifyContract(
  address: string,
  constructorArguments: unknown[],
  contractName: string
): Promise<void> {
  console.log(`🔍 Verifying ${contractName}...`);
  
  try {
    await run("verify:verify", {
      address,
      constructorArguments,
    });
    console.log(`✅ ${contractName} verified!`);
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes("Already Verified")) {
      console.log(`ℹ️  ${contractName} already verified`);
    } else {
      console.log(`❌ Verification failed for ${contractName}:`, error);
    }
  }
}

/**
 * Wait for transaction confirmations
 */
async function waitForConfirmations(
  txHash: string,
  confirmations: number
): Promise<void> {
  if (confirmations <= 1) return;
  
  console.log(`⏳ Waiting for ${confirmations} confirmations...`);
  const provider = ethers.provider;
  const receipt = await provider.getTransactionReceipt(txHash);
  
  if (receipt) {
    await receipt.confirmations();
  }
}

// =============================================================================
// MAIN DEPLOYMENT FUNCTION
// =============================================================================

async function main(): Promise<void> {
  console.log("=".repeat(70));
  console.log("🚀 TRCS - Tokenized Reward & Credential System Deployment");
  console.log("=".repeat(70));
  
  // Get deployer info
  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);
  const chainId = (await ethers.provider.getNetwork()).chainId;
  
  console.log(`\n📋 Deployment Configuration:`);
  console.log(`   Network:  ${network.name}`);
  console.log(`   Chain ID: ${chainId}`);
  console.log(`   Deployer: ${deployer.address}`);
  console.log(`   Balance:  ${ethers.formatEther(balance)} ETH`);
  
  const config = getConfig();
  console.log(`\n📦 Token Config:`);
  console.log(`   Name:           ${config.tokenName}`);
  console.log(`   Symbol:         ${config.tokenSymbol}`);
  console.log(`   Initial Supply: ${ethers.formatEther(config.initialSupply)} tokens`);
  console.log(`   Max Cap:        ${ethers.formatEther(config.maxCap)} tokens`);
  
  console.log(`\n🎫 Credential Config:`);
  console.log(`   Name:     ${config.credentialName}`);
  console.log(`   Symbol:   ${config.credentialSymbol}`);
  console.log(`   Base URI: ${config.baseUri}`);
  
  // Safety check for mainnet
  if (network.name === "mainnet") {
    console.log("\n⚠️  WARNING: Deploying to MAINNET!");
    console.log("   Press Ctrl+C within 10 seconds to cancel...");
    await new Promise((resolve) => setTimeout(resolve, 10000));
  }
  
  // ==========================================================================
  // DEPLOY CONTRACTS
  // ==========================================================================
  
  console.log("\n" + "-".repeat(70));
  console.log("📝 Deploying Contracts...");
  console.log("-".repeat(70));
  
  // 1. Deploy AccessControlManager
  console.log("\n1️⃣  Deploying AccessControlManager...");
  const AccessControlManager = await ethers.getContractFactory("AccessControlManager");
  const accessControlManager = await AccessControlManager.deploy(deployer.address);
  await accessControlManager.waitForDeployment();
  const acmAddress = await accessControlManager.getAddress();
  console.log(`   ✅ AccessControlManager: ${acmAddress}`);
  
  if (config.confirmations > 1) {
    const deployTx = accessControlManager.deploymentTransaction();
    if (deployTx) {
      await waitForConfirmations(deployTx.hash, config.confirmations);
    }
  }
  
  // 2. Deploy Token
  console.log("\n2️⃣  Deploying TRCSToken...");
  const Token = await ethers.getContractFactory("TRCSToken");
  const token = await Token.deploy(
    config.tokenName,
    config.tokenSymbol,
    config.initialSupply,
    config.maxCap,
    acmAddress
  );
  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();
  console.log(`   ✅ TRCSToken: ${tokenAddress}`);
  
  if (config.confirmations > 1) {
    const deployTx = token.deploymentTransaction();
    if (deployTx) {
      await waitForConfirmations(deployTx.hash, config.confirmations);
    }
  }
  
  // 3. Deploy Credential
  console.log("\n3️⃣  Deploying TRCSCredential...");
  const Credential = await ethers.getContractFactory("TRCSCredential");
  const credential = await Credential.deploy(
    config.credentialName,
    config.credentialSymbol,
    config.baseUri,
    acmAddress
  );
  await credential.waitForDeployment();
  const credentialAddress = await credential.getAddress();
  console.log(`   ✅ TRCSCredential: ${credentialAddress}`);
  
  if (config.confirmations > 1) {
    const deployTx = credential.deploymentTransaction();
    if (deployTx) {
      await waitForConfirmations(deployTx.hash, config.confirmations);
    }
  }
  
  // 4. Deploy RewardDistributor
  console.log("\n4️⃣  Deploying RewardDistributor...");
  const RewardDistributor = await ethers.getContractFactory("RewardDistributor");
  const rewardDistributor = await RewardDistributor.deploy(
    tokenAddress,
    acmAddress
  );
  await rewardDistributor.waitForDeployment();
  const distributorAddress = await rewardDistributor.getAddress();
  console.log(`   ✅ RewardDistributor: ${distributorAddress}`);
  
  if (config.confirmations > 1) {
    const deployTx = rewardDistributor.deploymentTransaction();
    if (deployTx) {
      await waitForConfirmations(deployTx.hash, config.confirmations);
    }
  }
  
  // ==========================================================================
  // GRANT ROLES
  // ==========================================================================
  
  console.log("\n" + "-".repeat(70));
  console.log("🔐 Configuring Roles...");
  console.log("-".repeat(70));
  
  // Grant ISSUER_ROLE to RewardDistributor so it can mint tokens
  const ISSUER_ROLE = await accessControlManager.ISSUER_ROLE();
  
  console.log("\n   Granting ISSUER_ROLE to RewardDistributor...");
  const grantTx = await accessControlManager.grantRole(ISSUER_ROLE, distributorAddress);
  await grantTx.wait();
  console.log(`   ✅ RewardDistributor can now mint tokens`);
  
  // ==========================================================================
  // SAVE DEPLOYMENT
  // ==========================================================================
  
  const blockNumber = await ethers.provider.getBlockNumber();
  
  const deployedContracts: DeployedContracts = {
    accessControlManager: acmAddress,
    token: tokenAddress,
    credential: credentialAddress,
    rewardDistributor: distributorAddress,
    deployer: deployer.address,
    network: network.name,
    chainId: Number(chainId),
    timestamp: new Date().toISOString(),
    blockNumber: blockNumber,
  };
  
  saveDeployment(deployedContracts);
  
  // ==========================================================================
  // VERIFY CONTRACTS
  // ==========================================================================
  
  if (config.verifyContracts) {
    console.log("\n" + "-".repeat(70));
    console.log("🔍 Verifying Contracts on Etherscan...");
    console.log("-".repeat(70));
    
    // Wait a bit for Etherscan to index
    console.log("\n⏳ Waiting 30 seconds for Etherscan indexing...");
    await new Promise((resolve) => setTimeout(resolve, 30000));
    
    await verifyContract(
      acmAddress,
      [deployer.address],
      "AccessControlManager"
    );
    
    await verifyContract(
      tokenAddress,
      [
        config.tokenName,
        config.tokenSymbol,
        config.initialSupply,
        config.maxCap,
        acmAddress,
      ],
      "TRCSToken"
    );
    
    await verifyContract(
      credentialAddress,
      [
        config.credentialName,
        config.credentialSymbol,
        config.baseUri,
        acmAddress,
      ],
      "TRCSCredential"
    );
    
    await verifyContract(
      distributorAddress,
      [tokenAddress, acmAddress],
      "RewardDistributor"
    );
  }
  
  // ==========================================================================
  // DEPLOYMENT SUMMARY
  // ==========================================================================
  
  console.log("\n" + "=".repeat(70));
  console.log("🎉 DEPLOYMENT COMPLETE!");
  console.log("=".repeat(70));
  
  console.log(`
📋 Contract Addresses:
   AccessControlManager: ${acmAddress}
   TRCSToken:           ${tokenAddress}
   TRCSCredential:      ${credentialAddress}
   RewardDistributor:   ${distributorAddress}

📊 Initial State:
   Token Total Supply:  ${ethers.formatEther(config.initialSupply)} TRCS
   Token Max Cap:       ${ethers.formatEther(config.maxCap)} TRCS
   Credentials Issued:  0

🔐 Role Configuration:
   Admin:               ${deployer.address}
   Issuer:              ${deployer.address}, ${distributorAddress}
   Pauser:              ${deployer.address}
   Revoker:             ${deployer.address}

📁 Deployment saved to: deployments/${network.name}.json
  `);
  
  // Post-deployment instructions
  if (network.name !== "hardhat" && network.name !== "localhost") {
    console.log(`
⚠️  IMPORTANT POST-DEPLOYMENT STEPS:

1. Save the deployment addresses securely
2. Update your .env file with the contract addresses:
   TOKEN_CONTRACT_ADDRESS=${tokenAddress}
   CREDENTIAL_CONTRACT_ADDRESS=${credentialAddress}
   REWARD_DISTRIBUTOR_ADDRESS=${distributorAddress}
   ACCESS_CONTROL_MANAGER_ADDRESS=${acmAddress}

3. For production:
   - Transfer admin roles to a multi-sig wallet
   - Set up monitoring for contract events
   - Configure your backend with the new addresses
    `);
  }
}

// =============================================================================
// EXECUTE
// =============================================================================

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
