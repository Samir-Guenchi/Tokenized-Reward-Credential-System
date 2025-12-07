/**
 * @file src/routes/health.ts
 * @description Health check and status routes
 *
 * =============================================================================
 * LEARNING PATH - Health Endpoints
 * =============================================================================
 *
 * Health endpoints are critical for:
 * 1. Kubernetes/Docker health checks
 * 2. Load balancer configuration
 * 3. Monitoring and alerting
 * 4. Deployment verification
 *
 * =============================================================================
 */

import { Router, Request, Response } from "express";
import { asyncHandler } from "../middleware/errorHandler.js";
import { getBlockchainService } from "../services/blockchain.js";
import { getIpfsService } from "../services/ipfs.js";

const router = Router();

/**
 * GET /health
 * Basic health check
 */
router.get("/", (req: Request, res: Response) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

/**
 * GET /health/ready
 * Readiness probe - checks if all dependencies are ready
 */
router.get(
  "/ready",
  asyncHandler(async (req: Request, res: Response) => {
    const checks: Record<string, { status: string; latency?: number }> = {};
    
    // Check blockchain connection
    const blockchainStart = Date.now();
    try {
      const blockchain = getBlockchainService();
      await blockchain.getBlockNumber();
      checks.blockchain = {
        status: "ok",
        latency: Date.now() - blockchainStart,
      };
    } catch {
      checks.blockchain = { status: "error" };
    }
    
    // Check IPFS connection
    const ipfsStart = Date.now();
    try {
      const ipfs = getIpfsService();
      const connected = await ipfs.isConnected();
      checks.ipfs = {
        status: connected ? "ok" : "error",
        latency: Date.now() - ipfsStart,
      };
    } catch {
      checks.ipfs = { status: "error" };
    }
    
    const allHealthy = Object.values(checks).every((c) => c.status === "ok");
    
    res.status(allHealthy ? 200 : 503).json({
      status: allHealthy ? "ready" : "degraded",
      timestamp: new Date().toISOString(),
      checks,
    });
  })
);

/**
 * GET /health/live
 * Liveness probe - checks if the service is alive
 */
router.get("/live", (req: Request, res: Response) => {
  res.json({
    status: "alive",
    timestamp: new Date().toISOString(),
  });
});

export default router;
