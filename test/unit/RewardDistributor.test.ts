/**
 * @file test/unit/RewardDistributor.test.ts
 * @description Unit tests for the RewardDistributor contract
 */

import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { StandardMerkleTree } from "@openzeppelin/merkle-tree";
import { RewardDistributor, TRCSToken, AccessControlManager } from "../../typechain-types";

describe("RewardDistributor", function () {
  // ==========================================================================
  // FIXTURE
  // ==========================================================================
  
  async function deployDistributorFixture() {
    const [admin, issuer, pauser, revoker, user1, user2, user3, user4, user5] = 
      await ethers.getSigners();
    
    // Deploy AccessControlManager
    const AccessControlManager = await ethers.getContractFactory("AccessControlManager");
    const accessControlManager = await AccessControlManager.deploy(admin.address);
    const acmAddress = await accessControlManager.getAddress();
    
    // Deploy Token
    const Token = await ethers.getContractFactory("TRCSToken");
    const token = await Token.deploy(
      "TRCS Token",
      "TRCS",
      ethers.parseEther("1000000"),
      ethers.parseEther("100000000"),
      acmAddress
    );
    const tokenAddress = await token.getAddress();
    
    // Deploy RewardDistributor
    const RewardDistributor = await ethers.getContractFactory("RewardDistributor");
    const distributor = await RewardDistributor.deploy(tokenAddress, acmAddress);
    const distributorAddress = await distributor.getAddress();
    
    // Grant roles
    const ISSUER_ROLE = await accessControlManager.ISSUER_ROLE();
    const PAUSER_ROLE = await accessControlManager.PAUSER_ROLE();
    const REVOKER_ROLE = await accessControlManager.REVOKER_ROLE();
    const ADMIN_ROLE = await accessControlManager.ADMIN_ROLE();
    
    await accessControlManager.grantRole(ISSUER_ROLE, issuer.address);
    await accessControlManager.grantRole(ISSUER_ROLE, distributorAddress);
    await accessControlManager.grantRole(PAUSER_ROLE, pauser.address);
    await accessControlManager.grantRole(REVOKER_ROLE, revoker.address);
    await accessControlManager.grantRole(ADMIN_ROLE, admin.address);
    
    return {
      distributor,
      token,
      accessControlManager,
      admin,
      issuer,
      pauser,
      revoker,
      user1,
      user2,
      user3,
      user4,
      user5,
    };
  }

  // ==========================================================================
  // DEPLOYMENT TESTS
  // ==========================================================================
  
  describe("Deployment", function () {
    it("Should set correct token address", async function () {
      const { distributor, token } = await loadFixture(deployDistributorFixture);
      
      expect(await distributor.rewardToken()).to.equal(await token.getAddress());
    });
    
    it("Should have zero locked tokens initially", async function () {
      const { distributor } = await loadFixture(deployDistributorFixture);
      
      expect(await distributor.totalVestingLocked()).to.equal(0);
      expect(await distributor.totalDistributionReserved()).to.equal(0);
    });
  });

  // ==========================================================================
  // DIRECT DISTRIBUTION TESTS
  // ==========================================================================
  
  describe("Direct Distribution", function () {
    it("Should allow issuer to distribute directly", async function () {
      const { distributor, token, issuer, user1 } = await loadFixture(
        deployDistributorFixture
      );
      
      const amount = ethers.parseEther("1000");
      const reason = ethers.keccak256(ethers.toUtf8Bytes("Reward"));
      
      await distributor.connect(issuer).distributeDirectly(user1.address, amount, reason);
      
      expect(await token.balanceOf(user1.address)).to.equal(amount);
    });
    
    it("Should emit DirectDistribution event", async function () {
      const { distributor, issuer, user1 } = await loadFixture(deployDistributorFixture);
      
      const amount = ethers.parseEther("1000");
      const reason = ethers.keccak256(ethers.toUtf8Bytes("Reward"));
      
      await expect(distributor.connect(issuer).distributeDirectly(user1.address, amount, reason))
        .to.emit(distributor, "DirectDistribution")
        .withArgs(user1.address, amount, issuer.address, reason);
    });
    
    it("Should reject distribution to zero address", async function () {
      const { distributor, issuer } = await loadFixture(deployDistributorFixture);
      
      const reason = ethers.keccak256(ethers.toUtf8Bytes("Reward"));
      
      await expect(
        distributor.connect(issuer).distributeDirectly(
          ethers.ZeroAddress,
          ethers.parseEther("100"),
          reason
        )
      ).to.be.revertedWithCustomError(distributor, "ZeroAddress");
    });
    
    it("Should reject zero amount distribution", async function () {
      const { distributor, issuer, user1 } = await loadFixture(deployDistributorFixture);
      
      const reason = ethers.keccak256(ethers.toUtf8Bytes("Reward"));
      
      await expect(
        distributor.connect(issuer).distributeDirectly(user1.address, 0, reason)
      ).to.be.revertedWithCustomError(distributor, "ZeroAmount");
    });
    
    it("Should reject distribution by non-issuer", async function () {
      const { distributor, user1, user2 } = await loadFixture(deployDistributorFixture);
      
      const reason = ethers.keccak256(ethers.toUtf8Bytes("Reward"));
      
      await expect(
        distributor.connect(user1).distributeDirectly(
          user2.address,
          ethers.parseEther("100"),
          reason
        )
      ).to.be.revertedWithCustomError(distributor, "UnauthorizedAccess");
    });
    
    it("Should support batch distribution", async function () {
      const { distributor, token, issuer, user1, user2, user3 } = await loadFixture(
        deployDistributorFixture
      );
      
      const recipients = [user1.address, user2.address, user3.address];
      const amounts = [
        ethers.parseEther("100"),
        ethers.parseEther("200"),
        ethers.parseEther("300"),
      ];
      const reason = ethers.keccak256(ethers.toUtf8Bytes("Batch"));
      
      await distributor.connect(issuer).distributeBatch(recipients, amounts, reason);
      
      expect(await token.balanceOf(user1.address)).to.equal(amounts[0]);
      expect(await token.balanceOf(user2.address)).to.equal(amounts[1]);
      expect(await token.balanceOf(user3.address)).to.equal(amounts[2]);
    });
  });

  // ==========================================================================
  // VESTING TESTS
  // ==========================================================================
  
  describe("Vesting", function () {
    const ONE_DAY = 24 * 60 * 60;
    const ONE_YEAR = 365 * ONE_DAY;
    const THREE_MONTHS = 90 * ONE_DAY;
    
    it("Should allow admin to create vesting schedule", async function () {
      const { distributor, admin, user1 } = await loadFixture(deployDistributorFixture);
      
      const amount = ethers.parseEther("10000");
      
      await distributor.connect(admin).createVestingSchedule(
        user1.address,
        amount,
        THREE_MONTHS,
        ONE_YEAR,
        true
      );
      
      const schedule = await distributor.getVestingSchedule(user1.address);
      
      expect(schedule.totalAmount).to.equal(amount);
      expect(schedule.cliffDuration).to.equal(THREE_MONTHS);
      expect(schedule.vestingDuration).to.equal(ONE_YEAR);
      expect(schedule.revocable).to.be.true;
      expect(schedule.revoked).to.be.false;
    });
    
    it("Should emit VestingScheduleCreated event", async function () {
      const { distributor, admin, user1 } = await loadFixture(deployDistributorFixture);
      
      const amount = ethers.parseEther("10000");
      
      await expect(
        distributor.connect(admin).createVestingSchedule(
          user1.address,
          amount,
          THREE_MONTHS,
          ONE_YEAR,
          true
        )
      )
        .to.emit(distributor, "VestingScheduleCreated")
        .withArgs(user1.address, amount, THREE_MONTHS, ONE_YEAR, true);
    });
    
    it("Should lock tokens in vesting", async function () {
      const { distributor, admin, user1 } = await loadFixture(deployDistributorFixture);
      
      const amount = ethers.parseEther("10000");
      
      await distributor.connect(admin).createVestingSchedule(
        user1.address,
        amount,
        THREE_MONTHS,
        ONE_YEAR,
        true
      );
      
      expect(await distributor.totalVestingLocked()).to.equal(amount);
    });
    
    it("Should return zero vested during cliff", async function () {
      const { distributor, admin, user1 } = await loadFixture(deployDistributorFixture);
      
      const amount = ethers.parseEther("10000");
      
      await distributor.connect(admin).createVestingSchedule(
        user1.address,
        amount,
        THREE_MONTHS,
        ONE_YEAR,
        true
      );
      
      // During cliff
      await time.increase(ONE_DAY * 30);
      
      expect(await distributor.getVestedAmount(user1.address)).to.equal(0);
    });
    
    it("Should vest linearly after cliff", async function () {
      const { distributor, admin, user1 } = await loadFixture(deployDistributorFixture);
      
      const amount = ethers.parseEther("10000");
      
      await distributor.connect(admin).createVestingSchedule(
        user1.address,
        amount,
        THREE_MONTHS,
        ONE_YEAR,
        true
      );
      
      // After cliff (at 6 months = 50% of year)
      await time.increase(ONE_DAY * 180);
      
      const vested = await distributor.getVestedAmount(user1.address);
      // Should be approximately 50% vested (180/365 ≈ 49.3%)
      expect(vested).to.be.gt(ethers.parseEther("4900"));
      expect(vested).to.be.lt(ethers.parseEther("5000"));
    });
    
    it("Should vest fully after duration", async function () {
      const { distributor, admin, user1 } = await loadFixture(deployDistributorFixture);
      
      const amount = ethers.parseEther("10000");
      
      await distributor.connect(admin).createVestingSchedule(
        user1.address,
        amount,
        THREE_MONTHS,
        ONE_YEAR,
        true
      );
      
      // After full vesting period
      await time.increase(ONE_YEAR + ONE_DAY);
      
      const vested = await distributor.getVestedAmount(user1.address);
      expect(vested).to.equal(amount);
    });
    
    it("Should release vested tokens", async function () {
      const { distributor, token, admin, user1 } = await loadFixture(
        deployDistributorFixture
      );
      
      const amount = ethers.parseEther("10000");
      
      await distributor.connect(admin).createVestingSchedule(
        user1.address,
        amount,
        0, // No cliff
        ONE_YEAR,
        true
      );
      
      // After 6 months
      await time.increase(ONE_DAY * 180);
      
      const releasable = await distributor.getReleasableAmount(user1.address);
      
      await distributor.connect(user1).releaseVested(user1.address);
      
      expect(await token.balanceOf(user1.address)).to.be.gt(0);
    });
    
    it("Should emit VestedTokensReleased event", async function () {
      const { distributor, admin, user1 } = await loadFixture(deployDistributorFixture);
      
      const amount = ethers.parseEther("10000");
      
      await distributor.connect(admin).createVestingSchedule(
        user1.address,
        amount,
        0,
        ONE_YEAR,
        true
      );
      
      await time.increase(ONE_DAY * 180);
      
      await expect(distributor.connect(user1).releaseVested(user1.address))
        .to.emit(distributor, "VestedTokensReleased");
    });
    
    it("Should reject duplicate vesting schedule", async function () {
      const { distributor, admin, user1 } = await loadFixture(deployDistributorFixture);
      
      const amount = ethers.parseEther("10000");
      
      await distributor.connect(admin).createVestingSchedule(
        user1.address,
        amount,
        THREE_MONTHS,
        ONE_YEAR,
        true
      );
      
      await expect(
        distributor.connect(admin).createVestingSchedule(
          user1.address,
          amount,
          THREE_MONTHS,
          ONE_YEAR,
          true
        )
      ).to.be.revertedWithCustomError(distributor, "VestingAlreadyExists");
    });
    
    it("Should allow revoker to revoke vesting", async function () {
      const { distributor, token, admin, revoker, user1 } = await loadFixture(
        deployDistributorFixture
      );
      
      const amount = ethers.parseEther("10000");
      
      await distributor.connect(admin).createVestingSchedule(
        user1.address,
        amount,
        0,
        ONE_YEAR,
        true // revocable
      );
      
      // After 50% vested
      await time.increase(ONE_DAY * 180);
      
      const revokerBalanceBefore = await token.balanceOf(revoker.address);
      
      await distributor.connect(revoker).revokeVesting(user1.address);
      
      const schedule = await distributor.getVestingSchedule(user1.address);
      expect(schedule.revoked).to.be.true;
      
      // Revoker should receive unvested tokens
      const revokerBalanceAfter = await token.balanceOf(revoker.address);
      expect(revokerBalanceAfter).to.be.gt(revokerBalanceBefore);
    });
    
    it("Should reject revoking non-revocable vesting", async function () {
      const { distributor, admin, revoker, user1 } = await loadFixture(
        deployDistributorFixture
      );
      
      await distributor.connect(admin).createVestingSchedule(
        user1.address,
        ethers.parseEther("10000"),
        0,
        ONE_YEAR,
        false // not revocable
      );
      
      await expect(
        distributor.connect(revoker).revokeVesting(user1.address)
      ).to.be.revertedWithCustomError(distributor, "VestingNotRevocable");
    });
  });

  // ==========================================================================
  // MERKLE DISTRIBUTION TESTS
  // ==========================================================================
  
  describe("Merkle Distribution", function () {
    async function createMerkleTree(signers: any[]) {
      const values: [string, string][] = signers.map((signer, i) => [
        signer.address,
        ethers.parseEther(String((i + 1) * 100)).toString(),
      ]);
      
      const tree = StandardMerkleTree.of(values, ["address", "uint256"]);
      const totalAmount = values.reduce((sum, v) => sum + BigInt(v[1]), 0n);
      
      return { tree, values, totalAmount };
    }
    
    it("Should allow admin to create Merkle distribution", async function () {
      const { distributor, admin, user1, user2, user3 } = await loadFixture(
        deployDistributorFixture
      );
      
      const { tree, totalAmount } = await createMerkleTree([user1, user2, user3]);
      
      await distributor.connect(admin).createMerkleDistribution(
        tree.root,
        totalAmount,
        7 * 24 * 60 * 60, // 7 days
        "QmTestHash"
      );
      
      const dist = await distributor.getMerkleDistribution(1);
      
      expect(dist.merkleRoot).to.equal(tree.root);
      expect(dist.totalAmount).to.equal(totalAmount);
      expect(dist.active).to.be.true;
    });
    
    it("Should emit MerkleDistributionCreated event", async function () {
      const { distributor, admin, user1, user2 } = await loadFixture(
        deployDistributorFixture
      );
      
      const { tree, totalAmount } = await createMerkleTree([user1, user2]);
      const duration = 7 * 24 * 60 * 60;
      
      await expect(
        distributor.connect(admin).createMerkleDistribution(
          tree.root,
          totalAmount,
          duration,
          "QmTestHash"
        )
      ).to.emit(distributor, "MerkleDistributionCreated");
    });
    
    it("Should allow valid claim with proof", async function () {
      const { distributor, token, admin, user1, user2, user3 } = await loadFixture(
        deployDistributorFixture
      );
      
      const { tree, values, totalAmount } = await createMerkleTree([user1, user2, user3]);
      
      await distributor.connect(admin).createMerkleDistribution(
        tree.root,
        totalAmount,
        7 * 24 * 60 * 60,
        "QmTestHash"
      );
      
      // Get proof for user1
      let proof: string[] = [];
      let amount = "0";
      for (const [i, v] of tree.entries()) {
        if (v[0] === user1.address) {
          proof = tree.getProof(i);
          amount = v[1];
          break;
        }
      }
      
      await distributor.connect(user1).claimMerkle(1, amount, proof);
      
      expect(await token.balanceOf(user1.address)).to.equal(amount);
    });
    
    it("Should emit MerkleClaimed event", async function () {
      const { distributor, admin, user1, user2 } = await loadFixture(
        deployDistributorFixture
      );
      
      const { tree, totalAmount } = await createMerkleTree([user1, user2]);
      
      await distributor.connect(admin).createMerkleDistribution(
        tree.root,
        totalAmount,
        7 * 24 * 60 * 60,
        "QmTestHash"
      );
      
      let proof: string[] = [];
      let amount = "0";
      for (const [i, v] of tree.entries()) {
        if (v[0] === user1.address) {
          proof = tree.getProof(i);
          amount = v[1];
          break;
        }
      }
      
      await expect(distributor.connect(user1).claimMerkle(1, amount, proof))
        .to.emit(distributor, "MerkleClaimed")
        .withArgs(1, user1.address, amount);
    });
    
    it("Should reject invalid proof", async function () {
      const { distributor, admin, user1, user2, user3 } = await loadFixture(
        deployDistributorFixture
      );
      
      const { tree, totalAmount } = await createMerkleTree([user1, user2]);
      
      await distributor.connect(admin).createMerkleDistribution(
        tree.root,
        totalAmount,
        7 * 24 * 60 * 60,
        "QmTestHash"
      );
      
      // User3 not in tree
      await expect(
        distributor.connect(user3).claimMerkle(1, ethers.parseEther("100"), [])
      ).to.be.revertedWithCustomError(distributor, "InvalidMerkleProof");
    });
    
    it("Should reject double claim", async function () {
      const { distributor, admin, user1, user2 } = await loadFixture(
        deployDistributorFixture
      );
      
      const { tree, totalAmount } = await createMerkleTree([user1, user2]);
      
      await distributor.connect(admin).createMerkleDistribution(
        tree.root,
        totalAmount,
        7 * 24 * 60 * 60,
        "QmTestHash"
      );
      
      let proof: string[] = [];
      let amount = "0";
      for (const [i, v] of tree.entries()) {
        if (v[0] === user1.address) {
          proof = tree.getProof(i);
          amount = v[1];
          break;
        }
      }
      
      await distributor.connect(user1).claimMerkle(1, amount, proof);
      
      await expect(
        distributor.connect(user1).claimMerkle(1, amount, proof)
      ).to.be.revertedWithCustomError(distributor, "AlreadyClaimed");
    });
    
    it("Should reject claim after expiration", async function () {
      const { distributor, admin, user1, user2 } = await loadFixture(
        deployDistributorFixture
      );
      
      const { tree, totalAmount } = await createMerkleTree([user1, user2]);
      const duration = 7 * 24 * 60 * 60; // 7 days
      
      await distributor.connect(admin).createMerkleDistribution(
        tree.root,
        totalAmount,
        duration,
        "QmTestHash"
      );
      
      // Fast forward past expiration
      await time.increase(duration + 1);
      
      let proof: string[] = [];
      let amount = "0";
      for (const [i, v] of tree.entries()) {
        if (v[0] === user1.address) {
          proof = tree.getProof(i);
          amount = v[1];
          break;
        }
      }
      
      await expect(
        distributor.connect(user1).claimMerkle(1, amount, proof)
      ).to.be.revertedWithCustomError(distributor, "DistributionExpired");
    });
    
    it("Should verify claim correctly", async function () {
      const { distributor, admin, user1, user2 } = await loadFixture(
        deployDistributorFixture
      );
      
      const { tree, totalAmount } = await createMerkleTree([user1, user2]);
      
      await distributor.connect(admin).createMerkleDistribution(
        tree.root,
        totalAmount,
        7 * 24 * 60 * 60,
        "QmTestHash"
      );
      
      let proof: string[] = [];
      let amount = "0";
      for (const [i, v] of tree.entries()) {
        if (v[0] === user1.address) {
          proof = tree.getProof(i);
          amount = v[1];
          break;
        }
      }
      
      const [valid, claimable] = await distributor.verifyMerkleClaim(
        1,
        user1.address,
        amount,
        proof
      );
      
      expect(valid).to.be.true;
      expect(claimable).to.be.true;
    });
    
    it("Should allow closing expired distribution", async function () {
      const { distributor, token, admin, user1, user2 } = await loadFixture(
        deployDistributorFixture
      );
      
      const { tree, totalAmount } = await createMerkleTree([user1, user2]);
      const duration = 7 * 24 * 60 * 60;
      
      await distributor.connect(admin).createMerkleDistribution(
        tree.root,
        totalAmount,
        duration,
        "QmTestHash"
      );
      
      // Fast forward past expiration
      await time.increase(duration + 1);
      
      const adminBalanceBefore = await token.balanceOf(admin.address);
      
      await distributor.connect(admin).closeExpiredDistribution(1);
      
      const dist = await distributor.getMerkleDistribution(1);
      expect(dist.active).to.be.false;
      
      // Admin should receive unclaimed tokens
      const adminBalanceAfter = await token.balanceOf(admin.address);
      expect(adminBalanceAfter).to.be.gt(adminBalanceBefore);
    });
    
    it("Should track claimed status", async function () {
      const { distributor, admin, user1, user2 } = await loadFixture(
        deployDistributorFixture
      );
      
      const { tree, totalAmount } = await createMerkleTree([user1, user2]);
      
      await distributor.connect(admin).createMerkleDistribution(
        tree.root,
        totalAmount,
        7 * 24 * 60 * 60,
        "QmTestHash"
      );
      
      expect(await distributor.hasClaimed(1, user1.address)).to.be.false;
      
      let proof: string[] = [];
      let amount = "0";
      for (const [i, v] of tree.entries()) {
        if (v[0] === user1.address) {
          proof = tree.getProof(i);
          amount = v[1];
          break;
        }
      }
      
      await distributor.connect(user1).claimMerkle(1, amount, proof);
      
      expect(await distributor.hasClaimed(1, user1.address)).to.be.true;
    });
  });

  // ==========================================================================
  // PAUSE TESTS
  // ==========================================================================
  
  describe("Pausing", function () {
    it("Should prevent distribution when paused", async function () {
      const { distributor, pauser, issuer, user1 } = await loadFixture(
        deployDistributorFixture
      );
      
      await distributor.connect(pauser).pause();
      
      const reason = ethers.keccak256(ethers.toUtf8Bytes("Reward"));
      
      await expect(
        distributor.connect(issuer).distributeDirectly(
          user1.address,
          ethers.parseEther("100"),
          reason
        )
      ).to.be.reverted;
    });
    
    it("Should allow operations after unpause", async function () {
      const { distributor, pauser, issuer, user1 } = await loadFixture(
        deployDistributorFixture
      );
      
      await distributor.connect(pauser).pause();
      await distributor.connect(pauser).unpause();
      
      const reason = ethers.keccak256(ethers.toUtf8Bytes("Reward"));
      
      await expect(
        distributor.connect(issuer).distributeDirectly(
          user1.address,
          ethers.parseEther("100"),
          reason
        )
      ).to.not.be.reverted;
    });
  });
});
