/**
 * @file src/routes/tokens.ts
 * @description Token management API routes
 *
 * =============================================================================
 * LEARNING PATH - Token Operations
 * =============================================================================
 *
 * This router provides REST endpoints for:
 * - Getting token information
 * - Checking balances
 * - Minting new tokens (admin only)
 * - Transferring tokens
 *
 * All state-changing operations require authentication and appropriate roles.
 *
 * =============================================================================
 */

import { Router, Request, Response } from "express";
import { asyncHandler } from "../middleware/errorHandler.js";
import {
  validate,
  mintTokensSchema,
  transferTokensSchema,
  addressParamSchema,
} from "../middleware/validation.js";
import { authenticate, requireRole, AuthenticatedRequest } from "../middleware/auth.js";
import { getBlockchainService } from "../services/blockchain.js";
import { logger } from "../utils/logger.js";

const router = Router();

/**
 * GET /tokens/info
 * Get token contract information
 */
router.get(
  "/info",
  asyncHandler(async (req: Request, res: Response) => {
    const blockchain = getBlockchainService();
    const info = await blockchain.getTokenInfo();
    
    res.json({
      success: true,
      data: info,
    });
  })
);

/**
 * GET /tokens/balance/:address
 * Get token balance for an address
 */
router.get(
  "/balance/:address",
  validate(addressParamSchema, "params"),
  asyncHandler(async (req: Request, res: Response) => {
    const { address } = req.params;
    
    const blockchain = getBlockchainService();
    const balance = await blockchain.getTokenBalance(address);
    
    res.json({
      success: true,
      data: {
        address,
        balance,
      },
    });
  })
);

/**
 * POST /tokens/mint
 * Mint new tokens (requires ADMIN role)
 */
router.post(
  "/mint",
  authenticate,
  requireRole("ADMIN"),
  validate(mintTokensSchema),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { to, amount } = req.body;
    
    const blockchain = getBlockchainService();
    const receipt = await blockchain.mintTokens(to, amount);
    
    logger.info("Tokens minted", {
      to,
      amount,
      by: req.user!.address,
      txHash: receipt.hash,
    });
    
    res.json({
      success: true,
      data: {
        message: `Successfully minted ${amount} tokens to ${to}`,
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
      },
    });
  })
);

/**
 * POST /tokens/transfer
 * Transfer tokens (requires authentication)
 */
router.post(
  "/transfer",
  authenticate,
  validate(transferTokensSchema),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { to, amount } = req.body;
    
    const blockchain = getBlockchainService();
    const receipt = await blockchain.transferTokens(to, amount);
    
    logger.info("Tokens transferred", {
      to,
      amount,
      from: req.user!.address,
      txHash: receipt.hash,
    });
    
    res.json({
      success: true,
      data: {
        message: `Successfully transferred ${amount} tokens to ${to}`,
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
      },
    });
  })
);

export default router;
