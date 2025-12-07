# TRCS Demo Guide 🎬

## Quick Reference: Services Status

| Service | URL | Port |
|---------|-----|------|
| **Hardhat Blockchain** | http://127.0.0.1:8545 | 8545 |
| **Backend API** | http://127.0.0.1:3001 | 3001 |
| **Frontend App** | http://localhost:3000 | 3000 |

---

## 🚀 DEMO WALKTHROUGH

### Step 1: Open the Frontend
Open your browser to: **http://localhost:3000**

You'll see the beautiful humanized UI with:
- Animated hero section
- "Learn stuff. Get paid. Own your credentials." tagline
- Smooth Framer Motion animations

---

### Step 2: Connect a Wallet (MetaMask)

1. Install MetaMask browser extension if not already installed
2. Add Hardhat Local Network to MetaMask:
   - Network Name: `Hardhat Local`
   - RPC URL: `http://127.0.0.1:8545`
   - Chain ID: `31337`
   - Currency Symbol: `ETH`

3. Import a test account (from Hardhat's default accounts):
   ```
   Private Key: 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
   Address: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 (has 10000 ETH + initial TRCS)
   ```

4. Click "Connect Wallet" in the app

---

### Step 3: Demo Token Features (Tokens Page)

Navigate to the **Tokens** page to see:
- Your TRCS token balance
- Token transfer functionality
- Transaction history

**Demo Actions:**
- View the token balance (should show tokens for the deployer address)
- Try transferring tokens to another address

---

### Step 4: Demo Credentials (Credentials Page)

Navigate to the **Credentials** page to see:
- Your earned credentials (NFTs)
- Credential verification
- Beautiful badge designs with emojis

**Demo Actions:**
- View any issued credentials
- Click on a credential to see details
- Show the verification animation

---

### Step 5: Demo Rewards (Rewards Page)

Navigate to the **Rewards** page to see:
- Vesting schedules
- Claimable rewards
- Celebration animations

---

## 🔧 CLI Demo Commands

Run these commands from the project root to demonstrate blockchain operations:

### Check Token Info
```bash
npx hardhat run scripts/cli.ts --network localhost
```
Then select option 1 to view token info.

### Get Account Balances
```powershell
cd "c:\Users\Samir Guenchi\OneDrive\Desktop\blockchain"
npx hardhat console --network localhost
```

Then in the console:
```javascript
// Get contract instances
const TRCSToken = await ethers.getContractAt("TRCSToken", "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512");

// Check total supply
const supply = await TRCSToken.totalSupply();
console.log("Total Supply:", ethers.formatEther(supply), "TRCS");

// Check deployer balance
const [deployer] = await ethers.getSigners();
const balance = await TRCSToken.balanceOf(deployer.address);
console.log("Deployer Balance:", ethers.formatEther(balance), "TRCS");
```

### Issue a Credential (NFT)
```javascript
const TRCSCredential = await ethers.getContractAt("TRCSCredential", "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0");

// Issue credential to an address
const recipientAddress = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"; // Account #1
await TRCSCredential.issueCredential(
    recipientAddress,
    "COURSE_COMPLETION",
    "https://example.com/metadata/course-123.json"
);
console.log("✅ Credential issued!");
```

### Transfer Tokens
```javascript
const TRCSToken = await ethers.getContractAt("TRCSToken", "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512");

// Transfer 100 TRCS to Account #1
const recipient = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
const amount = ethers.parseEther("100");
await TRCSToken.transfer(recipient, amount);
console.log("✅ Transferred 100 TRCS!");
```

### Create Vesting Schedule
```javascript
const RewardDistributor = await ethers.getContractAt("RewardDistributor", "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9");

// Create vesting for Account #1
const beneficiary = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
const amount = ethers.parseEther("500");
const startTime = Math.floor(Date.now() / 1000);
const duration = 60 * 60 * 24 * 30; // 30 days
const cliff = 60 * 60 * 24 * 7; // 7 days

await RewardDistributor.createVesting(beneficiary, amount, startTime, duration, cliff);
console.log("✅ Vesting schedule created!");
```

---

## 📡 API Demo Endpoints

### Backend Health Check
```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:3001/health" -Method GET
```

### Get Token Info
```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:3001/api/tokens/info" -Method GET
```

### Get Token Balance
```powershell
$address = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
Invoke-RestMethod -Uri "http://127.0.0.1:3001/api/tokens/balance/$address" -Method GET
```

---

## 🎯 Key Demo Points

1. **Smart Contracts**: All 4 contracts deployed and functional
   - AccessControlManager: Role-based permissions
   - TRCSToken: ERC-20 reward tokens
   - TRCSCredential: ERC-721 credential NFTs
   - RewardDistributor: Token vesting system

2. **Full Stack Integration**: 
   - Blockchain (Hardhat) ↔ Backend (Express) ↔ Frontend (React)
   
3. **Modern UI**: 
   - Framer Motion animations
   - Humanized, warm design
   - Responsive layout
   - Real-time blockchain data

4. **Testing**: 139/139 tests passing

---

## 🛑 Stopping Services

When done with the demo:

1. **Frontend**: Press `Ctrl+C` in the frontend terminal
2. **Backend**: Close the backend PowerShell window
3. **Hardhat**: Close the Hardhat cmd window

---

## 📋 Contract Addresses (Localhost)

```
AccessControlManager: 0x5FbDB2315678afecb367f032d93F642f64180aa3
TRCSToken:            0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
TRCSCredential:       0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0
RewardDistributor:    0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9
```

---

## 🎥 Recommended Demo Flow

1. **Start** → Show all 3 services running (terminals)
2. **Frontend** → Walk through each page with animations
3. **CLI** → Run Hardhat console commands to show blockchain interaction
4. **API** → Call backend endpoints to show data flow
5. **MetaMask** → Connect wallet and show real-time updates
6. **Tests** → Run `npm test` to show 139/139 passing

**Total Demo Time**: ~10-15 minutes
