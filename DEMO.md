# 🎓 TRCS Platform Demo Guide

## Overview

This guide walks you through demonstrating the **Tokenized Reward & Credential System (TRCS)** - a full-stack blockchain application featuring:

- **Smart Contracts** (Solidity + Hardhat)
- **Backend API** (Express.js + ethers.js)
- **Frontend UI** (React + Vite + Framer Motion)

---

## 🚀 Quick Start (One Command)

```powershell
# From the project root directory
.\start-demo.ps1
```

This script will:
1. Start the Hardhat local blockchain
2. Deploy all smart contracts
3. Start the backend API server
4. Start the frontend development server

---

## 📋 Manual Setup (Step by Step)

If you prefer to run each service manually:

### Terminal 1: Hardhat Node
```powershell
cd "c:\Users\Samir Guenchi\OneDrive\Desktop\blockchain"
npx hardhat node
```

**Expected Output:**
```
Started HTTP and WebSocket JSON-RPC server at http://127.0.0.1:8545/

Accounts
========
Account #0: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 (10000 ETH)
Private Key: 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
...
```

### Terminal 2: Deploy Contracts
```powershell
cd "c:\Users\Samir Guenchi\OneDrive\Desktop\blockchain"
npx hardhat run scripts/deploy.ts --network localhost
```

**Expected Output:**
```
Deploying contracts...
✓ AccessControlManager deployed
✓ TRCSToken deployed
✓ TRCSCredential deployed
✓ RewardDistributor deployed
```

### Terminal 3: Backend API
```powershell
cd "c:\Users\Samir Guenchi\OneDrive\Desktop\blockchain\backend"
npm run dev
```

**Expected Output:**
```
🚀 TRCS Backend API running on port 3001
📊 Connected to blockchain at http://127.0.0.1:8545
```

### Terminal 4: Frontend
```powershell
cd "c:\Users\Samir Guenchi\OneDrive\Desktop\blockchain\frontend"
npm run dev
```

**Expected Output:**
```
VITE v5.4.21  ready in 2000 ms
➜  Local:   http://localhost:3000/
```

---

## 🎬 Demo Script

### Run the Interactive Demo

```powershell
cd "c:\Users\Samir Guenchi\OneDrive\Desktop\blockchain"
npx hardhat run scripts/demo.ts --network localhost
```

This script demonstrates:
1. **Token Operations** - Transfers and balance checks
2. **Credential Minting** - NFT credential issuance
3. **Reward Distribution** - Vesting schedule creation

---

## 🦊 MetaMask Configuration

### Add Hardhat Network

1. Open MetaMask → Settings → Networks → Add Network
2. Fill in:
   - **Network Name:** Hardhat Local
   - **RPC URL:** `http://127.0.0.1:8545`
   - **Chain ID:** `31337`
   - **Currency Symbol:** ETH

### Import Test Accounts

Import these private keys to get test accounts with ETH and tokens:

| Account | Private Key |
|---------|-------------|
| Deployer (Admin) | `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80` |
| Alice (User) | `0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d` |
| Bob (User) | `0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a` |

---

## 🖥️ Demo Walkthrough

### 1. Frontend Demo (http://localhost:3000)

#### Homepage
- Shows platform overview with humanized design
- Animated statistics and feature cards
- Call-to-action buttons

#### Tokens Page
- Connect wallet (MetaMask)
- View token balance
- Transfer tokens to another address

#### Credentials Page
- View earned credentials (NFTs)
- Verify credential by Token ID
- See credential metadata

#### Rewards Page
- View vesting schedule
- Check claimable tokens
- Track vesting progress

### 2. API Demo (http://localhost:3001/api)

Test these endpoints with Invoke-WebRequest or curl:

```powershell
# Get token info
Invoke-WebRequest -Uri "http://localhost:3001/api/tokens/info" | Select-Object -ExpandProperty Content

# Get token balance
Invoke-WebRequest -Uri "http://localhost:3001/api/tokens/balance/0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" | Select-Object -ExpandProperty Content

# Get reward stats
Invoke-WebRequest -Uri "http://localhost:3001/api/rewards/stats" | Select-Object -ExpandProperty Content
```

### 3. CLI Demo (Hardhat Scripts)

```powershell
# Seed test data
npx hardhat run scripts/seed_data.ts --network localhost

# Mint a credential
npx hardhat run scripts/mint_credential.ts --network localhost

# Distribute rewards
npx hardhat run scripts/distribute_rewards.ts --network localhost
```

---

## 📊 What to Show in Demo

### Smart Contracts
1. **TRCSToken** - ERC-20 token with minting, burning, capping
2. **TRCSCredential** - Soulbound NFT credentials (non-transferable)
3. **RewardDistributor** - Vesting schedules and Merkle airdrops
4. **AccessControlManager** - Role-based permissions

### Backend Features
1. REST API with Express.js
2. Blockchain integration with ethers.js v6
3. IPFS metadata simulation
4. Error handling and validation

### Frontend Features
1. React 18 with TypeScript
2. Framer Motion animations
3. Tailwind CSS with humanized design
4. MetaMask wallet integration
5. Real-time blockchain data

---

## 🧪 Running Tests

```powershell
# Run all 139 tests
cd "c:\Users\Samir Guenchi\OneDrive\Desktop\blockchain"
npx hardhat test

# Run with coverage
npx hardhat coverage
```

---

## 🔧 Troubleshooting

### Port Already in Use
```powershell
# Kill all Node processes
Stop-Process -Name "node" -Force -ErrorAction SilentlyContinue
```

### Contract Deployment Failed
```powershell
# Make sure Hardhat node is running first
npx hardhat node
# Then deploy in a new terminal
npx hardhat run scripts/deploy.ts --network localhost
```

### MetaMask Nonce Error
1. Go to MetaMask → Settings → Advanced
2. Click "Clear activity tab data"
3. Reconnect to the site

---

## 📁 Project Structure

```
blockchain/
├── contracts/           # Solidity smart contracts
├── scripts/             # Deployment and demo scripts
│   ├── deploy.ts        # Contract deployment
│   ├── demo.ts          # Interactive demo
│   ├── seed_data.ts     # Seed test data
│   ├── mint_credential.ts
│   └── distribute_rewards.ts
├── test/                # 139 comprehensive tests
├── backend/             # Express.js API
│   ├── src/
│   │   ├── routes/      # API endpoints
│   │   ├── services/    # Blockchain service
│   │   └── index.ts     # Server entry
│   └── package.json
├── frontend/            # React + Vite UI
│   ├── src/
│   │   ├── pages/       # Page components
│   │   ├── components/  # Shared components
│   │   ├── services/    # API client
│   │   └── store/       # Zustand state
│   └── package.json
├── deployments/         # Contract addresses
├── start-demo.ps1       # One-click demo startup
└── DEMO.md              # This file
```

---

## 🎯 Demo Talking Points

1. **Blockchain Benefits**
   - Immutable credential records
   - Transparent token distribution
   - Trustless reward claiming

2. **Technical Highlights**
   - Gas-optimized smart contracts
   - Type-safe TypeScript throughout
   - Modern React with animations
   - Comprehensive test coverage (139 tests)

3. **Real-World Applications**
   - Online course platforms
   - Professional certifications
   - Employee reward programs
   - DAO membership systems

---

## 📞 Support

For issues or questions, check:
- `README.md` - Project overview
- `QUICKSTART.md` - Quick setup guide
- `EXPERT_MODE.md` - Advanced configuration
