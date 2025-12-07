/**
 * @file src/services/ipfs.ts
 * @description IPFS service for metadata storage (Mock implementation)
 *
 * =============================================================================
 * LEARNING PATH - IPFS Integration
 * =============================================================================
 *
 * Why IPFS?
 * 1. Decentralized storage - no single point of failure
 * 2. Content-addressed - data integrity guaranteed by hash
 * 3. Immutable - once stored, content cannot be changed
 * 4. Perfect for NFT metadata and credential data
 *
 * NOTE: This is a mock implementation for development.
 * In production, you would use a real IPFS node or service like Pinata.
 *
 * =============================================================================
 */

import { createHash } from "crypto";
import { logger } from "../utils/logger.js";
import { IpfsError } from "../utils/errors.js";

/**
 * Credential metadata structure
 */
export interface CredentialMetadata {
  name: string;
  description: string;
  image?: string;
  attributes: Array<{
    trait_type: string;
    value: string | number;
  }>;
  credentialType: number;
  issuer: string;
  issuedAt: number;
  expiresAt: number;
  recipient: string;
  additionalData?: Record<string, unknown>;
}

/**
 * IPFS Service Class (Mock Implementation)
 * 
 * This mock stores data in memory and generates fake CIDs.
 * For production, integrate with a real IPFS node or Pinata.
 */
export class IpfsService {
  private gateway: string;
  private storage: Map<string, Buffer> = new Map();
  private config: {
    host: string;
    port: number;
    protocol: string;
  };

  constructor(config: { host: string; port: number; protocol: string; gateway: string }) {
    this.config = {
      host: config.host,
      port: config.port,
      protocol: config.protocol,
    };
    this.gateway = config.gateway;
    logger.info("IPFS service initialized (mock mode)", this.config);
  }

  /**
   * Generate a mock CID from content
   */
  private generateCid(content: Buffer | string): string {
    const hash = createHash("sha256")
      .update(content)
      .digest("hex");
    // Generate a CIDv1-like string (not a real CID but looks similar)
    return `bafybeig${hash.substring(0, 52)}`;
  }

  /**
   * Store JSON metadata on IPFS (mock)
   */
  async storeMetadata(metadata: CredentialMetadata): Promise<string> {
    try {
      const json = JSON.stringify(metadata, null, 2);
      const buffer = Buffer.from(json);
      const cid = this.generateCid(buffer);
      
      this.storage.set(cid, buffer);
      
      logger.info("Metadata stored (mock IPFS)", {
        cid,
        name: metadata.name,
      });

      return cid;
    } catch (error) {
      throw new IpfsError("Failed to store metadata");
    }
  }

  /**
   * Store a file on IPFS (mock)
   */
  async storeFile(buffer: Buffer, filename: string): Promise<string> {
    try {
      const cid = this.generateCid(buffer);
      
      this.storage.set(cid, buffer);

      logger.info("File stored (mock IPFS)", {
        cid,
        filename,
        size: buffer.length,
      });

      return cid;
    } catch (error) {
      throw new IpfsError("Failed to store file");
    }
  }

  /**
   * Get content from IPFS by CID (mock)
   */
  async getContent(cid: string): Promise<Buffer> {
    const content = this.storage.get(cid);
    if (!content) {
      throw new IpfsError(`Content not found: ${cid}`);
    }
    return content;
  }

  /**
   * Get JSON metadata from IPFS (mock)
   */
  async getMetadata(cid: string): Promise<CredentialMetadata> {
    const content = await this.getContent(cid);
    try {
      return JSON.parse(content.toString()) as CredentialMetadata;
    } catch (error) {
      throw new IpfsError("Failed to parse content as JSON");
    }
  }

  /**
   * Get the full IPFS URI for a CID
   */
  getIpfsUri(cid: string): string {
    return `ipfs://${cid}`;
  }

  /**
   * Get the gateway URL for a CID
   */
  getGatewayUrl(cid: string): string {
    return `${this.gateway}/${cid}`;
  }

  /**
   * Pin content to keep it available (mock - no-op)
   */
  async pin(cid: string): Promise<void> {
    logger.info("Content pinned (mock)", { cid });
  }

  /**
   * Unpin content (mock - no-op)
   */
  async unpin(cid: string): Promise<void> {
    this.storage.delete(cid);
    logger.info("Content unpinned (mock)", { cid });
  }

  /**
   * Check if connected to IPFS (mock - always true)
   */
  async isConnected(): Promise<boolean> {
    return true;
  }
}

// Singleton instance
let ipfsServiceInstance: IpfsService | null = null;

/**
 * Get or create the IPFS service instance
 */
export function getIpfsService(config?: {
  host: string;
  port: number;
  protocol: string;
  gateway: string;
}): IpfsService {
  if (!ipfsServiceInstance) {
    if (!config) {
      throw new Error("IpfsService requires config for initialization");
    }
    ipfsServiceInstance = new IpfsService(config);
  }
  return ipfsServiceInstance;
}
