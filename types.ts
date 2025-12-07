export enum WalletState {
  DISCONNECTED,
  CONNECTING,
  CONNECTED
}

export interface UserFinanceData {
  balanceBNB: string;
  balanceYBOT: string;
  usdtBalance: string; // USDT balance for vault deposits
  bnbBalance: string; // BNB balance for vault deposits
  stakedAmount: string; // USDT deposited in vault
  pendingYield: string; // Pending YBOT rewards
  creditScore: number;
  creditTier: 'Iron' | 'Bronze' | 'Silver' | 'Gold' | 'Platinum';
  hasSBT: boolean; // Soulbound Token status
}

export interface VaultStats {
  tvl: string;
  apy: number;
  totalYieldDistributed: string;
  nextRebalance: string;
}

import type { Eip1193Provider } from 'ethers';

export interface NFTItem {
  id: number;
  name: string;
  description: string;
  image: string; // URL or Base64 - the actual NFT image
  previewImage?: string; // Optional key preview image
  tier: string;
  tokenId: number;
  attributes?: {
    trait_type: string;
    value: string;
    rarity?: string;
  }[];
  rarity?: string;
}

export const TIERS = {
  Iron: { min: 0, color: '#64748b' },
  Bronze: { min: 300, color: '#92400e' },
  Silver: { min: 500, color: '#94a3b8' },
  Gold: { min: 700, color: '#f59e0b' },
  Platinum: { min: 900, color: '#06b6d4' },
};