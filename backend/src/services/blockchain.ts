/**
 * @file src/services/blockchain.ts
 * @description Blockchain service for interacting with smart contracts
 *
 * =============================================================================
 * LEARNING PATH - Smart Contract Integration
 * =============================================================================
 *
 * This service provides a clean abstraction over ethers.js for:
 * 1. Connecting to the blockchain network
 * 2. Interacting with deployed contracts
 * 3. Signing and sending transactions
 * 4. Reading on-chain data
 *
 * ARCHITECTURE:
 * - Singleton pattern for provider/signer
 * - Lazy contract initialization
 * - Error wrapping for consistent handling
 * - Transaction confirmation with retry logic
 *
 * =============================================================================
 */

import { ethers, Contract, Wallet, Provider, TransactionResponse, TransactionReceipt } from "ethers";
import { logger, logTransaction } from "../utils/logger.js";
import { BlockchainError } from "../utils/errors.js";

// Contract ABIs (these would be imported from compiled artifacts)
// For now, we define minimal ABIs for the functions we need
const ACCESS_CONTROL_ABI = [
  "function hasRole(bytes32 role, address account) view returns (bool)",
  "function grantRole(bytes32 role, address account)",
  "function revokeRole(bytes32 role, address account)",
  "function getRoleAdmin(bytes32 role) view returns (bytes32)",
  "function ADMIN_ROLE() view returns (bytes32)",
  "function ISSUER_ROLE() view returns (bytes32)",
  "function PAUSER_ROLE() view returns (bytes32)",
  "function TREASURY_ROLE() view returns (bytes32)",
];

const TOKEN_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function mint(address to, uint256 amount)",
  "function burn(uint256 amount)",
  "function cap() view returns (uint256)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
];

const CREDENTIAL_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function balanceOf(address owner) view returns (uint256)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function tokenURI(uint256 tokenId) view returns (string)",
  "function isCredentialValid(uint256 tokenId) view returns (bool)",
  "function getCredentialType(uint256 tokenId) view returns (uint8)",
  "function getCredentialMetadata(uint256 tokenId) view returns (tuple(uint8 credentialType, address issuer, uint256 issuedAt, uint256 expiresAt, bool revoked, bytes32 dataHash))",
  "function issueCredential(address to, string uri, bytes32 credentialType, uint256 expiresAt, bytes32 dataHash) returns (uint256)",
  "function revokeCredential(uint256 tokenId, bytes32 reason)",
  "function totalSupply() view returns (uint256)",
  "event CredentialIssued(uint256 indexed tokenId, address indexed recipient, bytes32 credentialType, address issuer)",
  "event CredentialRevoked(uint256 indexed tokenId, bytes32 reason)",
];

const REWARD_DISTRIBUTOR_ABI = [
  "function rewardToken() view returns (address)",
  "function totalVestingLocked() view returns (uint256)",
  "function totalDistributionReserved() view returns (uint256)",
  "function nextDistributionId() view returns (uint256)",
  "function getVestingSchedule(address beneficiary) view returns (tuple(uint256 totalAmount, uint256 releasedAmount, uint256 startTime, uint256 cliffDuration, uint256 vestingDuration, bool revocable, bool revoked))",
  "function getReleasableAmount(address beneficiary) view returns (uint256)",
  "function getVestedAmount(address beneficiary) view returns (uint256)",
  "function hasClaimed(uint256 distributionId, address account) view returns (bool)",
  "function getMerkleDistribution(uint256 distributionId) view returns (tuple(bytes32 merkleRoot, uint256 totalAmount, uint256 claimedAmount, uint256 expiresAt, bool active, string ipfsHash))",
  "function createVestingSchedule(address beneficiary, uint256 amount, uint256 cliffDuration, uint256 vestingDuration, bool revocable)",
  "function releaseVested(address beneficiary) returns (uint256)",
  "function claimMerkle(uint256 distributionId, uint256 amount, bytes32[] proof)",
  "event VestingScheduleCreated(address indexed beneficiary, uint256 amount, uint256 cliffDuration, uint256 vestingDuration, bool revocable)",
  "event VestedTokensReleased(address indexed beneficiary, uint256 amount)",
  "event MerkleClaimed(uint256 indexed distributionId, address indexed claimer, uint256 amount)",
];

/**
 * Blockchain Service Class
 * Handles all blockchain interactions
 */
export class BlockchainService {
  private provider: Provider;
  private signer: Wallet;
  private contracts: {
    accessControl?: Contract;
    token?: Contract;
    credential?: Contract;
    rewardDistributor?: Contract;
  } = {};

  private config: {
    rpcUrl: string;
    privateKey: string;
    addresses: {
      accessControl: string;
      token: string;
      credential: string;
      rewardDistributor: string;
    };
  };

  constructor(config: {
    rpcUrl: string;
    privateKey: string;
    addresses: {
      accessControl: string;
      token: string;
      credential: string;
      rewardDistributor: string;
    };
  }) {
    this.config = config;
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
    this.signer = new Wallet(config.privateKey, this.provider);
    
    logger.info("BlockchainService initialized", {
      rpcUrl: config.rpcUrl,
      signerAddress: this.signer.address,
    });
  }

  /**
   * Get the signer address
   */
  getSignerAddress(): string {
    return this.signer.address;
  }

  /**
   * Get current block number
   */
  async getBlockNumber(): Promise<number> {
    try {
      return await this.provider.getBlockNumber();
    } catch (error) {
      throw new BlockchainError("Failed to get block number");
    }
  }

  /**
   * Get ETH balance for an address
   */
  async getBalance(address: string): Promise<string> {
    try {
      const balance = await this.provider.getBalance(address);
      return ethers.formatEther(balance);
    } catch (error) {
      throw new BlockchainError(`Failed to get balance for ${address}`);
    }
  }

  // ==========================================================================
  // Access Control Contract Methods
  // ==========================================================================

  private getAccessControlContract(): Contract {
    if (!this.contracts.accessControl) {
      this.contracts.accessControl = new Contract(
        this.config.addresses.accessControl,
        ACCESS_CONTROL_ABI,
        this.signer
      );
    }
    return this.contracts.accessControl;
  }

  async hasRole(role: string, account: string): Promise<boolean> {
    try {
      const contract = this.getAccessControlContract();
      return await contract.hasRole(role, account);
    } catch (error) {
      throw new BlockchainError(`Failed to check role for ${account}`);
    }
  }

  async grantRole(role: string, account: string): Promise<TransactionReceipt> {
    try {
      const contract = this.getAccessControlContract();
      const tx: TransactionResponse = await contract.grantRole(role, account);
      logTransaction("grantRole", tx.hash, this.signer.address, account);
      return await tx.wait() as TransactionReceipt;
    } catch (error) {
      throw new BlockchainError(`Failed to grant role to ${account}`);
    }
  }

  // ==========================================================================
  // Token Contract Methods
  // ==========================================================================

  private getTokenContract(): Contract {
    if (!this.contracts.token) {
      this.contracts.token = new Contract(
        this.config.addresses.token,
        TOKEN_ABI,
        this.signer
      );
    }
    return this.contracts.token;
  }

  async getTokenInfo(): Promise<{
    name: string;
    symbol: string;
    decimals: number;
    totalSupply: string;
    cap: string;
  }> {
    try {
      const contract = this.getTokenContract();
      const [name, symbol, decimals, totalSupply, cap] = await Promise.all([
        contract.name(),
        contract.symbol(),
        contract.decimals(),
        contract.totalSupply(),
        contract.cap(),
      ]);
      return {
        name,
        symbol,
        decimals: Number(decimals),
        totalSupply: ethers.formatEther(totalSupply),
        cap: ethers.formatEther(cap),
      };
    } catch (error) {
      throw new BlockchainError("Failed to get token info");
    }
  }

  async getTokenBalance(address: string): Promise<string> {
    try {
      const contract = this.getTokenContract();
      const balance = await contract.balanceOf(address);
      return ethers.formatEther(balance);
    } catch (error) {
      throw new BlockchainError(`Failed to get token balance for ${address}`);
    }
  }

  async mintTokens(to: string, amount: string): Promise<TransactionReceipt> {
    try {
      const contract = this.getTokenContract();
      const parsedAmount = ethers.parseEther(amount);
      const tx: TransactionResponse = await contract.mint(to, parsedAmount);
      logTransaction("mint", tx.hash, this.signer.address, to);
      return await tx.wait() as TransactionReceipt;
    } catch (error) {
      throw new BlockchainError(`Failed to mint tokens to ${to}`);
    }
  }

  async transferTokens(to: string, amount: string): Promise<TransactionReceipt> {
    try {
      const contract = this.getTokenContract();
      const parsedAmount = ethers.parseEther(amount);
      const tx: TransactionResponse = await contract.transfer(to, parsedAmount);
      logTransaction("transfer", tx.hash, this.signer.address, to);
      return await tx.wait() as TransactionReceipt;
    } catch (error) {
      throw new BlockchainError(`Failed to transfer tokens to ${to}`);
    }
  }

  // ==========================================================================
  // Credential Contract Methods
  // ==========================================================================

  private getCredentialContract(): Contract {
    if (!this.contracts.credential) {
      this.contracts.credential = new Contract(
        this.config.addresses.credential,
        CREDENTIAL_ABI,
        this.signer
      );
    }
    return this.contracts.credential;
  }

  async getCredentialInfo(tokenId: number): Promise<{
    owner: string;
    tokenURI: string;
    isValid: boolean;
    credentialType: number;
    metadata: {
      issuer: string;
      issuedAt: number;
      expiresAt: number;
      revoked: boolean;
    };
  }> {
    try {
      const contract = this.getCredentialContract();
      const [owner, tokenURI, isValid, credentialType, metadata] = await Promise.all([
        contract.ownerOf(tokenId),
        contract.tokenURI(tokenId),
        contract.isCredentialValid(tokenId),
        contract.getCredentialType(tokenId),
        contract.getCredentialMetadata(tokenId),
      ]);
      return {
        owner,
        tokenURI,
        isValid,
        credentialType,
        metadata: {
          issuer: metadata.issuer,
          issuedAt: Number(metadata.issuedAt),
          expiresAt: Number(metadata.expiresAt),
          revoked: metadata.revoked,
        },
      };
    } catch (error) {
      throw new BlockchainError(`Failed to get credential info for token ${tokenId}`);
    }
  }

  async getCredentialBalance(address: string): Promise<number> {
    try {
      const contract = this.getCredentialContract();
      const balance = await contract.balanceOf(address);
      return Number(balance);
    } catch (error) {
      throw new BlockchainError(`Failed to get credential balance for ${address}`);
    }
  }

  async revokeCredential(tokenId: number, reason: string): Promise<TransactionReceipt> {
    try {
      const contract = this.getCredentialContract();
      const reasonHash = ethers.keccak256(ethers.toUtf8Bytes(reason));
      const tx: TransactionResponse = await contract.revokeCredential(tokenId, reasonHash);
      logTransaction("revokeCredential", tx.hash, this.signer.address);
      return await tx.wait() as TransactionReceipt;
    } catch (error) {
      throw new BlockchainError(`Failed to revoke credential ${tokenId}`);
    }
  }

  /**
   * Issue a credential NFT directly (for demo purposes)
   */
  async issueCredential(
    to: string,
    uri: string,
    credentialType: string,
    expiresAt: number,
    dataHash: string
  ): Promise<TransactionReceipt> {
    try {
      const contract = this.getCredentialContract();
      const tx: TransactionResponse = await contract.issueCredential(
        to,
        uri,
        credentialType,
        expiresAt,
        dataHash
      );
      logTransaction("issueCredential", tx.hash, this.signer.address, to);
      return await tx.wait() as TransactionReceipt;
    } catch (error: any) {
      throw new BlockchainError(`Failed to issue credential to ${to}: ${error.message}`);
    }
  }

  /**
   * Approve tokens for the reward distributor (for vesting)
   */
  async approveTokensForVesting(amount: string): Promise<TransactionReceipt> {
    try {
      const tokenContract = this.getTokenContract();
      const parsedAmount = ethers.parseEther(amount);
      const tx: TransactionResponse = await tokenContract.approve(
        this.config.addresses.rewardDistributor,
        parsedAmount
      );
      logTransaction("approve", tx.hash, this.signer.address, this.config.addresses.rewardDistributor);
      return await tx.wait() as TransactionReceipt;
    } catch (error: any) {
      throw new BlockchainError(`Failed to approve tokens for vesting: ${error.message}`);
    }
  }

  /**
   * Get releasable amount for vesting
   */
  async getReleasableAmount(beneficiary: string): Promise<string> {
    try {
      const contract = this.getRewardDistributorContract();
      const amount = await contract.getReleasableAmount(beneficiary);
      return ethers.formatEther(amount);
    } catch (error: any) {
      throw new BlockchainError(`Failed to get releasable amount for ${beneficiary}: ${error.message}`);
    }
  }

  // ==========================================================================
  // Reward Distributor Contract Methods
  // ==========================================================================

  private getRewardDistributorContract(): Contract {
    if (!this.contracts.rewardDistributor) {
      this.contracts.rewardDistributor = new Contract(
        this.config.addresses.rewardDistributor,
        REWARD_DISTRIBUTOR_ABI,
        this.signer
      );
    }
    return this.contracts.rewardDistributor;
  }

  async getDistributorInfo(): Promise<{
    tokenAddress: string;
    totalVestingLocked: string;
    totalDistributionReserved: string;
  }> {
    try {
      const contract = this.getRewardDistributorContract();
      const [tokenAddress, totalVestingLocked, totalDistributionReserved] = await Promise.all([
        contract.rewardToken(),
        contract.totalVestingLocked(),
        contract.totalDistributionReserved(),
      ]);
      return {
        tokenAddress,
        totalVestingLocked: ethers.formatEther(totalVestingLocked),
        totalDistributionReserved: ethers.formatEther(totalDistributionReserved),
      };
    } catch (error) {
      console.error("getDistributorInfo error:", error);
      throw new BlockchainError("Failed to get distributor info");
    }
  }

  async getVestingSchedule(beneficiary: string): Promise<{
    totalAmount: string;
    startTime: number;
    cliffDuration: number;
    vestingDuration: number;
    releasedAmount: string;
    revoked: boolean;
    releasable: string;
  }> {
    try {
      const contract = this.getRewardDistributorContract();
      const [schedule, releasable] = await Promise.all([
        contract.getVestingSchedule(beneficiary),
        contract.getReleasableAmount(beneficiary),
      ]);
      return {
        totalAmount: ethers.formatEther(schedule.totalAmount),
        startTime: Number(schedule.startTime),
        cliffDuration: Number(schedule.cliffDuration),
        vestingDuration: Number(schedule.vestingDuration),
        releasedAmount: ethers.formatEther(schedule.releasedAmount),
        revoked: schedule.revoked,
        releasable: ethers.formatEther(releasable),
      };
    } catch (error) {
      console.error("getVestingSchedule error:", error);
      throw new BlockchainError(`Failed to get vesting schedule for ${beneficiary}`);
    }
  }

  async createVestingSchedule(
    beneficiary: string,
    totalAmount: string,
    cliffDuration: number,
    vestingDuration: number,
    revocable: boolean = false
  ): Promise<TransactionReceipt> {
    try {
      const contract = this.getRewardDistributorContract();
      const parsedAmount = ethers.parseEther(totalAmount);
      const tx: TransactionResponse = await contract.createVestingSchedule(
        beneficiary,
        parsedAmount,
        cliffDuration,
        vestingDuration,
        revocable
      );
      logTransaction("createVestingSchedule", tx.hash, this.signer.address, beneficiary);
      return await tx.wait() as TransactionReceipt;
    } catch (error: any) {
      throw new BlockchainError(`Failed to create vesting schedule for ${beneficiary}: ${error.message}`);
    }
  }

  /**
   * Release vested tokens for a beneficiary
   */
  async releaseVested(beneficiary: string): Promise<{ receipt: TransactionReceipt; amount: string }> {
    try {
      const contract = this.getRewardDistributorContract();
      const tx: TransactionResponse = await contract.releaseVested(beneficiary);
      logTransaction("releaseVested", tx.hash, this.signer.address, beneficiary);
      const receipt = await tx.wait() as TransactionReceipt;
      
      // Parse the VestedTokensReleased event to get the amount
      const event = receipt.logs.find((log) => {
        try {
          const parsed = contract.interface.parseLog({ topics: log.topics as string[], data: log.data });
          return parsed?.name === "VestedTokensReleased";
        } catch {
          return false;
        }
      });
      
      let amount = "0";
      if (event) {
        const parsed = contract.interface.parseLog({ topics: event.topics as string[], data: event.data });
        amount = ethers.formatEther(parsed?.args?.amount || 0);
      }
      
      return { receipt, amount };
    } catch (error) {
      console.error("releaseVested error:", error);
      throw new BlockchainError(`Failed to release vested tokens for ${beneficiary}`);
    }
  }

  // ==========================================================================
  // EIP-712 Signature Methods
  // ==========================================================================

  /**
   * Create EIP-712 signature for credential issuance
   */
  async signCredentialIssuance(
    recipient: string,
    credentialType: number,
    expiresAt: number,
    tokenURI: string
  ): Promise<string> {
    try {
      const domain = {
        name: "TRCSCredential",
        version: "1",
        chainId: (await this.provider.getNetwork()).chainId,
        verifyingContract: this.config.addresses.credential,
      };

      const types = {
        CredentialIssuance: [
          { name: "recipient", type: "address" },
          { name: "credentialType", type: "uint8" },
          { name: "expiresAt", type: "uint256" },
          { name: "tokenURI", type: "string" },
        ],
      };

      const value = {
        recipient,
        credentialType,
        expiresAt,
        tokenURI,
      };

      return await this.signer.signTypedData(domain, types, value);
    } catch (error) {
      throw new BlockchainError("Failed to sign credential issuance");
    }
  }
}

// Singleton instance
let blockchainServiceInstance: BlockchainService | null = null;

/**
 * Get or create the blockchain service instance
 */
export function getBlockchainService(config?: {
  rpcUrl: string;
  privateKey: string;
  addresses: {
    accessControl: string;
    token: string;
    credential: string;
    rewardDistributor: string;
  };
}): BlockchainService {
  if (!blockchainServiceInstance) {
    if (!config) {
      throw new Error("BlockchainService requires config for initialization");
    }
    blockchainServiceInstance = new BlockchainService(config);
  }
  return blockchainServiceInstance;
}
