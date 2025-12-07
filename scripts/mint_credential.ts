/**
 * @file mint_credential.ts
 * @description Script to mint credentials to users
 *
 * =============================================================================
 * LEARNING PATH - Credential Issuance Flow
 * =============================================================================
 *
 * This script demonstrates how to:
 * 1. Connect to deployed contracts
 * 2. Prepare credential metadata
 * 3. Upload metadata to IPFS (simulated)
 * 4. Mint a soulbound NFT credential
 *
 * USAGE:
 * npx hardhat run scripts/mint_credential.ts --network localhost
 *
 * =============================================================================
 */

import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

// =============================================================================
// TYPES
// =============================================================================

interface CredentialMetadata {
  name: string;
  description: string;
  image: string;
  attributes: Array<{
    trait_type: string;
    value: string | number;
  }>;
  credential: {
    type: string;
    issuer: string;
    issuedAt: string;
    evidence?: string[];
  };
}

interface MintRequest {
  recipient: string;
  credentialType: string;
  metadata: CredentialMetadata;
  expiresAt?: number; // Unix timestamp, 0 for never
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Load deployment addresses
 */
function loadDeployment(): { credential: string; accessControlManager: string } {
  const deploymentPath = path.join(__dirname, "..", "deployments", `${network.name}.json`);
  
  if (!fs.existsSync(deploymentPath)) {
    throw new Error(`No deployment found for network: ${network.name}. Run deploy.ts first.`);
  }
  
  return JSON.parse(fs.readFileSync(deploymentPath, "utf-8"));
}

/**
 * Simulate IPFS upload (in production, use actual IPFS service)
 * 
 * For production:
 * - Use Pinata: https://www.pinata.cloud/
 * - Use Infura IPFS: https://infura.io/product/ipfs
 * - Use nft.storage: https://nft.storage/
 */
function uploadToIPFS(metadata: CredentialMetadata): string {
  // In production, this would upload to IPFS and return the CID
  // For demo, we create a deterministic "hash" from the metadata
  const metadataString = JSON.stringify(metadata);
  const hash = ethers.keccak256(ethers.toUtf8Bytes(metadataString));
  
  // Save locally for testing
  const metadataDir = path.join(__dirname, "..", "metadata");
  if (!fs.existsSync(metadataDir)) {
    fs.mkdirSync(metadataDir, { recursive: true });
  }
  
  const filename = path.join(metadataDir, `${hash.slice(2, 14)}.json`);
  fs.writeFileSync(filename, JSON.stringify(metadata, null, 2));
  
  console.log(`   📄 Metadata saved to: ${filename}`);
  
  // Return a mock IPFS URI
  return `ipfs://Qm${hash.slice(2, 48)}`;
}

/**
 * Create credential data hash for on-chain integrity
 */
function createDataHash(metadata: CredentialMetadata): string {
  return ethers.keccak256(
    ethers.toUtf8Bytes(JSON.stringify(metadata))
  );
}

// =============================================================================
// MAIN FUNCTION
// =============================================================================

async function main(): Promise<void> {
  console.log("=".repeat(70));
  console.log("🎫 TRCS Credential Minting Script");
  console.log("=".repeat(70));
  
  // Load deployment
  const deployment = loadDeployment();
  console.log(`\n📋 Using deployment for network: ${network.name}`);
  console.log(`   Credential Contract: ${deployment.credential}`);
  
  // Get signer
  const [issuer] = await ethers.getSigners();
  console.log(`   Issuer Address: ${issuer.address}`);
  
  // Connect to contract
  const credential = await ethers.getContractAt("TRCSCredential", deployment.credential);
  
  // ==========================================================================
  // EXAMPLE: Single Credential Mint
  // ==========================================================================
  
  console.log("\n" + "-".repeat(70));
  console.log("📝 Minting Single Credential");
  console.log("-".repeat(70));
  
  // Prepare metadata
  const singleMetadata: CredentialMetadata = {
    name: "Blockchain Developer Certification",
    description: "Awarded for completing the Advanced Solidity Development course with distinction.",
    image: "ipfs://QmExampleImageHashHere",
    attributes: [
      { trait_type: "Course", value: "Advanced Solidity Development" },
      { trait_type: "Grade", value: "A+" },
      { trait_type: "Issued By", value: "TRCS Academy" },
      { trait_type: "Duration", value: "12 weeks" },
      { trait_type: "Completion Date", value: "2024-01-15" },
    ],
    credential: {
      type: "COURSE_COMPLETION",
      issuer: "TRCS Academy",
      issuedAt: new Date().toISOString(),
      evidence: ["ipfs://QmExamResultHash", "ipfs://QmProjectSubmissionHash"],
    },
  };
  
  console.log("\n   📄 Credential Details:");
  console.log(`      Name: ${singleMetadata.name}`);
  console.log(`      Type: ${singleMetadata.credential.type}`);
  
  // Upload to IPFS
  console.log("\n   ⬆️  Uploading metadata to IPFS...");
  const uri = uploadToIPFS(singleMetadata);
  console.log(`      URI: ${uri}`);
  
  // Calculate hashes
  const credentialTypeHash = ethers.keccak256(
    ethers.toUtf8Bytes(singleMetadata.credential.type)
  );
  const dataHash = createDataHash(singleMetadata);
  
  // Get a test recipient (in production, this would be the actual user)
  const signers = await ethers.getSigners();
  const recipient = signers.length > 1 ? signers[1].address : issuer.address;
  
  console.log(`\n   🎯 Minting to: ${recipient}`);
  
  // Mint the credential
  try {
    const tx = await credential.issueCredential(
      recipient,
      uri,
      credentialTypeHash,
      0, // Never expires
      dataHash
    );
    
    const receipt = await tx.wait();
    console.log(`   ✅ Transaction successful!`);
    console.log(`      TX Hash: ${receipt?.hash}`);
    
    // Get the token ID from events
    const event = receipt?.logs.find((log) => {
      try {
        const parsed = credential.interface.parseLog({
          topics: log.topics as string[],
          data: log.data,
        });
        return parsed?.name === "CredentialIssued";
      } catch {
        return false;
      }
    });
    
    if (event) {
      const parsed = credential.interface.parseLog({
        topics: event.topics as string[],
        data: event.data,
      });
      console.log(`      Token ID: ${parsed?.args.tokenId}`);
    }
  } catch (error) {
    console.error("   ❌ Minting failed:", error);
    throw error;
  }
  
  // ==========================================================================
  // EXAMPLE: Batch Credential Mint
  // ==========================================================================
  
  console.log("\n" + "-".repeat(70));
  console.log("📝 Minting Batch Credentials");
  console.log("-".repeat(70));
  
  // Prepare batch data
  const batchRecipients = signers.slice(0, 3).map((s) => s.address);
  const batchMetadata: CredentialMetadata[] = [
    {
      name: "Community Contributor Badge",
      description: "Awarded for active participation in the TRCS community.",
      image: "ipfs://QmContributorBadge",
      attributes: [
        { trait_type: "Level", value: "Gold" },
        { trait_type: "Contributions", value: 50 },
      ],
      credential: {
        type: "ACHIEVEMENT",
        issuer: "TRCS Community",
        issuedAt: new Date().toISOString(),
      },
    },
    {
      name: "Early Adopter Badge",
      description: "Awarded to early supporters of the TRCS platform.",
      image: "ipfs://QmEarlyAdopterBadge",
      attributes: [
        { trait_type: "Joined", value: "Genesis" },
      ],
      credential: {
        type: "MEMBERSHIP",
        issuer: "TRCS Platform",
        issuedAt: new Date().toISOString(),
      },
    },
    {
      name: "Security Researcher Certification",
      description: "Certified smart contract security researcher.",
      image: "ipfs://QmSecurityBadge",
      attributes: [
        { trait_type: "Specialization", value: "Smart Contract Auditing" },
        { trait_type: "Vulnerabilities Found", value: 10 },
      ],
      credential: {
        type: "SKILL_CERTIFICATION",
        issuer: "TRCS Security Lab",
        issuedAt: new Date().toISOString(),
      },
    },
  ];
  
  // Prepare arrays for batch mint
  const uris: string[] = [];
  const credentialTypes: string[] = [];
  const dataHashes: string[] = [];
  const expirations: number[] = [];
  
  for (let i = 0; i < batchMetadata.length; i++) {
    const metadata = batchMetadata[i];
    
    console.log(`\n   Processing credential ${i + 1}/${batchMetadata.length}:`);
    console.log(`      Name: ${metadata.name}`);
    console.log(`      Recipient: ${batchRecipients[i]}`);
    
    const metadataUri = uploadToIPFS(metadata);
    uris.push(metadataUri);
    
    credentialTypes.push(
      ethers.keccak256(ethers.toUtf8Bytes(metadata.credential.type))
    );
    
    dataHashes.push(createDataHash(metadata));
    expirations.push(0); // Never expire
  }
  
  console.log("\n   🎯 Executing batch mint...");
  
  try {
    const tx = await credential.issueBatchCredentials(
      batchRecipients,
      uris,
      credentialTypes,
      expirations,
      dataHashes
    );
    
    const receipt = await tx.wait();
    console.log(`   ✅ Batch mint successful!`);
    console.log(`      TX Hash: ${receipt?.hash}`);
    console.log(`      Gas Used: ${receipt?.gasUsed.toString()}`);
  } catch (error) {
    console.error("   ❌ Batch minting failed:", error);
  }
  
  // ==========================================================================
  // VERIFICATION
  // ==========================================================================
  
  console.log("\n" + "-".repeat(70));
  console.log("🔍 Verifying Credentials");
  console.log("-".repeat(70));
  
  const totalCredentials = await credential.totalCredentialsIssued();
  console.log(`\n   Total credentials issued: ${totalCredentials}`);
  
  // Check first credential
  if (totalCredentials > 0n) {
    const credData = await credential.getCredentialData(1);
    console.log(`\n   Credential #1:`);
    console.log(`      Holder: ${credData.holder}`);
    console.log(`      Issuer: ${credData.issuer}`);
    console.log(`      Valid: ${await credential.isCredentialValid(1)}`);
  }
  
  console.log("\n" + "=".repeat(70));
  console.log("🎉 Credential minting complete!");
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
