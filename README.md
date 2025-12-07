# TRCS - Tokenized Reward & Credential System

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Solidity](https://img.shields.io/badge/Solidity-0.8.22-blue.svg)](https://soliditylang.org/)
[![Hardhat](https://img.shields.io/badge/Hardhat-2.19-orange.svg)](https://hardhat.org/)

A complete, production-ready blockchain-based system for managing tokenized rewards and verifiable credentials. Built with Solidity, Hardhat, Node.js, and React.

##  Features

### Smart Contracts
- **TRCSToken (ERC-20)**: Capped, mintable, burnable token with EIP-2612 permit
- **TRCSCredential (ERC-721)**: Verifiable credentials with metadata, expiration, and revocation
- **RewardDistributor**: Linear vesting schedules and Merkle tree airdrops
- **AccessControlManager**: Centralized role-based access control

### Backend API
- RESTful API with Express.js
- Web3 authentication (wallet signature verification)
- IPFS integration for metadata storage
- JWT-based session management

### Frontend Demo
- React + TypeScript + Vite
- MetaMask wallet integration
- Real-time balance updates
- Credential verification UI

## Quick Start

### Prerequisites
- Node.js >= 18.0.0
- npm or yarn
- Git
- MetaMask browser extension

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/trcs-tokenized-reward-credential-system.git
cd trcs-tokenized-reward-credential-system

# Install root dependencies
npm install

# Install backend dependencies
cd backend && npm install && cd ..

# Install frontend dependencies
cd frontend && npm install && cd ..
```

### Environment Setup

```bash
# Copy environment files
cp .env.example .env
cp backend/.env.example backend/.env

# Edit .env files with your configuration
```

### Running Locally

```bash
# Terminal 1: Start local blockchain
npm run node

# Terminal 2: Deploy contracts
npm run deploy:local

# Terminal 3: Start backend
npm run backend:dev

# Terminal 4: Start frontend
npm run frontend:dev
```

Visit `http://localhost:3000` in your browser.

##  Project Structure

```
trcs-tokenized-reward-credential-system/
├── contracts/                 # Solidity smart contracts
│   ├── AccessControlManager.sol
│   ├── Token.sol
│   ├── Credential.sol
│   └── RewardDistributor.sol
├── scripts/                   # Deployment and utility scripts
│   ├── deploy.ts
│   ├── mint_credential.ts
│   ├── distribute_rewards.ts
│   └── seed_data.ts
├── test/                      # Test suites
│   ├── unit/                  # Unit tests
│   └── integration/           # Integration tests
├── backend/                   # Express.js backend
│   └── src/
│       ├── config/
│       ├── middleware/
│       ├── routes/
│       ├── services/
│       └── utils/
├── frontend/                  # React frontend
│   └── src/
│       ├── components/
│       ├── pages/
│       ├── services/
│       └── store/
├── docs/                      # Documentation
└── latex/                     # LaTeX design document
```

##  Smart Contract Architecture

### AccessControlManager
Centralized role management for the entire system.

```solidity
// Roles defined
ADMIN_ROLE     // Full system access
ISSUER_ROLE    // Can issue credentials
PAUSER_ROLE    // Can pause system
TREASURY_ROLE  // Can manage funds
```

### TRCSToken
ERC-20 token with controlled minting.

```solidity
// Key features
- Capped supply (configurable maximum)
- Controlled minting (ADMIN only)
- Burn functionality
- EIP-2612 permit for gasless approvals
```

### TRCSCredential
ERC-721 NFT for verifiable credentials.

```solidity
// Credential types
0: COURSE_COMPLETION
1: SKILL_CERTIFICATION
2: ACHIEVEMENT_BADGE
3: MEMBERSHIP
4: CUSTOM
```

### RewardDistributor
Token distribution with multiple mechanisms.

```solidity
// Distribution methods
- Linear vesting with cliff
- Merkle tree airdrops
- Direct transfers
```

## 🔧 Development

### Compile Contracts

```bash
npm run compile
```

### Run Tests

```bash
# All tests
npm test

# Unit tests only
npm run test:unit

# Integration tests
npm run test:integration

# With coverage
npm run coverage
```

### Linting

```bash
# Lint Solidity
npm run lint:sol

# Lint TypeScript
npm run lint:ts

# Fix lint issues
npm run lint:fix
```

### Security Analysis

```bash
# Run Slither
npm run slither

# Full security check
npm run security:check
```

##  API Endpoints

### Authentication
- `GET /api/auth/nonce` - Request signing nonce
- `POST /api/auth/verify` - Verify signature and get JWT
- `GET /api/auth/me` - Get current user info

### Tokens
- `GET /api/tokens/info` - Get token information
- `GET /api/tokens/balance/:address` - Get balance
- `POST /api/tokens/mint` - Mint tokens (admin)
- `POST /api/tokens/transfer` - Transfer tokens

### Credentials
- `GET /api/credentials/:tokenId` - Get credential
- `GET /api/credentials/:tokenId/verify` - Verify credential
- `POST /api/credentials/issue` - Issue credential (issuer)
- `POST /api/credentials/revoke` - Revoke credential

### Rewards
- `GET /api/rewards/stats` - Get distribution stats
- `GET /api/rewards/vesting/:address` - Get vesting schedule
- `POST /api/rewards/vesting` - Create vesting (admin)

##  Security Considerations

1. **Access Control**: All privileged functions require appropriate roles
2. **Reentrancy**: Protected using checks-effects-interactions pattern
3. **Integer Overflow**: Solidity 0.8+ built-in protection
4. **Input Validation**: All inputs validated on-chain and off-chain
5. **Signature Verification**: EIP-712 typed structured data
6. **Rate Limiting**: API protected against abuse

See [SECURITY.md](./docs/SECURITY.md) for detailed security documentation.

##  Testing Strategy

- **Unit Tests**: Individual contract function testing
- **Integration Tests**: Multi-contract interaction testing
- **Fuzz Testing**: Property-based testing with Foundry
- **Coverage Target**: 90%+

##  Gas Optimization

| Function | Gas Cost |
|----------|----------|
| Deploy AccessControlManager | ~800,000 |
| Deploy Token | ~1,200,000 |
| Deploy Credential | ~1,500,000 |
| Deploy RewardDistributor | ~1,100,000 |
| Mint Token | ~50,000 |
| Issue Credential | ~150,000 |
| Claim Vesting | ~80,000 |

##  Deployment

### Testnet (Sepolia)

```bash
# Set environment variables
export PRIVATE_KEY=your_private_key
export INFURA_API_KEY=your_infura_key

# Deploy
npm run deploy:sepolia

# Verify on Etherscan
npx hardhat verify --network sepolia CONTRACT_ADDRESS
```

### Mainnet

```bash
npm run deploy:mainnet
```

##  Docker

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

##  Documentation

- [Architecture Guide](./docs/architecture.md)
- [Security Guide](./docs/security.md)
- [Testing Plan](./docs/testing-plan.md)
- [API Documentation](./docs/api.md)

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [OpenZeppelin](https://openzeppelin.com/) for secure contract implementations
- [Hardhat](https://hardhat.org/) for the development framework
- [ethers.js](https://ethers.org/) for Ethereum interactions

---

Built with by : leader Samir Guenchi && Ainouche abde rahman && Guerroudj abdennour && riadh moulahcene
