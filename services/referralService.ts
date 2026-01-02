// Referral Code Service - Store codes on Pinata IPFS
import { pinJSONToIPFS } from './pinataService';

interface ReferralCode {
  code: string;
  walletAddress: string;
  createdAt: string;
  usedBy: string[];
  totalReferred: number;
}

// Generate unique referral code
export function generateReferralCode(walletAddress: string): string {
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  const shortAddress = walletAddress.slice(2, 6).toUpperCase();
  return `YBOT-${shortAddress}-${randomNum}`;
}

// Store referral code on IPFS via Pinata
export async function storeReferralCode(
  walletAddress: string,
  code: string
): Promise<string> {
  const referralData: ReferralCode = {
    code,
    walletAddress,
    createdAt: new Date().toISOString(),
    usedBy: [],
    totalReferred: 0
  };

  try {
    const ipfsHash = await pinJSONToIPFS(referralData, `referral-${code}`);
    
    // Store in localStorage for quick access
    const localData = {
      code,
      ipfsHash,
      walletAddress,
      createdAt: referralData.createdAt
    };
    localStorage.setItem(`referral_${walletAddress}`, JSON.stringify(localData));
    
    return ipfsHash;
  } catch (error) {
    console.error('Error storing referral code:', error);
    throw error;
  }
}

// Get referral code for wallet
export function getReferralCode(walletAddress: string): string | null {
  const stored = localStorage.getItem(`referral_${walletAddress}`);
  if (stored) {
    const data = JSON.parse(stored);
    return data.code;
  }
  return null;
}

// Track referral usage
export async function trackReferralUsage(
  referralCode: string,
  usedByWallet: string
): Promise<void> {
  try {
    // Store usage record on IPFS
    const usageData = {
      referralCode,
      usedByWallet,
      timestamp: new Date().toISOString()
    };
    
    await pinJSONToIPFS(usageData, `referral-usage-${referralCode}-${Date.now()}`);
    
    // Update local tracking
    const usageKey = `referral_usage_${referralCode}`;
    const existing = localStorage.getItem(usageKey);
    const usageList = existing ? JSON.parse(existing) : [];
    usageList.push(usedByWallet);
    localStorage.setItem(usageKey, JSON.stringify(usageList));
    
  } catch (error) {
    console.error('Error tracking referral usage:', error);
  }
}

// Get referral stats
export function getReferralStats(walletAddress: string): {
  code: string | null;
  totalReferred: number;
  referredWallets: string[];
} {
  const code = getReferralCode(walletAddress);
  
  if (!code) {
    return { code: null, totalReferred: 0, referredWallets: [] };
  }
  
  const usageKey = `referral_usage_${code}`;
  const stored = localStorage.getItem(usageKey);
  const referredWallets = stored ? JSON.parse(stored) : [];
  
  return {
    code,
    totalReferred: referredWallets.length,
    referredWallets
  };
}
