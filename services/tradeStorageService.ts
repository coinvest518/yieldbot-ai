/**
 * Trade Storage Service - IPFS/Pinata based trade history
 * Stores user trade history securely on IPFS for decentralized access
 */

import { uploadMetadataToPinata } from './pinataService';

export interface TradeRecord {
  id: string;
  timestamp: number;
  action: 'stake' | 'unstake' | 'swap' | 'deposit' | 'withdraw';
  token: string;
  amount: string;
  txHash?: string;
  protocol?: string;
  pool?: string;
  aiDecision?: string;
  status: 'pending' | 'success' | 'failed';
  gasUsed?: string;
}

export interface TradeHistoryData {
  walletAddress: string;
  version: number;
  lastUpdated: number;
  trades: TradeRecord[];
}

// Local storage key for IPFS hash mappings
const TRADE_HASHES_KEY = 'ybot_trade_ipfs_hashes';

/**
 * Generate a unique trade ID
 */
export const generateTradeId = (): string => {
  return `trade_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
};

/**
 * Get stored IPFS hashes for a wallet from localStorage
 */
const getStoredHashes = (walletAddress: string): string[] => {
  try {
    const allHashes = localStorage.getItem(TRADE_HASHES_KEY);
    if (!allHashes) return [];
    
    const parsed = JSON.parse(allHashes);
    return parsed[walletAddress.toLowerCase()] || [];
  } catch (error) {
    console.error('Error reading trade hashes:', error);
    return [];
  }
};

/**
 * Store IPFS hash mapping for a wallet
 */
const storeHash = (walletAddress: string, ipfsHash: string): void => {
  try {
    const allHashes = JSON.parse(localStorage.getItem(TRADE_HASHES_KEY) || '{}');
    const walletKey = walletAddress.toLowerCase();
    
    if (!allHashes[walletKey]) {
      allHashes[walletKey] = [];
    }
    
    // Only store last 50 hashes to prevent unbounded growth
    allHashes[walletKey] = [...allHashes[walletKey].slice(-49), ipfsHash];
    
    localStorage.setItem(TRADE_HASHES_KEY, JSON.stringify(allHashes));
  } catch (error) {
    console.error('Error storing trade hash:', error);
  }
};

/**
 * Save a new trade to IPFS via Pinata
 */
export const saveTradeToIPFS = async (
  walletAddress: string,
  trade: TradeRecord
): Promise<string | null> => {
  try {
    console.log('[TradeStorage] Saving trade to IPFS:', trade);
    
    const tradeData = {
      walletAddress: walletAddress.toLowerCase(),
      trade,
      version: 1,
      timestamp: Date.now(),
      appName: 'YieldBot AI'
    };
    
    // Upload to Pinata
    const ipfsHash = await uploadMetadataToPinata(tradeData);
    
    // Store hash mapping locally
    storeHash(walletAddress, ipfsHash);
    
    console.log('[TradeStorage] Trade saved to IPFS:', ipfsHash);
    
    return ipfsHash;
  } catch (error) {
    console.error('[TradeStorage] Error saving trade to IPFS:', error);
    return null;
  }
};

/**
 * Get trade history from IPFS
 */
export const getTradeHistoryFromIPFS = async (
  walletAddress: string
): Promise<TradeRecord[]> => {
  try {
    const hashes = getStoredHashes(walletAddress);
    
    if (hashes.length === 0) {
      console.log('[TradeStorage] No trade history found for wallet');
      return [];
    }
    
    console.log('[TradeStorage] Fetching', hashes.length, 'trades from IPFS');
    
    // Fetch trades from IPFS (using Pinata gateway)
    const trades: TradeRecord[] = [];
    
    for (const hash of hashes.slice(-20)) { // Only fetch last 20 trades
      try {
        const response = await fetch(`https://gateway.pinata.cloud/ipfs/${hash}`, {
          method: 'GET',
          headers: { 'Accept': 'application/json' }
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.trade) {
            trades.push(data.trade);
          }
        }
      } catch (fetchError) {
        console.warn('[TradeStorage] Failed to fetch trade:', hash, fetchError);
      }
    }
    
    // Sort by timestamp descending (newest first)
    trades.sort((a, b) => b.timestamp - a.timestamp);
    
    return trades;
  } catch (error) {
    console.error('[TradeStorage] Error fetching trade history:', error);
    return [];
  }
};

/**
 * Get local trade history (from localStorage cache)
 * Faster than IPFS but may be out of sync
 */
export const getLocalTradeHistory = (walletAddress: string): TradeRecord[] => {
  try {
    const key = `ybot_trades_local_${walletAddress.toLowerCase()}`;
    const stored = localStorage.getItem(key);
    if (!stored) return [];
    
    const trades: TradeRecord[] = JSON.parse(stored);
    return trades.sort((a, b) => b.timestamp - a.timestamp);
  } catch (error) {
    console.error('[TradeStorage] Error reading local trades:', error);
    return [];
  }
};

/**
 * Save trade to local cache (for fast access)
 */
export const saveTradeToLocal = (walletAddress: string, trade: TradeRecord): void => {
  try {
    const key = `ybot_trades_local_${walletAddress.toLowerCase()}`;
    const existing = getLocalTradeHistory(walletAddress);
    
    // Keep last 100 trades
    const updated = [trade, ...existing].slice(0, 100);
    
    localStorage.setItem(key, JSON.stringify(updated));
  } catch (error) {
    console.error('[TradeStorage] Error saving local trade:', error);
  }
};

/**
 * Record a trade (saves to both local and IPFS)
 */
export const recordTrade = async (
  walletAddress: string,
  trade: Omit<TradeRecord, 'id' | 'timestamp'>
): Promise<TradeRecord> => {
  const fullTrade: TradeRecord = {
    ...trade,
    id: generateTradeId(),
    timestamp: Date.now()
  };
  
  // Save to local cache immediately
  saveTradeToLocal(walletAddress, fullTrade);
  
  // Save to IPFS in background (don't await)
  saveTradeToIPFS(walletAddress, fullTrade).catch(err => {
    console.error('[TradeStorage] Background IPFS save failed:', err);
  });
  
  return fullTrade;
};

/**
 * Get trade statistics for a wallet
 */
export const getTradeStats = (trades: TradeRecord[]): {
  totalTrades: number;
  successfulTrades: number;
  failedTrades: number;
  mostUsedAction: string;
  totalVolume: number;
} => {
  if (trades.length === 0) {
    return {
      totalTrades: 0,
      successfulTrades: 0,
      failedTrades: 0,
      mostUsedAction: 'N/A',
      totalVolume: 0
    };
  }
  
  const actionCounts: Record<string, number> = {};
  let successCount = 0;
  let failCount = 0;
  let totalVolume = 0;
  
  for (const trade of trades) {
    actionCounts[trade.action] = (actionCounts[trade.action] || 0) + 1;
    
    if (trade.status === 'success') successCount++;
    else if (trade.status === 'failed') failCount++;
    
    totalVolume += parseFloat(trade.amount) || 0;
  }
  
  const mostUsedAction = Object.entries(actionCounts)
    .sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';
  
  return {
    totalTrades: trades.length,
    successfulTrades: successCount,
    failedTrades: failCount,
    mostUsedAction,
    totalVolume
  };
};

/**
 * Format trade for display
 */
export const formatTradeDisplay = (trade: TradeRecord): string => {
  const date = new Date(trade.timestamp).toLocaleString();
  const action = trade.action.charAt(0).toUpperCase() + trade.action.slice(1);
  const status = trade.status === 'success' ? '✅' : trade.status === 'failed' ? '❌' : '⏳';
  
  return `${status} ${action} ${trade.amount} ${trade.token} - ${date}`;
};
