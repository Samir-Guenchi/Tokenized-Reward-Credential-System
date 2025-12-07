/**
 * @file src/routes/rewards.ts
 * @description Reward distribution API routes
 *
 * =============================================================================
 * LEARNING PATH - Reward Distribution
 * =============================================================================
 *
 * This router provides REST endpoints for:
 * - Getting distribution statistics
 * - Creating vesting schedules
 * - Checking claimable amounts
 * - Managing Merkle tree airdrops
 *
 * VESTING MECHANICS:
 * - Tokens are locked and released over time
 * - Cliff period: no tokens released
 * - Linear vesting: tokens release proportionally
 * - Beneficiaries can claim released tokens
 *
 * =============================================================================
 */

import { Router, Request, Response } from "express";
import { asyncHandler } from "../middleware/errorHandler.js";
import {
  validate,
  createVestingSchema,
  addressParamSchema,
} from "../middleware/validation.js";
import { authenticate, requireRole, AuthenticatedRequest } from "../middleware/auth.js";
import { getBlockchainService } from "../services/blockchain.js";
import { logger } from "../utils/logger.js";

const router = Router();

/**
 * GET /rewards/stats
 * Get reward distribution statistics
 */
router.get(
  "/stats",
  asyncHandler(async (req: Request, res: Response) => {
    const blockchain = getBlockchainService();
    const info = await blockchain.getDistributorInfo();
    
    res.json({
      success: true,
      data: {
        tokenAddress: info.tokenAddress,
        totalVestingLocked: info.totalVestingLocked,
        totalDistributionReserved: info.totalDistributionReserved,
        totalLocked: (
          parseFloat(info.totalVestingLocked) + parseFloat(info.totalDistributionReserved)
        ).toFixed(18),
      },
    });
  })
);

/**
 * GET /rewards/vesting/:address
 * Get vesting schedule for an address
 */
router.get(
  "/vesting/:address",
  validate(addressParamSchema, "params"),
  asyncHandler(async (req: Request, res: Response) => {
    const { address } = req.params;
    
    const blockchain = getBlockchainService();
    const schedule = await blockchain.getVestingSchedule(address);
    
    // Calculate vesting progress
    const now = Math.floor(Date.now() / 1000);
    const vestingEnd = schedule.startTime + schedule.vestingDuration;
    const cliffEnd = schedule.startTime + schedule.cliffDuration;
    
    let progressPercent = 0;
    if (now >= vestingEnd) {
      progressPercent = 100;
    } else if (now > schedule.startTime) {
      progressPercent = Math.min(
        100,
        ((now - schedule.startTime) / schedule.vestingDuration) * 100
      );
    }
    
    res.json({
      success: true,
      data: {
        address,
        schedule: {
          totalAmount: schedule.totalAmount,
          startTime: new Date(schedule.startTime * 1000).toISOString(),
          cliffEnd: new Date(cliffEnd * 1000).toISOString(),
          vestingEnd: new Date(vestingEnd * 1000).toISOString(),
          vestingDuration: schedule.vestingDuration,
          cliffDuration: schedule.cliffDuration,
          releasedAmount: schedule.releasedAmount,
          releasable: schedule.releasable,
          revoked: schedule.revoked,
        },
        progress: {
          percent: progressPercent.toFixed(2),
          isCliffPassed: now >= cliffEnd,
          isFullyVested: now >= vestingEnd,
        },
      },
    });
  })
);

/**
 * POST /rewards/vesting
 * Create a new vesting schedule (requires ADMIN role)
 */
router.post(
  "/vesting",
  authenticate,
  requireRole("ADMIN"),
  validate(createVestingSchema),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { beneficiary, totalAmount, cliffDuration, vestingDuration, revocable } = req.body;
    
    const blockchain = getBlockchainService();
    const receipt = await blockchain.createVestingSchedule(
      beneficiary,
      totalAmount,
      cliffDuration,
      vestingDuration,
      revocable || false
    );
    
    const startTime = Math.floor(Date.now() / 1000);
    
    logger.info("Vesting schedule created", {
      beneficiary,
      totalAmount,
      vestingDuration,
      by: req.user!.address,
      txHash: receipt.hash,
    });
    
    res.json({
      success: true,
      data: {
        message: `Vesting schedule created for ${beneficiary}`,
        schedule: {
          beneficiary,
          totalAmount,
          startTime: new Date(startTime * 1000).toISOString(),
          cliffEnd: new Date((startTime + cliffDuration) * 1000).toISOString(),
          vestingEnd: new Date((startTime + vestingDuration) * 1000).toISOString(),
        },
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
      },
    });
  })
);

/**
 * GET /rewards/claimable/:address
 * Get claimable amount for an address
 */
router.get(
  "/claimable/:address",
  validate(addressParamSchema, "params"),
  asyncHandler(async (req: Request, res: Response) => {
    const { address } = req.params;
    
    const blockchain = getBlockchainService();
    const schedule = await blockchain.getVestingSchedule(address);
    
    res.json({
      success: true,
      data: {
        address,
        releasable: schedule.releasable,
        releasedAmount: schedule.releasedAmount,
        total: schedule.totalAmount,
      },
    });
  })
);

/**
 * POST /rewards/claim
 * Claim/release vested tokens for an address
 */
router.post(
  "/claim",
  asyncHandler(async (req: Request, res: Response) => {
    const { address } = req.body;
    
    if (!address) {
      res.status(400).json({
        success: false,
        error: "Address is required",
      });
      return;
    }
    
    const blockchain = getBlockchainService();
    
    // First check if there's anything to claim
    const schedule = await blockchain.getVestingSchedule(address);
    if (parseFloat(schedule.releasable) === 0) {
      res.status(400).json({
        success: false,
        error: "No tokens available to claim",
      });
      return;
    }
    
    // Release the tokens
    const { receipt, amount } = await blockchain.releaseVested(address);
    
    logger.info("Vested tokens claimed", {
      beneficiary: address,
      amount,
      txHash: receipt.hash,
    });
    
    res.json({
      success: true,
      data: {
        message: `Successfully claimed ${amount} TRCS`,
        address,
        amount,
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
      },
    });
  })
);

export default router;
