/**
 * @file seed_data.ts
 * @description Seed script to populate local environment with test data
 *
 * This script creates a realistic demo environment with:
 * - Multiple credential types
 * - Various token holders
 * - Active vesting schedules
 * - Pending Merkle distributions
 *
 * USAGE:
 * 1. Start local node: npx hardhat node
 * 2. Deploy contracts: npx hardhat run scripts/deploy.ts --network localhost
 * 3. Seed data: npx hardhat run scripts/seed_data.ts --network localhost
 */

import { ethers, network } from "hardhat";
import { StandardMerkleTree } from "@openzeppelin/merkle-tree";
import * as fs from "fs";
import * as path from "path";

// =============================================================================
// SEED DATA CONFIGURATION
// =============================================================================

const SEED_CONFIG = {
  // Token distributions
  tokenDistributions: [
    { name: "Alice", amount: "5000" },
    { name: "Bob", amount: "3000" },
    { name: "Charlie", amount: "7500" },
    { name: "Diana", amount: "2000" },
    { name: "Eve", amount: "10000" },
  ],
  
  // Credentials to issue
  credentials: [
    {
      type: "COURSE_COMPLETION",
      name: "Solidity Fundamentals Certificate",
      description: "Completed the Solidity Fundamentals course",
    },
    {
      type: "SKILL_CERTIFICATION",
      name: "Smart Contract Auditor Level 1",
      description: "Certified smart contract auditor - entry level",
    },
    {
      type: "MEMBERSHIP",
      name: "TRCS DAO Member",
      description: "Active member of the TRCS DAO",
    },
    {
      type: "ACHIEVEMENT",
      name: "Bug Bounty Hunter",
      description: "Found and reported a security vulnerability",
    },
  ],
  
  // Vesting schedules
  vestingSchedules: [
    { name: "Team Member", amount: "50000", cliffDays: 90, durationDays: 365 },
    { name: "Advisor", amount: "25000", cliffDays: 180, durationDays: 730 },
  ],
  
  // Airdrop configuration
  airdrop: {
    totalRecipients: 5,
    baseAmount: "100", // Base amount in tokens
  },
};

// =============================================================================
// MAIN FUNCTION
// =============================================================================

async function main(): Promise<void> {
  console.log("=".repeat(70));
  console.log("🌱 TRCS Seed Data Script");
  console.log("=".repeat(70));
  
  // Load deployment
  const deploymentPath = path.join(__dirname, "..", "deployments", `${network.name}.json`);
  if (!fs.existsSync(deploymentPath)) {
    throw new Error(`No deployment found. Run deploy.ts first.`);
  }
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf-8"));
  
  console.log(`\n📋 Loaded deployment for: ${network.name}`);
  
  // Get signers
  const signers = await ethers.getSigners();
  const admin = signers[0];
  
  console.log(`   Admin: ${admin.address}`);
  console.log(`   Available accounts: ${signers.length}`);
  
  // Connect to contracts
  const token = await ethers.getContractAt("TRCSToken", deployment.token);
  const credential = await ethers.getContractAt("TRCSCredential", deployment.credential);
  const distributor = await ethers.getContractAt("RewardDistributor", deployment.rewardDistributor);
  
  // ==========================================================================
  // SEED TOKENS
  // ==========================================================================
  
  console.log("\n" + "-".repeat(70));
  console.log("💰 Seeding Token Distributions");
  console.log("-".repeat(70));
  
  for (let i = 0; i < SEED_CONFIG.tokenDistributions.length; i++) {
    const dist = SEED_CONFIG.tokenDistributions[i];
    const recipient = signers[i % signers.length].address;
    const amount = ethers.parseEther(dist.amount);
    
    console.log(`\n   ${dist.name}: ${dist.amount} TRCS -> ${recipient.slice(0, 10)}...`);
    
    try {
      const reason = ethers.keccak256(ethers.toUtf8Bytes(`Seed: ${dist.name}`));
      await distributor.distributeDirectly(recipient, amount, reason);
      console.log(`   ✅ Distributed`);
    } catch (error) {
      console.log(`   ⚠️  Skipped (may already exist)`);
    }
  }
  
  // ==========================================================================
  // SEED CREDENTIALS
  // ==========================================================================
  
  console.log("\n" + "-".repeat(70));
  console.log("🎫 Seeding Credentials");
  console.log("-".repeat(70));
  
  for (let i = 0; i < SEED_CONFIG.credentials.length; i++) {
    const cred = SEED_CONFIG.credentials[i];
    const recipient = signers[(i + 1) % signers.length].address;
    
    console.log(`\n   ${cred.name} -> ${recipient.slice(0, 10)}...`);
    
    const metadata = {
      name: cred.name,
      description: cred.description,
      image: `ipfs://QmSeed${i}`,
      attributes: [
        { trait_type: "Type", value: cred.type },
        { trait_type: "Seed", value: true },
      ],
      credential: {
        type: cred.type,
        issuer: "TRCS Seed Script",
        issuedAt: new Date().toISOString(),
      },
    };
    
    const uri = `ipfs://QmSeedCredential${i}`;
    const typeHash = ethers.keccak256(ethers.toUtf8Bytes(cred.type));
    const dataHash = ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(metadata)));
    
    try {
      await credential.issueCredential(recipient, uri, typeHash, 0, dataHash);
      console.log(`   ✅ Issued`);
    } catch (error) {
      console.log(`   ⚠️  Skipped`);
    }
  }
  
  // ==========================================================================
  // SEED VESTING
  // ==========================================================================
  
  console.log("\n" + "-".repeat(70));
  console.log("⏰ Seeding Vesting Schedules");
  console.log("-".repeat(70));
  
  for (let i = 0; i < SEED_CONFIG.vestingSchedules.length; i++) {
    const vest = SEED_CONFIG.vestingSchedules[i];
    const beneficiary = signers[(i + 3) % signers.length].address;
    
    console.log(`\n   ${vest.name}: ${vest.amount} TRCS over ${vest.durationDays} days`);
    console.log(`      Beneficiary: ${beneficiary.slice(0, 10)}...`);
    
    try {
      await distributor.createVestingSchedule(
        beneficiary,
        ethers.parseEther(vest.amount),
        vest.cliffDays * 24 * 60 * 60,
        vest.durationDays * 24 * 60 * 60,
        true
      );
      console.log(`   ✅ Created`);
    } catch (error) {
      console.log(`   ⚠️  Skipped (may already exist)`);
    }
  }
  
  // ==========================================================================
  // SEED MERKLE DISTRIBUTION
  // ==========================================================================
  
  console.log("\n" + "-".repeat(70));
  console.log("🌳 Seeding Merkle Distribution");
  console.log("-".repeat(70));
  
  const airdropRecipients = signers.slice(0, SEED_CONFIG.airdrop.totalRecipients);
  const values: [string, string][] = airdropRecipients.map((signer, i) => [
    signer.address,
    ethers.parseEther(String((i + 1) * Number(SEED_CONFIG.airdrop.baseAmount))).toString(),
  ]);
  
  const tree = StandardMerkleTree.of(values, ["address", "uint256"]);
  const totalAmount = values.reduce((sum, v) => sum + BigInt(v[1]), 0n);
  
  console.log(`\n   Creating airdrop with ${values.length} recipients`);
  console.log(`   Total: ${ethers.formatEther(totalAmount)} TRCS`);
  console.log(`   Root: ${tree.root}`);
  
  try {
    const tx = await distributor.createMerkleDistribution(
      tree.root,
      totalAmount,
      7 * 24 * 60 * 60, // 7 days
      "QmSeedAirdrop"
    );
    await tx.wait();
    console.log(`   ✅ Merkle distribution created`);
    
    // Save tree
    const merkleDir = path.join(__dirname, "..", "merkle-trees");
    if (!fs.existsSync(merkleDir)) {
      fs.mkdirSync(merkleDir, { recursive: true });
    }
    fs.writeFileSync(
      path.join(merkleDir, "seed-airdrop-tree.json"),
      JSON.stringify(tree.dump(), null, 2)
    );
  } catch (error) {
    console.log(`   ⚠️  Skipped`);
  }
  
  // ==========================================================================
  // SUMMARY
  // ==========================================================================
  
  console.log("\n" + "=".repeat(70));
  console.log("📊 Seed Data Summary");
  console.log("=".repeat(70));
  
  const totalSupply = await token.totalSupply();
  const totalCredentials = await credential.totalCredentialsIssued();
  const vestingLocked = await distributor.totalVestingLocked();
  
  console.log(`\n   Token Total Supply: ${ethers.formatEther(totalSupply)} TRCS`);
  console.log(`   Credentials Issued: ${totalCredentials}`);
  console.log(`   Vesting Locked: ${ethers.formatEther(vestingLocked)} TRCS`);
  
  console.log("\n🌱 Seeding complete!");
  console.log("   You can now test the frontend and backend with this data.");
}

// =============================================================================
// EXECUTE
// =============================================================================

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Seed failed:", error);
    process.exit(1);
  });
