/**
 * @file test/unit/Token.test.ts
 * @description Unit tests for the TRCSToken contract
 */

import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { TRCSToken, AccessControlManager } from "../../typechain-types";

describe("TRCSToken", function () {
  // ==========================================================================
  // FIXTURE
  // ==========================================================================
  
  async function deployTokenFixture() {
    const [admin, issuer, pauser, revoker, user1, user2] = await ethers.getSigners();
    
    // Deploy AccessControlManager first
    const AccessControlManager = await ethers.getContractFactory("AccessControlManager");
    const accessControlManager = await AccessControlManager.deploy(admin.address);
    const acmAddress = await accessControlManager.getAddress();
    
    // Deploy Token
    const Token = await ethers.getContractFactory("TRCSToken");
    const initialSupply = ethers.parseEther("1000000"); // 1M tokens
    const maxCap = ethers.parseEther("100000000"); // 100M cap
    
    const token = await Token.deploy(
      "TRCS Reward Token",
      "TRCS",
      initialSupply,
      maxCap,
      acmAddress
    );
    
    // Grant roles to test accounts
    const ISSUER_ROLE = await accessControlManager.ISSUER_ROLE();
    const PAUSER_ROLE = await accessControlManager.PAUSER_ROLE();
    const REVOKER_ROLE = await accessControlManager.REVOKER_ROLE();
    
    await accessControlManager.grantRole(ISSUER_ROLE, issuer.address);
    await accessControlManager.grantRole(PAUSER_ROLE, pauser.address);
    await accessControlManager.grantRole(REVOKER_ROLE, revoker.address);
    
    return {
      token,
      accessControlManager,
      admin,
      issuer,
      pauser,
      revoker,
      user1,
      user2,
      initialSupply,
      maxCap,
    };
  }

  // ==========================================================================
  // DEPLOYMENT TESTS
  // ==========================================================================
  
  describe("Deployment", function () {
    it("Should set correct token name and symbol", async function () {
      const { token } = await loadFixture(deployTokenFixture);
      
      expect(await token.name()).to.equal("TRCS Reward Token");
      expect(await token.symbol()).to.equal("TRCS");
    });
    
    it("Should mint initial supply to deployer", async function () {
      const { token, admin, initialSupply } = await loadFixture(deployTokenFixture);
      
      expect(await token.balanceOf(admin.address)).to.equal(initialSupply);
    });
    
    it("Should set correct cap", async function () {
      const { token, maxCap } = await loadFixture(deployTokenFixture);
      
      expect(await token.cap()).to.equal(maxCap);
    });
    
    it("Should set correct total minted", async function () {
      const { token, initialSupply } = await loadFixture(deployTokenFixture);
      
      expect(await token.totalMinted()).to.equal(initialSupply);
    });
    
    it("Should have 18 decimals", async function () {
      const { token } = await loadFixture(deployTokenFixture);
      
      expect(await token.decimals()).to.equal(18);
    });
    
    it("Should reject zero address for ACM", async function () {
      const Token = await ethers.getContractFactory("TRCSToken");
      
      await expect(
        Token.deploy("Test", "TST", 0, 0, ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid ACM address");
    });
    
    it("Should reject initial supply exceeding cap", async function () {
      const [admin] = await ethers.getSigners();
      const AccessControlManager = await ethers.getContractFactory("AccessControlManager");
      const acm = await AccessControlManager.deploy(admin.address);
      
      const Token = await ethers.getContractFactory("TRCSToken");
      const initialSupply = ethers.parseEther("1000");
      const maxCap = ethers.parseEther("100"); // Less than initial
      
      await expect(
        Token.deploy("Test", "TST", initialSupply, maxCap, await acm.getAddress())
      ).to.be.revertedWith("Initial supply exceeds cap");
    });
  });

  // ==========================================================================
  // MINTING TESTS
  // ==========================================================================
  
  describe("Minting", function () {
    it("Should allow issuer to mint tokens", async function () {
      const { token, issuer, user1 } = await loadFixture(deployTokenFixture);
      
      const amount = ethers.parseEther("1000");
      await token.connect(issuer).mint(user1.address, amount);
      
      expect(await token.balanceOf(user1.address)).to.equal(amount);
    });
    
    it("Should emit TokensMinted event", async function () {
      const { token, issuer, user1 } = await loadFixture(deployTokenFixture);
      
      const amount = ethers.parseEther("1000");
      
      await expect(token.connect(issuer).mint(user1.address, amount))
        .to.emit(token, "TokensMinted")
        .withArgs(user1.address, amount, issuer.address);
    });
    
    it("Should update total minted", async function () {
      const { token, issuer, user1, initialSupply } = await loadFixture(deployTokenFixture);
      
      const amount = ethers.parseEther("1000");
      await token.connect(issuer).mint(user1.address, amount);
      
      expect(await token.totalMinted()).to.equal(initialSupply + amount);
    });
    
    it("Should reject minting to zero address", async function () {
      const { token, issuer } = await loadFixture(deployTokenFixture);
      
      await expect(
        token.connect(issuer).mint(ethers.ZeroAddress, ethers.parseEther("100"))
      ).to.be.revertedWithCustomError(token, "MintToZeroAddress");
    });
    
    it("Should reject minting by non-issuer", async function () {
      const { token, user1, user2 } = await loadFixture(deployTokenFixture);
      
      await expect(
        token.connect(user1).mint(user2.address, ethers.parseEther("100"))
      ).to.be.revertedWithCustomError(token, "UnauthorizedAccess");
    });
    
    it("Should reject minting beyond cap", async function () {
      const { token, issuer, user1, maxCap, initialSupply } = await loadFixture(deployTokenFixture);
      
      const remaining = maxCap - initialSupply;
      const tooMuch = remaining + 1n;
      
      await expect(
        token.connect(issuer).mint(user1.address, tooMuch)
      ).to.be.revertedWithCustomError(token, "CapExceeded");
    });
    
    it("Should support batch minting", async function () {
      const { token, issuer, user1, user2 } = await loadFixture(deployTokenFixture);
      
      const recipients = [user1.address, user2.address];
      const amounts = [ethers.parseEther("100"), ethers.parseEther("200")];
      
      await token.connect(issuer).mintBatch(recipients, amounts);
      
      expect(await token.balanceOf(user1.address)).to.equal(amounts[0]);
      expect(await token.balanceOf(user2.address)).to.equal(amounts[1]);
    });
    
    it("Should emit BatchMint event", async function () {
      const { token, issuer, user1, user2 } = await loadFixture(deployTokenFixture);
      
      const recipients = [user1.address, user2.address];
      const amounts = [ethers.parseEther("100"), ethers.parseEther("200")];
      const total = amounts[0] + amounts[1];
      
      await expect(token.connect(issuer).mintBatch(recipients, amounts))
        .to.emit(token, "BatchMint")
        .withArgs(2, total, issuer.address);
    });
    
    it("Should reject batch mint with mismatched arrays", async function () {
      const { token, issuer, user1 } = await loadFixture(deployTokenFixture);
      
      const recipients = [user1.address];
      const amounts = [ethers.parseEther("100"), ethers.parseEther("200")];
      
      await expect(
        token.connect(issuer).mintBatch(recipients, amounts)
      ).to.be.revertedWithCustomError(token, "ArrayLengthMismatch");
    });
  });

  // ==========================================================================
  // BURNING TESTS
  // ==========================================================================
  
  describe("Burning", function () {
    it("Should allow users to burn their own tokens", async function () {
      const { token, admin } = await loadFixture(deployTokenFixture);
      
      const burnAmount = ethers.parseEther("1000");
      const initialBalance = await token.balanceOf(admin.address);
      
      await token.connect(admin).burn(burnAmount);
      
      expect(await token.balanceOf(admin.address)).to.equal(initialBalance - burnAmount);
    });
    
    it("Should update total burned", async function () {
      const { token, admin } = await loadFixture(deployTokenFixture);
      
      const burnAmount = ethers.parseEther("1000");
      await token.connect(admin).burn(burnAmount);
      
      expect(await token.totalBurned()).to.equal(burnAmount);
    });
    
    it("Should allow revoker to admin burn", async function () {
      const { token, revoker, admin } = await loadFixture(deployTokenFixture);
      
      const burnAmount = ethers.parseEther("1000");
      const initialBalance = await token.balanceOf(admin.address);
      
      await token.connect(revoker).adminBurn(admin.address, burnAmount);
      
      expect(await token.balanceOf(admin.address)).to.equal(initialBalance - burnAmount);
    });
    
    it("Should emit TokensBurnedByAdmin event", async function () {
      const { token, revoker, admin } = await loadFixture(deployTokenFixture);
      
      const burnAmount = ethers.parseEther("1000");
      const reasonHash = ethers.keccak256(ethers.toUtf8Bytes("ADMIN_BURN"));
      
      await expect(token.connect(revoker).adminBurn(admin.address, burnAmount))
        .to.emit(token, "TokensBurnedByAdmin")
        .withArgs(admin.address, burnAmount, revoker.address, reasonHash);
    });
    
    it("Should reject admin burn by non-revoker", async function () {
      const { token, user1, admin } = await loadFixture(deployTokenFixture);
      
      await expect(
        token.connect(user1).adminBurn(admin.address, ethers.parseEther("100"))
      ).to.be.revertedWithCustomError(token, "UnauthorizedAccess");
    });
    
    it("Should reject admin burn exceeding balance", async function () {
      const { token, revoker, user1 } = await loadFixture(deployTokenFixture);
      
      await expect(
        token.connect(revoker).adminBurn(user1.address, ethers.parseEther("100"))
      ).to.be.revertedWithCustomError(token, "InsufficientBalance");
    });
  });

  // ==========================================================================
  // FREEZE TESTS
  // ==========================================================================
  
  describe("Freezing", function () {
    it("Should allow revoker to freeze account", async function () {
      const { token, revoker, user1 } = await loadFixture(deployTokenFixture);
      
      await token.connect(revoker).freezeAccount(user1.address);
      
      expect(await token.isFrozen(user1.address)).to.be.true;
    });
    
    it("Should emit AccountFrozen event", async function () {
      const { token, revoker, user1 } = await loadFixture(deployTokenFixture);
      
      await expect(token.connect(revoker).freezeAccount(user1.address))
        .to.emit(token, "AccountFrozen")
        .withArgs(user1.address, revoker.address);
    });
    
    it("Should prevent frozen account from sending tokens", async function () {
      const { token, revoker, admin, user1, issuer } = await loadFixture(deployTokenFixture);
      
      // Give user1 some tokens
      await token.connect(issuer).mint(user1.address, ethers.parseEther("100"));
      
      // Freeze user1
      await token.connect(revoker).freezeAccount(user1.address);
      
      // Try to transfer
      await expect(
        token.connect(user1).transfer(admin.address, ethers.parseEther("50"))
      ).to.be.revertedWithCustomError(token, "AccountIsFrozen");
    });
    
    it("Should prevent frozen account from receiving tokens", async function () {
      const { token, revoker, admin, user1 } = await loadFixture(deployTokenFixture);
      
      // Freeze user1
      await token.connect(revoker).freezeAccount(user1.address);
      
      // Try to transfer to frozen account
      await expect(
        token.connect(admin).transfer(user1.address, ethers.parseEther("50"))
      ).to.be.revertedWithCustomError(token, "AccountIsFrozen");
    });
    
    it("Should allow revoker to unfreeze account", async function () {
      const { token, revoker, user1 } = await loadFixture(deployTokenFixture);
      
      await token.connect(revoker).freezeAccount(user1.address);
      await token.connect(revoker).unfreezeAccount(user1.address);
      
      expect(await token.isFrozen(user1.address)).to.be.false;
    });
    
    it("Should reject freezing already frozen account", async function () {
      const { token, revoker, user1 } = await loadFixture(deployTokenFixture);
      
      await token.connect(revoker).freezeAccount(user1.address);
      
      await expect(
        token.connect(revoker).freezeAccount(user1.address)
      ).to.be.revertedWithCustomError(token, "AccountAlreadyFrozen");
    });
  });

  // ==========================================================================
  // PAUSE TESTS
  // ==========================================================================
  
  describe("Pausing", function () {
    it("Should allow pauser to pause", async function () {
      const { token, pauser } = await loadFixture(deployTokenFixture);
      
      await token.connect(pauser).pause();
      expect(await token.paused()).to.be.true;
    });
    
    it("Should prevent transfers when paused", async function () {
      const { token, pauser, admin, user1 } = await loadFixture(deployTokenFixture);
      
      await token.connect(pauser).pause();
      
      await expect(
        token.connect(admin).transfer(user1.address, ethers.parseEther("100"))
      ).to.be.reverted;
    });
    
    it("Should prevent minting when paused", async function () {
      const { token, pauser, issuer, user1 } = await loadFixture(deployTokenFixture);
      
      await token.connect(pauser).pause();
      
      await expect(
        token.connect(issuer).mint(user1.address, ethers.parseEther("100"))
      ).to.be.reverted;
    });
    
    it("Should allow operations after unpause", async function () {
      const { token, pauser, admin, user1 } = await loadFixture(deployTokenFixture);
      
      await token.connect(pauser).pause();
      await token.connect(pauser).unpause();
      
      await expect(
        token.connect(admin).transfer(user1.address, ethers.parseEther("100"))
      ).to.not.be.reverted;
    });
  });

  // ==========================================================================
  // VIEW FUNCTIONS TESTS
  // ==========================================================================
  
  describe("View Functions", function () {
    it("Should return correct remaining mintable supply", async function () {
      const { token, maxCap, initialSupply } = await loadFixture(deployTokenFixture);
      
      const remaining = await token.remainingMintableSupply();
      expect(remaining).to.equal(maxCap - initialSupply);
    });
    
    it("Should return max uint256 for unlimited cap", async function () {
      const [admin] = await ethers.getSigners();
      const AccessControlManager = await ethers.getContractFactory("AccessControlManager");
      const acm = await AccessControlManager.deploy(admin.address);
      
      const Token = await ethers.getContractFactory("TRCSToken");
      const token = await Token.deploy("Test", "TST", 0, 0, await acm.getAddress());
      
      const remaining = await token.remainingMintableSupply();
      expect(remaining).to.equal(ethers.MaxUint256);
    });
    
    it("Should calculate circulating supply correctly", async function () {
      const { token, admin, initialSupply } = await loadFixture(deployTokenFixture);
      
      const burnAmount = ethers.parseEther("1000");
      await token.connect(admin).burn(burnAmount);
      
      const circulating = await token.circulatingSupply();
      expect(circulating).to.equal(initialSupply - burnAmount);
    });
  });

  // ==========================================================================
  // ERC20 PERMIT TESTS
  // ==========================================================================
  
  describe("ERC20 Permit", function () {
    it("Should return correct nonces", async function () {
      const { token, admin } = await loadFixture(deployTokenFixture);
      
      expect(await token.nonces(admin.address)).to.equal(0);
    });
    
    it("Should have DOMAIN_SEPARATOR", async function () {
      const { token } = await loadFixture(deployTokenFixture);
      
      const domainSeparator = await token.DOMAIN_SEPARATOR();
      expect(domainSeparator).to.not.equal(ethers.ZeroHash);
    });
  });
});
