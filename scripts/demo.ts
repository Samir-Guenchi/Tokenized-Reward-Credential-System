/**
 * @file demo.ts
 * @description Interactive demo script for TRCS blockchain project
 * 
 * This script demonstrates the full flow of the TRCS platform:
 * 1. Token operations (transfers, balances)
 * 2. Credential minting (NFT credentials)
 * 3. Reward distribution (vesting schedules)
 * 
 * USAGE:
 * npx hardhat run scripts/demo.ts --network localhost
 */

import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

// Colors for console output
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
};

function log(message: string, color: string = colors.reset): void {
  console.log(`${color}${message}${colors.reset}`);
}

function header(title: string): void {
  console.log();
  log("═".repeat(70), colors.cyan);
  log(`  ${title}`, colors.bright + colors.cyan);
  log("═".repeat(70), colors.cyan);
  console.log();
}

function subHeader(title: string): void {
  console.log();
  log(`▸ ${title}`, colors.yellow);
  log("─".repeat(50), colors.yellow);
}

function success(message: string): void {
  log(`  ✓ ${message}`, colors.green);
}

function info(message: string): void {
  log(`  ℹ ${message}`, colors.blue);
}

// Load deployment addresses
function loadDeployment(): {
  accessControlManager: string;
  token: string;
  credential: string;
  rewardDistributor: string;
} {
  const deploymentPath = path.join(__dirname, "..", "deployments", `${network.name}.json`);
  
  if (!fs.existsSync(deploymentPath)) {
    throw new Error(`No deployment found for network: ${network.name}. Run deploy.ts first.`);
  }
  
  return JSON.parse(fs.readFileSync(deploymentPath, "utf-8"));
}

async function main(): Promise<void> {
  header("🎓 TRCS PLATFORM DEMO");
  
  info("This demo showcases the Tokenized Reward & Credential System");
  info("Network: " + network.name);
  console.log();

  // Load contracts
  const deployment = loadDeployment();
  const [deployer, alice, bob, charlie] = await ethers.getSigners();
  
  info(`Deployer: ${deployer.address}`);
  info(`Alice: ${alice.address}`);
  info(`Bob: ${bob.address}`);
  info(`Charlie: ${charlie.address}`);

  // Get contract instances
  const token = await ethers.getContractAt("TRCSToken", deployment.token);
  const credential = await ethers.getContractAt("TRCSCredential", deployment.credential);
  const rewardDistributor = await ethers.getContractAt("RewardDistributor", deployment.rewardDistributor);

  // ==========================================================================
  // DEMO 1: TOKEN OPERATIONS
  // ==========================================================================
  header("💰 DEMO 1: TOKEN OPERATIONS");
  
  subHeader("Token Information");
  const name = await token.name();
  const symbol = await token.symbol();
  const totalSupply = await token.totalSupply();
  const decimals = await token.decimals();
  
  success(`Token Name: ${name}`);
  success(`Token Symbol: ${symbol}`);
  success(`Decimals: ${decimals}`);
  success(`Total Supply: ${ethers.formatUnits(totalSupply, decimals)} ${symbol}`);

  subHeader("Check Deployer Balance");
  const deployerBalance = await token.balanceOf(deployer.address);
  success(`Deployer Balance: ${ethers.formatUnits(deployerBalance, decimals)} ${symbol}`);

  subHeader("Transfer Tokens to Alice");
  const transferAmount = ethers.parseUnits("1000", decimals);
  info(`Transferring 1000 ${symbol} to Alice...`);
  
  const tx1 = await token.transfer(alice.address, transferAmount);
  await tx1.wait();
  
  const aliceBalance = await token.balanceOf(alice.address);
  success(`Alice's Balance: ${ethers.formatUnits(aliceBalance, decimals)} ${symbol}`);
  success(`Transaction Hash: ${tx1.hash}`);

  subHeader("Alice Transfers to Bob");
  info(`Alice sending 250 ${symbol} to Bob...`);
  
  const tx2 = await token.connect(alice).transfer(bob.address, ethers.parseUnits("250", decimals));
  await tx2.wait();
  
  const bobBalance = await token.balanceOf(bob.address);
  success(`Bob's Balance: ${ethers.formatUnits(bobBalance, decimals)} ${symbol}`);

  // ==========================================================================
  // DEMO 2: CREDENTIAL MINTING
  // ==========================================================================
  header("🎖️ DEMO 2: CREDENTIAL (NFT) MINTING");

  subHeader("Credential Contract Info");
  const credentialName = await credential.name();
  const credentialSymbol = await credential.symbol();
  success(`NFT Name: ${credentialName}`);
  success(`NFT Symbol: ${credentialSymbol}`);

  subHeader("Mint Course Completion Certificate to Alice");
  const credentialType = 0; // COURSE_COMPLETION
  const expiresAt = 0; // Never expires
  const tokenURI = "ipfs://QmDemo123456789/metadata.json";
  
  info("Minting credential NFT...");
  
  // Check if deployer has minter role
  const MINTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MINTER_ROLE"));
  
  const tx3 = await credential.issueCredential(
    alice.address,
    credentialType,
    expiresAt,
    tokenURI
  );
  const receipt3 = await tx3.wait();
  
  // Get token ID from event
  const tokenId = 1; // First token
  success(`Credential NFT minted!`);
  success(`Token ID: ${tokenId}`);
  success(`Owner: ${alice.address}`);
  success(`Type: Course Completion`);
  success(`Transaction Hash: ${tx3.hash}`);

  subHeader("Verify Alice's Credentials");
  const aliceCredentialCount = await credential.balanceOf(alice.address);
  success(`Alice owns ${aliceCredentialCount} credential(s)`);
  
  const credentialOwner = await credential.ownerOf(tokenId);
  success(`Token #${tokenId} owner verified: ${credentialOwner}`);

  subHeader("Check Credential Validity");
  const isValid = await credential.isCredentialValid(tokenId);
  success(`Credential #${tokenId} is valid: ${isValid}`);

  // ==========================================================================
  // DEMO 3: REWARD DISTRIBUTION
  // ==========================================================================
  header("🎁 DEMO 3: REWARD DISTRIBUTION (VESTING)");

  subHeader("Reward Distributor Info");
  const rewardToken = await rewardDistributor.rewardToken();
  success(`Reward Token Address: ${rewardToken}`);

  subHeader("Fund Reward Distributor");
  const fundAmount = ethers.parseUnits("10000", decimals);
  info("Approving tokens for reward distributor...");
  
  const tx4 = await token.approve(rewardDistributor.target, fundAmount);
  await tx4.wait();
  success("Tokens approved for distribution");

  subHeader("Create Vesting Schedule for Bob");
  const vestingAmount = ethers.parseUnits("5000", decimals);
  const now = Math.floor(Date.now() / 1000);
  const cliffDuration = 60; // 1 minute cliff for demo
  const vestingDuration = 300; // 5 minutes total vesting
  
  info("Creating vesting schedule...");
  info(`  Amount: 5000 ${symbol}`);
  info(`  Cliff: 1 minute`);
  info(`  Total Duration: 5 minutes`);
  
  const tx5 = await rewardDistributor.createVestingSchedule(
    bob.address,
    vestingAmount,
    now,
    cliffDuration,
    vestingDuration
  );
  await tx5.wait();
  
  success("Vesting schedule created!");
  success(`Beneficiary: ${bob.address}`);
  success(`Transaction Hash: ${tx5.hash}`);

  subHeader("Check Bob's Vesting Schedule");
  const schedule = await rewardDistributor.getVestingSchedule(bob.address);
  success(`Total Amount: ${ethers.formatUnits(schedule.totalAmount, decimals)} ${symbol}`);
  success(`Released: ${ethers.formatUnits(schedule.released, decimals)} ${symbol}`);
  success(`Start Time: ${new Date(Number(schedule.start) * 1000).toLocaleString()}`);

  subHeader("Check Releasable Amount");
  const releasable = await rewardDistributor.getReleasableAmount(bob.address);
  success(`Currently Releasable: ${ethers.formatUnits(releasable, decimals)} ${symbol}`);
  info("(Tokens will become releasable after the cliff period passes)");

  // ==========================================================================
  // SUMMARY
  // ==========================================================================
  header("📊 DEMO SUMMARY");

  console.log();
  log("  Token Operations:", colors.bright);
  info(`  • Transferred 1000 ${symbol} to Alice`);
  info(`  • Alice sent 250 ${symbol} to Bob`);
  console.log();
  
  log("  Credential Operations:", colors.bright);
  info(`  • Minted Course Completion NFT to Alice (Token #${tokenId})`);
  info(`  • Verified credential ownership and validity`);
  console.log();
  
  log("  Reward Operations:", colors.bright);
  info(`  • Created vesting schedule for Bob (5000 ${symbol})`);
  info(`  • Cliff: 1 minute, Total: 5 minutes`);
  console.log();

  header("🌐 VIEW IN FRONTEND");
  
  info("The frontend is running at: http://localhost:3000");
  info("The backend API is at: http://localhost:3001/api");
  console.log();
  info("To connect with MetaMask:");
  info("  1. Add Hardhat Network (Chain ID: 31337, RPC: http://127.0.0.1:8545)");
  info("  2. Import a test account using one of these private keys:");
  console.log();
  
  // Show some test private keys from Hardhat
  const testKeys = [
    { name: "Account #0 (Deployer)", key: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" },
    { name: "Account #1 (Alice)", key: "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" },
    { name: "Account #2 (Bob)", key: "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a" },
  ];
  
  for (const account of testKeys) {
    log(`  ${account.name}:`, colors.magenta);
    info(`    ${account.key}`);
  }
  
  console.log();
  log("═".repeat(70), colors.green);
  log("  ✅ DEMO COMPLETED SUCCESSFULLY!", colors.bright + colors.green);
  log("═".repeat(70), colors.green);
  console.log();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Demo failed:", error);
    process.exit(1);
  });
