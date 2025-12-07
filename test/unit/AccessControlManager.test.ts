/**
 * @file test/unit/AccessControlManager.test.ts
 * @description Unit tests for the AccessControlManager contract
 *
 * =============================================================================
 * LEARNING PATH - Testing Smart Contracts
 * =============================================================================
 *
 * TESTING PHILOSOPHY:
 * ------------------
 * 1. Test happy paths (normal usage)
 * 2. Test edge cases (boundary conditions)
 * 3. Test failure cases (invalid inputs, unauthorized access)
 * 4. Test events (verify correct event emission)
 * 5. Test gas efficiency (for optimization)
 *
 * TEST STRUCTURE:
 * --------------
 * - describe: Group related tests
 * - beforeEach: Set up fresh state for each test
 * - it: Individual test case
 * - expect: Assertion
 *
 * HARDHAT TESTING FEATURES:
 * ------------------------
 * - ethers: Contract interactions
 * - expect: Chai assertions
 * - loadFixture: Efficient test setup with state snapshots
 * - time: Time manipulation
 *
 * =============================================================================
 */

import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { AccessControlManager } from "../../typechain-types";

describe("AccessControlManager", function () {
  // ==========================================================================
  // FIXTURE - Efficient test setup
  // ==========================================================================
  
  /**
   * Deploy fixture that creates a fresh contract state
   * loadFixture uses Hardhat's snapshot feature for efficiency
   */
  async function deployAccessControlManagerFixture() {
    // Get signers
    const [admin, issuer, pauser, revoker, user1, user2] = await ethers.getSigners();
    
    // Deploy contract
    const AccessControlManager = await ethers.getContractFactory("AccessControlManager");
    const accessControlManager = await AccessControlManager.deploy(admin.address);
    
    // Get role constants
    const DEFAULT_ADMIN_ROLE = await accessControlManager.DEFAULT_ADMIN_ROLE();
    const ADMIN_ROLE = await accessControlManager.ADMIN_ROLE();
    const ISSUER_ROLE = await accessControlManager.ISSUER_ROLE();
    const PAUSER_ROLE = await accessControlManager.PAUSER_ROLE();
    const REVOKER_ROLE = await accessControlManager.REVOKER_ROLE();
    const UPGRADER_ROLE = await accessControlManager.UPGRADER_ROLE();
    
    return {
      accessControlManager,
      admin,
      issuer,
      pauser,
      revoker,
      user1,
      user2,
      roles: {
        DEFAULT_ADMIN_ROLE,
        ADMIN_ROLE,
        ISSUER_ROLE,
        PAUSER_ROLE,
        REVOKER_ROLE,
        UPGRADER_ROLE,
      },
    };
  }

  // ==========================================================================
  // DEPLOYMENT TESTS
  // ==========================================================================
  
  describe("Deployment", function () {
    it("Should set the correct admin on deployment", async function () {
      const { accessControlManager, admin, roles } = await loadFixture(
        deployAccessControlManagerFixture
      );
      
      expect(await accessControlManager.hasRole(roles.DEFAULT_ADMIN_ROLE, admin.address)).to.be.true;
      expect(await accessControlManager.hasRole(roles.ADMIN_ROLE, admin.address)).to.be.true;
    });
    
    it("Should grant all initial roles to admin", async function () {
      const { accessControlManager, admin, roles } = await loadFixture(
        deployAccessControlManagerFixture
      );
      
      expect(await accessControlManager.hasRole(roles.ISSUER_ROLE, admin.address)).to.be.true;
      expect(await accessControlManager.hasRole(roles.PAUSER_ROLE, admin.address)).to.be.true;
      expect(await accessControlManager.hasRole(roles.REVOKER_ROLE, admin.address)).to.be.true;
      expect(await accessControlManager.hasRole(roles.UPGRADER_ROLE, admin.address)).to.be.true;
    });
    
    it("Should reject zero address as admin", async function () {
      const AccessControlManager = await ethers.getContractFactory("AccessControlManager");
      
      await expect(
        AccessControlManager.deploy(ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid admin address");
    });
    
    it("Should initialize total role grants correctly", async function () {
      const { accessControlManager } = await loadFixture(
        deployAccessControlManagerFixture
      );
      
      expect(await accessControlManager.totalRoleGrants()).to.equal(6);
    });
  });

  // ==========================================================================
  // ROLE CHECK TESTS
  // ==========================================================================
  
  describe("Role Checks", function () {
    it("Should correctly identify admins via isAdmin", async function () {
      const { accessControlManager, admin, user1 } = await loadFixture(
        deployAccessControlManagerFixture
      );
      
      expect(await accessControlManager.isAdmin(admin.address)).to.be.true;
      expect(await accessControlManager.isAdmin(user1.address)).to.be.false;
    });
    
    it("Should correctly identify issuers via isIssuer", async function () {
      const { accessControlManager, admin, user1 } = await loadFixture(
        deployAccessControlManagerFixture
      );
      
      expect(await accessControlManager.isIssuer(admin.address)).to.be.true;
      expect(await accessControlManager.isIssuer(user1.address)).to.be.false;
    });
    
    it("Should correctly identify pausers via isPauser", async function () {
      const { accessControlManager, admin, user1 } = await loadFixture(
        deployAccessControlManagerFixture
      );
      
      expect(await accessControlManager.isPauser(admin.address)).to.be.true;
      expect(await accessControlManager.isPauser(user1.address)).to.be.false;
    });
    
    it("Should correctly identify revokers via isRevoker", async function () {
      const { accessControlManager, admin, user1 } = await loadFixture(
        deployAccessControlManagerFixture
      );
      
      expect(await accessControlManager.isRevoker(admin.address)).to.be.true;
      expect(await accessControlManager.isRevoker(user1.address)).to.be.false;
    });
    
    it("Should correctly identify upgraders via isUpgrader", async function () {
      const { accessControlManager, admin, user1 } = await loadFixture(
        deployAccessControlManagerFixture
      );
      
      expect(await accessControlManager.isUpgrader(admin.address)).to.be.true;
      expect(await accessControlManager.isUpgrader(user1.address)).to.be.false;
    });
  });

  // ==========================================================================
  // ROLE MANAGEMENT TESTS
  // ==========================================================================
  
  describe("Role Management", function () {
    it("Should allow admin to grant roles", async function () {
      const { accessControlManager, admin, user1, roles } = await loadFixture(
        deployAccessControlManagerFixture
      );
      
      await accessControlManager.connect(admin).grantRole(roles.ISSUER_ROLE, user1.address);
      
      expect(await accessControlManager.hasRole(roles.ISSUER_ROLE, user1.address)).to.be.true;
    });
    
    it("Should emit RoleGranted event when granting role", async function () {
      const { accessControlManager, admin, user1, roles } = await loadFixture(
        deployAccessControlManagerFixture
      );
      
      await expect(accessControlManager.connect(admin).grantRole(roles.ISSUER_ROLE, user1.address))
        .to.emit(accessControlManager, "RoleGranted")
        .withArgs(roles.ISSUER_ROLE, user1.address, admin.address);
    });
    
    it("Should allow admin to revoke roles", async function () {
      const { accessControlManager, admin, user1, roles } = await loadFixture(
        deployAccessControlManagerFixture
      );
      
      // Grant then revoke
      await accessControlManager.connect(admin).grantRole(roles.ISSUER_ROLE, user1.address);
      await accessControlManager.connect(admin).revokeRole(roles.ISSUER_ROLE, user1.address);
      
      expect(await accessControlManager.hasRole(roles.ISSUER_ROLE, user1.address)).to.be.false;
    });
    
    it("Should prevent non-admin from granting roles", async function () {
      const { accessControlManager, user1, user2, roles } = await loadFixture(
        deployAccessControlManagerFixture
      );
      
      await expect(
        accessControlManager.connect(user1).grantRole(roles.ISSUER_ROLE, user2.address)
      ).to.be.reverted;
    });
    
    it("Should support batch role granting", async function () {
      const { accessControlManager, admin, user1, roles } = await loadFixture(
        deployAccessControlManagerFixture
      );
      
      const rolesToGrant = [roles.ISSUER_ROLE, roles.PAUSER_ROLE];
      await accessControlManager.connect(admin).grantRoles(user1.address, rolesToGrant);
      
      expect(await accessControlManager.hasRole(roles.ISSUER_ROLE, user1.address)).to.be.true;
      expect(await accessControlManager.hasRole(roles.PAUSER_ROLE, user1.address)).to.be.true;
    });
    
    it("Should emit BatchRolesGranted event", async function () {
      const { accessControlManager, admin, user1, roles } = await loadFixture(
        deployAccessControlManagerFixture
      );
      
      const rolesToGrant = [roles.ISSUER_ROLE, roles.PAUSER_ROLE];
      
      await expect(accessControlManager.connect(admin).grantRoles(user1.address, rolesToGrant))
        .to.emit(accessControlManager, "BatchRolesGranted")
        .withArgs(user1.address, rolesToGrant, admin.address);
    });
    
    it("Should reject empty array in batch grant", async function () {
      const { accessControlManager, admin, user1 } = await loadFixture(
        deployAccessControlManagerFixture
      );
      
      await expect(
        accessControlManager.connect(admin).grantRoles(user1.address, [])
      ).to.be.revertedWithCustomError(accessControlManager, "EmptyArray");
    });
    
    it("Should support batch role revocation", async function () {
      const { accessControlManager, admin, user1, roles } = await loadFixture(
        deployAccessControlManagerFixture
      );
      
      // Grant roles first
      const rolesToGrant = [roles.ISSUER_ROLE, roles.PAUSER_ROLE];
      await accessControlManager.connect(admin).grantRoles(user1.address, rolesToGrant);
      
      // Revoke them
      await accessControlManager.connect(admin).revokeRoles(user1.address, rolesToGrant);
      
      expect(await accessControlManager.hasRole(roles.ISSUER_ROLE, user1.address)).to.be.false;
      expect(await accessControlManager.hasRole(roles.PAUSER_ROLE, user1.address)).to.be.false;
    });
  });

  // ==========================================================================
  // BAN MANAGEMENT TESTS
  // ==========================================================================
  
  describe("Ban Management", function () {
    it("Should allow admin to ban an address", async function () {
      const { accessControlManager, admin, user1 } = await loadFixture(
        deployAccessControlManagerFixture
      );
      
      const reasonHash = ethers.keccak256(ethers.toUtf8Bytes("Suspicious activity"));
      await accessControlManager.connect(admin).banAddress(user1.address, reasonHash);
      
      const [banned, timestamp] = await accessControlManager.isBanned(user1.address);
      expect(banned).to.be.true;
      expect(timestamp).to.be.gt(0);
    });
    
    it("Should emit AddressBanned event", async function () {
      const { accessControlManager, admin, user1 } = await loadFixture(
        deployAccessControlManagerFixture
      );
      
      const reasonHash = ethers.keccak256(ethers.toUtf8Bytes("Suspicious activity"));
      
      await expect(accessControlManager.connect(admin).banAddress(user1.address, reasonHash))
        .to.emit(accessControlManager, "AddressBanned")
        .withArgs(user1.address, admin.address, reasonHash);
    });
    
    it("Should prevent granting roles to banned address", async function () {
      const { accessControlManager, admin, user1, roles } = await loadFixture(
        deployAccessControlManagerFixture
      );
      
      const reasonHash = ethers.keccak256(ethers.toUtf8Bytes("Banned"));
      await accessControlManager.connect(admin).banAddress(user1.address, reasonHash);
      
      await expect(
        accessControlManager.connect(admin).grantRole(roles.ISSUER_ROLE, user1.address)
      ).to.be.revertedWithCustomError(accessControlManager, "AddressIsBanned");
    });
    
    it("Should allow DEFAULT_ADMIN to unban an address", async function () {
      const { accessControlManager, admin, user1 } = await loadFixture(
        deployAccessControlManagerFixture
      );
      
      const reasonHash = ethers.keccak256(ethers.toUtf8Bytes("Banned"));
      await accessControlManager.connect(admin).banAddress(user1.address, reasonHash);
      await accessControlManager.connect(admin).unbanAddress(user1.address);
      
      const [banned] = await accessControlManager.isBanned(user1.address);
      expect(banned).to.be.false;
    });
    
    it("Should reject banning zero address", async function () {
      const { accessControlManager, admin } = await loadFixture(
        deployAccessControlManagerFixture
      );
      
      const reasonHash = ethers.keccak256(ethers.toUtf8Bytes("Banned"));
      
      await expect(
        accessControlManager.connect(admin).banAddress(ethers.ZeroAddress, reasonHash)
      ).to.be.revertedWithCustomError(accessControlManager, "CannotBanZeroAddress");
    });
    
    it("Should reject double-banning", async function () {
      const { accessControlManager, admin, user1 } = await loadFixture(
        deployAccessControlManagerFixture
      );
      
      const reasonHash = ethers.keccak256(ethers.toUtf8Bytes("Banned"));
      await accessControlManager.connect(admin).banAddress(user1.address, reasonHash);
      
      await expect(
        accessControlManager.connect(admin).banAddress(user1.address, reasonHash)
      ).to.be.revertedWithCustomError(accessControlManager, "AlreadyBanned");
    });
    
    it("Should reject unbanning non-banned address", async function () {
      const { accessControlManager, admin, user1 } = await loadFixture(
        deployAccessControlManagerFixture
      );
      
      await expect(
        accessControlManager.connect(admin).unbanAddress(user1.address)
      ).to.be.revertedWithCustomError(accessControlManager, "NotBanned");
    });
  });

  // ==========================================================================
  // PAUSE FUNCTIONALITY TESTS
  // ==========================================================================
  
  describe("Pause Functionality", function () {
    it("Should allow pauser to pause", async function () {
      const { accessControlManager, admin } = await loadFixture(
        deployAccessControlManagerFixture
      );
      
      await accessControlManager.connect(admin).pause();
      expect(await accessControlManager.paused()).to.be.true;
    });
    
    it("Should allow pauser to unpause", async function () {
      const { accessControlManager, admin } = await loadFixture(
        deployAccessControlManagerFixture
      );
      
      await accessControlManager.connect(admin).pause();
      await accessControlManager.connect(admin).unpause();
      expect(await accessControlManager.paused()).to.be.false;
    });
    
    it("Should emit Paused event", async function () {
      const { accessControlManager, admin } = await loadFixture(
        deployAccessControlManagerFixture
      );
      
      await expect(accessControlManager.connect(admin).pause())
        .to.emit(accessControlManager, "Paused");
    });
    
    it("Should prevent non-pauser from pausing", async function () {
      const { accessControlManager, user1 } = await loadFixture(
        deployAccessControlManagerFixture
      );
      
      await expect(accessControlManager.connect(user1).pause()).to.be.reverted;
    });
  });

  // ==========================================================================
  // VIEW FUNCTIONS TESTS
  // ==========================================================================
  
  describe("View Functions", function () {
    it("Should return correct role members", async function () {
      const { accessControlManager, admin, user1, roles } = await loadFixture(
        deployAccessControlManagerFixture
      );
      
      await accessControlManager.connect(admin).grantRole(roles.ISSUER_ROLE, user1.address);
      
      const members = await accessControlManager.getRoleMembers(roles.ISSUER_ROLE);
      expect(members).to.include(admin.address);
      expect(members).to.include(user1.address);
    });
    
    it("Should correctly identify hasAnyAdminRole", async function () {
      const { accessControlManager, admin, user1 } = await loadFixture(
        deployAccessControlManagerFixture
      );
      
      expect(await accessControlManager.hasAnyAdminRole(admin.address)).to.be.true;
      expect(await accessControlManager.hasAnyAdminRole(user1.address)).to.be.false;
    });
    
    it("Should return all account roles", async function () {
      const { accessControlManager, admin, roles } = await loadFixture(
        deployAccessControlManagerFixture
      );
      
      const accountRoles = await accessControlManager.getAccountRoles(admin.address);
      
      expect(accountRoles).to.include(roles.DEFAULT_ADMIN_ROLE);
      expect(accountRoles).to.include(roles.ADMIN_ROLE);
      expect(accountRoles).to.include(roles.ISSUER_ROLE);
    });
  });
});
