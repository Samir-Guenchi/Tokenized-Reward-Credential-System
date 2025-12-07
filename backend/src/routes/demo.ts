/**
 * @file src/routes/demo.ts
 * @description Demo-only API routes for showcasing the TRCS system
 * 
 * ⚠️ WARNING: These endpoints are for DEMO/DEVELOPMENT ONLY!
 * They bypass authentication and should NEVER be used in production.
 * 
 * These endpoints allow the frontend demo to:
 * - Issue credentials without authentication
 * - Create vesting schedules without authentication
 * - Transfer tokens for demo purposes
 */

import { Router, Request, Response } from "express";
import { asyncHandler } from "../middleware/errorHandler.js";
import { getBlockchainService } from "../services/blockchain.js";
import { logger } from "../utils/logger.js";
import { ethers } from "ethers";

const router = Router();

// Check if demo mode is enabled (only on localhost/development)
const isDemoEnabled = () => {
  const nodeEnv = process.env.NODE_ENV || 'development';
  return nodeEnv === 'development' || nodeEnv === 'test';
};

/**
 * POST /demo/reward
 * Issue tokens directly to an address for demo purposes
 */
router.post(
  "/reward",
  asyncHandler(async (req: Request, res: Response) => {
    if (!isDemoEnabled()) {
      return res.status(403).json({
        success: false,
        error: "Demo endpoints are disabled in production",
      });
    }

    const { recipient, amount, reason } = req.body;

    if (!recipient || !ethers.isAddress(recipient)) {
      return res.status(400).json({
        success: false,
        error: "Valid recipient address required",
      });
    }

    const tokenAmount = amount || "100"; // Default 100 TRCS

    try {
      const blockchain = getBlockchainService();
      const receipt = await blockchain.transferTokens(recipient, tokenAmount);

      logger.info("Demo reward sent", {
        recipient,
        amount: tokenAmount,
        reason: reason || "Demo course completion",
        txHash: receipt.hash,
      });

      res.json({
        success: true,
        data: {
          message: `Successfully sent ${tokenAmount} TRCS to ${recipient}`,
          recipient,
          amount: tokenAmount,
          reason: reason || "Demo course completion",
          transactionHash: receipt.hash,
          blockNumber: receipt.blockNumber,
        },
      });
    } catch (error: any) {
      logger.error("Demo reward failed", { error: error.message, recipient });
      res.status(500).json({
        success: false,
        error: error.message || "Failed to send demo reward",
      });
    }
  })
);

/**
 * POST /demo/credential
 * Issue a credential NFT for demo purposes
 */
router.post(
  "/credential",
  asyncHandler(async (req: Request, res: Response) => {
    if (!isDemoEnabled()) {
      return res.status(403).json({
        success: false,
        error: "Demo endpoints are disabled in production",
      });
    }

    const { recipient, courseName, credentialType } = req.body;

    if (!recipient || !ethers.isAddress(recipient)) {
      return res.status(400).json({
        success: false,
        error: "Valid recipient address required",
      });
    }

    try {
      const blockchain = getBlockchainService();
      
      // Create demo credential URI
      const uri = `https://trcs.demo/credentials/${courseName?.replace(/\s+/g, '-').toLowerCase() || 'demo-course'}`;
      
      // Get the credential type hash
      const typeHash = ethers.keccak256(ethers.toUtf8Bytes(credentialType || "COURSE_COMPLETION"));
      const dataHash = ethers.keccak256(ethers.toUtf8Bytes(`${courseName || 'Demo Course'} - ${recipient}`));
      
      const receipt = await blockchain.issueCredential(
        recipient,
        uri,
        typeHash,
        0, // No expiration
        dataHash
      );

      logger.info("Demo credential issued", {
        recipient,
        courseName: courseName || "Demo Course",
        txHash: receipt.hash,
      });

      res.json({
        success: true,
        data: {
          message: `Credential issued to ${recipient}`,
          recipient,
          courseName: courseName || "Demo Course",
          credentialType: credentialType || "COURSE_COMPLETION",
          transactionHash: receipt.hash,
          blockNumber: receipt.blockNumber,
        },
      });
    } catch (error: any) {
      logger.error("Demo credential failed", { error: error.message, recipient });
      res.status(500).json({
        success: false,
        error: error.message || "Failed to issue demo credential",
      });
    }
  })
);

/**
 * POST /demo/vesting
 * Create a vesting schedule for demo purposes
 */
router.post(
  "/vesting",
  asyncHandler(async (req: Request, res: Response) => {
    if (!isDemoEnabled()) {
      return res.status(403).json({
        success: false,
        error: "Demo endpoints are disabled in production",
      });
    }

    const { beneficiary, amount, cliffSeconds, vestingSeconds } = req.body;

    if (!beneficiary || !ethers.isAddress(beneficiary)) {
      return res.status(400).json({
        success: false,
        error: "Valid beneficiary address required",
      });
    }

    const tokenAmount = amount || "100";
    const cliff = cliffSeconds || 0;
    const vesting = vestingSeconds || 60; // 1 minute default

    try {
      const blockchain = getBlockchainService();
      
      // First approve tokens for the distributor
      await blockchain.approveTokensForVesting(tokenAmount);
      
      const receipt = await blockchain.createVestingSchedule(
        beneficiary,
        tokenAmount,
        cliff,
        vesting,
        false // not revocable
      );

      logger.info("Demo vesting created", {
        beneficiary,
        amount: tokenAmount,
        cliff,
        vesting,
        txHash: receipt.hash,
      });

      res.json({
        success: true,
        data: {
          message: `Vesting schedule created for ${beneficiary}`,
          beneficiary,
          amount: tokenAmount,
          cliffSeconds: cliff,
          vestingSeconds: vesting,
          transactionHash: receipt.hash,
          blockNumber: receipt.blockNumber,
        },
      });
    } catch (error: any) {
      // Check if vesting already exists
      if (error.message?.includes("VestingAlreadyExists")) {
        return res.status(400).json({
          success: false,
          error: "Vesting schedule already exists for this address. Try claiming existing tokens first.",
        });
      }
      
      logger.error("Demo vesting failed", { error: error.message, beneficiary });
      res.status(500).json({
        success: false,
        error: error.message || "Failed to create demo vesting",
      });
    }
  })
);

/**
 * POST /demo/claim
 * Claim vested tokens for demo purposes
 */
router.post(
  "/claim",
  asyncHandler(async (req: Request, res: Response) => {
    if (!isDemoEnabled()) {
      return res.status(403).json({
        success: false,
        error: "Demo endpoints are disabled in production",
      });
    }

    const { address } = req.body;

    if (!address || !ethers.isAddress(address)) {
      return res.status(400).json({
        success: false,
        error: "Valid address required",
      });
    }

    try {
      const blockchain = getBlockchainService();
      
      // Check claimable amount first
      const claimable = await blockchain.getReleasableAmount(address);
      
      if (parseFloat(claimable) === 0) {
        return res.status(400).json({
          success: false,
          error: "No tokens available to claim yet. Vesting cliff may not have passed.",
        });
      }
      
      const result = await blockchain.releaseVested(address);

      logger.info("Demo tokens claimed", {
        address,
        amount: result.amount,
        txHash: result.receipt.hash,
      });

      res.json({
        success: true,
        data: {
          message: `Successfully claimed ${result.amount} TRCS`,
          address,
          amountClaimed: result.amount,
          transactionHash: result.receipt.hash,
          blockNumber: result.receipt.blockNumber,
        },
      });
    } catch (error: any) {
      logger.error("Demo claim failed", { error: error.message, address });
      res.status(500).json({
        success: false,
        error: error.message || "Failed to claim tokens",
      });
    }
  })
);

/**
 * GET /demo/status
 * Check demo mode status and show available endpoints
 */
router.get(
  "/status",
  asyncHandler(async (_req: Request, res: Response) => {
    res.json({
      success: true,
      data: {
        demoEnabled: isDemoEnabled(),
        environment: process.env.NODE_ENV || 'development',
        endpoints: isDemoEnabled() ? [
          "POST /demo/reward - Send tokens to an address",
          "POST /demo/credential - Issue a credential NFT",
          "POST /demo/vesting - Create a vesting schedule",
          "POST /demo/claim - Claim vested tokens",
        ] : [],
        message: isDemoEnabled() 
          ? "Demo mode is enabled. These endpoints bypass authentication."
          : "Demo mode is disabled in production.",
      },
    });
  })
);

export default router;
