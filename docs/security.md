# Security Guide

## Overview

This document outlines the security considerations, best practices, and audit recommendations for the Tokenized Reward & Credential System (TRCS).

## Smart Contract Security

### 1. Access Control

All privileged functions are protected by role-based access control:

```solidity
modifier onlyRole(bytes32 role) {
    require(accessControlManager.hasRole(role, msg.sender), "Unauthorized");
    _;
}
```

**Roles:**
| Role | Permissions |
|------|-------------|
| ADMIN_ROLE | Full system access, can grant/revoke roles |
| ISSUER_ROLE | Can issue and revoke credentials |
| PAUSER_ROLE | Can pause/unpause system operations |
| TREASURY_ROLE | Can manage funds and distributions |

### 2. Reentrancy Protection

All state changes follow the checks-effects-interactions pattern:

```solidity
function claim() external nonReentrant {
    // 1. CHECKS
    uint256 claimable = getClaimableAmount(msg.sender);
    require(claimable > 0, "Nothing to claim");
    
    // 2. EFFECTS
    vestingSchedules[msg.sender].claimed += claimable;
    totalClaimed += claimable;
    
    // 3. INTERACTIONS
    token.transfer(msg.sender, claimable);
    
    emit TokensClaimed(msg.sender, claimable);
}
```

### 3. Integer Overflow/Underflow

Solidity 0.8+ provides built-in overflow protection. All arithmetic operations will revert on overflow/underflow.

### 4. Input Validation

All inputs are validated before processing:

```solidity
function createVestingSchedule(
    address beneficiary,
    uint256 totalAmount,
    uint256 startTime,
    uint256 cliffDuration,
    uint256 duration
) external onlyRole(ADMIN_ROLE) {
    // Validation
    require(beneficiary != address(0), "Invalid beneficiary");
    require(totalAmount > 0, "Amount must be positive");
    require(duration > 0, "Duration must be positive");
    require(cliffDuration <= duration, "Cliff exceeds duration");
    require(startTime >= block.timestamp, "Start must be future");
    
    // ... rest of function
}
```

### 5. Emergency Pause

The system includes an emergency pause mechanism:

```solidity
function pause() external onlyRole(PAUSER_ROLE) {
    _pause();
}

function unpause() external onlyRole(ADMIN_ROLE) {
    _unpause();
}

// Applied to critical functions
function transfer(...) external whenNotPaused {
    // ...
}
```

### 6. Signature Verification

EIP-712 typed structured data is used for secure off-chain signatures:

```solidity
bytes32 public constant CREDENTIAL_ISSUANCE_TYPEHASH = keccak256(
    "CredentialIssuance(address recipient,uint8 credentialType,uint256 expiresAt,string tokenURI)"
);

function verifySignature(
    address recipient,
    uint8 credentialType,
    uint256 expiresAt,
    string memory tokenURI,
    bytes memory signature
) internal view returns (bool) {
    bytes32 structHash = keccak256(abi.encode(
        CREDENTIAL_ISSUANCE_TYPEHASH,
        recipient,
        credentialType,
        expiresAt,
        keccak256(bytes(tokenURI))
    ));
    
    bytes32 digest = _hashTypedDataV4(structHash);
    address signer = ECDSA.recover(digest, signature);
    
    return accessControlManager.hasRole(ISSUER_ROLE, signer);
}
```

## Backend Security

### 1. Authentication

Web3 authentication with nonce-based signature verification:

```typescript
// Nonces are:
// - Single use (consumed after verification)
// - Time-limited (5 minute expiration)
// - Unique per address
function generateNonce(address: string): string {
    const nonce = crypto.randomBytes(16).toString('hex');
    nonceStore.set(address.toLowerCase(), {
        nonce,
        expires: Date.now() + 5 * 60 * 1000
    });
    return nonce;
}
```

### 2. JWT Security

```typescript
// JWT Configuration
const JWT_SECRET = process.env.JWT_SECRET; // 256-bit minimum
const JWT_EXPIRES_IN = '24h';

// JWT contains:
// - address: Wallet address (verified by signature)
// - roles: On-chain roles at time of authentication
// - iat: Issued at timestamp
// - exp: Expiration timestamp
```

### 3. Rate Limiting

```typescript
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per window
    message: 'Too many requests'
});
```

### 4. Input Validation

All inputs validated using Zod schemas:

```typescript
const ethereumAddress = z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address");

const positiveAmount = z
    .string()
    .regex(/^\d+(\.\d+)?$/)
    .refine(val => parseFloat(val) > 0);
```

### 5. HTTP Security Headers

Using Helmet.js for security headers:

```typescript
app.use(helmet({
    contentSecurityPolicy: true,
    crossOriginEmbedderPolicy: true,
    crossOriginOpenerPolicy: true,
    crossOriginResourcePolicy: true,
    dnsPrefetchControl: true,
    frameguard: true,
    hidePoweredBy: true,
    hsts: true,
    ieNoOpen: true,
    noSniff: true,
    originAgentCluster: true,
    permittedCrossDomainPolicies: true,
    referrerPolicy: true,
    xssFilter: true
}));
```

### 6. CORS Configuration

```typescript
app.use(cors({
    origin: process.env.CORS_ORIGIN, // Specific origin, not '*'
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
}));
```

## Common Vulnerabilities Addressed

### 1. Front-Running

For sensitive operations, consider:
- Commit-reveal schemes
- Flashbots or private mempools
- Timestamp tolerance checks

### 2. Denial of Service

- Gas-efficient loops with limits
- Pull over push for payments
- Pagination for queries

### 3. Oracle Manipulation

- Use time-weighted average prices
- Multiple oracle sources
- Sanity checks on values

### 4. Flash Loan Attacks

- Avoid using spot prices
- Add minimum holding periods
- Use time-locked operations

## Audit Checklist

### Smart Contracts

- [ ] All functions have appropriate access controls
- [ ] Reentrancy guards on state-changing functions
- [ ] No unchecked external calls
- [ ] All inputs validated
- [ ] Events emitted for state changes
- [ ] No floating pragma
- [ ] No deprecated functions
- [ ] Proper inheritance order
- [ ] No tx.origin usage
- [ ] Safe math operations (Solidity 0.8+)

### Backend

- [ ] All routes authenticated (where required)
- [ ] Input validation on all endpoints
- [ ] Rate limiting implemented
- [ ] Secure headers configured
- [ ] No sensitive data in logs
- [ ] Environment variables for secrets
- [ ] SQL/NoSQL injection prevention
- [ ] CORS properly configured

### Infrastructure

- [ ] HTTPS only
- [ ] Secrets in vault/KMS
- [ ] Network segmentation
- [ ] Regular backups
- [ ] Monitoring and alerting
- [ ] Incident response plan

## Recommended Tools

### Static Analysis
- **Slither**: Solidity static analyzer
- **Mythril**: Security analysis tool
- **Securify2**: Security scanner

### Dynamic Testing
- **Echidna**: Fuzzing tool
- **Foundry Forge**: Fuzz testing

### Code Quality
- **Solhint**: Solidity linter
- **ESLint**: TypeScript linter

## Incident Response

### 1. Discovery
- Monitor for anomalies
- Set up alerting thresholds
- Community bug bounty program

### 2. Assessment
- Determine severity
- Identify affected components
- Estimate impact

### 3. Containment
- Emergency pause if needed
- Disable affected features
- Communicate with users

### 4. Resolution
- Deploy fixes
- Gradual service restoration
- Post-mortem analysis

### 5. Recovery
- Compensate affected users
- Update security measures
- Document lessons learned

## Bug Bounty Guidelines

### Scope
- Smart contracts
- Backend API
- Authentication system

### Severity Levels
| Level | Description | Reward |
|-------|-------------|--------|
| Critical | Direct fund loss | $10,000+ |
| High | Significant vulnerability | $5,000 |
| Medium | Limited impact | $1,000 |
| Low | Minor issues | $100 |

### Out of Scope
- Social engineering
- Physical attacks
- Third-party services
- Known issues

## Contact

For security issues, contact: security@trcs.example.com

PGP Key: [link to public key]

---

**Note**: This is a living document. Update as the system evolves.
