/**
 * @file src/middleware/validation.ts
 * @description Request validation middleware using Zod
 *
 * =============================================================================
 * LEARNING PATH - Input Validation
 * =============================================================================
 *
 * Why validation is critical:
 * 1. Prevents invalid data from reaching business logic
 * 2. Protects against injection attacks
 * 3. Provides clear error messages
 * 4. Documents expected input format
 *
 * =============================================================================
 */

import { Request, Response, NextFunction } from "express";
import { z, ZodSchema, ZodError } from "zod";
import { ValidationError } from "../utils/errors.js";

/**
 * Create validation middleware from a Zod schema
 */
export function validate<T extends ZodSchema>(
  schema: T,
  source: "body" | "query" | "params" = "body"
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const data = req[source];
      const parsed = schema.parse(data);
      
      // Replace with parsed/transformed data
      (req as Record<string, unknown>)[source] = parsed;
      
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const details = error.errors.reduce((acc, err) => {
          const path = err.path.join(".");
          acc[path] = err.message;
          return acc;
        }, {} as Record<string, string>);

        next(new ValidationError("Validation failed", details));
      } else {
        next(error);
      }
    }
  };
}

// =============================================================================
// Common Validation Schemas
// =============================================================================

/**
 * Ethereum address validation
 */
export const ethereumAddress = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address");

/**
 * Transaction hash validation
 */
export const transactionHash = z
  .string()
  .regex(/^0x[a-fA-F0-9]{64}$/, "Invalid transaction hash");

/**
 * IPFS CID validation
 */
export const ipfsCid = z
  .string()
  .regex(/^Qm[a-zA-Z0-9]{44}$|^bafy[a-zA-Z0-9]{55}$/, "Invalid IPFS CID");

/**
 * Positive amount (for tokens)
 */
export const positiveAmount = z
  .string()
  .regex(/^\d+(\.\d+)?$/, "Must be a positive number")
  .refine((val) => parseFloat(val) > 0, "Amount must be greater than 0");

/**
 * Pagination parameters
 */
export const paginationSchema = z.object({
  page: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 1)),
  limit: z.string().optional().transform((val) => Math.min(val ? parseInt(val, 10) : 20, 100)),
});

// =============================================================================
// API Request Schemas
// =============================================================================

/**
 * Auth: Request nonce
 */
export const nonceRequestSchema = z.object({
  address: ethereumAddress,
});

/**
 * Auth: Verify signature
 */
export const verifySignatureSchema = z.object({
  address: ethereumAddress,
  signature: z.string().min(130).max(132),
  nonce: z.string().min(1),
});

/**
 * Token: Mint tokens
 */
export const mintTokensSchema = z.object({
  to: ethereumAddress,
  amount: positiveAmount,
});

/**
 * Token: Transfer tokens
 */
export const transferTokensSchema = z.object({
  to: ethereumAddress,
  amount: positiveAmount,
});

/**
 * Credential: Issue credential
 */
export const issueCredentialSchema = z.object({
  recipient: ethereumAddress,
  credentialType: z.number().int().min(0).max(255),
  expiresAt: z.number().int().positive(),
  name: z.string().min(1).max(100),
  description: z.string().min(1).max(1000),
  attributes: z.array(
    z.object({
      trait_type: z.string(),
      value: z.union([z.string(), z.number()]),
    })
  ).optional(),
});

/**
 * Credential: Revoke credential
 */
export const revokeCredentialSchema = z.object({
  tokenId: z.number().int().positive(),
  reason: z.string().min(1).max(500),
});

/**
 * Reward: Create vesting schedule
 */
export const createVestingSchema = z.object({
  beneficiary: ethereumAddress,
  totalAmount: positiveAmount,
  startTime: z.number().int().positive(),
  cliffDuration: z.number().int().min(0),
  duration: z.number().int().positive(),
});

/**
 * Address parameter
 */
export const addressParamSchema = z.object({
  address: ethereumAddress,
});

/**
 * Token ID parameter
 */
export const tokenIdParamSchema = z.object({
  tokenId: z.string().transform((val) => parseInt(val, 10)),
});
