# Tutorial 4: Building the Frontend

> **Create a React DApp to interact with TRCS contracts**

## Overview

In this tutorial, you'll learn how to:
- Set up a React + Vite project
- Connect to MetaMask
- Read data from smart contracts
- Send transactions

## Prerequisites

- Completed previous tutorials
- Node.js 18+ installed
- MetaMask browser extension

## Step 1: Project Setup

The frontend is already set up in the `frontend/` directory. Let's explore it:

```bash
cd frontend
npm install
```

## Step 2: Configure Environment

Create `.env` file:

```bash
# frontend/.env
VITE_API_URL=http://localhost:3000/api/v1
VITE_TOKEN_ADDRESS=0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
VITE_CREDENTIAL_ADDRESS=0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0
VITE_REWARD_DISTRIBUTOR_ADDRESS=0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9
VITE_CHAIN_ID=31337
```

## Step 3: Understanding the Wallet Store

The wallet connection is managed by Zustand in `src/store/wallet.ts`:

```typescript
import { create } from 'zustand';
import { ethers } from 'ethers';

interface WalletState {
  address: string | null;
  provider: ethers.BrowserProvider | null;
  signer: ethers.Signer | null;
  chainId: number | null;
  isConnecting: boolean;
  error: string | null;
  
  connect: () => Promise<void>;
  disconnect: () => void;
}

export const useWalletStore = create<WalletState>((set, get) => ({
  address: null,
  provider: null,
  signer: null,
  chainId: null,
  isConnecting: false,
  error: null,

  connect: async () => {
    if (typeof window.ethereum === 'undefined') {
      set({ error: 'MetaMask is not installed' });
      return;
    }

    set({ isConnecting: true, error: null });

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await provider.send('eth_requestAccounts', []);
      const signer = await provider.getSigner();
      const network = await provider.getNetwork();

      set({
        address: accounts[0],
        provider,
        signer,
        chainId: Number(network.chainId),
        isConnecting: false,
      });
    } catch (error: any) {
      set({ error: error.message, isConnecting: false });
    }
  },

  disconnect: () => {
    set({
      address: null,
      provider: null,
      signer: null,
      chainId: null,
    });
  },
}));
```

## Step 4: Create Contract Hooks

Create custom hooks for contract interaction:

```typescript
// src/hooks/useToken.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ethers } from 'ethers';
import { useWalletStore } from '../store/wallet';
import TokenABI from '../abi/Token.json';

const TOKEN_ADDRESS = import.meta.env.VITE_TOKEN_ADDRESS;

export function useTokenContract() {
  const { signer, provider } = useWalletStore();
  
  if (!provider) return null;
  
  return new ethers.Contract(
    TOKEN_ADDRESS,
    TokenABI,
    signer || provider
  );
}

export function useTokenBalance(address?: string) {
  const contract = useTokenContract();
  const { address: connectedAddress } = useWalletStore();
  const targetAddress = address || connectedAddress;
  
  return useQuery({
    queryKey: ['tokenBalance', targetAddress],
    queryFn: async () => {
      if (!contract || !targetAddress) return null;
      const balance = await contract.balanceOf(targetAddress);
      return ethers.formatEther(balance);
    },
    enabled: !!contract && !!targetAddress,
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}

export function useTokenTransfer() {
  const contract = useTokenContract();
  const queryClient = useQueryClient();
  const { address } = useWalletStore();
  
  return useMutation({
    mutationFn: async ({ to, amount }: { to: string; amount: string }) => {
      if (!contract) throw new Error('Contract not available');
      
      const tx = await contract.transfer(to, ethers.parseEther(amount));
      await tx.wait();
      return tx;
    },
    onSuccess: () => {
      // Invalidate balance queries to refresh
      queryClient.invalidateQueries({ queryKey: ['tokenBalance'] });
    },
  });
}
```

## Step 5: Build Token Balance Component

```tsx
// src/components/TokenBalance.tsx
import { useTokenBalance } from '../hooks/useToken';
import { useWalletStore } from '../store/wallet';

export function TokenBalance() {
  const { address } = useWalletStore();
  const { data: balance, isLoading, error } = useTokenBalance();
  
  if (!address) {
    return (
      <div className="bg-gray-100 p-4 rounded-lg">
        <p className="text-gray-500">Connect wallet to view balance</p>
      </div>
    );
  }
  
  if (isLoading) {
    return (
      <div className="bg-gray-100 p-4 rounded-lg animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-32"></div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="bg-red-100 p-4 rounded-lg">
        <p className="text-red-600">Error loading balance</p>
      </div>
    );
  }
  
  return (
    <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-6 rounded-lg text-white">
      <p className="text-sm opacity-80">Your Balance</p>
      <p className="text-3xl font-bold">{balance} TRCS</p>
    </div>
  );
}
```

## Step 6: Build Transfer Form

```tsx
// src/components/TransferForm.tsx
import { useState } from 'react';
import { useTokenTransfer } from '../hooks/useToken';

export function TransferForm() {
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');
  const { mutate: transfer, isPending, error, isSuccess } = useTokenTransfer();
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    transfer({ to, amount });
  };
  
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Recipient Address
        </label>
        <input
          type="text"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          placeholder="0x..."
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm 
                     focus:border-blue-500 focus:ring-blue-500"
          required
        />
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Amount (TRCS)
        </label>
        <input
          type="number"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="100"
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm 
                     focus:border-blue-500 focus:ring-blue-500"
          required
        />
      </div>
      
      <button
        type="submit"
        disabled={isPending}
        className="w-full bg-blue-600 text-white py-2 px-4 rounded-md 
                   hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isPending ? 'Sending...' : 'Send Tokens'}
      </button>
      
      {error && (
        <div className="bg-red-100 text-red-700 p-3 rounded-md">
          {(error as Error).message}
        </div>
      )}
      
      {isSuccess && (
        <div className="bg-green-100 text-green-700 p-3 rounded-md">
          Transfer successful!
        </div>
      )}
    </form>
  );
}
```

## Step 7: Build Credentials List

```tsx
// src/components/CredentialsList.tsx
import { useQuery } from '@tanstack/react-query';
import { ethers } from 'ethers';
import { useWalletStore } from '../store/wallet';
import CredentialABI from '../abi/Credential.json';

const CREDENTIAL_ADDRESS = import.meta.env.VITE_CREDENTIAL_ADDRESS;

interface Credential {
  tokenId: string;
  metadataURI: string;
  isRevoked: boolean;
}

export function CredentialsList() {
  const { address, provider } = useWalletStore();
  
  const { data: credentials, isLoading } = useQuery({
    queryKey: ['credentials', address],
    queryFn: async (): Promise<Credential[]> => {
      if (!provider || !address) return [];
      
      const contract = new ethers.Contract(
        CREDENTIAL_ADDRESS,
        CredentialABI,
        provider
      );
      
      const tokenIds = await contract.getCredentialsByHolder(address);
      
      const credentials = await Promise.all(
        tokenIds.map(async (id: bigint) => {
          const [metadataURI, isRevoked] = await Promise.all([
            contract.tokenURI(id),
            contract.isRevoked(id),
          ]);
          
          return {
            tokenId: id.toString(),
            metadataURI,
            isRevoked,
          };
        })
      );
      
      return credentials;
    },
    enabled: !!address && !!provider,
  });
  
  if (!address) {
    return <p>Connect wallet to view credentials</p>;
  }
  
  if (isLoading) {
    return <p>Loading credentials...</p>;
  }
  
  if (!credentials?.length) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>No credentials found</p>
      </div>
    );
  }
  
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {credentials.map((cred) => (
        <CredentialCard key={cred.tokenId} credential={cred} />
      ))}
    </div>
  );
}

function CredentialCard({ credential }: { credential: Credential }) {
  return (
    <div className={`p-4 rounded-lg border-2 ${
      credential.isRevoked 
        ? 'border-red-300 bg-red-50' 
        : 'border-green-300 bg-green-50'
    }`}>
      <div className="flex justify-between items-start">
        <h3 className="font-semibold">Credential #{credential.tokenId}</h3>
        <span className={`px-2 py-1 text-xs rounded ${
          credential.isRevoked
            ? 'bg-red-200 text-red-800'
            : 'bg-green-200 text-green-800'
        }`}>
          {credential.isRevoked ? 'Revoked' : 'Valid'}
        </span>
      </div>
      <p className="text-sm text-gray-500 mt-2 truncate">
        {credential.metadataURI}
      </p>
    </div>
  );
}
```

## Step 8: Build Reward Claim Component

```tsx
// src/components/RewardClaim.tsx
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ethers } from 'ethers';
import { useWalletStore } from '../store/wallet';
import RewardDistributorABI from '../abi/RewardDistributor.json';

const DISTRIBUTOR_ADDRESS = import.meta.env.VITE_REWARD_DISTRIBUTOR_ADDRESS;

interface ClaimProps {
  campaignId: number;
  amount: string;
  proof: string[];
}

export function RewardClaim({ campaignId, amount, proof }: ClaimProps) {
  const { signer } = useWalletStore();
  const queryClient = useQueryClient();
  
  const { mutate: claim, isPending, isSuccess, error } = useMutation({
    mutationFn: async () => {
      if (!signer) throw new Error('Wallet not connected');
      
      const contract = new ethers.Contract(
        DISTRIBUTOR_ADDRESS,
        RewardDistributorABI,
        signer
      );
      
      const tx = await contract.claimReward(
        campaignId,
        ethers.parseEther(amount),
        proof
      );
      
      await tx.wait();
      return tx;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tokenBalance'] });
      queryClient.invalidateQueries({ queryKey: ['claimStatus', campaignId] });
    },
  });
  
  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h3 className="text-lg font-semibold mb-2">Reward Available</h3>
      <p className="text-3xl font-bold text-blue-600 mb-4">{amount} TRCS</p>
      
      <button
        onClick={() => claim()}
        disabled={isPending || isSuccess}
        className="w-full bg-blue-600 text-white py-3 px-4 rounded-md 
                   hover:bg-blue-700 disabled:opacity-50"
      >
        {isPending ? 'Claiming...' : isSuccess ? 'Claimed!' : 'Claim Reward'}
      </button>
      
      {error && (
        <p className="text-red-600 mt-2">{(error as Error).message}</p>
      )}
    </div>
  );
}
```

## Step 9: Run the Frontend

```bash
cd frontend
npm run dev
```

Open http://localhost:5173 in your browser.

## Step 10: Connect MetaMask

1. Open MetaMask
2. Add Hardhat network:
   - Network Name: Hardhat Local
   - RPC URL: http://127.0.0.1:8545
   - Chain ID: 31337
   - Currency Symbol: ETH
3. Import test account:
   - Private Key: `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80`
4. Click "Connect Wallet" in the app

## Exercise: Add Transaction History

Create a component that shows recent transactions:

```tsx
// src/components/TransactionHistory.tsx
import { useQuery } from '@tanstack/react-query';
import { ethers } from 'ethers';
import { useWalletStore } from '../store/wallet';
import TokenABI from '../abi/Token.json';

const TOKEN_ADDRESS = import.meta.env.VITE_TOKEN_ADDRESS;

export function TransactionHistory() {
  const { address, provider } = useWalletStore();
  
  const { data: transfers } = useQuery({
    queryKey: ['transfers', address],
    queryFn: async () => {
      if (!provider || !address) return [];
      
      const contract = new ethers.Contract(
        TOKEN_ADDRESS,
        TokenABI,
        provider
      );
      
      // Get Transfer events where user is sender or recipient
      const filterFrom = contract.filters.Transfer(address, null);
      const filterTo = contract.filters.Transfer(null, address);
      
      const [fromEvents, toEvents] = await Promise.all([
        contract.queryFilter(filterFrom, -1000), // Last 1000 blocks
        contract.queryFilter(filterTo, -1000),
      ]);
      
      // Combine and sort by block number
      const allEvents = [...fromEvents, ...toEvents]
        .sort((a, b) => b.blockNumber - a.blockNumber)
        .slice(0, 10); // Last 10 transactions
      
      return allEvents.map(event => ({
        hash: event.transactionHash,
        from: event.args?.from,
        to: event.args?.to,
        value: ethers.formatEther(event.args?.value || 0),
        blockNumber: event.blockNumber,
        type: event.args?.from === address ? 'sent' : 'received',
      }));
    },
    enabled: !!address && !!provider,
  });
  
  // Render the transaction list
  // Your implementation here...
}
```

## Common Issues

### MetaMask Not Detected
Install MetaMask or use a Web3-enabled browser.

### Wrong Network
Switch MetaMask to the correct network (Hardhat Local).

### Transaction Failed
Check the console for error details. Common causes:
- Insufficient gas
- Contract reverted
- Nonce issues (reset MetaMask)

### Contract Not Found
Verify contract addresses in `.env` match deployed addresses.

---

*Continue to [Tutorial 5: Security Best Practices →](./05-security-practices.md)*
