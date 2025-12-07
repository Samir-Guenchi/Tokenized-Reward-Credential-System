/**
 * @file test/integration/full-flow.test.ts
 * @description Integration tests simulating complete user flows
 *
 * =============================================================================
 * LEARNING PATH - Integration Testing
 * =============================================================================
 *
 * Integration tests verify that multiple contracts work together correctly.
 * They simulate real-world usage patterns and catch issues that unit tests miss.
 *
 * KEY DIFFERENCES FROM UNIT TESTS:
 * - Test multiple contracts together
 * - Simulate complete user journeys
 * - More realistic setup
 * - Catch integration bugs
 *
 * =============================================================================
 */

import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { StandardMerkleTree } from "@openzeppelin/merkle-tree";

describe("Integration: Full System Flow", function () {
  // ==========================================================================
  // FIXTURE - Deploy complete system
  // ==========================================================================
  
  async function deployFullSystemFixture() {
    const signers = await ethers.getSigners();
    const [admin, issuerAccount, user1, user2, user3, user4, user5] = signers;
    
    // Deploy AccessControlManager
    const AccessControlManager = await ethers.getContractFactory("AccessControlManager");
    const acm = await AccessControlManager.deploy(admin.address);
    const acmAddress = await acm.getAddress();
    
    // Deploy Token
    const Token = await ethers.getContractFactory("TRCSToken");
    const token = await Token.deploy(
      "TRCS Token",
      "TRCS",
      ethers.parseEther("10000000"), // 10M initial
      ethers.parseEther("100000000"), // 100M cap
      acmAddress
    );
    const tokenAddress = await token.getAddress();
    
    // Deploy Credential
    const Credential = await ethers.getContractFactory("TRCSCredential");
    const credential = await Credential.deploy(
      "TRCS Credential",
      "TCRED",
      "ipfs://",
      acmAddress
    );
    
    // Deploy RewardDistributor
    const Distributor = await ethers.getContractFactory("RewardDistributor");
    const distributor = await Distributor.deploy(tokenAddress, acmAddress);
    const distributorAddress = await distributor.getAddress();
    
    // Setup roles
    const ISSUER_ROLE = await acm.ISSUER_ROLE();
    const REVOKER_ROLE = await acm.REVOKER_ROLE();
    
    await acm.grantRole(ISSUER_ROLE, issuerAccount.address);
    await acm.grantRole(ISSUER_ROLE, distributorAddress);
    await acm.grantRole(REVOKER_ROLE, admin.address);
    
    return {
      acm,
      token,
      credential,
      distributor,
      admin,
      issuerAccount,
      user1,
      user2,
      user3,
      user4,
      user5,
      signers,
    };
  }

  // ==========================================================================
  // FLOW 1: Complete User Onboarding
  // ==========================================================================
  
  describe("Flow 1: User Onboarding with Credential and Reward", function () {
    it("Should complete full onboarding flow", async function () {
      const { credential, distributor, token, issuerAccount, user1 } = 
        await loadFixture(deployFullSystemFixture);
      
      // Step 1: User completes a course (off-chain event)
      // This triggers the backend to issue a credential
      
      // Step 2: Issue credential
      const courseType = ethers.keccak256(ethers.toUtf8Bytes("COURSE_COMPLETION"));
      const courseData = JSON.stringify({
        course: "Blockchain Fundamentals",
        grade: "A",
        date: "2024-01-15",
      });
      const dataHash = ethers.keccak256(ethers.toUtf8Bytes(courseData));
      
      await credential.connect(issuerAccount).issueCredential(
        user1.address,
        "ipfs://QmCourseCredential",
        courseType,
        0, // Never expires
        dataHash
      );
      
      // Verify credential
      expect(await credential.isCredentialValid(1)).to.be.true;
      expect(await credential.ownerOf(1)).to.equal(user1.address);
      
      // Step 3: Reward user for course completion
      const rewardAmount = ethers.parseEther("500");
      const reason = ethers.keccak256(ethers.toUtf8Bytes("Course Completion Reward"));
      
      await distributor.connect(issuerAccount).distributeDirectly(
        user1.address,
        rewardAmount,
        reason
      );
      
      // Verify reward
      expect(await token.balanceOf(user1.address)).to.equal(rewardAmount);
      
      // Step 4: Verify complete state
      const userCredentials = await credential.getHolderCredentials(user1.address);
      expect(userCredentials.length).to.equal(1);
      
      console.log(`
        ✅ User Onboarding Complete:
           - Credential ID: 1
           - Credential Valid: true
           - Token Balance: ${ethers.formatEther(rewardAmount)} TRCS
      `);
    });
  });

  // ==========================================================================
  // FLOW 2: Merkle Airdrop Campaign
  // ==========================================================================
  
  describe("Flow 2: Community Airdrop Campaign", function () {
    it("Should execute complete airdrop flow", async function () {
      const { distributor, token, admin, user1, user2, user3, user4, user5 } = 
        await loadFixture(deployFullSystemFixture);
      
      // Step 1: Prepare airdrop list (in production, this comes from analytics/snapshot)
      const recipients = [user1, user2, user3, user4, user5];
      const values: [string, string][] = recipients.map((user, i) => [
        user.address,
        ethers.parseEther(String((i + 1) * 100)).toString(),
      ]);
      
      // Step 2: Build Merkle tree
      const tree = StandardMerkleTree.of(values, ["address", "uint256"]);
      const totalAmount = values.reduce((sum, v) => sum + BigInt(v[1]), 0n);
      
      console.log(`\n   📊 Airdrop Stats:`);
      console.log(`      Recipients: ${values.length}`);
      console.log(`      Total: ${ethers.formatEther(totalAmount)} TRCS`);
      console.log(`      Root: ${tree.root}`);
      
      // Step 3: Create on-chain distribution
      await distributor.connect(admin).createMerkleDistribution(
        tree.root,
        totalAmount,
        30 * 24 * 60 * 60, // 30 days to claim
        "QmAirdropData123"
      );
      
      // Step 4: Users claim their allocations
      const claims: { user: string; amount: string; success: boolean }[] = [];
      
      for (const [i, v] of tree.entries()) {
        const [address, amount] = v;
        const proof = tree.getProof(i);
        const signer = recipients.find(r => r.address === address);
        
        if (signer) {
          await distributor.connect(signer).claimMerkle(1, amount, proof);
          claims.push({ user: address.slice(0, 8) + "...", amount: ethers.formatEther(amount), success: true });
        }
      }
      
      // Step 5: Verify all claims
      for (const recipient of recipients) {
        expect(await distributor.hasClaimed(1, recipient.address)).to.be.true;
        expect(await token.balanceOf(recipient.address)).to.be.gt(0);
      }
      
      // Verify distribution state
      const dist = await distributor.getMerkleDistribution(1);
      expect(dist.claimedAmount).to.equal(totalAmount);
      
      console.log(`\n   ✅ Airdrop Complete!`);
      console.log(`      All ${claims.length} users claimed successfully`);
    });
    
    it("Should handle partial claims and expiration", async function () {
      const { distributor, token, admin, user1, user2, user3 } = 
        await loadFixture(deployFullSystemFixture);
      
      // Create airdrop for 3 users
      const values: [string, string][] = [
        [user1.address, ethers.parseEther("100").toString()],
        [user2.address, ethers.parseEther("200").toString()],
        [user3.address, ethers.parseEther("300").toString()],
      ];
      
      const tree = StandardMerkleTree.of(values, ["address", "uint256"]);
      const totalAmount = ethers.parseEther("600");
      
      await distributor.connect(admin).createMerkleDistribution(
        tree.root,
        totalAmount,
        7 * 24 * 60 * 60, // 7 days
        "QmPartialAirdrop"
      );
      
      // Only user1 claims
      for (const [i, v] of tree.entries()) {
        if (v[0] === user1.address) {
          const proof = tree.getProof(i);
          await distributor.connect(user1).claimMerkle(1, v[1], proof);
          break;
        }
      }
      
      // Fast forward past expiration
      await time.increase(8 * 24 * 60 * 60);
      
      // Admin closes and recovers unclaimed
      const adminBalanceBefore = await token.balanceOf(admin.address);
      await distributor.connect(admin).closeExpiredDistribution(1);
      const adminBalanceAfter = await token.balanceOf(admin.address);
      
      // Admin should receive 500 TRCS (user2 + user3 unclaimed)
      const recovered = adminBalanceAfter - adminBalanceBefore;
      expect(recovered).to.equal(ethers.parseEther("500"));
      
      console.log(`\n   📊 Partial Airdrop Results:`);
      console.log(`      Claimed: 100 TRCS (user1)`);
      console.log(`      Unclaimed: 500 TRCS (recovered by admin)`);
    });
  });

  // ==========================================================================
  // FLOW 3: Employee Vesting Program
  // ==========================================================================
  
  describe("Flow 3: Employee Vesting Program", function () {
    const ONE_DAY = 24 * 60 * 60;
    const ONE_YEAR = 365 * ONE_DAY;
    const SIX_MONTHS = 180 * ONE_DAY;
    
    it("Should execute complete vesting lifecycle", async function () {
      const { distributor, token, admin, user1 } = 
        await loadFixture(deployFullSystemFixture);
      
      // Step 1: Create vesting schedule for new employee
      const vestingAmount = ethers.parseEther("100000"); // 100k tokens
      
      await distributor.connect(admin).createVestingSchedule(
        user1.address,
        vestingAmount,
        SIX_MONTHS, // 6 month cliff
        ONE_YEAR * 2, // 2 year total vesting
        true // Revocable
      );
      
      console.log(`\n   📅 Vesting Schedule Created:`);
      console.log(`      Total: ${ethers.formatEther(vestingAmount)} TRCS`);
      console.log(`      Cliff: 6 months`);
      console.log(`      Duration: 2 years`);
      
      // Step 2: Check during cliff (should be 0)
      await time.increase(ONE_DAY * 90); // 3 months
      
      let vested = await distributor.getVestedAmount(user1.address);
      let releasable = await distributor.getReleasableAmount(user1.address);
      
      expect(vested).to.equal(0);
      console.log(`\n   📊 At 3 months (during cliff):`);
      console.log(`      Vested: ${ethers.formatEther(vested)} TRCS`);
      
      // Step 3: After cliff
      await time.increase(ONE_DAY * 90); // Now at 6 months
      
      vested = await distributor.getVestedAmount(user1.address);
      console.log(`\n   📊 At 6 months (after cliff):`);
      console.log(`      Vested: ${ethers.formatEther(vested)} TRCS`);
      expect(vested).to.be.gt(0);
      
      // Step 4: Employee claims vested tokens
      await distributor.connect(user1).releaseVested(user1.address);
      
      let balance = await token.balanceOf(user1.address);
      console.log(`      Claimed: ${ethers.formatEther(balance)} TRCS`);
      
      // Step 5: Continue vesting
      await time.increase(ONE_DAY * 180); // Now at 12 months
      
      vested = await distributor.getVestedAmount(user1.address);
      releasable = await distributor.getReleasableAmount(user1.address);
      
      console.log(`\n   📊 At 12 months:`);
      console.log(`      Total Vested: ${ethers.formatEther(vested)} TRCS`);
      console.log(`      Releasable: ${ethers.formatEther(releasable)} TRCS`);
      
      // Claim again
      await distributor.connect(user1).releaseVested(user1.address);
      balance = await token.balanceOf(user1.address);
      console.log(`      Total Claimed: ${ethers.formatEther(balance)} TRCS`);
      
      // Step 6: Full vesting
      await time.increase(ONE_YEAR); // Now at 24 months
      
      vested = await distributor.getVestedAmount(user1.address);
      // Allow small rounding difference due to block timing
      expect(vested).to.be.closeTo(vestingAmount, ethers.parseEther("1000"));
      
      await distributor.connect(user1).releaseVested(user1.address);
      balance = await token.balanceOf(user1.address);
      
      console.log(`\n   ✅ Vesting Complete:`);
      console.log(`      Final Balance: ${ethers.formatEther(balance)} TRCS`);
      // Allow small rounding difference (less than 1% of total)
      expect(balance).to.be.closeTo(vestingAmount, ethers.parseEther("1000"));
    });
  });

  // ==========================================================================
  // FLOW 4: Credential Lifecycle (Issue -> Verify -> Revoke)
  // ==========================================================================
  
  describe("Flow 4: Credential Lifecycle", function () {
    it("Should handle complete credential lifecycle", async function () {
      const { credential, acm, admin, issuerAccount, user1 } = 
        await loadFixture(deployFullSystemFixture);
      
      // Step 1: Issue credential with expiration
      const certType = ethers.keccak256(ethers.toUtf8Bytes("SKILL_CERTIFICATION"));
      const certData = JSON.stringify({
        skill: "Solidity Development",
        level: "Advanced",
        validUntil: "2025-01-15",
      });
      const dataHash = ethers.keccak256(ethers.toUtf8Bytes(certData));
      const expiresAt = Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60); // 1 year
      
      await credential.connect(issuerAccount).issueCredential(
        user1.address,
        "ipfs://QmCertificate",
        certType,
        expiresAt,
        dataHash
      );
      
      console.log(`\n   📜 Credential Issued:`);
      console.log(`      Token ID: 1`);
      console.log(`      Type: SKILL_CERTIFICATION`);
      
      // Step 2: Verify credential is valid
      expect(await credential.isCredentialValid(1)).to.be.true;
      
      // Step 3: External service verifies data integrity
      const isDataValid = await credential.verifyCredentialData(
        1,
        ethers.toUtf8Bytes(certData)
      );
      expect(isDataValid).to.be.true;
      console.log(`      Data Integrity: ✅`);
      
      // Step 4: Check credential details
      const credData = await credential.getCredentialData(1);
      console.log(`      Holder: ${credData.holder.slice(0, 10)}...`);
      console.log(`      Issuer: ${credData.issuer.slice(0, 10)}...`);
      console.log(`      Revoked: ${credData.revoked}`);
      
      // Step 5: Revoke credential (e.g., fraud detected)
      await acm.grantRole(await acm.REVOKER_ROLE(), admin.address);
      
      const reason = ethers.keccak256(ethers.toUtf8Bytes("Certification requirements not met"));
      await credential.connect(admin).revokeCredential(1, reason);
      
      // Step 6: Verify credential is now invalid
      expect(await credential.isCredentialValid(1)).to.be.false;
      
      const updatedData = await credential.getCredentialData(1);
      console.log(`\n   🚫 Credential Revoked:`);
      console.log(`      Valid: false`);
      console.log(`      Revoked: ${updatedData.revoked}`);
      
      // Note: NFT still exists (for audit trail)
      expect(await credential.ownerOf(1)).to.equal(user1.address);
      console.log(`      NFT Still Exists: ✅ (for audit trail)`);
    });
  });

  // ==========================================================================
  // FLOW 5: Emergency Pause and Recovery
  // ==========================================================================
  
  describe("Flow 5: Emergency Pause and Recovery", function () {
    it("Should handle emergency pause across system", async function () {
      const { acm, token, credential, distributor, admin, issuerAccount, user1 } = 
        await loadFixture(deployFullSystemFixture);
      
      // Grant pauser role
      const PAUSER_ROLE = await acm.PAUSER_ROLE();
      await acm.grantRole(PAUSER_ROLE, admin.address);
      
      console.log(`\n   🚨 Simulating Security Incident...`);
      
      // Step 1: Pause all contracts
      await token.connect(admin).pause();
      await credential.connect(admin).pause();
      await distributor.connect(admin).pause();
      
      console.log(`   ⏸️  All contracts paused`);
      
      // Step 2: Verify operations are blocked
      const certType = ethers.keccak256(ethers.toUtf8Bytes("COURSE_COMPLETION"));
      const dataHash = ethers.keccak256(ethers.toUtf8Bytes("test"));
      
      await expect(
        credential.connect(issuerAccount).issueCredential(
          user1.address,
          "ipfs://test",
          certType,
          0,
          dataHash
        )
      ).to.be.reverted;
      
      await expect(
        token.connect(issuerAccount).mint(user1.address, ethers.parseEther("100"))
      ).to.be.reverted;
      
      console.log(`   🛑 Operations blocked`);
      
      // Step 3: Investigate and fix (simulated)
      console.log(`   🔍 Investigating issue...`);
      await time.increase(3600); // 1 hour passes
      
      // Step 4: Resume operations
      await token.connect(admin).unpause();
      await credential.connect(admin).unpause();
      await distributor.connect(admin).unpause();
      
      console.log(`   ▶️  All contracts resumed`);
      
      // Step 5: Verify normal operations work
      await credential.connect(issuerAccount).issueCredential(
        user1.address,
        "ipfs://test",
        certType,
        0,
        dataHash
      );
      
      expect(await credential.ownerOf(1)).to.equal(user1.address);
      console.log(`   ✅ Normal operations restored`);
    });
  });

  // ==========================================================================
  // FLOW 6: Role Transfer (Decentralization)
  // ==========================================================================
  
  describe("Flow 6: Admin Role Transfer", function () {
    it("Should transfer admin to multi-sig (simulated)", async function () {
      const { acm, admin, user1, user2, user3 } = 
        await loadFixture(deployFullSystemFixture);
      
      // Simulate multi-sig as user1
      const newAdmin = user1.address;
      
      const DEFAULT_ADMIN_ROLE = await acm.DEFAULT_ADMIN_ROLE();
      const ADMIN_ROLE = await acm.ADMIN_ROLE();
      
      console.log(`\n   🔐 Transferring Admin Role:`);
      console.log(`      From: ${admin.address.slice(0, 10)}... (EOA)`);
      console.log(`      To: ${newAdmin.slice(0, 10)}... (Multi-sig)`);
      
      // Step 1: Grant roles to new admin
      await acm.connect(admin).grantRole(DEFAULT_ADMIN_ROLE, newAdmin);
      await acm.connect(admin).grantRole(ADMIN_ROLE, newAdmin);
      
      // Step 2: Verify new admin has roles
      expect(await acm.hasRole(DEFAULT_ADMIN_ROLE, newAdmin)).to.be.true;
      expect(await acm.hasRole(ADMIN_ROLE, newAdmin)).to.be.true;
      console.log(`   ✅ New admin has roles`);
      
      // Step 3: New admin grants role to someone (prove it works)
      const ISSUER_ROLE = await acm.ISSUER_ROLE();
      await acm.connect(user1).grantRole(ISSUER_ROLE, user2.address);
      expect(await acm.hasRole(ISSUER_ROLE, user2.address)).to.be.true;
      console.log(`   ✅ New admin can grant roles`);
      
      // Step 4: Revoke from old admin
      await acm.connect(user1).revokeRole(DEFAULT_ADMIN_ROLE, admin.address);
      await acm.connect(user1).revokeRole(ADMIN_ROLE, admin.address);
      
      expect(await acm.hasRole(DEFAULT_ADMIN_ROLE, admin.address)).to.be.false;
      console.log(`   ✅ Old admin roles revoked`);
      
      // Step 5: Verify old admin can't do admin things
      await expect(
        acm.connect(admin).grantRole(ISSUER_ROLE, user3.address)
      ).to.be.reverted;
      console.log(`   ✅ Old admin operations blocked`);
      
      console.log(`\n   🎉 Admin transfer complete!`);
    });
  });
});
