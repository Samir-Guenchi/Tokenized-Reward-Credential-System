/**
 * @file src/store/wallet.ts
 * @description Wallet state management with Zustand
 *
 * =============================================================================
 * LEARNING PATH - Zustand State Management
 * =============================================================================
 *
 * Why Zustand?
 * 1. Minimal boilerplate
 * 2. No providers needed
 * 3. Built-in TypeScript support
 * 4. Easy async actions
 *
 * WALLET STATE:
 * - address: Connected wallet address
 * - chainId: Current network
 * - isConnected: Connection status
 * - balance: ETH balance
 *
 * =============================================================================
 */

import { create } from 'zustand';
import { BrowserProvider, JsonRpcSigner, formatEther, Contract, parseEther } from 'ethers';

// TRCS Token contract address (deployed on localhost)
const TRCS_TOKEN_ADDRESS = '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512';

// Minimal ERC-20 ABI for transfer and balanceOf
const ERC20_ABI = [
  'function transfer(address to, uint256 amount) returns (bool)',
  'function balanceOf(address account) view returns (uint256)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
];

interface WalletState {
  address: string | null;
  chainId: number | null;
  isConnected: boolean;
  isConnecting: boolean;
  balance: string;
  trcsBalance: string;
  signer: JsonRpcSigner | null;
  provider: BrowserProvider | null;
  error: string | null;

  // Actions
  connect: () => Promise<void>;
  disconnect: () => void;
  switchNetwork: (chainId: number) => Promise<void>;
  refreshBalance: () => Promise<void>;
  refreshTRCSBalance: () => Promise<void>;
  transferTRCS: (to: string, amount: string) => Promise<{ hash: string }>;
}

// Expected chain ID (Hardhat local network)
const EXPECTED_CHAIN_ID = 31337;

export const useWalletStore = create<WalletState>((set, get) => ({
  address: null,
  chainId: null,
  isConnected: false,
  isConnecting: false,
  balance: '0',
  trcsBalance: '0',
  signer: null,
  provider: null,
  error: null,

  connect: async () => {
    set({ isConnecting: true, error: null });

    try {
      // Check if MetaMask is installed
      if (typeof window.ethereum === 'undefined') {
        throw new Error('MetaMask is not installed. Please install it to continue.');
      }

      // Create provider
      const provider = new BrowserProvider(window.ethereum);
      
      // Request account access
      const accounts = await provider.send('eth_requestAccounts', []);
      
      if (accounts.length === 0) {
        throw new Error('No accounts found. Please unlock MetaMask.');
      }

      const address = accounts[0];
      const signer = await provider.getSigner();
      const network = await provider.getNetwork();
      const chainId = Number(network.chainId);
      const balance = await provider.getBalance(address);

      set({
        address,
        chainId,
        isConnected: true,
        isConnecting: false,
        balance: formatEther(balance),
        signer,
        provider,
      });

      // Set up event listeners
      window.ethereum.on('accountsChanged', async (accounts: unknown) => {
        const accountsArr = accounts as string[];
        if (accountsArr.length === 0) {
          get().disconnect();
        } else {
          const newBalance = await provider.getBalance(accountsArr[0]);
          set({
            address: accountsArr[0],
            balance: formatEther(newBalance),
          });
        }
      });

      window.ethereum.on('chainChanged', (chainIdHex: unknown) => {
        const newChainId = parseInt(chainIdHex as string, 16);
        set({ chainId: newChainId });
      });

    } catch (error) {
      set({
        isConnecting: false,
        error: error instanceof Error ? error.message : 'Failed to connect wallet',
      });
    }
  },

  disconnect: () => {
    set({
      address: null,
      chainId: null,
      isConnected: false,
      balance: '0',
      signer: null,
      provider: null,
      error: null,
    });
  },

  switchNetwork: async (chainId: number) => {
    try {
      if (!window.ethereum) {
        throw new Error('MetaMask is not installed');
      }

      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${chainId.toString(16)}` }],
      });
    } catch (error: unknown) {
      // If the chain hasn't been added, add it
      if ((error as { code?: number }).code === 4902 && window.ethereum) {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [
            {
              chainId: `0x${EXPECTED_CHAIN_ID.toString(16)}`,
              chainName: 'Hardhat Local',
              rpcUrls: ['http://127.0.0.1:8545'],
              nativeCurrency: {
                name: 'ETH',
                symbol: 'ETH',
                decimals: 18,
              },
            },
          ],
        });
      } else {
        throw error;
      }
    }
  },

  refreshBalance: async () => {
    const { provider, address } = get();
    if (provider && address) {
      const balance = await provider.getBalance(address);
      set({ balance: formatEther(balance) });
      // Also refresh TRCS balance
      get().refreshTRCSBalance();
    }
  },

  refreshTRCSBalance: async () => {
    const { signer, address } = get();
    if (signer && address) {
      try {
        const tokenContract = new Contract(TRCS_TOKEN_ADDRESS, ERC20_ABI, signer);
        const balance = await tokenContract.balanceOf(address);
        set({ trcsBalance: formatEther(balance) });
      } catch (error) {
        console.error('Failed to get TRCS balance:', error);
      }
    }
  },

  transferTRCS: async (to: string, amount: string) => {
    const { signer } = get();
    if (!signer) {
      throw new Error('Wallet not connected');
    }
    
    const tokenContract = new Contract(TRCS_TOKEN_ADDRESS, ERC20_ABI, signer);
    const tx = await tokenContract.transfer(to, parseEther(amount));
    const receipt = await tx.wait();
    
    // Refresh balance after transfer
    get().refreshTRCSBalance();
    
    return { hash: receipt.hash };
  },
}));

// Auto-reconnect on page load if wallet was previously connected
if (typeof window !== 'undefined' && window.ethereum) {
  window.ethereum.request({ method: 'eth_accounts' }).then((accounts) => {
    const accountsArr = accounts as string[];
    if (accountsArr.length > 0) {
      // Wallet is already connected, trigger connect
      useWalletStore.getState().connect();
    }
  }).catch(console.error);
}

// Type declarations for window.ethereum
declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      on: (event: string, callback: (...args: unknown[]) => void) => void;
      removeListener: (event: string, callback: (...args: unknown[]) => void) => void;
    };
  }
}
