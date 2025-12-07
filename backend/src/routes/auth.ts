/**
 * @file src/routes/auth.ts
 * @description Authentication routes for Web3 login
 *
 * =============================================================================
 * LEARNING PATH - Web3 Authentication
 * =============================================================================
 *
 * How Web3 auth works:
 * 1. Client requests a nonce for their wallet address
 * 2. Client signs the message containing the nonce
 * 3. Server verifies signature and issues JWT
 * 4. Client uses JWT for subsequent requests
 *
 * Why this is secure:
 * - Nonces are single-use and time-limited
 * - Signatures prove wallet ownership
 * - No passwords to leak
 *
 * =============================================================================
 */

import { Router, Request, Response } from "express";
import { asyncHandler } from "../middleware/errorHandler.js";
import { validate, nonceRequestSchema, verifySignatureSchema } from "../middleware/validation.js";
import {
  generateNonce,
  verifyNonce,
  generateAuthMessage,
  verifySignature,
  generateToken,
  authenticate,
  AuthenticatedRequest,
} from "../middleware/auth.js";
import { BadRequestError, UnauthorizedError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";
import { getBlockchainService } from "../services/blockchain.js";

const router = Router();

/**
 * GET /auth/nonce
 * Request a nonce for signing
 */
router.get(
  "/nonce",
  validate(nonceRequestSchema, "query"),
  asyncHandler(async (req: Request, res: Response) => {
    const { address } = req.query as { address: string };
    
    // Generate nonce
    const nonce = generateNonce(address);
    
    // Generate message to sign
    const message = generateAuthMessage(address, nonce);
    
    logger.debug("Nonce generated", { address });
    
    res.json({
      success: true,
      data: {
        message,
        nonce,
      },
    });
  })
);

/**
 * POST /auth/verify
 * Verify signature and issue JWT
 */
router.post(
  "/verify",
  validate(verifySignatureSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { address, signature, nonce } = req.body;
    
    // Verify nonce
    if (!verifyNonce(address, nonce)) {
      throw new BadRequestError("Invalid or expired nonce");
    }
    
    // Reconstruct message
    const message = generateAuthMessage(address, nonce);
    
    // Verify signature
    if (!verifySignature(message, signature, address)) {
      throw new UnauthorizedError("Invalid signature");
    }
    
    // Check on-chain roles
    const blockchain = getBlockchainService();
    const roles: string[] = [];
    
    try {
      // Role hashes (would be fetched from contract in production)
      const ADMIN_ROLE = "0xa49807205ce4d355092ef5a8a18f56e8913cf4a201fbe287825b095693c21775";
      const ISSUER_ROLE = "0x114e74f6ea3bd819998f78687bfcb11b140da08e9b7d222fa9c1f1ba1f2aa122";
      
      const [isAdmin, isIssuer] = await Promise.all([
        blockchain.hasRole(ADMIN_ROLE, address),
        blockchain.hasRole(ISSUER_ROLE, address),
      ]);
      
      if (isAdmin) roles.push("ADMIN");
      if (isIssuer) roles.push("ISSUER");
    } catch (error) {
      // Roles optional, continue without them
      logger.warn("Failed to fetch on-chain roles", { address, error });
    }
    
    // Generate JWT
    const token = generateToken(address, roles);
    
    logger.info("User authenticated", { address, roles });
    
    res.json({
      success: true,
      data: {
        token,
        address,
        roles,
        expiresIn: process.env.JWT_EXPIRES_IN || "24h",
      },
    });
  })
);

/**
 * GET /auth/me
 * Get current user info
 */
router.get(
  "/me",
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { address, roles } = req.user!;
    
    const blockchain = getBlockchainService();
    const [ethBalance, tokenBalance] = await Promise.all([
      blockchain.getBalance(address),
      blockchain.getTokenBalance(address),
    ]);
    
    res.json({
      success: true,
      data: {
        address,
        roles,
        balances: {
          eth: ethBalance,
          token: tokenBalance,
        },
      },
    });
  })
);

export default router;
