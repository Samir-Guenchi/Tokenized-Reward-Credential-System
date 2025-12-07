# 🚀 TRCS Quick Start Guide

Get TRCS running in under 5 minutes!

## Prerequisites

- Node.js 18+ and npm
- Git

## Step 1: Install Dependencies

```bash
# Install all dependencies
npm install
```

## Step 2: Compile Contracts

```bash
npm run compile
```

## Step 3: Run Tests

```bash
npm test
```

## Step 4: Start Local Blockchain

```bash
# In terminal 1
npx hardhat node
```

## Step 5: Deploy Contracts

```bash
# In terminal 2
npx hardhat run scripts/deploy.ts --network localhost
```

## Step 6: Seed Test Data (Optional)

```bash
npx hardhat run scripts/seed_data.ts --network localhost
```

## Step 7: Start Backend API

```bash
cd backend
npm install
npm run dev
```

## Step 8: Start Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 and connect MetaMask!

---

## Docker Quick Start

```bash
# Build and start everything
docker-compose up -d --build

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

---

## Useful Commands

| Command | Description |
|---------|-------------|
| `npm run compile` | Compile smart contracts |
| `npm test` | Run all tests |
| `npm run coverage` | Run tests with coverage |
| `npx hardhat node` | Start local blockchain |
| `npx hardhat console --network localhost` | Interactive console |

---

## Next Steps

1. 📖 Read [README.md](./README.md) for full documentation
2. 📚 Follow [tutorials](./tutorials/README.md) for hands-on learning
3. 🎓 Check [EXPERT_MODE.md](./EXPERT_MODE.md) for advanced topics

---

Happy building! 🔨
