/**
 * @file distribute_rewards.ts
 * @description Script to distribute token rewards via various methods
 *
 * =============================================================================
 * LEARNING PATH - Reward Distribution Patterns
 * =============================================================================
 *
 * This script demonstrates three distribution methods:
 * 1. DIRECT: Immediate transfer to recipients
 * 2. VESTING: Tokens released over time
 * 3. MERKLE: Gas-efficient airdrops via Merkle proofs
 *
 * Each method has trade-offs:
 * - Direct: Simple but admin pays all gas
 * - Vesting: Good for long-term incentives
 * - Merkle: Best for large-scale distributions
 *
 * USAGE:
 * npx hardhat run scripts/distribute_rewards.ts --network localhost
 *
 * =============================================================================
 */

import { ethers, network } from "hardhat";
import { StandardMerkleTree } from "@openzeppelin/merkle-tree";
import * as fs from "fs";
import * as path from "path";

// =============================================================================
// TYPES
// =============================================================================

interface AirdropRecipient {
  address: string;
  amount: string; // Amount in wei as string
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Load deployment addresses
 */
function loadDeployment(): {
  token: string;
  rewardDistributor: string;
  accessControlManager: string;
} {
  const deploymentPath = path.join(__dirname, "..", "deployments", `${network.name}.json`);
  
  if (!fs.existsSync(deploymentPath)) {
    throw new Error(`No deployment found for network: ${network.name}. Run deploy.ts first.`);
  }
  
  return JSON.parse(fs.readFileSync(deploymentPath, "utf-8"));
}

/**
 * Save Merkle tree for later claiming
 */
function saveMerkleTree(
  distributionId: number,
  tree: StandardMerkleTree<[string, string]>,
  recipients: AirdropRecipient[]
): void {
  const merkleDir = path.join(__dirname, "..", "merkle-trees");
  
  if (!fs.existsSync(merkleDir)) {
    fs.mkdirSync(merkleDir, { recursive: true });
  }
  
  // Save full tree
  const treeFile = path.join(merkleDir, `distribution-${distributionId}-tree.json`);
  fs.writeFileSync(treeFile, JSON.stringify(tree.dump(), null, 2));
  
  // Save proofs for each recipient
  const proofsFile = path.join(merkleDir, `distribution-${distributionId}-proofs.json`);
  const proofs: Record<string, { amount: string; proof: string[] }> = {};
  
  for (const [i, v] of tree.entries()) {
    const [address, amount] = v;
    proofs[address] = {
      amount,
      proof: tree.getProof(i),
    };
  }
  
  fs.writeFileSync(proofsFile, JSON.stringify(proofs, null, 2));
  
  console.log(`   📄 Merkle tree saved to: ${treeFile}`);
  console.log(`   📄 Proofs saved to: ${proofsFile}`);
}

// =============================================================================
// MAIN FUNCTION
// =============================================================================

async function main(): Promise<void> {
  console.log("=".repeat(70));
  console.log("💰 TRCS Reward Distribution Script");
  console.log("=".repeat(70));
  
  // Load deployment
  const deployment = loadDeployment();
  console.log(`\n📋 Using deployment for network: ${network.name}`);
  console.log(`   Token:             ${deployment.token}`);
  console.log(`   RewardDistributor: ${deployment.rewardDistributor}`);
  
  // Get signer
  const [admin] = await ethers.getSigners();
  console.log(`   Admin Address:     ${admin.address}`);
  
  // Connect to contracts
  const token = await ethers.getContractAt("TRCSToken", deployment.token);
  const distributor = await ethers.getContractAt("RewardDistributor", deployment.rewardDistributor);
  
  // Check initial balances
  const adminBalance = await token.balanceOf(admin.address);
  console.log(`\n   Admin Token Balance: ${ethers.formatEther(adminBalance)} TRCS`);
  
  // ==========================================================================
  // METHOD 1: Direct Distribution
  // ==========================================================================
  
  console.log("\n" + "-".repeat(70));
  console.log("1️⃣  DIRECT DISTRIBUTION");
  console.log("-".repeat(70));
  console.log("   Use case: Immediate rewards, small groups, bounties");
  
  const signers = await ethers.getSigners();
  const directRecipient = signers.length > 1 ? signers[1].address : admin.address;
  const directAmount = ethers.parseEther("1000"); // 1000 tokens
  const reasonHash = ethers.keccak256(ethers.toUtf8Bytes("Bug Bounty Reward"));
  
  console.log(`\n   Distributing ${ethers.formatEther(directAmount)} TRCS to ${directRecipient}`);
  
  try {
    const tx = await distributor.distributeDirectly(
      directRecipient,
      directAmount,
      reasonHash
    );
    const receipt = await tx.wait();
    console.log(`   ✅ Direct distribution successful!`);
    console.log(`      TX Hash: ${receipt?.hash}`);
    console.log(`      Gas Used: ${receipt?.gasUsed.toString()}`);
    
    const newBalance = await token.balanceOf(directRecipient);
    console.log(`      New Balance: ${ethers.formatEther(newBalance)} TRCS`);
  } catch (error) {
    console.error("   ❌ Direct distribution failed:", error);
  }
  
  // ==========================================================================
  // METHOD 2: Batch Direct Distribution
  // ==========================================================================
  
  console.log("\n" + "-".repeat(70));
  console.log("2️⃣  BATCH DIRECT DISTRIBUTION");
  console.log("-".repeat(70));
  console.log("   Use case: Multiple rewards in one transaction");
  
  const batchRecipients = signers.slice(0, 3).map((s) => s.address);
  const batchAmounts = [
    ethers.parseEther("500"),
    ethers.parseEther("750"),
    ethers.parseEther("1000"),
  ];
  const batchReason = ethers.keccak256(ethers.toUtf8Bytes("Community Rewards"));
  
  console.log(`\n   Distributing to ${batchRecipients.length} recipients:`);
  for (let i = 0; i < batchRecipients.length; i++) {
    console.log(`      ${batchRecipients[i]}: ${ethers.formatEther(batchAmounts[i])} TRCS`);
  }
  
  try {
    const tx = await distributor.distributeBatch(
      batchRecipients,
      batchAmounts,
      batchReason
    );
    const receipt = await tx.wait();
    console.log(`\n   ✅ Batch distribution successful!`);
    console.log(`      TX Hash: ${receipt?.hash}`);
    console.log(`      Gas Used: ${receipt?.gasUsed.toString()}`);
  } catch (error) {
    console.error("   ❌ Batch distribution failed:", error);
  }
  
  // ==========================================================================
  // METHOD 3: Vesting Schedule
  // ==========================================================================
  
  console.log("\n" + "-".repeat(70));
  console.log("3️⃣  VESTING SCHEDULE");
  console.log("-".repeat(70));
  console.log("   Use case: Team tokens, long-term incentives");
  
  const vestingBeneficiary = signers.length > 2 ? signers[2].address : admin.address;
  const vestingAmount = ethers.parseEther("10000"); // 10,000 tokens
  const cliffDuration = 90 * 24 * 60 * 60; // 90 days
  const vestingDuration = 365 * 24 * 60 * 60; // 1 year
  
  console.log(`\n   Creating vesting schedule:`);
  console.log(`      Beneficiary: ${vestingBeneficiary}`);
  console.log(`      Amount: ${ethers.formatEther(vestingAmount)} TRCS`);
  console.log(`      Cliff: 90 days`);
  console.log(`      Duration: 365 days`);
  console.log(`      Revocable: Yes`);
  
  try {
    const tx = await distributor.createVestingSchedule(
      vestingBeneficiary,
      vestingAmount,
      cliffDuration,
      vestingDuration,
      true // revocable
    );
    const receipt = await tx.wait();
    console.log(`\n   ✅ Vesting schedule created!`);
    console.log(`      TX Hash: ${receipt?.hash}`);
    
    // Check vesting details
    const schedule = await distributor.getVestingSchedule(vestingBeneficiary);
    console.log(`\n   📊 Vesting Schedule Details:`);
    console.log(`      Total Amount: ${ethers.formatEther(schedule.totalAmount)} TRCS`);
    console.log(`      Released: ${ethers.formatEther(schedule.releasedAmount)} TRCS`);
    console.log(`      Start Time: ${new Date(Number(schedule.startTime) * 1000).toISOString()}`);
    
    // Check current vested amount
    const vestedNow = await distributor.getVestedAmount(vestingBeneficiary);
    console.log(`      Vested Now: ${ethers.formatEther(vestedNow)} TRCS`);
  } catch (error) {
    console.error("   ❌ Vesting creation failed:", error);
  }
  
  // ==========================================================================
  // METHOD 4: Merkle Airdrop
  // ==========================================================================
  
  console.log("\n" + "-".repeat(70));
  console.log("4️⃣  MERKLE AIRDROP");
  console.log("-".repeat(70));
  console.log("   Use case: Large-scale distributions, users claim themselves");
  
  // Create airdrop list
  const airdropList: AirdropRecipient[] = signers.slice(0, 5).map((signer, index) => ({
    address: signer.address,
    amount: ethers.parseEther(String((index + 1) * 100)).toString(),
  }));
  
  console.log(`\n   Creating Merkle tree for ${airdropList.length} recipients:`);
  for (const recipient of airdropList) {
    console.log(`      ${recipient.address}: ${ethers.formatEther(recipient.amount)} TRCS`);
  }
  
  // Build Merkle tree
  // Format: [address, amount] - OpenZeppelin Merkle tree format
  const values: [string, string][] = airdropList.map((r) => [r.address, r.amount]);
  const tree = StandardMerkleTree.of(values, ["address", "uint256"]);
  
  console.log(`\n   📊 Merkle Tree:`);
  console.log(`      Root: ${tree.root}`);
  
  // Calculate total
  const totalAirdrop = airdropList.reduce(
    (sum, r) => sum + BigInt(r.amount),
    0n
  );
  
  // Create distribution on-chain
  const duration = 30 * 24 * 60 * 60; // 30 days to claim
  const ipfsHash = "QmExampleMerkleTreeIPFSHash";
  
  try {
    const tx = await distributor.createMerkleDistribution(
      tree.root,
      totalAirdrop,
      duration,
      ipfsHash
    );
    const receipt = await tx.wait();
    
    // Get distribution ID from event
    const event = receipt?.logs.find((log) => {
      try {
        const parsed = distributor.interface.parseLog({
          topics: log.topics as string[],
          data: log.data,
        });
        return parsed?.name === "MerkleDistributionCreated";
      } catch {
        return false;
      }
    });
    
    let distributionId = 1;
    if (event) {
      const parsed = distributor.interface.parseLog({
        topics: event.topics as string[],
        data: event.data,
      });
      distributionId = Number(parsed?.args.distributionId);
    }
    
    console.log(`\n   ✅ Merkle distribution created!`);
    console.log(`      Distribution ID: ${distributionId}`);
    console.log(`      TX Hash: ${receipt?.hash}`);
    console.log(`      Total Amount: ${ethers.formatEther(totalAirdrop)} TRCS`);
    
    // Save tree for claiming
    saveMerkleTree(distributionId, tree, airdropList);
    
    // ==========================================================================
    // DEMONSTRATE CLAIMING
    // ==========================================================================
    
    console.log("\n   🎯 Demonstrating claim process...");
    
    const claimant = signers[0];
    const claimAmount = airdropList[0].amount;
    
    // Get proof for this claimant
    let proof: string[] = [];
    for (const [i, v] of tree.entries()) {
      if (v[0] === claimant.address) {
        proof = tree.getProof(i);
        break;
      }
    }
    
    console.log(`\n      Claimant: ${claimant.address}`);
    console.log(`      Amount: ${ethers.formatEther(claimAmount)} TRCS`);
    console.log(`      Proof: ${JSON.stringify(proof).slice(0, 80)}...`);
    
    // Verify before claiming
    const [valid, claimable] = await distributor.verifyMerkleClaim(
      distributionId,
      claimant.address,
      claimAmount,
      proof
    );
    console.log(`      Valid Proof: ${valid}`);
    console.log(`      Claimable: ${claimable}`);
    
    if (claimable) {
      const claimTx = await distributor.connect(claimant).claimMerkle(
        distributionId,
        claimAmount,
        proof
      );
      const claimReceipt = await claimTx.wait();
      
      console.log(`\n   ✅ Claim successful!`);
      console.log(`      TX Hash: ${claimReceipt?.hash}`);
      console.log(`      Gas Used: ${claimReceipt?.gasUsed.toString()}`);
      
      const newBalance = await token.balanceOf(claimant.address);
      console.log(`      New Balance: ${ethers.formatEther(newBalance)} TRCS`);
    }
    
  } catch (error) {
    console.error("   ❌ Merkle distribution failed:", error);
  }
  
  // ==========================================================================
  // SUMMARY
  // ==========================================================================
  
  console.log("\n" + "=".repeat(70));
  console.log("📊 Distribution Summary");
  console.log("=".repeat(70));
  
  const totalSupply = await token.totalSupply();
  const vestingLocked = await distributor.totalVestingLocked();
  const distributionReserved = await distributor.totalDistributionReserved();
  
  console.log(`\n   Token Statistics:`);
  console.log(`      Total Supply: ${ethers.formatEther(totalSupply)} TRCS`);
  console.log(`      Vesting Locked: ${ethers.formatEther(vestingLocked)} TRCS`);
  console.log(`      Distribution Reserved: ${ethers.formatEther(distributionReserved)} TRCS`);
  
  console.log("\n" + "=".repeat(70));
  console.log("🎉 Reward distribution complete!");
  console.log("=".repeat(70));
}

// =============================================================================
// EXECUTE
// =============================================================================

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Script failed:", error);
    process.exit(1);
  });
