# Architecture Guide

## System Overview

The Tokenized Reward & Credential System (TRCS) is a comprehensive blockchain-based platform designed for managing digital tokens, verifiable credentials, and reward distribution mechanisms.

```
┌──────────────────────────────────────────────────────────────────┐
│                         Frontend (React)                          │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐ │
│  │   Wallet   │  │   Token    │  │ Credential │  │   Reward   │ │
│  │  Connect   │  │  Manager   │  │   Viewer   │  │  Claimer   │ │
│  └────────────┘  └────────────┘  └────────────┘  └────────────┘ │
└───────────────────────────┬──────────────────────────────────────┘
                            │ HTTP/REST
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│                      Backend (Express.js)                         │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐ │
│  │    Auth    │  │  Tokens    │  │ Credentials│  │  Rewards   │ │
│  │   Routes   │  │   Routes   │  │   Routes   │  │   Routes   │ │
│  └────────────┘  └────────────┘  └────────────┘  └────────────┘ │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                    Services Layer                            │ │
│  │  ┌─────────────────┐  ┌─────────────────┐                   │ │
│  │  │   Blockchain    │  │      IPFS       │                   │ │
│  │  │    Service      │  │    Service      │                   │ │
│  │  └─────────────────┘  └─────────────────┘                   │ │
│  └─────────────────────────────────────────────────────────────┘ │
└───────────────────────────┬──────────────────────────────────────┘
                            │ JSON-RPC / HTTP
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│                    Blockchain (Ethereum)                          │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                   Smart Contracts                           │  │
│  │  ┌─────────────────┐  ┌─────────────────────────────────┐  │  │
│  │  │ AccessControl   │◄─┤ TRCSToken (ERC-20)              │  │  │
│  │  │    Manager      │  │ - Minting/Burning               │  │  │
│  │  │                 │  │ - EIP-2612 Permit               │  │  │
│  │  │ - Role Mgmt     │  └─────────────────────────────────┘  │  │
│  │  │ - Pause/Unpause │                                       │  │
│  │  │                 │  ┌─────────────────────────────────┐  │  │
│  │  │                 │◄─┤ TRCSCredential (ERC-721)        │  │  │
│  │  │                 │  │ - Issue/Revoke                  │  │  │
│  │  │                 │  │ - Verification                  │  │  │
│  │  │                 │  │ - EIP-712 Signatures            │  │  │
│  │  │                 │  └─────────────────────────────────┘  │  │
│  │  │                 │                                       │  │
│  │  │                 │  ┌─────────────────────────────────┐  │  │
│  │  │                 │◄─┤ RewardDistributor               │  │  │
│  │  │                 │  │ - Vesting Schedules             │  │  │
│  │  └─────────────────┘  │ - Merkle Airdrops               │  │  │
│  │                       └─────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│                           IPFS                                    │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                   Metadata Storage                          │  │
│  │  - Credential Metadata (JSON)                               │  │
│  │  - Images and Documents                                     │  │
│  │  - Content-Addressable (CID)                                │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

## Smart Contract Architecture

### 1. AccessControlManager

The central authority for role-based access control across the entire system.

```solidity
contract AccessControlManager {
    // Role definitions
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant TREASURY_ROLE = keccak256("TREASURY_ROLE");
    
    // Emergency pause functionality
    bool public paused;
}
```

**Role Hierarchy:**
```
DEFAULT_ADMIN_ROLE
    └── ADMIN_ROLE
        ├── ISSUER_ROLE (can issue credentials)
        ├── PAUSER_ROLE (can pause system)
        └── TREASURY_ROLE (can manage funds)
```

### 2. TRCSToken (ERC-20)

A capped, mintable ERC-20 token with advanced features.

**Key Features:**
- **Capped Supply**: Maximum token supply enforced on-chain
- **Controlled Minting**: Only ADMIN_ROLE can mint new tokens
- **Burnable**: Token holders can burn their tokens
- **EIP-2612 Permit**: Gasless approvals via signatures

**State Variables:**
```solidity
string public name;
string public symbol;
uint8 public decimals = 18;
uint256 public totalSupply;
uint256 public cap;
mapping(address => uint256) public balanceOf;
mapping(address => mapping(address => uint256)) public allowance;
```

### 3. TRCSCredential (ERC-721)

Non-fungible tokens representing verifiable credentials.

**Credential Lifecycle:**
```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  Issue   │───►│  Active  │───►│ Expired  │    │ Revoked  │
│          │    │          │    │          │    │          │
└──────────┘    └────┬─────┘    └──────────┘    └──────────┘
                     │                               ▲
                     └───────────────────────────────┘
                              Revoke
```

**Metadata Structure:**
```solidity
struct CredentialMetadata {
    uint8 credentialType;    // Type of credential
    address issuer;          // Who issued it
    uint256 issuedAt;        // Timestamp of issuance
    uint256 expiresAt;       // Expiration timestamp
    bool revoked;            // Revocation status
    bytes32 dataHash;        // Hash of off-chain data
}
```

### 4. RewardDistributor

Manages token distribution through multiple mechanisms.

**Vesting Schedule:**
```
                    ┌─────────────────────────────────────────┐
                    │              Vesting Period              │
                    │                                         │
Tokens  ─────────┬──┼───────────────────────────────────────┬─┼─────
Released         │  │             Linear Release              │
                 │  │         ╱                               │
                 │  │       ╱                                 │
                 │  │     ╱                                   │
                 │  │   ╱                                     │
                 │  │ ╱                                       │
           0 ────┴──┴─────────────────────────────────────────┴─────
                 │  │                                         │
                Start    Cliff                           End
                         End
```

**Merkle Tree Airdrop:**
```
                    Root Hash
                       │
            ┌──────────┴──────────┐
            │                     │
         Hash AB              Hash CD
            │                     │
       ┌────┴────┐           ┌────┴────┐
       │         │           │         │
    Leaf A    Leaf B      Leaf C    Leaf D
    (addr,    (addr,      (addr,    (addr,
    amount)   amount)     amount)   amount)
```

## Backend Architecture

### Service Layer

```
┌─────────────────────────────────────────────────────────────┐
│                      Request Flow                            │
│                                                             │
│  Request → Middleware → Route Handler → Service → Response  │
│            │                                                │
│            ├── Auth (JWT verification)                      │
│            ├── Validation (Zod schemas)                     │
│            ├── Rate Limiting                                │
│            └── Error Handling                               │
└─────────────────────────────────────────────────────────────┘
```

### Blockchain Service

The blockchain service provides a clean abstraction over ethers.js:

```typescript
class BlockchainService {
  // Connection management
  private provider: Provider;
  private signer: Wallet;
  
  // Contract instances (lazy loaded)
  private contracts: {
    accessControl?: Contract;
    token?: Contract;
    credential?: Contract;
    rewardDistributor?: Contract;
  };
  
  // Methods for each contract
  async getTokenBalance(address: string): Promise<string>;
  async mintTokens(to: string, amount: string): Promise<Receipt>;
  async issueCredential(...): Promise<Receipt>;
  // ... etc
}
```

### IPFS Service

Handles metadata storage on IPFS:

```typescript
class IpfsService {
  // Store credential metadata
  async storeMetadata(metadata: CredentialMetadata): Promise<string>;
  
  // Retrieve content by CID
  async getContent(cid: string): Promise<Buffer>;
  
  // Generate URLs
  getIpfsUri(cid: string): string;  // ipfs://...
  getGatewayUrl(cid: string): string;  // https://ipfs.io/ipfs/...
}
```

## Frontend Architecture

### State Management (Zustand)

```typescript
interface WalletState {
  address: string | null;
  chainId: number | null;
  isConnected: boolean;
  balance: string;
  signer: JsonRpcSigner | null;
  
  // Actions
  connect: () => Promise<void>;
  disconnect: () => void;
  switchNetwork: (chainId: number) => Promise<void>;
}
```

### Data Fetching (React Query)

```typescript
// Example query hook
const { data, isLoading, error } = useQuery({
  queryKey: ['tokenBalance', address],
  queryFn: () => tokenApi.getBalance(address),
  enabled: !!address,
});
```

## Security Architecture

### Authentication Flow

```
┌─────────┐                              ┌─────────┐
│ Client  │                              │ Server  │
└────┬────┘                              └────┬────┘
     │                                        │
     │  1. Request nonce                      │
     │──────────────────────────────────────►│
     │                                        │
     │  2. Return nonce + message             │
     │◄──────────────────────────────────────│
     │                                        │
     │  3. Sign message with wallet           │
     │  (off-chain, in MetaMask)              │
     │                                        │
     │  4. Send signature                     │
     │──────────────────────────────────────►│
     │                                        │
     │                    5. Verify signature │
     │                    6. Check roles      │
     │                    7. Generate JWT     │
     │                                        │
     │  8. Return JWT                         │
     │◄──────────────────────────────────────│
     │                                        │
     │  9. Use JWT for API calls              │
     │──────────────────────────────────────►│
```

### Access Control

```
┌─────────────────────────────────────────────────────────────┐
│                    Access Control Matrix                     │
├─────────────────┬───────┬────────┬────────┬────────────────┤
│ Action          │ Admin │ Issuer │ Pauser │ Regular User   │
├─────────────────┼───────┼────────┼────────┼────────────────┤
│ Mint Tokens     │  ✓    │   ✗    │   ✗    │      ✗         │
│ Issue Credential│  ✓    │   ✓    │   ✗    │      ✗         │
│ Revoke Credential│ ✓    │   ✓    │   ✗    │      ✗         │
│ Pause System    │  ✓    │   ✗    │   ✓    │      ✗         │
│ Create Vesting  │  ✓    │   ✗    │   ✗    │      ✗         │
│ Claim Tokens    │  ✓    │   ✓    │   ✓    │      ✓         │
│ Transfer Tokens │  ✓    │   ✓    │   ✓    │      ✓         │
│ View Balance    │  ✓    │   ✓    │   ✓    │      ✓         │
└─────────────────┴───────┴────────┴────────┴────────────────┘
```

## Data Flow

### Credential Issuance

```
┌────────────┐   ┌────────────┐   ┌────────────┐   ┌────────────┐
│   Issuer   │   │   Backend  │   │    IPFS    │   │  Contract  │
└─────┬──────┘   └─────┬──────┘   └─────┬──────┘   └─────┬──────┘
      │                │                │                │
      │ 1. Submit      │                │                │
      │ credential data│                │                │
      │───────────────►│                │                │
      │                │                │                │
      │                │ 2. Upload      │                │
      │                │ metadata       │                │
      │                │───────────────►│                │
      │                │                │                │
      │                │ 3. Return CID  │                │
      │                │◄───────────────│                │
      │                │                │                │
      │                │ 4. Sign        │                │
      │                │ EIP-712 data   │                │
      │                │────────────────│───────────────►│
      │                │                │                │
      │                │ 5. Mint NFT    │                │
      │                │                │                │
      │ 6. Return      │                │                │
      │ tx receipt     │                │                │
      │◄───────────────│                │                │
```

### Reward Claiming

```
┌────────────┐   ┌────────────┐   ┌────────────────────────────┐
│    User    │   │  Contract  │   │      Calculation           │
└─────┬──────┘   └─────┬──────┘   └─────────────┬──────────────┘
      │                │                        │
      │ 1. Call claim()│                        │
      │───────────────►│                        │
      │                │                        │
      │                │ 2. Get schedule        │
      │                │ 3. Calculate vested    │
      │                │───────────────────────►│
      │                │                        │
      │                │         vested =       │
      │                │  total * elapsed       │
      │                │  ────────────────      │
      │                │      duration          │
      │                │                        │
      │                │ 4. claimable =         │
      │                │    vested - claimed    │
      │                │◄───────────────────────│
      │                │                        │
      │                │ 5. Transfer tokens     │
      │                │ 6. Update claimed      │
      │                │                        │
      │ 7. Tokens      │                        │
      │    received    │                        │
      │◄───────────────│                        │
```

## Deployment Architecture

### Production Setup

```
                         ┌─────────────────┐
                         │   CloudFlare    │
                         │   (CDN/WAF)     │
                         └────────┬────────┘
                                  │
                    ┌─────────────┴─────────────┐
                    │                           │
           ┌────────┴────────┐         ┌───────┴───────┐
           │  Load Balancer  │         │  Static CDN   │
           │   (API/WS)      │         │  (Frontend)   │
           └────────┬────────┘         └───────────────┘
                    │
        ┌───────────┼───────────┐
        │           │           │
   ┌────┴────┐ ┌────┴────┐ ┌────┴────┐
   │ API #1  │ │ API #2  │ │ API #3  │
   │         │ │         │ │         │
   └────┬────┘ └────┬────┘ └────┬────┘
        │           │           │
        └───────────┼───────────┘
                    │
        ┌───────────┴───────────┐
        │                       │
   ┌────┴────┐            ┌────┴────┐
   │  Redis  │            │ Postgres│
   │ (Cache) │            │  (DB)   │
   └─────────┘            └─────────┘
                    │
        ┌───────────┴───────────┐
        │                       │
   ┌────┴────┐            ┌────┴────┐
   │ Ethereum│            │  IPFS   │
   │  Node   │            │  Node   │
   └─────────┘            └─────────┘
```

## Upgrade Strategy

The system is designed with upgradeability in mind:

1. **Proxy Pattern**: Use OpenZeppelin's UUPS proxy for contract upgrades
2. **Data Migration**: Schema versioning for off-chain data
3. **Feature Flags**: Gradual rollout of new features
4. **Backward Compatibility**: API versioning (v1, v2, etc.)

---

For more details, see the individual component documentation.
