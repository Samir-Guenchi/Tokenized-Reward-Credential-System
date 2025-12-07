# Testing Plan

## Overview

This document outlines the comprehensive testing strategy for the Tokenized Reward & Credential System (TRCS), targeting 90%+ code coverage across all components.

## Testing Philosophy

1. **Test Early, Test Often**: Write tests alongside code
2. **Pyramid Strategy**: More unit tests, fewer E2E tests
3. **Meaningful Coverage**: Focus on critical paths and edge cases
4. **Deterministic Tests**: No flaky tests allowed

## Test Categories

### 1. Unit Tests

Individual function testing in isolation.

**Target Coverage**: 95%

**Smart Contracts (`test/unit/`)**:
- `AccessControlManager.test.ts`
- `Token.test.ts`
- `Credential.test.ts`
- `RewardDistributor.test.ts`

**Backend (`backend/src/__tests__/unit/`)**:
- Service functions
- Middleware functions
- Utility functions

### 2. Integration Tests

Multiple components working together.

**Target Coverage**: 85%

**Smart Contracts (`test/integration/`)**:
- `full-flow.test.ts`: Complete user journeys

**Backend (`backend/src/__tests__/integration/`)**:
- API endpoint tests
- Database operations
- External service mocks

### 3. Fuzz Tests

Property-based testing with random inputs.

**Smart Contracts (Foundry)**:
```bash
cd contracts
forge test --fuzz-runs 1000
```

## Test Structure

### Smart Contract Test Template

```typescript
describe("ContractName", function () {
    // Fixture for consistent test setup
    async function deployFixture() {
        const [owner, user1, user2] = await ethers.getSigners();
        const Contract = await ethers.getContractFactory("ContractName");
        const contract = await Contract.deploy(...);
        return { contract, owner, user1, user2 };
    }

    describe("Deployment", function () {
        it("should set correct initial values", async function () {
            const { contract } = await loadFixture(deployFixture);
            expect(await contract.value()).to.equal(expected);
        });
    });

    describe("FunctionName", function () {
        it("should succeed when conditions are met", async function () {
            // Happy path
        });

        it("should revert when unauthorized", async function () {
            // Access control
        });

        it("should handle edge cases", async function () {
            // Boundary conditions
        });
    });
});
```

## Test Cases by Component

### AccessControlManager

| Test Case | Category | Priority |
|-----------|----------|----------|
| Grant role to new address | Unit | High |
| Revoke role from address | Unit | High |
| Check role membership | Unit | High |
| Grant role without permission | Unit | High |
| Pause system | Unit | High |
| Unpause system | Unit | High |
| Pause when already paused | Unit | Medium |
| Role hierarchy enforcement | Integration | High |

### TRCSToken

| Test Case | Category | Priority |
|-----------|----------|----------|
| Initial deployment values | Unit | High |
| Mint tokens (authorized) | Unit | High |
| Mint tokens (unauthorized) | Unit | High |
| Mint exceeding cap | Unit | High |
| Transfer tokens | Unit | High |
| Transfer exceeding balance | Unit | High |
| Approve and transferFrom | Unit | High |
| Burn tokens | Unit | Medium |
| EIP-2612 permit | Unit | Medium |
| Transfer when paused | Integration | High |

### TRCSCredential

| Test Case | Category | Priority |
|-----------|----------|----------|
| Issue credential (authorized) | Unit | High |
| Issue credential (unauthorized) | Unit | High |
| Issue with signature | Unit | High |
| Issue with invalid signature | Unit | High |
| Revoke credential | Unit | High |
| Check validity (valid) | Unit | High |
| Check validity (expired) | Unit | High |
| Check validity (revoked) | Unit | High |
| Token URI retrieval | Unit | Medium |
| Metadata hash verification | Unit | Medium |

### RewardDistributor

| Test Case | Category | Priority |
|-----------|----------|----------|
| Create vesting schedule | Unit | High |
| Create duplicate schedule | Unit | High |
| Calculate vested amount (before cliff) | Unit | High |
| Calculate vested amount (during vesting) | Unit | High |
| Calculate vested amount (after vesting) | Unit | High |
| Claim tokens | Unit | High |
| Claim with nothing to claim | Unit | High |
| Set Merkle root | Unit | High |
| Claim with valid proof | Unit | High |
| Claim with invalid proof | Unit | High |
| Double claim prevention | Unit | High |
| Revoke vesting schedule | Unit | Medium |

### Integration Test Scenarios

| Scenario | Components | Description |
|----------|------------|-------------|
| Complete Onboarding | All | User registers, gets credential, receives reward |
| Token Economy Flow | Token, Distributor | Mint → Distribute → Claim → Transfer |
| Credential Lifecycle | Credential, ACM | Issue → Verify → Expire → Revoke |
| Access Control Flow | All | Grant roles → Perform actions → Revoke roles |
| Emergency Pause | All | Pause → Attempt actions → Unpause |

## Running Tests

### Smart Contracts

```bash
# All tests
npm test

# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration

# With coverage
npm run coverage

# Specific test file
npx hardhat test test/unit/Token.test.ts

# With gas reporting
REPORT_GAS=true npm test
```

### Backend

```bash
cd backend

# All tests
npm test

# Watch mode
npm run test:watch

# Coverage
npm run test:coverage
```

### Fuzz Testing (Foundry)

```bash
# Install Foundry
curl -L https://foundry.paradigm.xyz | bash
foundryup

# Run fuzz tests
forge test --fuzz-runs 1000
```

## Coverage Requirements

### Minimum Thresholds

| Component | Lines | Branches | Functions |
|-----------|-------|----------|-----------|
| Smart Contracts | 90% | 85% | 100% |
| Backend Services | 85% | 80% | 90% |
| Middleware | 90% | 85% | 95% |
| Routes | 80% | 75% | 90% |

### Coverage Commands

```bash
# Smart contracts
npm run coverage

# Generate HTML report
npx hardhat coverage --solcoverjs .solcover.js
```

## Continuous Integration

### GitHub Actions Workflow

```yaml
name: Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Compile contracts
        run: npm run compile
      
      - name: Run tests
        run: npm test
      
      - name: Run coverage
        run: npm run coverage
      
      - name: Check coverage threshold
        run: |
          coverage=$(cat coverage/coverage-summary.json | jq '.total.lines.pct')
          if (( $(echo "$coverage < 90" | bc -l) )); then
            echo "Coverage $coverage% is below 90%"
            exit 1
          fi
```

## Test Data Management

### Fixtures

```typescript
// Shared test fixtures
export const testAccounts = {
    admin: "0x...",
    issuer: "0x...",
    user1: "0x...",
    user2: "0x..."
};

export const testCredential = {
    type: 0,
    name: "Test Certification",
    description: "A test credential",
    expiresAt: Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60
};

export const testVesting = {
    amount: ethers.parseEther("1000"),
    cliff: 30 * 24 * 60 * 60,  // 30 days
    duration: 365 * 24 * 60 * 60  // 1 year
};
```

### Mocks

```typescript
// Mock blockchain service
export const mockBlockchainService = {
    getTokenBalance: jest.fn().mockResolvedValue("1000.0"),
    mintTokens: jest.fn().mockResolvedValue({ hash: "0x..." }),
    // ...
};

// Mock IPFS service
export const mockIpfsService = {
    storeMetadata: jest.fn().mockResolvedValue("QmTest..."),
    getMetadata: jest.fn().mockResolvedValue({ name: "Test" }),
    // ...
};
```

## Performance Testing

### Gas Benchmarks

Track gas usage for key operations:

```typescript
describe("Gas Benchmarks", function () {
    it("measures mint gas usage", async function () {
        const tx = await token.mint(user.address, amount);
        const receipt = await tx.wait();
        console.log(`Mint gas used: ${receipt.gasUsed}`);
        expect(receipt.gasUsed).to.be.lt(100000);
    });
});
```

### Load Testing (Backend)

```bash
# Using k6
k6 run load-test.js
```

## Security Testing

### Slither Analysis

```bash
npm run slither
```

### Manual Testing Checklist

- [ ] Reentrancy attacks
- [ ] Access control bypass
- [ ] Integer overflow/underflow
- [ ] Front-running vulnerabilities
- [ ] Flash loan attacks
- [ ] Oracle manipulation

## Reporting

### Test Reports

- **JUnit XML**: For CI integration
- **HTML Coverage**: For human review
- **Gas Reports**: For optimization tracking

### Metrics Tracked

- Test pass/fail rate
- Code coverage percentage
- Gas usage changes
- Test execution time

---

**Last Updated**: January 2024
**Review Frequency**: Monthly
