/**
 * @file src/config/index.ts
 * @description Centralized configuration management for the TRCS backend
 *
 * =============================================================================
 * LEARNING PATH - Configuration Management
 * =============================================================================
 *
 * Why centralized configuration?
 * 1. Single source of truth for all settings
 * 2. Type-safe access to environment variables
 * 3. Validation at startup (fail fast)
 * 4. Easy to mock in tests
 *
 * SECURITY BEST PRACTICES:
 * - Never log sensitive values
 * - Use environment variables, not hardcoded values
 * - Validate all inputs
 * - Provide sensible defaults where safe
 *
 * =============================================================================
 */

import { z } from "zod";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

/**
 * Environment variable schema using Zod for validation
 * This ensures all required values are present and correctly typed
 */
const envSchema = z.object({
  // Server
  PORT: z.string().default("3001").transform(Number),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  HOST: z.string().default("0.0.0.0"),

  // Blockchain
  RPC_URL: z.string().url().default("http://127.0.0.1:8545"),
  CHAIN_ID: z.string().default("31337").transform(Number),
  PRIVATE_KEY: z.string().min(64),

  // Contract Addresses
  ACCESS_CONTROL_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  TOKEN_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  CREDENTIAL_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  REWARD_DISTRIBUTOR_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/),

  // IPFS
  IPFS_HOST: z.string().default("localhost"),
  IPFS_PORT: z.string().default("5001").transform(Number),
  IPFS_PROTOCOL: z.enum(["http", "https"]).default("http"),
  IPFS_GATEWAY: z.string().url().default("https://ipfs.io/ipfs"),

  // JWT
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default("24h"),

  // Redis (optional)
  REDIS_URL: z.string().optional().refine(val => !val || val.startsWith('redis://'), {
    message: 'REDIS_URL must be a valid redis:// URL or empty'
  }),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.string().default("900000").transform(Number),
  RATE_LIMIT_MAX_REQUESTS: z.string().default("100").transform(Number),

  // Logging
  LOG_LEVEL: z.enum(["error", "warn", "info", "debug"]).default("info"),
  LOG_FORMAT: z.enum(["combined", "common", "dev", "short", "tiny"]).default("combined"),

  // CORS
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
});

/**
 * Parse and validate environment variables
 * Will throw an error at startup if configuration is invalid
 */
function loadConfig() {
  try {
    const parsed = envSchema.parse(process.env);
    return {
      server: {
        port: parsed.PORT,
        env: parsed.NODE_ENV,
        host: parsed.HOST,
        isDev: parsed.NODE_ENV === "development",
        isProd: parsed.NODE_ENV === "production",
        isTest: parsed.NODE_ENV === "test",
      },
      blockchain: {
        rpcUrl: parsed.RPC_URL,
        chainId: parsed.CHAIN_ID,
        privateKey: parsed.PRIVATE_KEY,
      },
      contracts: {
        accessControl: parsed.ACCESS_CONTROL_ADDRESS,
        token: parsed.TOKEN_ADDRESS,
        credential: parsed.CREDENTIAL_ADDRESS,
        rewardDistributor: parsed.REWARD_DISTRIBUTOR_ADDRESS,
      },
      ipfs: {
        host: parsed.IPFS_HOST,
        port: parsed.IPFS_PORT,
        protocol: parsed.IPFS_PROTOCOL,
        gateway: parsed.IPFS_GATEWAY,
      },
      jwt: {
        secret: parsed.JWT_SECRET,
        expiresIn: parsed.JWT_EXPIRES_IN,
      },
      redis: {
        url: parsed.REDIS_URL,
      },
      rateLimit: {
        windowMs: parsed.RATE_LIMIT_WINDOW_MS,
        maxRequests: parsed.RATE_LIMIT_MAX_REQUESTS,
      },
      logging: {
        level: parsed.LOG_LEVEL,
        format: parsed.LOG_FORMAT,
      },
      cors: {
        origin: parsed.CORS_ORIGIN,
      },
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("❌ Configuration validation failed:");
      error.errors.forEach((err) => {
        console.error(`   - ${err.path.join(".")}: ${err.message}`);
      });
      process.exit(1);
    }
    throw error;
  }
}

export const config = loadConfig();
export type Config = typeof config;
