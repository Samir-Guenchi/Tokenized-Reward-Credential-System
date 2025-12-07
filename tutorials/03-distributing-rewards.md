# Tutorial 3: Distributing Rewards

> **Learn to create campaigns and distribute token rewards**

## Overview

In this tutorial, you'll learn how to:
- Create reward distribution campaigns
- Generate Merkle trees for eligible users
- Allow users to claim rewards
- Track distribution progress

## Prerequisites

- Completed [Tutorial 1](./01-first-deployment.md) and [Tutorial 2](./02-working-with-credentials.md)
- Contracts deployed locally
- Some TRCS tokens minted

## Understanding Reward Distribution

The RewardDistributor contract uses **Merkle trees** for efficient, gas-optimized distribution:

1. **Admin** creates a campaign with total tokens and Merkle root
2. **Users** claim by providing a Merkle proof
3. **Contract** verifies the proof and transfers tokens

### Why Merkle Trees?

- Store only 32-byte root on-chain (not entire user list)
- Users provide their own proof
- O(log n) verification cost
- Perfect for airdrops and large distributions

## Step 1: Setup

```bash
npx hardhat console --network localhost
```

```javascript
// Get contract instances
const Token = await ethers.getContractFactory("Token");
const token = Token.attach("0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512");

const Distributor = await ethers.getContractFactory("RewardDistributor");
const distributor = Distributor.attach("0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9");

const [admin, user1, user2, user3] = await ethers.getSigners();
```

## Step 2: Prepare Distribution List

Define who gets what:

```javascript
const distributions = [
  { address: user1.address, amount: ethers.parseEther("100") },
  { address: user2.address, amount: ethers.parseEther("200") },
  { address: user3.address, amount: ethers.parseEther("150") },
];

const totalAmount = distributions.reduce(
  (sum, d) => sum + d.amount,
  0n
);
console.log("Total to distribute:", ethers.formatEther(totalAmount));
```

## Step 3: Generate Merkle Tree

Install merkletreejs if not available:

```bash
npm install merkletreejs
```

Generate the tree:

```javascript
const { MerkleTree } = require('merkletreejs');
const keccak256 = require('keccak256');

// Create leaves from distribution data
function hashLeaf(address, amount) {
  return ethers.solidityPackedKeccak256(
    ['address', 'uint256'],
    [address, amount]
  );
}

const leaves = distributions.map(d => 
  hashLeaf(d.address, d.amount)
);

// Build tree
const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
const merkleRoot = tree.getHexRoot();
console.log("Merkle Root:", merkleRoot);
```

## Step 4: Mint Tokens for Distribution

```javascript
// Mint tokens to distributor contract
await token.mint(distributor.target, totalAmount);

// Verify balance
const balance = await token.balanceOf(distributor.target);
console.log("Distributor balance:", ethers.formatEther(balance));
```

## Step 5: Create Campaign

```javascript
// Campaign parameters
const startTime = Math.floor(Date.now() / 1000); // Now
const endTime = startTime + 86400 * 30; // 30 days

// Create campaign
const tx = await distributor.createCampaign(
  totalAmount,
  startTime,
  endTime,
  merkleRoot
);

const receipt = await tx.wait();

// Get campaign ID from event
const event = receipt.logs.find(
  log => log.fragment?.name === 'CampaignCreated'
);
const campaignId = event.args.campaignId;
console.log("Campaign ID:", campaignId.toString());
```

## Step 6: View Campaign Details

```javascript
const campaign = await distributor.getCampaign(campaignId);

console.log("Campaign Details:");
console.log("  Total Amount:", ethers.formatEther(campaign.totalAmount));
console.log("  Claimed:", ethers.formatEther(campaign.claimedAmount));
console.log("  Start:", new Date(Number(campaign.startTime) * 1000));
console.log("  End:", new Date(Number(campaign.endTime) * 1000));
console.log("  Paused:", campaign.paused);
```

## Step 7: Generate Proof for User

```javascript
function getProof(address, amount) {
  const leaf = hashLeaf(address, amount);
  return tree.getHexProof(leaf);
}

// Get proof for user1
const user1Amount = ethers.parseEther("100");
const user1Proof = getProof(user1.address, user1Amount);
console.log("User1 Proof:", user1Proof);
```

## Step 8: Claim Reward

```javascript
// User1 claims their reward
const tx = await distributor.connect(user1).claimReward(
  campaignId,
  user1Amount,
  user1Proof
);

await tx.wait();

// Check user1's token balance
const user1Balance = await token.balanceOf(user1.address);
console.log("User1 Token Balance:", ethers.formatEther(user1Balance));

// Check if claimed
const hasClaimed = await distributor.hasClaimed(campaignId, user1.address);
console.log("Has Claimed:", hasClaimed);
```

## Step 9: Batch Claiming

For multiple campaigns:

```javascript
// Assuming user has eligibility in multiple campaigns
const campaignIds = [0, 1, 2];
const amounts = [
  ethers.parseEther("100"),
  ethers.parseEther("50"),
  ethers.parseEther("75")
];
const proofs = [
  getProof(user1.address, amounts[0]),
  getProof(user1.address, amounts[1]),
  getProof(user1.address, amounts[2])
];

await distributor.connect(user1).batchClaim(campaignIds, amounts, proofs);
```

## Step 10: Campaign Management

### Pause Campaign

```javascript
// Admin can pause a campaign
await distributor.pauseCampaign(campaignId);

// Verify
const campaign = await distributor.getCampaign(campaignId);
console.log("Paused:", campaign.paused); // true
```

### Unpause Campaign

```javascript
await distributor.unpauseCampaign(campaignId);
```

### Withdraw Unclaimed Tokens

After campaign ends:

```javascript
// Only after endTime has passed
await distributor.withdrawUnclaimed(campaignId, admin.address);
```

## Full Example Script

```typescript
// scripts/distribute_rewards.ts
import { ethers } from "hardhat";
import { MerkleTree } from "merkletreejs";
import keccak256 from "keccak256";

interface Distribution {
  address: string;
  amount: bigint;
}

function hashLeaf(address: string, amount: bigint): string {
  return ethers.solidityPackedKeccak256(
    ['address', 'uint256'],
    [address, amount]
  );
}

async function main() {
  const [admin] = await ethers.getSigners();
  
  // Contract addresses (update these)
  const tokenAddress = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
  const distributorAddress = "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9";
  
  const token = await ethers.getContractAt("Token", tokenAddress);
  const distributor = await ethers.getContractAt("RewardDistributor", distributorAddress);
  
  // Load distribution list (in production, load from file)
  const distributions: Distribution[] = [
    { address: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", amount: ethers.parseEther("100") },
    { address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC", amount: ethers.parseEther("200") },
    { address: "0x90F79bf6EB2c4f870365E785982E1f101E93b906", amount: ethers.parseEther("150") },
  ];
  
  // Calculate total
  const totalAmount = distributions.reduce((sum, d) => sum + d.amount, 0n);
  console.log(`Total to distribute: ${ethers.formatEther(totalAmount)} TRCS`);
  
  // Generate Merkle tree
  const leaves = distributions.map(d => hashLeaf(d.address, d.amount));
  const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
  const merkleRoot = tree.getHexRoot();
  console.log(`Merkle Root: ${merkleRoot}`);
  
  // Mint tokens to distributor
  console.log("Minting tokens to distributor...");
  await token.mint(distributorAddress, totalAmount);
  
  // Create campaign
  const startTime = Math.floor(Date.now() / 1000);
  const endTime = startTime + 86400 * 30; // 30 days
  
  console.log("Creating campaign...");
  const tx = await distributor.createCampaign(
    totalAmount,
    startTime,
    endTime,
    merkleRoot
  );
  
  const receipt = await tx.wait();
  const event = receipt!.logs.find(
    (log: any) => log.fragment?.name === 'CampaignCreated'
  );
  const campaignId = (event as any).args.campaignId;
  
  console.log(`\n✅ Campaign Created!`);
  console.log(`   Campaign ID: ${campaignId}`);
  console.log(`   Total Amount: ${ethers.formatEther(totalAmount)} TRCS`);
  console.log(`   Recipients: ${distributions.length}`);
  console.log(`   Duration: 30 days`);
  
  // Generate and save proofs
  console.log("\n📋 Proofs for each recipient:");
  for (const d of distributions) {
    const proof = tree.getHexProof(hashLeaf(d.address, d.amount));
    console.log(`\n   ${d.address}:`);
    console.log(`   Amount: ${ethers.formatEther(d.amount)} TRCS`);
    console.log(`   Proof: ${JSON.stringify(proof)}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
```

## Exercise: Claim Interface

Build a simple claim script:

```typescript
// scripts/claim_reward.ts
import { ethers } from "hardhat";

async function main() {
  const campaignId = process.env.CAMPAIGN_ID || "0";
  const amount = ethers.parseEther(process.env.AMOUNT || "100");
  const proof = JSON.parse(process.env.PROOF || "[]");
  
  const [claimer] = await ethers.getSigners();
  const distributorAddress = "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9";
  
  const distributor = await ethers.getContractAt("RewardDistributor", distributorAddress);
  
  // Check if already claimed
  const hasClaimed = await distributor.hasClaimed(campaignId, claimer.address);
  if (hasClaimed) {
    console.log("❌ You have already claimed from this campaign");
    return;
  }
  
  // Claim
  console.log(`Claiming ${ethers.formatEther(amount)} TRCS...`);
  const tx = await distributor.claimReward(campaignId, amount, proof);
  await tx.wait();
  
  console.log("✅ Claim successful!");
}

main().catch(console.error);
```

Run with:
```bash
CAMPAIGN_ID=0 AMOUNT=100 PROOF='["0x...","0x..."]' npx hardhat run scripts/claim_reward.ts --network localhost
```

## Common Issues

### "Invalid Merkle proof"
- Check that address and amount match exactly
- Ensure proof is for the correct campaign
- Verify tree was generated with same parameters

### "Campaign not active"
- Check current time vs start/end time
- Campaign might be paused

### "Already claimed"
- Each user can claim only once per campaign

### "Insufficient balance"
- Distributor contract needs tokens
- Mint or transfer tokens before creating campaign

---

*Continue to [Tutorial 4: Building the Frontend →](./04-building-frontend.md)*
