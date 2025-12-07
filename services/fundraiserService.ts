/**
 * Fundraiser Service - Bonding Curve Token Sale
 * Connects frontend to BondingCurveFundraiser contract
 */

import { ethers } from 'ethers';
import { getEthereumObject } from './web3Service';

// Contract ABI (minimal for frontend) - individual functions for better error handling
const FUNDRAISER_ABI = [
  // View functions
  "function getCurrentPricePerToken() view returns (uint256)",
  "function getBnbPriceUsd() view returns (uint256)",
  "function totalTokensSold() view returns (uint256)",
  "function totalUsdRaised() view returns (uint256)",
  "function contractFeePercent() view returns (uint256)",
  "function calculateTokensForUsd(uint256 usdAmount) view returns (uint256 tokensMint, uint256 feeUsd)",
  "function calculateUsdForTokens(uint256 tokenAmount) view returns (uint256 usdAmount, uint256 feeUsd)",
  "function getUserContribution(address user) view returns (uint256)",
  "function getUserTokenBalance(address user) view returns (uint256)",
  "function getStats() view returns (uint256 _totalTokensSold, uint256 _totalUsdRaised, uint256 _currentPrice, uint256 _bnbPrice)",
  // Write functions
  "function buyWithUsdc(uint256 usdcAmount, uint256 minTokensOut)",
  "function buyWithBnb(uint256 minTokensOut) payable",
  "function sellTokens(uint256 tokenAmount, uint256 minUsdcOut)",
  // Events
  "event TokensPurchased(address indexed buyer, uint256 usdAmount, uint256 tokensMinted, uint256 pricePerToken)",
  "event TokensSold(address indexed seller, uint256 tokenAmount, uint256 usdReceived, uint256 pricePerToken)"
];

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)"
];

// Contract addresses (to be updated after deployment)
const FUNDRAISER_ADDRESSES = {
  mainnet: import.meta.env.VITE_BONDINGCURVE_MAINNET || '0x06826d64d31c6A05D17D35ae658f47a3827bdd51',
  testnet: import.meta.env.VITE_FUNDRAISER_TESTNET || '0x51AD8f34C7c26Ddfc2641E711eEC66193a927f5b'
};

const USDC_ADDRESSES = {
  mainnet: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', // BSC USDC
  testnet: '0x64544969ed7EBf5f083679233325356EbE738930'  // BSC Testnet USDC
};

// Bonding curve constants (match contract)
const BASE_PRICE = 0.10; // $0.10 per token
const PRICE_INCREMENT = 0.0001; // Price increase per token sold
const TOKENS_PER_DOLLAR = 10;
const FUNDRAISING_GOAL = 100000; // $100,000 goal

// Types
export interface FundraiserStats {
  totalTokensSold: string;
  totalUsdRaised: string;
  currentPrice: string;
  bnbPrice: string;
  progressPercent: number;
  feePercent: number;
}

export interface UserFundraiserData {
  contribution: string;
  tokenBalance: string;
}

export interface TradeEvent {
  type: 'buy' | 'sell';
  address: string;
  usdAmount: string;
  tokenAmount: string;
  price: string;
  timestamp: Date;
  txHash: string;
}

export interface BondingCurvePoint {
  tokensSold: number;
  price: number;
}

// ============ Utility Functions ============

const getNetworkType = async (): Promise<'mainnet' | 'testnet'> => {
  const ethereum = getEthereumObject();
  if (!ethereum) return 'testnet';
  const chainId = await ethereum.request({ method: 'eth_chainId' });
  return chainId === '0x38' ? 'mainnet' : 'testnet';
};

const getFundraiserAddress = async (): Promise<string> => {
  const network = await getNetworkType();
  return FUNDRAISER_ADDRESSES[network];
};

const getUsdcAddress = async (): Promise<string> => {
  const network = await getNetworkType();
  return USDC_ADDRESSES[network];
};

// ============ Read Functions ============

/**
 * Get fundraiser statistics from contract
 * Uses individual calls to avoid Chainlink oracle dependency in getStats()
 */
export const getFundraiserStats = async (): Promise<FundraiserStats> => {
  const ethereum = getEthereumObject();
  
  // Return mock data if no wallet connected - prevents RPC errors on page load
  if (!ethereum) {
    return getMockStats();
  }

  // Check if wallet is actually connected before making RPC calls
  try {
    const accounts = await ethereum.request({ method: 'eth_accounts' });
    if (!accounts || accounts.length === 0) {
      // Wallet not connected, return mock data to avoid RPC errors
      return getMockStats();
    }
  } catch (e) {
    return getMockStats();
  }

  try {
    const provider = new ethers.BrowserProvider(ethereum);
    const address = await getFundraiserAddress();
    
    if (!address) {
      console.log('Fundraiser contract not deployed yet, using mock data');
      return getMockStats();
    }
    
    const contract = new ethers.Contract(address, FUNDRAISER_ABI, provider);
    
    // Call individual view functions to avoid getStats() which calls Chainlink
    // These calls won't revert even if Chainlink is not working
    const [totalTokensSold, totalUsdRaised, currentPrice, feePercent] = await Promise.all([
      contract.totalTokensSold().catch(() => BigInt(0)),
      contract.totalUsdRaised().catch(() => BigInt(0)),
      contract.getCurrentPricePerToken().catch(() => ethers.parseUnits(BASE_PRICE.toString(), 18)),
      contract.contractFeePercent().catch(() => BigInt(5))
    ]);

    // Try to get BNB price separately, fallback to CoinGecko or default
    let bnbPrice = BigInt(0);
    try {
      bnbPrice = await contract.getBnbPriceUsd();
    } catch (e) {
      console.log('Chainlink BNB price unavailable, using fallback');
      // Fallback: fetch from CoinGecko or use default
      bnbPrice = await fetchBnbPriceFallback();
    }

    const totalUsdRaisedNum = parseFloat(ethers.formatUnits(totalUsdRaised, 18));
    
    return {
      totalTokensSold: ethers.formatUnits(totalTokensSold, 18),
      totalUsdRaised: totalUsdRaisedNum.toFixed(2),
      currentPrice: ethers.formatUnits(currentPrice, 18),
      bnbPrice: ethers.formatUnits(bnbPrice, 18),
      progressPercent: (totalUsdRaisedNum / FUNDRAISING_GOAL) * 100,
      feePercent: Number(feePercent)
    };
  } catch (error) {
    console.error('Error fetching fundraiser stats:', error);
    return getMockStats();
  }
};

/**
 * Fallback BNB price fetcher when Chainlink is unavailable
 */
const fetchBnbPriceFallback = async (): Promise<bigint> => {
  try {
    // Try CoinGecko API
    const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=binancecoin&vs_currencies=usd');
    const data = await response.json();
    const price = data.binancecoin?.usd || 650;
    // Convert to 18 decimals (same format as Chainlink returns after contract conversion)
    return ethers.parseUnits(price.toString(), 18);
  } catch (e) {
    console.log('CoinGecko fetch failed, using default BNB price');
    // Default fallback: $650
    return ethers.parseUnits('650', 18);
  }
};

/**
 * Get user's contribution and balance
 */
export const getUserFundraiserData = async (userAddress: string): Promise<UserFundraiserData> => {
  const ethereum = getEthereumObject();
  
  if (!ethereum || !userAddress) {
    return { contribution: '0', tokenBalance: '0' };
  }

  // Check if wallet is actually connected
  try {
    const accounts = await ethereum.request({ method: 'eth_accounts' });
    if (!accounts || accounts.length === 0) {
      return { contribution: '0', tokenBalance: '0' };
    }
  } catch (e) {
    return { contribution: '0', tokenBalance: '0' };
  }

  try {
    const provider = new ethers.BrowserProvider(ethereum);
    const address = await getFundraiserAddress();
    
    if (!address) {
      return { contribution: '0', tokenBalance: '0' };
    }
    
    const contract = new ethers.Contract(address, FUNDRAISER_ABI, provider);
    
    const [contribution, tokenBalance] = await Promise.all([
      contract.getUserContribution(userAddress),
      contract.getUserTokenBalance(userAddress)
    ]);

    return {
      contribution: ethers.formatUnits(contribution, 18),
      tokenBalance: ethers.formatUnits(tokenBalance, 18)
    };
  } catch (error) {
    console.error('Error fetching user fundraiser data:', error);
    return { contribution: '0', tokenBalance: '0' };
  }
};

/**
 * Calculate tokens user will receive for a given amount
 */
export const calculateTokensForAmount = async (
  amount: string, 
  paymentType: 'BNB' | 'USDC'
): Promise<{ tokens: string; fee: string; pricePerToken: string }> => {
  const ethereum = getEthereumObject();
  
  if (!ethereum || !amount || parseFloat(amount) <= 0) {
    return { tokens: '0', fee: '0', pricePerToken: '0' };
  }

  // Check if wallet is actually connected before making RPC calls
  try {
    const accounts = await ethereum.request({ method: 'eth_accounts' });
    if (!accounts || accounts.length === 0) {
      return calculateLocalTokens(amount, paymentType);
    }
  } catch (e) {
    return calculateLocalTokens(amount, paymentType);
  }

  try {
    const provider = new ethers.BrowserProvider(ethereum);
    const address = await getFundraiserAddress();
    
    if (!address) {
      // Calculate locally with mock bonding curve
      return calculateLocalTokens(amount, paymentType);
    }
    
    const contract = new ethers.Contract(address, FUNDRAISER_ABI, provider);
    
    let usdAmount: bigint;
    
    if (paymentType === 'BNB') {
      const bnbPrice = await contract.getBnbPriceUsd();
      const amountWei = ethers.parseEther(amount);
      usdAmount = (amountWei * bnbPrice) / ethers.parseEther('1');
    } else {
      usdAmount = ethers.parseUnits(amount, 18);
    }
    
    const [tokens, fee] = await contract.calculateTokensForUsd(usdAmount);
    const currentPrice = await contract.getCurrentPricePerToken();
    
    return {
      tokens: ethers.formatUnits(tokens, 18),
      fee: ethers.formatUnits(fee, 18),
      pricePerToken: ethers.formatUnits(currentPrice, 18)
    };
  } catch (error) {
    console.error('Error calculating tokens:', error);
    return calculateLocalTokens(amount, paymentType);
  }
};

// ============ Write Functions ============

/**
 * Buy tokens with BNB
 */
export const buyWithBnb = async (amountBnb: string): Promise<string> => {
  const ethereum = getEthereumObject();
  if (!ethereum) throw new Error('Wallet not connected');

  const provider = new ethers.BrowserProvider(ethereum);
  const signer = await provider.getSigner();
  const address = await getFundraiserAddress();

  if (!address) throw new Error('Fundraiser contract not deployed');

  const contract = new ethers.Contract(address, FUNDRAISER_ABI, signer);

  // Calculate expected tokens to set minimum output (with 10% slippage tolerance)
  const { tokens } = await calculateTokensForAmount(amountBnb, 'BNB');
  const minTokensOut = ethers.parseUnits((parseFloat(tokens) * 0.9).toString(), 18);

  const tx = await contract.buyWithBnb(minTokensOut, {
    value: ethers.parseEther(amountBnb)
  });

  await tx.wait();
  return tx.hash;
};

/**
 * Buy tokens with USDC
 */
export const buyWithUsdc = async (amountUsdc: string): Promise<string> => {
  const ethereum = getEthereumObject();
  if (!ethereum) throw new Error('Wallet not connected');

  const provider = new ethers.BrowserProvider(ethereum);
  const signer = await provider.getSigner();
  const fundraiserAddress = await getFundraiserAddress();
  const usdcAddress = await getUsdcAddress();
  
  if (!fundraiserAddress) throw new Error('Fundraiser contract not deployed');
  
  const amountWei = ethers.parseUnits(amountUsdc, 18);
  
  // Approve USDC spending
  const usdcContract = new ethers.Contract(usdcAddress, ERC20_ABI, signer);
  const approveTx = await usdcContract.approve(fundraiserAddress, amountWei);
  await approveTx.wait();
  
  // Buy tokens
  const contract = new ethers.Contract(fundraiserAddress, FUNDRAISER_ABI, signer);
  
  // Calculate expected tokens to set minimum output (with 10% slippage tolerance)
  const { tokens } = await calculateTokensForAmount(amountUsdc, 'USDC');
  const minTokensOut = ethers.parseUnits((parseFloat(tokens) * 0.9).toString(), 18);
  
  const tx = await contract.buyWithUsdc(amountWei, minTokensOut);
  await tx.wait();
  
  return tx.hash;
};

/**
 * Sell tokens back to contract
 */
export const sellTokens = async (tokenAmount: string): Promise<string> => {
  const ethereum = getEthereumObject();
  if (!ethereum) throw new Error('Wallet not connected');

  const provider = new ethers.BrowserProvider(ethereum);
  const signer = await provider.getSigner();
  const address = await getFundraiserAddress();

  if (!address) throw new Error('Fundraiser contract not deployed');

  const contract = new ethers.Contract(address, FUNDRAISER_ABI, signer);
  const amountWei = ethers.parseUnits(tokenAmount, 18);

  // Calculate expected USDC return to set minimum output (with 10% slippage tolerance)
  // For selling, we need to calculate the USD value of tokens
  const expectedValue = await contract.calculateUsdForTokens(amountWei);
  const minUsdcOut = (expectedValue[0] * 90n) / 100n; // 10% slippage tolerance

  const tx = await contract.sellTokens(amountWei, minUsdcOut);
  await tx.wait();

  return tx.hash;
};

// ============ Bonding Curve Visualization ============

/**
 * Generate bonding curve data points for chart
 */
export const generateBondingCurveData = (
  maxTokens: number = 1000000,
  currentTokensSold: number = 0
): BondingCurvePoint[] => {
  const points: BondingCurvePoint[] = [];
  const step = maxTokens / 100; // 100 data points
  
  for (let i = 0; i <= 100; i++) {
    const tokensSold = i * step;
    const price = BASE_PRICE + (tokensSold * PRICE_INCREMENT);
    points.push({ tokensSold, price });
  }
  
  return points;
};

/**
 * Get current position on bonding curve
 */
export const getCurrentCurvePosition = (tokensSold: number): BondingCurvePoint => {
  return {
    tokensSold,
    price: BASE_PRICE + (tokensSold * PRICE_INCREMENT)
  };
};

// ============ Event Listening (for live feed) ============

/**
 * Subscribe to purchase events using polling instead of eth_newFilter
 * BSC public RPC nodes don't support event filters, so we poll for new events
 */
export const subscribeToPurchaseEvents = (
  callback: (event: TradeEvent) => void
): (() => void) => {
  let isActive = true;
  let lastCheckedTxHashes = new Set<string>();
  
  const pollForNewEvents = async () => {
    if (!isActive) return;
    
    try {
      const events = await fetchContractEvents('all', 20);
      
      // Find new events we haven't seen
      for (const event of events) {
        if (!lastCheckedTxHashes.has(event.txHash)) {
          // Check if this is a recent event (within last 2 minutes)
          const isRecent = Date.now() - event.timestamp.getTime() < 120000;
          if (isRecent && lastCheckedTxHashes.size > 0) {
            // Only callback for truly new events after initial load
            callback(event);
          }
          lastCheckedTxHashes.add(event.txHash);
        }
      }
      
      // Keep set from growing too large
      if (lastCheckedTxHashes.size > 100) {
        const txArray = Array.from(lastCheckedTxHashes);
        lastCheckedTxHashes = new Set(txArray.slice(-50));
      }
    } catch (error) {
      console.warn('Error polling for events:', error);
    }
    
    // Poll every 15 seconds if still active
    if (isActive) {
      setTimeout(pollForNewEvents, 15000);
    }
  };
  
  // Start polling after a short delay
  setTimeout(pollForNewEvents, 2000);
  
  // Return cleanup function
  return () => {
    isActive = false;
  };
};

// ============ Mock Data ============

const getMockStats = (): FundraiserStats => {
  // Simulate some progress
  const mockTokensSold = 125000;
  const mockUsdRaised = 15000;
  
  return {
    totalTokensSold: mockTokensSold.toString(),
    totalUsdRaised: mockUsdRaised.toFixed(2),
    currentPrice: (BASE_PRICE + mockTokensSold * PRICE_INCREMENT).toFixed(4),
    bnbPrice: '650.00',
    progressPercent: (mockUsdRaised / FUNDRAISING_GOAL) * 100,
    feePercent: 5
  };
};

const calculateLocalTokens = (
  amount: string, 
  paymentType: 'BNB' | 'USDC'
): { tokens: string; fee: string; pricePerToken: string } => {
  const amountNum = parseFloat(amount);
  let usdValue = amountNum;
  
  if (paymentType === 'BNB') {
    usdValue = amountNum * 650; // Approximate BNB price
  }
  
  const fee = usdValue * 0.05; // 5% fee
  const invested = usdValue - fee;
  const currentPrice = BASE_PRICE; // Simplified
  const tokens = (invested * TOKENS_PER_DOLLAR) / currentPrice;
  
  return {
    tokens: tokens.toFixed(2),
    fee: fee.toFixed(2),
    pricePerToken: currentPrice.toFixed(4)
  };
};

// ============ Moralis Event Integration (REAL DATA) ============

const MORALIS_API_KEY = import.meta.env.VITE_MORALIS_KEY;
const CHAIN_ID = '0x61'; // BSC Testnet
const CHAIN_ID_DECIMAL = 97; // BSC Testnet decimal

// Proper event topic hashes (keccak256)
const EVENT_TOPICS = {
  TokensPurchased: ethers.id('TokensPurchased(address,uint256,uint256,uint256)'),
  TokensSold: ethers.id('TokensSold(address,uint256,uint256,uint256)')
};

// Cache to prevent repeated API calls
let eventsCache: { data: TradeEvent[]; timestamp: number } | null = null;
const CACHE_TTL = 60000; // 60 seconds - increase cache time to reduce RPC calls

// Use multiple RPC endpoints for reliability - MAINNET!
const RPC_ENDPOINTS = [
  'https://bsc-dataseed.binance.org',
  'https://bsc-dataseed1.binance.org',
  'https://bsc-dataseed2.binance.org',
  'https://bsc-dataseed3.binance.org',
  'https://bsc-dataseed4.binance.org',
  'https://bsc.publicnode.com'
];

let currentRpcIndex = 0;

const getNextRpcProvider = (): ethers.JsonRpcProvider => {
  const url = RPC_ENDPOINTS[currentRpcIndex];
  currentRpcIndex = (currentRpcIndex + 1) % RPC_ENDPOINTS.length;
  return new ethers.JsonRpcProvider(url);
};

/**
 * Fetch contract events using direct RPC (getLogs) - works on all chains
 * Uses smaller block ranges and retry logic to avoid rate limiting
 */
export const fetchContractEvents = async (
  eventType: 'TokensPurchased' | 'TokensSold' | 'all' = 'all',
  limit: number = 100
): Promise<TradeEvent[]> => {
  const contractAddress = await getFundraiserAddress();
  if (!contractAddress) {
    console.log('No contract address, returning empty');
    return [];
  }

  // Check cache first
  if (eventsCache && Date.now() - eventsCache.timestamp < CACHE_TTL) {
    console.log('Using cached events');
    return eventsCache.data;
  }

  // Try with retries using different RPCs
  for (let attempt = 0; attempt < RPC_ENDPOINTS.length; attempt++) {
    try {
      const provider = getNextRpcProvider();
      
      // Get current block
      const currentBlock = await provider.getBlockNumber();
      // Use smaller block range to avoid rate limits (1000 blocks instead of 10000)
      const fromBlock = Math.max(0, currentBlock - 2000);
      
      console.log(`Fetching events from block ${fromBlock} to ${currentBlock} (attempt ${attempt + 1})`);

      const filter = {
        address: contractAddress,
        fromBlock: fromBlock,
        toBlock: 'latest' as const
      };

      const logs = await provider.getLogs(filter);
      console.log(`Found ${logs.length} logs from contract`);

      // Parse logs into TradeEvent format
      const events: TradeEvent[] = [];
      
      for (const log of logs) {
        const topic0 = log.topics[0];
        
        // Check if it's a purchase or sell event
        const isPurchase = topic0 === EVENT_TOPICS.TokensPurchased;
        const isSell = topic0 === EVENT_TOPICS.TokensSold;
        
        if (!isPurchase && !isSell) continue;
        if (eventType === 'TokensPurchased' && !isPurchase) continue;
        if (eventType === 'TokensSold' && !isSell) continue;

        try {
          // Topic1 is the indexed buyer/seller address (padded to 32 bytes)
          const addressTopic = log.topics[1] || '0x';
          const address = '0x' + addressTopic.slice(-40);
          
          // Decode the non-indexed parameters from data
          const dataHex = log.data || '0x';
          
          let usdAmount = '0';
          let tokenAmount = '0';
          let pricePerToken = '0';

          if (dataHex.length >= 194) { // 0x + 64*3 = 194 chars for 3 uint256
            const param1 = BigInt('0x' + dataHex.slice(2, 66));
            const param2 = BigInt('0x' + dataHex.slice(66, 130));
            const param3 = BigInt('0x' + dataHex.slice(130, 194));
            
            if (isPurchase) {
              usdAmount = ethers.formatUnits(param1, 18);
              tokenAmount = ethers.formatUnits(param2, 18);
              pricePerToken = ethers.formatUnits(param3, 18);
            } else {
              tokenAmount = ethers.formatUnits(param1, 18);
              usdAmount = ethers.formatUnits(param2, 18);
              pricePerToken = ethers.formatUnits(param3, 18);
            }
          }

          // Get block timestamp (skip individual calls to reduce rate limit impact)
          // Use approximate timestamp based on block number
          const timestamp = new Date(Date.now() - (currentBlock - log.blockNumber) * 3000); // ~3s per block

          events.push({
            type: isPurchase ? 'buy' : 'sell',
            address: address,
            usdAmount,
            tokenAmount,
            price: pricePerToken,
            timestamp,
            txHash: log.transactionHash
          });
        } catch (e) {
          console.warn('Failed to parse event:', e);
        }
      }

      // Sort by timestamp descending and limit
      events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      const limitedEvents = events.slice(0, limit);

      // Update cache
      eventsCache = { data: limitedEvents, timestamp: Date.now() };

      return limitedEvents;
    } catch (error: any) {
      console.warn(`RPC attempt ${attempt + 1} failed:`, error.message);
      // Add small delay before retry
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  // All retries failed
  console.error('All RPC endpoints failed');
  return eventsCache?.data || [];
};

/**
 * Get REAL trade history from blockchain
 */
export const getRealTradeHistory = async (limit: number = 50): Promise<TradeEvent[]> => {
  return fetchContractEvents('all', limit);
};

// ============ Leaderboard ============

export interface LeaderboardEntry {
  rank: number;
  address: string;
  contribution: string;
  tokens: string;
}

/**
 * Get top contributors from real blockchain data
 */
export const getLeaderboard = async (): Promise<LeaderboardEntry[]> => {
  try {
    const events = await fetchContractEvents('TokensPurchased', 500);
    
    if (events.length === 0) {
      // Return placeholder when no transactions yet
      return [
        { rank: 1, address: 'No contributors yet', contribution: '$0.00', tokens: '0' },
      ];
    }

    // Aggregate contributions by address
    const contributions: Map<string, { usd: number; tokens: number }> = new Map();
    
    for (const event of events) {
      if (event.type !== 'buy') continue;
      const addr = event.address.toLowerCase();
      const existing = contributions.get(addr) || { usd: 0, tokens: 0 };
      existing.usd += parseFloat(event.usdAmount);
      existing.tokens += parseFloat(event.tokenAmount);
      contributions.set(addr, existing);
    }

    // Sort by contribution and take top 10
    const sorted = Array.from(contributions.entries())
      .sort((a, b) => b[1].usd - a[1].usd)
      .slice(0, 10);

    if (sorted.length === 0) {
      return [
        { rank: 1, address: 'No contributors yet', contribution: '$0.00', tokens: '0' },
      ];
    }

    return sorted.map(([address, data], index) => ({
      rank: index + 1,
      address: `${address.slice(0, 6)}...${address.slice(-4)}`,
      contribution: `$${data.usd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      tokens: data.tokens.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })
    }));
  } catch (e) {
    console.error('Error building leaderboard:', e);
    return [
      { rank: 1, address: 'Loading...', contribution: '$0.00', tokens: '0' },
    ];
  }
};

// Export constants for UI
export const FUNDRAISER_CONSTANTS = {
  BASE_PRICE,
  PRICE_INCREMENT,
  TOKENS_PER_DOLLAR,
  FUNDRAISING_GOAL
};
