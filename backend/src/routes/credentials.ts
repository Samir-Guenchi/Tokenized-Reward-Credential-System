/**
 * @file src/routes/credentials.ts
 * @description Credential NFT management API routes
 *
 * =============================================================================
 * LEARNING PATH - Credential Operations
 * =============================================================================
 *
 * This router provides REST endpoints for:
 * - Getting credential information
 * - Issuing new credentials (with IPFS metadata)
 * - Revoking credentials
 * - Verifying credentials
 *
 * CREDENTIAL FLOW:
 * 1. Issuer submits credential data
 * 2. Backend uploads metadata to IPFS
 * 3. Backend signs EIP-712 issuance request
 * 4. Transaction is sent to mint the NFT
 * 5. Credential can be verified on-chain
 *
 * =============================================================================
 */

import { Router, Request, Response } from "express";
import { asyncHandler } from "../middleware/errorHandler.js";
import {
  validate,
  issueCredentialSchema,
  revokeCredentialSchema,
  addressParamSchema,
  tokenIdParamSchema,
} from "../middleware/validation.js";
import { authenticate, requireRole, AuthenticatedRequest } from "../middleware/auth.js";
import { getBlockchainService } from "../services/blockchain.js";
import { getIpfsService, CredentialMetadata } from "../services/ipfs.js";
import { logger } from "../utils/logger.js";
import { NotFoundError } from "../utils/errors.js";

const router = Router();

/**
 * Credential type names for metadata
 */
const CREDENTIAL_TYPES: Record<number, string> = {
  0: "COURSE_COMPLETION",
  1: "SKILL_CERTIFICATION",
  2: "ACHIEVEMENT_BADGE",
  3: "MEMBERSHIP",
  4: "CUSTOM",
};

/**
 * GET /credentials/:tokenId
 * Get credential information by token ID
 */
router.get(
  "/:tokenId",
  validate(tokenIdParamSchema, "params"),
  asyncHandler(async (req: Request, res: Response) => {
    const tokenId = parseInt(req.params.tokenId, 10);
    
    const blockchain = getBlockchainService();
    const ipfs = getIpfsService();
    
    try {
      const credentialInfo = await blockchain.getCredentialInfo(tokenId);
      
      // Fetch metadata from IPFS if available
      let metadata: CredentialMetadata | null = null;
      if (credentialInfo.tokenURI.startsWith("ipfs://")) {
        const cid = credentialInfo.tokenURI.replace("ipfs://", "");
        try {
          metadata = await ipfs.getMetadata(cid);
        } catch {
          // Metadata fetch failed, continue without it
        }
      }
      
      res.json({
        success: true,
        data: {
          tokenId,
          ...credentialInfo,
          typeName: CREDENTIAL_TYPES[credentialInfo.credentialType] || "UNKNOWN",
          metadata,
          gatewayUrl: credentialInfo.tokenURI.startsWith("ipfs://")
            ? ipfs.getGatewayUrl(credentialInfo.tokenURI.replace("ipfs://", ""))
            : credentialInfo.tokenURI,
        },
      });
    } catch (error) {
      throw new NotFoundError(`Credential ${tokenId}`);
    }
  })
);

/**
 * GET /credentials/owner/:address
 * Get credentials owned by an address
 */
router.get(
  "/owner/:address",
  validate(addressParamSchema, "params"),
  asyncHandler(async (req: Request, res: Response) => {
    const { address } = req.params;
    
    const blockchain = getBlockchainService();
    const balance = await blockchain.getCredentialBalance(address);
    
    res.json({
      success: true,
      data: {
        address,
        credentialCount: balance,
        // Note: Getting all token IDs would require indexer or event scanning
      },
    });
  })
);

/**
 * GET /credentials/:tokenId/verify
 * Verify if a credential is valid
 */
router.get(
  "/:tokenId/verify",
  validate(tokenIdParamSchema, "params"),
  asyncHandler(async (req: Request, res: Response) => {
    const tokenId = parseInt(req.params.tokenId, 10);
    
    const blockchain = getBlockchainService();
    
    try {
      const credentialInfo = await blockchain.getCredentialInfo(tokenId);
      
      res.json({
        success: true,
        data: {
          tokenId,
          isValid: credentialInfo.isValid,
          owner: credentialInfo.owner,
          credentialType: CREDENTIAL_TYPES[credentialInfo.credentialType] || "UNKNOWN",
          metadata: {
            issuer: credentialInfo.metadata.issuer,
            issuedAt: new Date(credentialInfo.metadata.issuedAt * 1000).toISOString(),
            expiresAt: new Date(credentialInfo.metadata.expiresAt * 1000).toISOString(),
            revoked: credentialInfo.metadata.revoked,
          },
        },
      });
    } catch (error) {
      throw new NotFoundError(`Credential ${tokenId}`);
    }
  })
);

/**
 * POST /credentials/issue
 * Issue a new credential (requires ISSUER role)
 */
router.post(
  "/issue",
  authenticate,
  requireRole("ISSUER", "ADMIN"),
  validate(issueCredentialSchema),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { recipient, credentialType, expiresAt, name, description, attributes } = req.body;
    
    const blockchain = getBlockchainService();
    const ipfs = getIpfsService();
    
    // Build metadata
    const metadata: CredentialMetadata = {
      name,
      description,
      attributes: attributes || [],
      credentialType,
      issuer: req.user!.address,
      issuedAt: Math.floor(Date.now() / 1000),
      expiresAt,
      recipient,
    };
    
    // Upload metadata to IPFS
    const cid = await ipfs.storeMetadata(metadata);
    const tokenURI = ipfs.getIpfsUri(cid);
    
    // Create EIP-712 signature for credential issuance
    const signature = await blockchain.signCredentialIssuance(
      recipient,
      credentialType,
      expiresAt,
      tokenURI
    );
    
    logger.info("Credential issuance prepared", {
      recipient,
      credentialType: CREDENTIAL_TYPES[credentialType],
      cid,
      by: req.user!.address,
    });
    
    // Return signature for client-side transaction
    // The actual minting happens when the user submits the tx
    res.json({
      success: true,
      data: {
        message: "Credential issuance prepared",
        credential: {
          recipient,
          credentialType,
          typeName: CREDENTIAL_TYPES[credentialType] || "CUSTOM",
          expiresAt: new Date(expiresAt * 1000).toISOString(),
          tokenURI,
          gatewayUrl: ipfs.getGatewayUrl(cid),
        },
        signature,
        // Include call data for client to submit transaction
        callData: {
          to: blockchain.getSignerAddress(), // Credential contract address
          method: "issueCredential",
          args: [recipient, credentialType, expiresAt, tokenURI, signature],
        },
      },
    });
  })
);

/**
 * POST /credentials/revoke
 * Revoke a credential (requires ISSUER role)
 */
router.post(
  "/revoke",
  authenticate,
  requireRole("ISSUER", "ADMIN"),
  validate(revokeCredentialSchema),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { tokenId, reason } = req.body;
    
    const blockchain = getBlockchainService();
    const receipt = await blockchain.revokeCredential(tokenId, reason);
    
    logger.info("Credential revoked", {
      tokenId,
      reason,
      by: req.user!.address,
      txHash: receipt.hash,
    });
    
    res.json({
      success: true,
      data: {
        message: `Credential ${tokenId} has been revoked`,
        reason,
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
      },
    });
  })
);

export default router;
