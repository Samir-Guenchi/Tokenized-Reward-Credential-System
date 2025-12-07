# Tutorial 1: Your First Smart Contract Deployment

> **Learn to compile, test, and deploy TRCS contracts step by step**

## Prerequisites

Before starting, ensure you have:
- Node.js 18+ installed
- Git installed
- A code editor (VS Code recommended)
- Basic JavaScript knowledge

## Step 1: Clone and Setup

```bash
# Clone the repository
git clone <repository-url> trcs
cd trcs

# Install dependencies
npm install

# Copy environment template
cp .env.example .env
```

## Step 2: Understand the Project Structure

```
trcs/
├── contracts/           # Solidity smart contracts
│   ├── AccessControlManager.sol
│   ├── Token.sol
│   ├── Credential.sol
│   └── RewardDistributor.sol
├── scripts/             # Deployment scripts
├── test/                # Test files
├── hardhat.config.ts    # Hardhat configuration
└── package.json         # Dependencies
```

## Step 3: Compile Contracts

```bash
# Compile all contracts
npx hardhat compile
```

You should see:
```
Compiled 4 Solidity files successfully
```

### What Happens During Compilation?

1. Hardhat reads all `.sol` files from `contracts/`
2. Solidity compiler converts them to bytecode
3. ABI (Application Binary Interface) is generated
4. Artifacts are stored in `artifacts/`

## Step 4: Run the Tests

```bash
# Run all tests
npx hardhat test

# Run with verbose output
npx hardhat test --verbose

# Run specific test file
npx hardhat test test/unit/Token.test.ts
```

### Understanding Test Output

```
  Token Contract
    Deployment
      ✓ Should set the correct name and symbol (45ms)
      ✓ Should assign DEFAULT_ADMIN_ROLE to deployer
    Minting
      ✓ Should allow minter to mint tokens
      ✓ Should emit TokensMinted event
```

## Step 5: Start Local Blockchain

Open a new terminal:

```bash
# Start Hardhat node
npx hardhat node
```

Keep this running! You'll see:
```
Started HTTP and WebSocket JSON-RPC server at http://127.0.0.1:8545/

Accounts
========
Account #0: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 (10000 ETH)
Private Key: 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
...
```

## Step 6: Deploy to Local Network

In your original terminal:

```bash
# Deploy all contracts
npx hardhat run scripts/deploy.ts --network localhost
```

Expected output:
```
🚀 Starting TRCS Deployment...
📋 Network: localhost
👤 Deployer: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266

📦 Deploying AccessControlManager...
✅ AccessControlManager deployed at: 0x5FbDB2315678afecb367f032d93F642f64180aa3

📦 Deploying Token...
✅ Token deployed at: 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512

📦 Deploying Credential...
✅ Credential deployed at: 0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0

📦 Deploying RewardDistributor...
✅ RewardDistributor deployed at: 0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9

✅ Deployment complete!
```

## Step 7: Interact with Contracts

Open Hardhat console:

```bash
npx hardhat console --network localhost
```

### Get Contract Instances

```javascript
// Get contract factories
const Token = await ethers.getContractFactory("Token");
const token = Token.attach("0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512");

// Check token info
await token.name()    // "TRCS Reward Token"
await token.symbol()  // "TRCS"
```

### Mint Some Tokens

```javascript
// Get signer
const [deployer] = await ethers.getSigners();

// Mint tokens (we have MINTER role)
const tx = await token.mint(deployer.address, ethers.parseEther("1000"));
await tx.wait();

// Check balance
const balance = await token.balanceOf(deployer.address);
console.log("Balance:", ethers.formatEther(balance)); // "1000.0"
```

### Transfer Tokens

```javascript
// Transfer to another address
const recipient = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
await token.transfer(recipient, ethers.parseEther("100"));

// Check balances
console.log(
  "Deployer:", ethers.formatEther(await token.balanceOf(deployer.address))
); // "900.0"
console.log(
  "Recipient:", ethers.formatEther(await token.balanceOf(recipient))
); // "100.0"
```

## Step 8: Deploy to Testnet (Optional)

### Configure Environment

Edit `.env`:
```
INFURA_API_KEY=your_infura_key
PRIVATE_KEY=your_wallet_private_key
```

⚠️ **Never use a wallet with real funds for development!**

### Get Testnet ETH

1. Go to [Sepolia Faucet](https://sepoliafaucet.com/)
2. Enter your wallet address
3. Request testnet ETH

### Deploy

```bash
npx hardhat run scripts/deploy.ts --network sepolia
```

### Verify Contracts

```bash
npx hardhat verify --network sepolia <CONTRACT_ADDRESS> <CONSTRUCTOR_ARGS>
```

## Next Steps

- 📖 Read [Tutorial 2: Working with Credentials](./02-working-with-credentials.md)
- 🧪 Explore the test files to understand contract behavior
- 💡 Try modifying contracts and running tests

## Troubleshooting

### "Contract not found"
Make sure you compiled with `npx hardhat compile`

### "Insufficient funds"
Your account needs ETH. On testnet, use a faucet.

### "Nonce too high"
Reset your MetaMask account: Settings → Advanced → Reset Account

---

*Continue to [Tutorial 2: Working with Credentials →](./02-working-with-credentials.md)*
