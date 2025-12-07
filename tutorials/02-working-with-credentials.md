# Tutorial 2: Working with Credentials (NFTs)

> **Learn to mint, manage, and verify credential NFTs**

## Overview

In this tutorial, you'll learn how to:
- Mint credential NFTs
- Store metadata on IPFS
- Verify credential authenticity
- Revoke credentials when needed

## Prerequisites

- Completed [Tutorial 1](./01-first-deployment.md)
- Contracts deployed locally
- Hardhat node running

## Understanding Credentials

TRCS credentials are ERC-721 NFTs that represent:
- Certificates
- Achievements
- Qualifications
- Memberships

Each credential has:
- **Token ID**: Unique identifier
- **Owner**: Current holder's address
- **Metadata URI**: Link to JSON metadata
- **Issuer**: Address that minted it
- **Revocation Status**: Whether it's been revoked

## Step 1: Connect to Credential Contract

```bash
npx hardhat console --network localhost
```

```javascript
// Attach to deployed credential contract
const Credential = await ethers.getContractFactory("Credential");
const credential = Credential.attach("0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0");

// Get signers
const [admin, issuer, holder] = await ethers.getSigners();
```

## Step 2: Prepare Metadata

### Metadata JSON Structure

```json
{
  "name": "Blockchain Developer Certificate",
  "description": "Certified completion of blockchain development course",
  "image": "ipfs://QmXxx.../certificate.png",
  "issuer": "TRCS Academy",
  "issuedAt": 1699900000,
  "attributes": [
    {
      "trait_type": "Course",
      "value": "Solidity Fundamentals"
    },
    {
      "trait_type": "Level",
      "value": "Advanced"
    },
    {
      "trait_type": "Score",
      "value": 95
    }
  ]
}
```

### Store on IPFS (Simulated)

For local development, we'll use a mock URI:

```javascript
// In production, upload to IPFS and get the CID
const metadataURI = "ipfs://QmExample123456789/metadata.json";
```

### Using Pinata (Production)

```javascript
// Example using Pinata SDK
const pinataSDK = require('@pinata/sdk');
const pinata = new pinataSDK('apiKey', 'secretKey');

const metadata = {
  name: "Blockchain Developer Certificate",
  description: "Certified completion of blockchain development course",
  image: "ipfs://QmImageCID/certificate.png",
  issuer: "TRCS Academy",
  issuedAt: Math.floor(Date.now() / 1000),
  attributes: [
    { trait_type: "Course", value: "Solidity Fundamentals" },
    { trait_type: "Level", value: "Advanced" }
  ]
};

const result = await pinata.pinJSONToIPFS(metadata);
const metadataURI = `ipfs://${result.IpfsHash}`;
```

## Step 3: Mint a Credential

```javascript
// Grant MINTER_ROLE to issuer (if not already)
const MINTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MINTER_ROLE"));
const AccessControl = await ethers.getContractFactory("AccessControlManager");
const accessControl = AccessControl.attach("0x5FbDB2315678afecb367f032d93F642f64180aa3");

await accessControl.grantRole(MINTER_ROLE, issuer.address);

// Mint credential
const tx = await credential.connect(issuer).mintCredential(
  holder.address,
  "ipfs://QmExample123456789/metadata.json"
);

const receipt = await tx.wait();
console.log("Transaction hash:", receipt.hash);

// Get the token ID from the event
const event = receipt.logs.find(
  log => log.fragment?.name === 'CredentialMinted'
);
const tokenId = event.args.tokenId;
console.log("Minted Token ID:", tokenId.toString());
```

## Step 4: View Credential Details

```javascript
// Get owner of the credential
const owner = await credential.ownerOf(tokenId);
console.log("Owner:", owner);

// Get metadata URI
const uri = await credential.tokenURI(tokenId);
console.log("Metadata URI:", uri);

// Get issuer
const credentialIssuer = await credential.getCredentialIssuer(tokenId);
console.log("Issuer:", credentialIssuer);

// Check if revoked
const isRevoked = await credential.isRevoked(tokenId);
console.log("Is Revoked:", isRevoked);
```

## Step 5: Batch Minting

For efficiency, mint multiple credentials at once:

```javascript
const recipients = [
  "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
  "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
  "0x90F79bf6EB2c4f870365E785982E1f101E93b906"
];

const metadataURIs = [
  "ipfs://QmCert1/metadata.json",
  "ipfs://QmCert2/metadata.json",
  "ipfs://QmCert3/metadata.json"
];

const tx = await credential.connect(issuer).batchMintCredentials(
  recipients,
  metadataURIs
);

const receipt = await tx.wait();
console.log("Batch minted", recipients.length, "credentials");
```

## Step 6: Verify Credential Authenticity

Create a verification function:

```javascript
async function verifyCredential(credential, tokenId) {
  const verification = {
    valid: true,
    errors: []
  };
  
  try {
    // Check if token exists
    const owner = await credential.ownerOf(tokenId);
    verification.owner = owner;
    
    // Check if revoked
    const isRevoked = await credential.isRevoked(tokenId);
    if (isRevoked) {
      verification.valid = false;
      verification.errors.push("Credential has been revoked");
    }
    
    // Get issuer
    verification.issuer = await credential.getCredentialIssuer(tokenId);
    
    // Get metadata
    verification.metadataURI = await credential.tokenURI(tokenId);
    
  } catch (error) {
    verification.valid = false;
    verification.errors.push("Credential does not exist");
  }
  
  return verification;
}

// Use it
const result = await verifyCredential(credential, 1);
console.log(result);
```

## Step 7: Revoke a Credential

Sometimes credentials need to be revoked:

```javascript
// Only the issuer or admin can revoke
await credential.connect(issuer).revokeCredential(tokenId);

// Verify revocation
const isRevoked = await credential.isRevoked(tokenId);
console.log("Is Revoked:", isRevoked); // true

// Note: The token still exists, but is marked as revoked
const owner = await credential.ownerOf(tokenId);
console.log("Still owned by:", owner);
```

## Step 8: Query Holder's Credentials

```javascript
// Get all credentials for a holder
const holderCredentials = await credential.getCredentialsByHolder(holder.address);
console.log("Holder has", holderCredentials.length, "credentials");

// List all with details
for (const tokenId of holderCredentials) {
  const uri = await credential.tokenURI(tokenId);
  const isRevoked = await credential.isRevoked(tokenId);
  console.log(`Token ${tokenId}: ${uri} (Revoked: ${isRevoked})`);
}
```

## Exercise: Build a Credential Viewer

Create a script that displays credential information nicely:

```javascript
// scripts/view_credential.ts
import { ethers } from "hardhat";

async function main() {
  const tokenId = process.env.TOKEN_ID || "1";
  const credentialAddress = process.env.CREDENTIAL_ADDRESS;
  
  const credential = await ethers.getContractAt("Credential", credentialAddress);
  
  console.log("\n═══════════════════════════════════════");
  console.log("         CREDENTIAL VIEWER             ");
  console.log("═══════════════════════════════════════\n");
  
  try {
    const owner = await credential.ownerOf(tokenId);
    const issuer = await credential.getCredentialIssuer(tokenId);
    const uri = await credential.tokenURI(tokenId);
    const isRevoked = await credential.isRevoked(tokenId);
    
    console.log(`Token ID:    ${tokenId}`);
    console.log(`Owner:       ${owner}`);
    console.log(`Issuer:      ${issuer}`);
    console.log(`Metadata:    ${uri}`);
    console.log(`Status:      ${isRevoked ? '❌ REVOKED' : '✅ VALID'}`);
    
  } catch (error) {
    console.log("❌ Credential not found");
  }
  
  console.log("\n═══════════════════════════════════════\n");
}

main().catch(console.error);
```

Run with:
```bash
TOKEN_ID=1 CREDENTIAL_ADDRESS=0x... npx hardhat run scripts/view_credential.ts --network localhost
```

## Best Practices

### 1. Metadata Immutability
- Once minted, metadata URI shouldn't change
- Use IPFS for permanent storage

### 2. Issuer Verification
- Verify issuer address on-chain
- Publish list of authorized issuers

### 3. Expiration Handling
- Include `expiresAt` in metadata
- Check expiration off-chain

### 4. Revocation Reasons
- Emit events with reason codes
- Maintain revocation registry

## Common Issues

### "ERC721: invalid token ID"
The token doesn't exist. Check the token ID.

### "AccessControl: account is missing role"
The caller doesn't have MINTER_ROLE. Grant it first.

### "Credential already revoked"
Can't revoke twice. Check status before revoking.

---

*Continue to [Tutorial 3: Distributing Rewards →](./03-distributing-rewards.md)*
