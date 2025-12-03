/**
 * Smart Wallet Service - Alchemy Account Kit Integration
 * Handles smart wallet creation, session keys, and AI agent permissions
 */

import { createSmartWalletClient } from "@account-kit/wallet-client";
import { alchemy } from "@account-kit/infra";
import { LocalAccountSigner } from "@aa-sdk/core";
import { encodeFunctionData, parseEther, type Hex } from 'viem';

// Contract addresses
const YBOT_STAKING_CONTRACT = import.meta.env.VITE_STAKING_TESTNET || '0x600a169769319e082A98365196db0437e7463389';
const YBOT_TOKEN_ADDRESS = import.meta.env.VITE_YBOT_TOKEN_TESTNET || '0x5cBbBe32b2893DDCca439372F6AD120C848B2712';

// Alchemy config
const ALCHEMY_API_KEY = import.meta.env.VITE_ALCHEMY_API_KEY || import.meta.env.VITE_ALCHEMY_KEY;
const ALCHEMY_POLICY_ID = import.meta.env.VITE_ALCHEMY_POLICY_ID;

// BSC Testnet chain config
const bscTestnet = {
  id: 97,
  name: 'BSC Testnet',
  network: 'bsc-testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'tBNB',
    symbol: 'tBNB',
  },
  rpcUrls: {
    default: {
      http: ['https://bsc-testnet-dataseed.bnbchain.org'],
    },
  },
  blockExplorers: {
    default: { name: 'BscScan', url: 'https://testnet.bscscan.com' },
  },
  testnet: true,
};

export interface SmartWalletState {
  address: string | null;
  isAuthenticated: boolean;
  hasSessionKey: boolean;
  sessionKeyExpiry: number | null;
  balance: string;
}

export interface SessionKeyPermissions {
  maxAmount: string;
  allowedContracts: string[];
  expiryHours: number;
}

// Session key storage
const SESSION_KEY_STORAGE_KEY = 'ybot_session_keys';

export interface StoredSessionKey {
  walletAddress: string;
  permissions: SessionKeyPermissions;
  createdAt: number;
  expiryAt: number;
  isActive: boolean;
}

/**
 * Get stored session keys from localStorage
 */
export const getStoredSessionKeys = (): StoredSessionKey[] => {
  try {
    const stored = localStorage.getItem(SESSION_KEY_STORAGE_KEY);
    if (!stored) return [];
    return JSON.parse(stored);
  } catch (error) {
    console.error('Error reading session keys:', error);
    return [];
  }
};

/**
 * Store session key in localStorage
 */
export const storeSessionKey = (sessionKey: StoredSessionKey): void => {
  try {
    const existing = getStoredSessionKeys();
    // Remove any existing session for this wallet
    const filtered = existing.filter(sk => sk.walletAddress !== sessionKey.walletAddress);
    filtered.push(sessionKey);
    localStorage.setItem(SESSION_KEY_STORAGE_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error('Error storing session key:', error);
  }
};

/**
 * Check if a wallet has an active session key
 */
export const hasActiveSessionKey = (walletAddress: string): boolean => {
  const sessionKeys = getStoredSessionKeys();
  const sessionKey = sessionKeys.find(sk => 
    sk.walletAddress.toLowerCase() === walletAddress.toLowerCase()
  );
  
  if (!sessionKey) return false;
  
  // Check if expired
  if (Date.now() > sessionKey.expiryAt) {
    // Remove expired session key
    revokeSessionKey(walletAddress);
    return false;
  }
  
  return sessionKey.isActive;
};

/**
 * Get session key for a wallet
 */
export const getSessionKey = (walletAddress: string): StoredSessionKey | null => {
  const sessionKeys = getStoredSessionKeys();
  const sessionKey = sessionKeys.find(sk => 
    sk.walletAddress.toLowerCase() === walletAddress.toLowerCase()
  );
  
  if (!sessionKey) return null;
  
  // Check if expired
  if (Date.now() > sessionKey.expiryAt) {
    revokeSessionKey(walletAddress);
    return null;
  }
  
  return sessionKey;
};

/**
 * Revoke session key for a wallet
 */
export const revokeSessionKey = (walletAddress: string): void => {
  try {
    const existing = getStoredSessionKeys();
    const filtered = existing.filter(sk => 
      sk.walletAddress.toLowerCase() !== walletAddress.toLowerCase()
    );
    localStorage.setItem(SESSION_KEY_STORAGE_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error('Error revoking session key:', error);
  }
};

/**
 * Grant session key permissions to AI agent
 * This is a simplified version - in production, you'd use Alchemy's actual session key API
 */
export const grantSessionKeyPermissions = async (
  walletAddress: string,
  permissions: SessionKeyPermissions
): Promise<StoredSessionKey> => {
  console.log('[SmartWallet] Granting session key permissions for:', walletAddress);
  console.log('[SmartWallet] Permissions:', permissions);
  
  const now = Date.now();
  const expiryAt = now + (permissions.expiryHours * 60 * 60 * 1000);
  
  const sessionKey: StoredSessionKey = {
    walletAddress,
    permissions,
    createdAt: now,
    expiryAt,
    isActive: true
  };
  
  storeSessionKey(sessionKey);
  
  console.log('[SmartWallet] Session key granted, expires:', new Date(expiryAt).toISOString());
  
  return sessionKey;
};

/**
 * Check if AI agent can execute a trade for this wallet
 */
export const canAIExecuteTrade = (
  walletAddress: string,
  amount: number,
  contractAddress: string
): { canExecute: boolean; reason: string } => {
  const sessionKey = getSessionKey(walletAddress);
  
  if (!sessionKey) {
    return { canExecute: false, reason: 'No active session key. Please authorize AI trading first.' };
  }
  
  // Check max amount
  const maxAmount = parseFloat(sessionKey.permissions.maxAmount);
  if (amount > maxAmount) {
    return { 
      canExecute: false, 
      reason: `Amount ${amount} exceeds max allowed ${maxAmount}. Please update session permissions.` 
    };
  }
  
  // Check allowed contracts
  const isAllowedContract = sessionKey.permissions.allowedContracts.some(
    c => c.toLowerCase() === contractAddress.toLowerCase()
  );
  
  if (!isAllowedContract) {
    return { 
      canExecute: false, 
      reason: `Contract ${contractAddress} is not in allowed list.` 
    };
  }
  
  return { canExecute: true, reason: 'OK' };
};

/**
 * Get default session key permissions for YieldBot
 */
export const getDefaultPermissions = (): SessionKeyPermissions => ({
  maxAmount: '1000', // Max 1000 YBOT per transaction
  allowedContracts: [
    YBOT_STAKING_CONTRACT,
    YBOT_TOKEN_ADDRESS
  ],
  expiryHours: 24 // 24 hour sessions
});

/**
 * Format session key expiry for display
 */
export const formatSessionExpiry = (expiryAt: number): string => {
  const now = Date.now();
  const remaining = expiryAt - now;
  
  if (remaining <= 0) return 'Expired';
  
  const hours = Math.floor(remaining / (1000 * 60 * 60));
  const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
  
  if (hours > 0) {
    return `${hours}h ${minutes}m remaining`;
  }
  return `${minutes}m remaining`;
};
