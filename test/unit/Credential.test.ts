/**
 * @file test/unit/Credential.test.ts
 * @description Unit tests for the TRCSCredential contract
 */

import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { TRCSCredential, AccessControlManager } from "../../typechain-types";

describe("TRCSCredential", function () {
  // ==========================================================================
  // FIXTURE
  // ==========================================================================
  
  async function deployCredentialFixture() {
    const [admin, issuer, pauser, revoker, user1, user2, user3] = await ethers.getSigners();
    
    // Deploy AccessControlManager
    const AccessControlManager = await ethers.getContractFactory("AccessControlManager");
    const accessControlManager = await AccessControlManager.deploy(admin.address);
    const acmAddress = await accessControlManager.getAddress();
    
    // Deploy Credential
    const Credential = await ethers.getContractFactory("TRCSCredential");
    const credential = await Credential.deploy(
      "TRCS Credential",
      "TCRED",
      "ipfs://",
      acmAddress
    );
    
    // Grant roles
    const ISSUER_ROLE = await accessControlManager.ISSUER_ROLE();
    const PAUSER_ROLE = await accessControlManager.PAUSER_ROLE();
    const REVOKER_ROLE = await accessControlManager.REVOKER_ROLE();
    
    await accessControlManager.grantRole(ISSUER_ROLE, issuer.address);
    await accessControlManager.grantRole(PAUSER_ROLE, pauser.address);
    await accessControlManager.grantRole(REVOKER_ROLE, revoker.address);
    
    // Helper to create credential type hash
    const getTypeHash = (typeName: string) => ethers.keccak256(ethers.toUtf8Bytes(typeName));
    
    return {
      credential,
      accessControlManager,
      admin,
      issuer,
      pauser,
      revoker,
      user1,
      user2,
      user3,
      getTypeHash,
    };
  }

  // ==========================================================================
  // DEPLOYMENT TESTS
  // ==========================================================================
  
  describe("Deployment", function () {
    it("Should set correct name and symbol", async function () {
      const { credential } = await loadFixture(deployCredentialFixture);
      
      expect(await credential.name()).to.equal("TRCS Credential");
      expect(await credential.symbol()).to.equal("TCRED");
    });
    
    it("Should have zero credentials initially", async function () {
      const { credential } = await loadFixture(deployCredentialFixture);
      
      expect(await credential.totalCredentialsIssued()).to.equal(0);
    });
    
    it("Should register default credential types", async function () {
      const { credential, getTypeHash } = await loadFixture(deployCredentialFixture);
      
      const courseType = getTypeHash("COURSE_COMPLETION");
      const description = await credential.getCredentialTypeDescription(courseType);
      
      expect(description).to.equal("Completion of an educational course");
    });
  });

  // ==========================================================================
  // CREDENTIAL ISSUANCE TESTS
  // ==========================================================================
  
  describe("Credential Issuance", function () {
    it("Should allow issuer to issue credential", async function () {
      const { credential, issuer, user1, getTypeHash } = await loadFixture(
        deployCredentialFixture
      );
      
      const uri = "ipfs://QmTest123";
      const typeHash = getTypeHash("COURSE_COMPLETION");
      const dataHash = ethers.keccak256(ethers.toUtf8Bytes("test data"));
      
      await credential.connect(issuer).issueCredential(
        user1.address,
        uri,
        typeHash,
        0, // Never expires
        dataHash
      );
      
      expect(await credential.ownerOf(1)).to.equal(user1.address);
      expect(await credential.totalCredentialsIssued()).to.equal(1);
    });
    
    it("Should emit CredentialIssued event", async function () {
      const { credential, issuer, user1, getTypeHash } = await loadFixture(
        deployCredentialFixture
      );
      
      const uri = "ipfs://QmTest123";
      const typeHash = getTypeHash("COURSE_COMPLETION");
      const dataHash = ethers.keccak256(ethers.toUtf8Bytes("test data"));
      
      await expect(
        credential.connect(issuer).issueCredential(user1.address, uri, typeHash, 0, dataHash)
      )
        .to.emit(credential, "CredentialIssued")
        .withArgs(1, user1.address, issuer.address, typeHash, 0);
    });
    
    it("Should store credential data correctly", async function () {
      const { credential, issuer, user1, getTypeHash } = await loadFixture(
        deployCredentialFixture
      );
      
      const uri = "ipfs://QmTest123";
      const typeHash = getTypeHash("SKILL_CERTIFICATION");
      const dataHash = ethers.keccak256(ethers.toUtf8Bytes("test data"));
      const expiresAt = Math.floor(Date.now() / 1000) + 86400; // 1 day from now
      
      await credential.connect(issuer).issueCredential(
        user1.address,
        uri,
        typeHash,
        expiresAt,
        dataHash
      );
      
      const data = await credential.getCredentialData(1);
      
      expect(data.tokenId).to.equal(1);
      expect(data.holder).to.equal(user1.address);
      expect(data.issuer).to.equal(issuer.address);
      expect(data.credentialType).to.equal(typeHash);
      expect(data.expiresAt).to.equal(expiresAt);
      expect(data.revoked).to.be.false;
      expect(data.dataHash).to.equal(dataHash);
    });
    
    it("Should return correct token URI", async function () {
      const { credential, issuer, user1, getTypeHash } = await loadFixture(
        deployCredentialFixture
      );
      
      const uri = "ipfs://QmTest123";
      const typeHash = getTypeHash("COURSE_COMPLETION");
      const dataHash = ethers.keccak256(ethers.toUtf8Bytes("test data"));
      
      await credential.connect(issuer).issueCredential(
        user1.address,
        uri,
        typeHash,
        0,
        dataHash
      );
      
      expect(await credential.tokenURI(1)).to.equal("ipfs://ipfs://QmTest123");
    });
    
    it("Should reject issuance to zero address", async function () {
      const { credential, issuer, getTypeHash } = await loadFixture(deployCredentialFixture);
      
      const typeHash = getTypeHash("COURSE_COMPLETION");
      const dataHash = ethers.keccak256(ethers.toUtf8Bytes("test"));
      
      await expect(
        credential.connect(issuer).issueCredential(
          ethers.ZeroAddress,
          "ipfs://test",
          typeHash,
          0,
          dataHash
        )
      ).to.be.revertedWithCustomError(credential, "InvalidRecipient");
    });
    
    it("Should reject issuance by non-issuer", async function () {
      const { credential, user1, user2, getTypeHash } = await loadFixture(
        deployCredentialFixture
      );
      
      const typeHash = getTypeHash("COURSE_COMPLETION");
      const dataHash = ethers.keccak256(ethers.toUtf8Bytes("test"));
      
      await expect(
        credential.connect(user1).issueCredential(
          user2.address,
          "ipfs://test",
          typeHash,
          0,
          dataHash
        )
      ).to.be.revertedWithCustomError(credential, "UnauthorizedAccess");
    });
    
    it("Should reject past expiration date", async function () {
      const { credential, issuer, user1, getTypeHash } = await loadFixture(
        deployCredentialFixture
      );
      
      const typeHash = getTypeHash("COURSE_COMPLETION");
      const dataHash = ethers.keccak256(ethers.toUtf8Bytes("test"));
      const pastDate = Math.floor(Date.now() / 1000) - 86400; // Yesterday
      
      await expect(
        credential.connect(issuer).issueCredential(
          user1.address,
          "ipfs://test",
          typeHash,
          pastDate,
          dataHash
        )
      ).to.be.revertedWithCustomError(credential, "InvalidExpiration");
    });
    
    it("Should support batch issuance", async function () {
      const { credential, issuer, user1, user2, user3, getTypeHash } = await loadFixture(
        deployCredentialFixture
      );
      
      const recipients = [user1.address, user2.address, user3.address];
      const uris = ["ipfs://1", "ipfs://2", "ipfs://3"];
      const typeHash = getTypeHash("MEMBERSHIP");
      const types = [typeHash, typeHash, typeHash];
      const expirations = [0, 0, 0];
      const dataHash = ethers.keccak256(ethers.toUtf8Bytes("batch"));
      const hashes = [dataHash, dataHash, dataHash];
      
      const tx = await credential.connect(issuer).issueBatchCredentials(
        recipients,
        uris,
        types,
        expirations,
        hashes
      );
      
      const receipt = await tx.wait();
      
      expect(await credential.totalCredentialsIssued()).to.equal(3);
      expect(await credential.ownerOf(1)).to.equal(user1.address);
      expect(await credential.ownerOf(2)).to.equal(user2.address);
      expect(await credential.ownerOf(3)).to.equal(user3.address);
    });
  });

  // ==========================================================================
  // SOULBOUND (NON-TRANSFERABLE) TESTS
  // ==========================================================================
  
  describe("Soulbound Enforcement", function () {
    it("Should prevent credential transfer", async function () {
      const { credential, issuer, user1, user2, getTypeHash } = await loadFixture(
        deployCredentialFixture
      );
      
      // Issue credential
      const typeHash = getTypeHash("COURSE_COMPLETION");
      const dataHash = ethers.keccak256(ethers.toUtf8Bytes("test"));
      
      await credential.connect(issuer).issueCredential(
        user1.address,
        "ipfs://test",
        typeHash,
        0,
        dataHash
      );
      
      // Try to transfer
      await expect(
        credential.connect(user1).transferFrom(user1.address, user2.address, 1)
      ).to.be.revertedWithCustomError(credential, "SoulboundTokenCannotBeTransferred");
    });
    
    it("Should prevent safeTransferFrom", async function () {
      const { credential, issuer, user1, user2, getTypeHash } = await loadFixture(
        deployCredentialFixture
      );
      
      const typeHash = getTypeHash("COURSE_COMPLETION");
      const dataHash = ethers.keccak256(ethers.toUtf8Bytes("test"));
      
      await credential.connect(issuer).issueCredential(
        user1.address,
        "ipfs://test",
        typeHash,
        0,
        dataHash
      );
      
      await expect(
        credential.connect(user1)["safeTransferFrom(address,address,uint256)"](
          user1.address,
          user2.address,
          1
        )
      ).to.be.revertedWithCustomError(credential, "SoulboundTokenCannotBeTransferred");
    });
  });

  // ==========================================================================
  // CREDENTIAL REVOCATION TESTS
  // ==========================================================================
  
  describe("Credential Revocation", function () {
    it("Should allow revoker to revoke credential", async function () {
      const { credential, issuer, revoker, user1, getTypeHash } = await loadFixture(
        deployCredentialFixture
      );
      
      // Issue credential
      const typeHash = getTypeHash("COURSE_COMPLETION");
      const dataHash = ethers.keccak256(ethers.toUtf8Bytes("test"));
      
      await credential.connect(issuer).issueCredential(
        user1.address,
        "ipfs://test",
        typeHash,
        0,
        dataHash
      );
      
      // Revoke
      const reason = ethers.keccak256(ethers.toUtf8Bytes("Fraud detected"));
      await credential.connect(revoker).revokeCredential(1, reason);
      
      const data = await credential.getCredentialData(1);
      expect(data.revoked).to.be.true;
    });
    
    it("Should emit CredentialRevoked event", async function () {
      const { credential, issuer, revoker, user1, getTypeHash } = await loadFixture(
        deployCredentialFixture
      );
      
      const typeHash = getTypeHash("COURSE_COMPLETION");
      const dataHash = ethers.keccak256(ethers.toUtf8Bytes("test"));
      
      await credential.connect(issuer).issueCredential(
        user1.address,
        "ipfs://test",
        typeHash,
        0,
        dataHash
      );
      
      const reason = ethers.keccak256(ethers.toUtf8Bytes("Fraud detected"));
      
      await expect(credential.connect(revoker).revokeCredential(1, reason))
        .to.emit(credential, "CredentialRevoked")
        .withArgs(1, revoker.address, reason);
    });
    
    it("Should mark credential as invalid after revocation", async function () {
      const { credential, issuer, revoker, user1, getTypeHash } = await loadFixture(
        deployCredentialFixture
      );
      
      const typeHash = getTypeHash("COURSE_COMPLETION");
      const dataHash = ethers.keccak256(ethers.toUtf8Bytes("test"));
      
      await credential.connect(issuer).issueCredential(
        user1.address,
        "ipfs://test",
        typeHash,
        0,
        dataHash
      );
      
      expect(await credential.isCredentialValid(1)).to.be.true;
      
      const reason = ethers.keccak256(ethers.toUtf8Bytes("Revoked"));
      await credential.connect(revoker).revokeCredential(1, reason);
      
      expect(await credential.isCredentialValid(1)).to.be.false;
    });
    
    it("Should reject revoking already revoked credential", async function () {
      const { credential, issuer, revoker, user1, getTypeHash } = await loadFixture(
        deployCredentialFixture
      );
      
      const typeHash = getTypeHash("COURSE_COMPLETION");
      const dataHash = ethers.keccak256(ethers.toUtf8Bytes("test"));
      
      await credential.connect(issuer).issueCredential(
        user1.address,
        "ipfs://test",
        typeHash,
        0,
        dataHash
      );
      
      const reason = ethers.keccak256(ethers.toUtf8Bytes("Revoked"));
      await credential.connect(revoker).revokeCredential(1, reason);
      
      await expect(
        credential.connect(revoker).revokeCredential(1, reason)
      ).to.be.revertedWithCustomError(credential, "CredentialAlreadyRevoked");
    });
    
    it("Should support batch revocation", async function () {
      const { credential, issuer, revoker, user1, user2, getTypeHash } = await loadFixture(
        deployCredentialFixture
      );
      
      const typeHash = getTypeHash("COURSE_COMPLETION");
      const dataHash = ethers.keccak256(ethers.toUtf8Bytes("test"));
      
      await credential.connect(issuer).issueCredential(user1.address, "ipfs://1", typeHash, 0, dataHash);
      await credential.connect(issuer).issueCredential(user2.address, "ipfs://2", typeHash, 0, dataHash);
      
      const reason = ethers.keccak256(ethers.toUtf8Bytes("Batch revoke"));
      await credential.connect(revoker).revokeBatchCredentials([1, 2], [reason, reason]);
      
      expect(await credential.isCredentialValid(1)).to.be.false;
      expect(await credential.isCredentialValid(2)).to.be.false;
    });
  });

  // ==========================================================================
  // CREDENTIAL VALIDATION TESTS
  // ==========================================================================
  
  describe("Credential Validation", function () {
    it("Should return false for non-existent credential", async function () {
      const { credential } = await loadFixture(deployCredentialFixture);
      
      expect(await credential.isCredentialValid(999)).to.be.false;
    });
    
    it("Should return true for valid credential", async function () {
      const { credential, issuer, user1, getTypeHash } = await loadFixture(
        deployCredentialFixture
      );
      
      const typeHash = getTypeHash("COURSE_COMPLETION");
      const dataHash = ethers.keccak256(ethers.toUtf8Bytes("test"));
      
      await credential.connect(issuer).issueCredential(
        user1.address,
        "ipfs://test",
        typeHash,
        0,
        dataHash
      );
      
      expect(await credential.isCredentialValid(1)).to.be.true;
    });
    
    it("Should return false for expired credential", async function () {
      const { credential, issuer, user1, getTypeHash } = await loadFixture(
        deployCredentialFixture
      );
      
      const typeHash = getTypeHash("COURSE_COMPLETION");
      const dataHash = ethers.keccak256(ethers.toUtf8Bytes("test"));
      const expiresAt = Math.floor(Date.now() / 1000) + 100; // Expires in 100 seconds
      
      await credential.connect(issuer).issueCredential(
        user1.address,
        "ipfs://test",
        typeHash,
        expiresAt,
        dataHash
      );
      
      expect(await credential.isCredentialValid(1)).to.be.true;
      
      // Fast forward time
      await time.increase(200);
      
      expect(await credential.isCredentialValid(1)).to.be.false;
    });
    
    it("Should verify credential data integrity", async function () {
      const { credential, issuer, user1, getTypeHash } = await loadFixture(
        deployCredentialFixture
      );
      
      const typeHash = getTypeHash("COURSE_COMPLETION");
      const originalData = "test data for verification";
      const dataHash = ethers.keccak256(ethers.toUtf8Bytes(originalData));
      
      await credential.connect(issuer).issueCredential(
        user1.address,
        "ipfs://test",
        typeHash,
        0,
        dataHash
      );
      
      // Verify with correct data
      const correctData = ethers.toUtf8Bytes(originalData);
      expect(await credential.verifyCredentialData(1, correctData)).to.be.true;
      
      // Verify with incorrect data
      const incorrectData = ethers.toUtf8Bytes("wrong data");
      expect(await credential.verifyCredentialData(1, incorrectData)).to.be.false;
    });
  });

  // ==========================================================================
  // HOLDER QUERIES TESTS
  // ==========================================================================
  
  describe("Holder Queries", function () {
    it("Should return all credentials for a holder", async function () {
      const { credential, issuer, user1, getTypeHash } = await loadFixture(
        deployCredentialFixture
      );
      
      const typeHash = getTypeHash("COURSE_COMPLETION");
      const dataHash = ethers.keccak256(ethers.toUtf8Bytes("test"));
      
      // Issue 3 credentials to user1
      await credential.connect(issuer).issueCredential(user1.address, "ipfs://1", typeHash, 0, dataHash);
      await credential.connect(issuer).issueCredential(user1.address, "ipfs://2", typeHash, 0, dataHash);
      await credential.connect(issuer).issueCredential(user1.address, "ipfs://3", typeHash, 0, dataHash);
      
      const credentials = await credential.getHolderCredentials(user1.address);
      
      expect(credentials.length).to.equal(3);
      expect(credentials[0]).to.equal(1);
      expect(credentials[1]).to.equal(2);
      expect(credentials[2]).to.equal(3);
    });
    
    it("Should return only valid credentials", async function () {
      const { credential, issuer, revoker, user1, getTypeHash } = await loadFixture(
        deployCredentialFixture
      );
      
      const typeHash = getTypeHash("COURSE_COMPLETION");
      const dataHash = ethers.keccak256(ethers.toUtf8Bytes("test"));
      
      // Issue 3 credentials
      await credential.connect(issuer).issueCredential(user1.address, "ipfs://1", typeHash, 0, dataHash);
      await credential.connect(issuer).issueCredential(user1.address, "ipfs://2", typeHash, 0, dataHash);
      await credential.connect(issuer).issueCredential(user1.address, "ipfs://3", typeHash, 0, dataHash);
      
      // Revoke one
      const reason = ethers.keccak256(ethers.toUtf8Bytes("Revoked"));
      await credential.connect(revoker).revokeCredential(2, reason);
      
      const validCredentials = await credential.getValidHolderCredentials(user1.address);
      
      expect(validCredentials.length).to.equal(2);
      expect(validCredentials).to.not.include(2n);
    });
  });

  // ==========================================================================
  // CREDENTIAL TYPE TESTS
  // ==========================================================================
  
  describe("Credential Types", function () {
    it("Should allow admin to register new credential type", async function () {
      const { credential, admin, getTypeHash } = await loadFixture(deployCredentialFixture);
      
      const typeHash = await credential.connect(admin).registerCredentialType.staticCall(
        "NEW_TYPE",
        "A new credential type"
      );
      
      await credential.connect(admin).registerCredentialType("NEW_TYPE", "A new credential type");
      
      const description = await credential.getCredentialTypeDescription(typeHash);
      expect(description).to.equal("A new credential type");
    });
    
    it("Should return correct type hash", async function () {
      const { credential, getTypeHash } = await loadFixture(deployCredentialFixture);
      
      const expected = getTypeHash("COURSE_COMPLETION");
      const actual = await credential.getCredentialTypeHash("COURSE_COMPLETION");
      
      expect(actual).to.equal(expected);
    });
  });

  // ==========================================================================
  // URI MANAGEMENT TESTS
  // ==========================================================================
  
  describe("URI Management", function () {
    it("Should allow admin to update token URI", async function () {
      const { credential, admin, issuer, user1, getTypeHash } = await loadFixture(
        deployCredentialFixture
      );
      
      const typeHash = getTypeHash("COURSE_COMPLETION");
      const dataHash = ethers.keccak256(ethers.toUtf8Bytes("test"));
      
      await credential.connect(issuer).issueCredential(
        user1.address,
        "ipfs://original",
        typeHash,
        0,
        dataHash
      );
      
      await credential.connect(admin).updateTokenURI(1, "ipfs://updated");
      
      const uri = await credential.tokenURI(1);
      expect(uri).to.contain("updated");
    });
    
    it("Should emit CredentialURIUpdated event", async function () {
      const { credential, admin, issuer, user1, getTypeHash } = await loadFixture(
        deployCredentialFixture
      );
      
      const typeHash = getTypeHash("COURSE_COMPLETION");
      const dataHash = ethers.keccak256(ethers.toUtf8Bytes("test"));
      
      await credential.connect(issuer).issueCredential(
        user1.address,
        "ipfs://original",
        typeHash,
        0,
        dataHash
      );
      
      await expect(credential.connect(admin).updateTokenURI(1, "ipfs://updated"))
        .to.emit(credential, "CredentialURIUpdated");
    });
  });

  // ==========================================================================
  // PAUSE TESTS
  // ==========================================================================
  
  describe("Pausing", function () {
    it("Should prevent issuance when paused", async function () {
      const { credential, pauser, issuer, user1, getTypeHash } = await loadFixture(
        deployCredentialFixture
      );
      
      await credential.connect(pauser).pause();
      
      const typeHash = getTypeHash("COURSE_COMPLETION");
      const dataHash = ethers.keccak256(ethers.toUtf8Bytes("test"));
      
      await expect(
        credential.connect(issuer).issueCredential(
          user1.address,
          "ipfs://test",
          typeHash,
          0,
          dataHash
        )
      ).to.be.reverted;
    });
    
    it("Should allow issuance after unpause", async function () {
      const { credential, pauser, issuer, user1, getTypeHash } = await loadFixture(
        deployCredentialFixture
      );
      
      await credential.connect(pauser).pause();
      await credential.connect(pauser).unpause();
      
      const typeHash = getTypeHash("COURSE_COMPLETION");
      const dataHash = ethers.keccak256(ethers.toUtf8Bytes("test"));
      
      await expect(
        credential.connect(issuer).issueCredential(
          user1.address,
          "ipfs://test",
          typeHash,
          0,
          dataHash
        )
      ).to.not.be.reverted;
    });
  });

  // ==========================================================================
  // INTERFACE TESTS
  // ==========================================================================
  
  describe("ERC721 Interface", function () {
    it("Should support ERC721 interface", async function () {
      const { credential } = await loadFixture(deployCredentialFixture);
      
      // ERC721 interface ID
      expect(await credential.supportsInterface("0x80ac58cd")).to.be.true;
    });
    
    it("Should support ERC721Metadata interface", async function () {
      const { credential } = await loadFixture(deployCredentialFixture);
      
      // ERC721Metadata interface ID
      expect(await credential.supportsInterface("0x5b5e139f")).to.be.true;
    });
    
    it("Should support ERC721Enumerable interface", async function () {
      const { credential } = await loadFixture(deployCredentialFixture);
      
      // ERC721Enumerable interface ID
      expect(await credential.supportsInterface("0x780e9d63")).to.be.true;
    });
  });
});
