/**
 * TRCS Demo Script
 * 
 * This script demonstrates the full functionality of the TRCS system:
 * 1. Shows token balances
 * 2. Transfers tokens between accounts
 * 3. Issues a credential NFT
 * 4. Creates a vesting schedule
 * 5. Claims vested tokens
 * 
 * Run with: npx hardhat run scripts/demo-full.ts --network localhost
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

function log(message: string, color: string = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function header(title: string) {
  console.log("\n" + "=".repeat(60));
  log(`  ${title}`, colors.bright + colors.cyan);
  console.log("=".repeat(60) + "\n");
}

function success(message: string) {
  log(`✅ ${message}`, colors.green);
}

function info(message: string) {
  log(`ℹ️  ${message}`, colors.blue);
}

function money(message: string) {
  log(`💰 ${message}`, colors.yellow);
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log("\n");
  log("🚀 TRCS DEMO SCRIPT", colors.bright + colors.magenta);
  log("   Tokenized Reward & Credential System\n", colors.magenta);

  // Load deployment addresses
  const deploymentPath = path.join(__dirname, "../deployments/localhost.json");
  if (!fs.existsSync(deploymentPath)) {
    throw new Error("Deployment file not found. Run 'npx hardhat run scripts/deploy.ts --network localhost' first.");
  }
  
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  
  // Get signers (test accounts)
  const [deployer, alice, bob, charlie] = await ethers.getSigners();
  
  info(`Deployer: ${deployer.address}`);
  info(`Alice:    ${alice.address}`);
  info(`Bob:      ${bob.address}`);
  info(`Charlie:  ${charlie.address}`);

  // Get contract instances
  const token = await ethers.getContractAt("TRCSToken", deployment.token);
  const credential = await ethers.getContractAt("TRCSCredential", deployment.credential);
  const distributor = await ethers.getContractAt("RewardDistributor", deployment.rewardDistributor);

  // ========================================
  // STEP 1: Show Initial Balances
  // ========================================
  header("STEP 1: Initial Token Balances");

  const showBalances = async () => {
    const deployerBal = await token.balanceOf(deployer.address);
    const aliceBal = await token.balanceOf(alice.address);
    const bobBal = await token.balanceOf(bob.address);
    const charlieBal = await token.balanceOf(charlie.address);

    console.log(`  Deployer: ${ethers.formatEther(deployerBal)} TRCS`);
    console.log(`  Alice:    ${ethers.formatEther(aliceBal)} TRCS`);
    console.log(`  Bob:      ${ethers.formatEther(bobBal)} TRCS`);
    console.log(`  Charlie:  ${ethers.formatEther(charlieBal)} TRCS`);
  };

  await showBalances();

  // ========================================
  // STEP 2: Transfer Tokens
  // ========================================
  header("STEP 2: Sending Tokens (Simulating Course Rewards)");

  info("Scenario: Alice completed 'Blockchain 101' - Reward: 500 TRCS");
  await sleep(1000);
  
  const tx1 = await token.transfer(alice.address, ethers.parseEther("500"));
  await tx1.wait();
  success(`Sent 500 TRCS to Alice`);
  money(`TX Hash: ${tx1.hash}`);

  await sleep(500);

  info("\nScenario: Bob completed 'Smart Contract Security' - Reward: 750 TRCS");
  await sleep(1000);
  
  const tx2 = await token.transfer(bob.address, ethers.parseEther("750"));
  await tx2.wait();
  success(`Sent 750 TRCS to Bob`);
  money(`TX Hash: ${tx2.hash}`);

  await sleep(500);

  info("\nScenario: Charlie completed 'DeFi Fundamentals' - Reward: 300 TRCS");
  await sleep(1000);
  
  const tx3 = await token.transfer(charlie.address, ethers.parseEther("300"));
  await tx3.wait();
  success(`Sent 300 TRCS to Charlie`);
  money(`TX Hash: ${tx3.hash}`);

  console.log("\n📊 Updated Balances:");
  await showBalances();

  // ========================================
  // STEP 3: Issue Credential NFTs
  // ========================================
  header("STEP 3: Issuing Credential NFTs");

  info("Minting 'Blockchain 101 Certificate' NFT for Alice...");
  await sleep(1000);

  // Credential type hash: keccak256("COURSE_COMPLETION")
  const courseCompletionType = ethers.keccak256(ethers.toUtf8Bytes("COURSE_COMPLETION"));
  const noExpiration = 0; // Never expires
  const dataHash = ethers.keccak256(ethers.toUtf8Bytes("Blockchain 101 Certificate - Alice"));

  const credTx1 = await credential.issueCredential(
    alice.address,
    "ipfs://QmBlockchain101CertificateAlice",
    courseCompletionType,
    noExpiration,
    dataHash
  );
  const credReceipt1 = await credTx1.wait();
  success(`Credential NFT minted for Alice!`);
  
  // Get token ID from event
  const event1 = credReceipt1?.logs.find((log: any) => {
    try {
      return credential.interface.parseLog({ topics: log.topics as string[], data: log.data })?.name === "CredentialIssued";
    } catch { return false; }
  });
  if (event1) {
    const parsed = credential.interface.parseLog({ topics: event1.topics as string[], data: event1.data });
    info(`Token ID: ${parsed?.args?.tokenId}`);
  }

  await sleep(500);

  info("\nMinting 'Smart Contract Security Certificate' NFT for Bob...");
  await sleep(1000);

  const dataHash2 = ethers.keccak256(ethers.toUtf8Bytes("Smart Contract Security - Bob"));
  const credTx2 = await credential.issueCredential(
    bob.address,
    "ipfs://QmSmartContractSecurityCertificateBob",
    courseCompletionType,
    noExpiration,
    dataHash2
  );
  await credTx2.wait();
  success(`Credential NFT minted for Bob!`);

  // Check credential counts
  const aliceCredCount = await credential.balanceOf(alice.address);
  const bobCredCount = await credential.balanceOf(bob.address);
  
  console.log("\n🏆 Credential Counts:");
  console.log(`  Alice: ${aliceCredCount} NFT(s)`);
  console.log(`  Bob:   ${bobCredCount} NFT(s)`);

  // ========================================
  // STEP 4: Create Vesting Schedule
  // ========================================
  header("STEP 4: Creating Token Vesting (Long-term Rewards)");

  info("Scenario: Charlie gets 1000 TRCS vested over time for being a top learner");
  await sleep(1000);

  // Check if Charlie already has a vesting schedule
  const existingSchedule = await distributor.getVestingSchedule(charlie.address);
  
  if (existingSchedule.totalAmount > 0n) {
    info(`Charlie already has a vesting schedule with ${ethers.formatEther(existingSchedule.totalAmount)} TRCS`);
    info("Skipping vesting creation - schedule already exists");
  } else {
    // Approve tokens for vesting
    const vestingAmount = ethers.parseEther("1000");
    await token.approve(deployment.rewardDistributor, vestingAmount);
    
    const vestingDuration = 120; // 2 minutes for demo
    const cliffDuration = 30; // 30 seconds cliff

    const vestTx = await distributor.createVestingSchedule(
      charlie.address,
      vestingAmount,
      cliffDuration,
      vestingDuration,
      false // not revocable
    );
    await vestTx.wait();
    
    success(`Vesting schedule created for Charlie!`);
    info(`Amount: 1000 TRCS`);
    info(`Cliff: 30 seconds`);
    info(`Full vesting: 2 minutes`);
    money(`TX Hash: ${vestTx.hash}`);
  }

  // ========================================
  // STEP 5: Check Vesting Status
  // ========================================
  header("STEP 5: Checking Vesting Status");

  const schedule = await distributor.getVestingSchedule(charlie.address);
  const releasable = await distributor.getReleasableAmount(charlie.address);

  console.log("📋 Charlie's Vesting Schedule:");
  console.log(`  Total Amount:   ${ethers.formatEther(schedule.totalAmount)} TRCS`);
  console.log(`  Released:       ${ethers.formatEther(schedule.releasedAmount)} TRCS`);
  console.log(`  Releasable Now: ${ethers.formatEther(releasable)} TRCS`);
  console.log(`  Cliff Duration: ${schedule.cliffDuration} seconds`);
  console.log(`  Total Duration: ${schedule.vestingDuration} seconds`);

  // ========================================
  // STEP 6: Wait and Claim
  // ========================================
  header("STEP 6: Waiting for Tokens to Vest...");

  info("Using Hardhat time manipulation to simulate 60 seconds passing...");
  await sleep(1000);
  
  // Use Hardhat's time manipulation instead of real waiting
  await network.provider.send("evm_increaseTime", [60]); // Advance 60 seconds (past the 30s cliff)
  await network.provider.send("evm_mine", []); // Mine a new block
  
  success("Time advanced by 60 seconds!");

  const releasableAfterCliff = await distributor.getReleasableAmount(charlie.address);
  success(`Cliff passed! Releasable: ${ethers.formatEther(releasableAfterCliff)} TRCS`);

  if (releasableAfterCliff > 0n) {
    info("\nClaiming vested tokens for Charlie...");
    await sleep(1000);

    const claimTx = await distributor.releaseVested(charlie.address);
    await claimTx.wait();
    
    const newBalance = await token.balanceOf(charlie.address);
    success(`Tokens claimed!`);
    money(`Charlie's new balance: ${ethers.formatEther(newBalance)} TRCS`);
  } else {
    info("\nNo tokens vested yet. Advancing time to full vesting...");
    await network.provider.send("evm_increaseTime", [120]); // Full vesting duration
    await network.provider.send("evm_mine", []);
    
    const fullReleasable = await distributor.getReleasableAmount(charlie.address);
    success(`Full vesting reached! Releasable: ${ethers.formatEther(fullReleasable)} TRCS`);
    
    if (fullReleasable > 0n) {
      const claimTx = await distributor.releaseVested(charlie.address);
      await claimTx.wait();
      
      const newBalance = await token.balanceOf(charlie.address);
      success(`Tokens claimed!`);
      money(`Charlie's new balance: ${ethers.formatEther(newBalance)} TRCS`);
    }
  }

  // ========================================
  // FINAL SUMMARY
  // ========================================
  header("DEMO COMPLETE! 🎉");

  console.log("📊 Final Token Balances:");
  await showBalances();

  const aliceCredFinal = await credential.balanceOf(alice.address);
  const bobCredFinal = await credential.balanceOf(bob.address);

  console.log("\n🏆 Credential NFTs:");
  console.log(`  Alice: ${aliceCredFinal} certificate(s)`);
  console.log(`  Bob:   ${bobCredFinal} certificate(s)`);

  console.log("\n" + "=".repeat(60));
  log("  To see tokens in MetaMask:", colors.bright);
  console.log("=".repeat(60));
  console.log(`
  1. Add Hardhat Network to MetaMask:
     - RPC URL: http://127.0.0.1:8545
     - Chain ID: 31337

  2. Import a test account (Alice):
     Private Key: 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d
     Address: ${alice.address}

  3. Add TRCS token:
     Token Address: ${deployment.token}
     Symbol: TRCS
     Decimals: 18

  4. Open the website: http://localhost:3000/tokens
  `);

  log("\n✨ Demo completed successfully!\n", colors.green + colors.bright);
  console.log(`
  =====================================================
  🔑 IMPORT THIS ACCOUNT INTO METAMASK TO SEE TOKENS:
  =====================================================
  
  Alice's Private Key (has ${ethers.formatEther(await token.balanceOf(alice.address))} TRCS):
  0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d
  
  Bob's Private Key (has ${ethers.formatEther(await token.balanceOf(bob.address))} TRCS):
  0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a
  
  Charlie's Private Key (has ${ethers.formatEther(await token.balanceOf(charlie.address))} TRCS):
  0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6
  
  Token Contract Address: ${deployment.token}
  
  MetaMask Network Settings:
  - Network Name: Hardhat Local
  - RPC URL: http://127.0.0.1:8545
  - Chain ID: 31337
  - Currency: ETH
  `);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
