/**
 * @file src/middleware/auth.ts
 * @description Authentication and authorization middleware
 *
 * =============================================================================
 * LEARNING PATH - JWT Authentication
 * =============================================================================
 *
 * This middleware provides:
 * 1. JWT token verification
 * 2. Wallet signature verification (Web3 auth)
 * 3. Role-based access control
 *
 * AUTHENTICATION FLOW:
 * 1. User signs message with wallet
 * 2. Backend verifies signature and issues JWT
 * 3. JWT is sent with subsequent requests
 * 4. Middleware verifies JWT and attaches user to request
 *
 * =============================================================================
 */

import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { ethers } from "ethers";
import { UnauthorizedError, ForbiddenError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";

/**
 * User payload stored in JWT
 */
export interface JwtPayload {
  address: string;
  roles: string[];
  iat: number;
  exp: number;
}

/**
 * Extended request with user info
 */
export interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
}

/**
 * JWT configuration
 */
const JWT_SECRET = process.env.JWT_SECRET || "default-secret-change-in-production";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "24h";

/**
 * Generate JWT token for a verified address
 */
export function generateToken(address: string, roles: string[] = []): string {
  return jwt.sign(
    {
      address: address.toLowerCase(),
      roles,
    },
    JWT_SECRET,
    {
      expiresIn: JWT_EXPIRES_IN,
    }
  );
}

/**
 * Verify JWT token and extract payload
 */
export function verifyToken(token: string): JwtPayload {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new UnauthorizedError("Token has expired");
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new UnauthorizedError("Invalid token");
    }
    throw new UnauthorizedError("Token verification failed");
  }
}

/**
 * Extract token from Authorization header
 */
function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") return null;

  return parts[1];
}

/**
 * Authentication middleware
 * Verifies JWT and attaches user to request
 */
export function authenticate(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  try {
    const token = extractToken(req);
    if (!token) {
      throw new UnauthorizedError("No authentication token provided");
    }

    const payload = verifyToken(token);
    req.user = payload;

    logger.debug("User authenticated", {
      address: payload.address,
      roles: payload.roles,
    });

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Optional authentication middleware
 * Attaches user if token present, but doesn't require it
 */
export function optionalAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  try {
    const token = extractToken(req);
    if (token) {
      const payload = verifyToken(token);
      req.user = payload;
    }
    next();
  } catch (error) {
    // Token invalid but optional, continue without user
    next();
  }
}

/**
 * Role authorization middleware factory
 * Requires specific roles to access the route
 */
export function requireRole(...requiredRoles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    try {
      if (!req.user) {
        throw new UnauthorizedError("Authentication required");
      }

      const hasRole = requiredRoles.some((role) => req.user!.roles.includes(role));
      if (!hasRole) {
        throw new ForbiddenError(
          `Required roles: ${requiredRoles.join(", ")}`
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Verify Ethereum signature
 * Used for Web3 authentication
 */
export function verifySignature(
  message: string,
  signature: string,
  expectedAddress: string
): boolean {
  try {
    const recoveredAddress = ethers.verifyMessage(message, signature);
    return recoveredAddress.toLowerCase() === expectedAddress.toLowerCase();
  } catch (error) {
    return false;
  }
}

/**
 * Generate authentication message for wallet signing
 */
export function generateAuthMessage(address: string, nonce: string): string {
  return `Welcome to TRCS!

Please sign this message to authenticate.

Wallet: ${address}
Nonce: ${nonce}
Timestamp: ${new Date().toISOString()}

This signature will not trigger any blockchain transaction or cost any gas fees.`;
}

/**
 * Nonce storage (in production, use Redis or database)
 */
const nonceStore = new Map<string, { nonce: string; expires: number }>();

/**
 * Generate and store a nonce for an address
 */
export function generateNonce(address: string): string {
  const nonce = ethers.hexlify(ethers.randomBytes(16));
  nonceStore.set(address.toLowerCase(), {
    nonce,
    expires: Date.now() + 5 * 60 * 1000, // 5 minutes
  });
  return nonce;
}

/**
 * Verify and consume a nonce
 */
export function verifyNonce(address: string, nonce: string): boolean {
  const stored = nonceStore.get(address.toLowerCase());
  if (!stored) return false;
  if (Date.now() > stored.expires) {
    nonceStore.delete(address.toLowerCase());
    return false;
  }
  if (stored.nonce !== nonce) return false;
  
  // Consume nonce (one-time use)
  nonceStore.delete(address.toLowerCase());
  return true;
}
