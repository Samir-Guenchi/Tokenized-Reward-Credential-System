/**
 * @file src/services/api.ts
 * @description API client for backend communication
 */

import axios from 'axios';

const API_BASE_URL = '/api';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('auth_token');
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  getNonce: (address: string) =>
    api.get<{ data: { message: string; nonce: string } }>(`/auth/nonce?address=${address}`),
  
  verify: (address: string, signature: string, nonce: string) =>
    api.post<{ data: { token: string; address: string; roles: string[] } }>('/auth/verify', {
      address,
      signature,
      nonce,
    }),
  
  getMe: () =>
    api.get<{
      data: {
        address: string;
        roles: string[];
        balances: { eth: string; token: string };
      };
    }>('/auth/me'),
};

// Token API
export const tokenApi = {
  getInfo: () =>
    api.get<{
      data: {
        name: string;
        symbol: string;
        decimals: number;
        totalSupply: string;
        cap: string;
      };
    }>('/tokens/info'),
  
  getBalance: (address: string) =>
    api.get<{ data: { address: string; balance: string } }>(`/tokens/balance/${address}`),
  
  mint: (to: string, amount: string) =>
    api.post<{
      data: {
        message: string;
        transactionHash: string;
        blockNumber: number;
      };
    }>('/tokens/mint', { to, amount }),
  
  transfer: (to: string, amount: string) =>
    api.post<{
      data: {
        message: string;
        transactionHash: string;
        blockNumber: number;
      };
    }>('/tokens/transfer', { to, amount }),
};

// Credential API
export const credentialApi = {
  getCredential: (tokenId: number) =>
    api.get<{
      data: {
        tokenId: number;
        owner: string;
        tokenURI: string;
        isValid: boolean;
        credentialType: number;
        typeName: string;
        metadata: {
          issuer: string;
          issuedAt: number;
          expiresAt: number;
          revoked: boolean;
        };
      };
    }>(`/credentials/${tokenId}`),
  
  getByOwner: (address: string) =>
    api.get<{ data: { address: string; credentialCount: number } }>(`/credentials/owner/${address}`),
  
  verify: (tokenId: number) =>
    api.get<{
      data: {
        tokenId: number;
        isValid: boolean;
        owner: string;
        credentialType: string;
      };
    }>(`/credentials/${tokenId}/verify`),
  
  issue: (data: {
    recipient: string;
    credentialType: number;
    expiresAt: number;
    name: string;
    description: string;
  }) => api.post('/credentials/issue', data),
  
  revoke: (tokenId: number, reason: string) =>
    api.post('/credentials/revoke', { tokenId, reason }),
};

// Reward API
export const rewardApi = {
  getStats: () =>
    api.get<{
      data: {
        tokenAddress: string;
        totalDistributed: string;
        totalClaimed: string;
        pendingDistribution: string;
      };
    }>('/rewards/stats'),
  
  getVesting: (address: string) =>
    api.get<{
      data: {
        address: string;
        schedule: {
          totalAmount: string;
          startTime: string;
          cliffEnd: string;
          vestingEnd: string;
          claimed: string;
          claimable: string;
          revoked: boolean;
        };
        progress: {
          percent: string;
          isCliffPassed: boolean;
          isFullyVested: boolean;
        };
      };
    }>(`/rewards/vesting/${address}`),
  
  getClaimable: (address: string) =>
    api.get<{
      data: {
        address: string;
        claimable: string;
        claimed: string;
        total: string;
      };
    }>(`/rewards/claimable/${address}`),
  
  claimRewards: (address: string) =>
    api.post<{
      data: {
        message: string;
        address: string;
        amount: string;
        transactionHash: string;
        blockNumber: number;
      };
    }>('/rewards/claim', { address }),
  
  createVesting: (data: {
    beneficiary: string;
    totalAmount: string;
    startTime: number;
    cliffDuration: number;
    duration: number;
  }) => api.post('/rewards/vesting', data),
};
