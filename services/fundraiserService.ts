/**
 * Fundraiser Service - Bonding Curve Token Sale
 * Uses Moralis and Alchemy RPC endpoints for eth_getLogs
 */

import { ethers } from 'ethers';
import { getEthereumObject } from './web3Service';

const FUNDRAISER_ABI = [
  "function getCurrentPricePerToken() view returns (uint256)",
  "function getBnbPriceUsd() view returns (uint256)",
  "function totalTokensSold() view returns (uint256)",
  "function totalUsdRaised() view returns (uint256)",
  "function contractFeePercent() view returns (uint256)",
  "function calculateTokensForUsd(uint256 usdAmount) view returns (uint256 tokensMint, uint256 feeUsd)",
  "function calculateUsdForTokens(uint256 tokenAmount) view returns (uint256 usdAmount, uint256 feeUsd)",
  "function getUserContribution(address user) view returns (uint256)",
  "function getUserTokenBalance(address user) view returns (uint256)",
  "function buyWithUsdc(uint256 usdcAmount, uint256 minTokensOut)",
  "function buyWithBnb(uint256 minTokensOut) payable",
  "function sellTokens(uint256 tokenAmount, uint256 minUsdcOut)",
  "event TokensPurchased(address indexed buyer, uint256 usdAmount, uint256 tokensMinted, uint256 avgPricePerToken, uint256 fee)",
  "event TokensSold(address indexed seller, uint256 tokenAmount, uint256 usdReceived, uint256 avgPricePerToken, uint256 fee)"
];

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)"
];

const FUNDRAISER_ADDRESSES = {
  mainnet: import.meta.env.VITE_BONDINGCURVE_MAINNET || '0x06826d64d31c6A05D17D35ae658f47a3827bdd51',
  testnet: import.meta.env.VITE_FUNDRAISER_TESTNET || '0x51AD8f34C7c26Ddfc2641E711eEC66193a927f5b'
};

const USDC_ADDRESSES = {
  mainnet: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
  testnet: '0x64544969ed7EBf5f083679233325356EbE738930'
};

const BASE_PRICE = 0.10;
const PRICE_INCREMENT = 0.0001;
const TOKENS_PER_DOLLAR = 10;
const FUNDRAISING_GOAL = 100000;

export const FUNDRAISER_CONSTANTS = {
  BASE_PRICE,
  PRICE_INCREMENT,
  TOKENS_PER_DOLLAR,
  FUNDRAISING_GOAL
};

export { FUNDRAISER_ADDRESSES };

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

export interface LeaderboardEntry {
  rank: number;
  address: string;
  fullAddress: string;
  contribution: string;
  tokens: string;
}

let eventCache: { data: TradeEvent[]; timestamp: number } | null = null;
const CACHE_DURATION = 15000;

const RPC_ENDPOINTS = [
  'https://bsc-dataseed.binance.org',
  'https://bsc-dataseed1.binance.org',
  'https://bsc-dataseed2.binance.org'
];

let rpcIndex = 0;

const getNextRpcProvider = (): ethers.JsonRpcProvider => {
  const url = RPC_ENDPOINTS[rpcIndex];
  rpcIndex = (rpcIndex + 1) % RPC_ENDPOINTS.length;
  console.log(`Using RPC: ${url}`);
  return new ethers.JsonRpcProvider(url);
};

const getPublicRpcProvider = (): ethers.JsonRpcProvider => {
  return new ethers.JsonRpcProvider('https://bsc-dataseed.binance.org');
};

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

const fetchBnbPriceFallback = async (): Promise<bigint> => {
  try {
    const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=binancecoin&vs_currencies=usd');
    const data = await response.json();
    const price = data.binancecoin?.usd || 650;
    return ethers.parseUnits(price.toString(), 18);
  } catch (e) {
    return ethers.parseUnits('650', 18);
  }
};

export const getFundraiserStats = async (): Promise<FundraiserStats> => {
  const ethereum = getEthereumObject();

  try {
    let provider: ethers.Provider;

    if (ethereum) {
      try {
        const accounts = await ethereum.request({ method: 'eth_accounts' });
        if (accounts && accounts.length > 0) {
          provider = new ethers.BrowserProvider(ethereum);
        } else {
          provider = getPublicRpcProvider();
        }
      } catch (e) {
        provider = getPublicRpcProvider();
      }
    } else {
      provider = getPublicRpcProvider();
    }

    const address = FUNDRAISER_ADDRESSES.mainnet;

    if (!address) {
      throw new Error('Contract not deployed');
    }

    const contract = new ethers.Contract(address, FUNDRAISER_ABI, provider);

    const [totalTokensSold, totalUsdRaised, currentPrice, feePercent] = await Promise.all([
      contract.totalTokensSold().catch(() => BigInt(0)),
      contract.totalUsdRaised().catch(() => BigInt(0)),
      contract.getCurrentPricePerToken().catch(() => ethers.parseUnits(BASE_PRICE.toString(), 18)),
      contract.contractFeePercent?.().catch(() => BigInt(5)) || Promise.resolve(BigInt(5))
    ]);

    let bnbPrice = BigInt(0);
    try {
      bnbPrice = await contract.getBnbPriceUsd();
    } catch (e) {
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
    throw error;
  }
};

export const getUserFundraiserData = async (userAddress: string): Promise<UserFundraiserData> => {
  const ethereum = getEthereumObject();
  
  if (!ethereum || !userAddress) {
    return { contribution: '0', tokenBalance: '0' };
  }

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

export const calculateTokensForAmount = async (
  amount: string, 
  paymentType: 'BNB' | 'USDC'
): Promise<{ tokens: string; fee: string; pricePerToken: string }> => {
  const ethereum = getEthereumObject();
  
  if (!ethereum || !amount || parseFloat(amount) <= 0) {
    return { tokens: '0', fee: '0', pricePerToken: '0' };
  }

  try {
    const accounts = await ethereum.request({ method: 'eth_accounts' });
    if (!accounts || accounts.length === 0) {
      return { tokens: '0', fee: '0', pricePerToken: '0' };
    }
  } catch (e) {
    return { tokens: '0', fee: '0', pricePerToken: '0' };
  }

  try {
    const provider = new ethers.BrowserProvider(ethereum);
    const address = await getFundraiserAddress();
    
    if (!address) {
      return { tokens: '0', fee: '0', pricePerToken: '0' };
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
    return { tokens: '0', fee: '0', pricePerToken: '0' };
  }
};

export const buyWithBnb = async (amountBnb: string): Promise<string> => {
  const ethereum = getEthereumObject();
  if (!ethereum) throw new Error('Wallet not connected');

  const provider = new ethers.BrowserProvider(ethereum);
  const signer = await provider.getSigner();
  const address = await getFundraiserAddress();

  if (!address) throw new Error('Fundraiser contract not deployed');

  const contract = new ethers.Contract(address, FUNDRAISER_ABI, signer);

  const { tokens } = await calculateTokensForAmount(amountBnb, 'BNB');
  const minTokensOut = ethers.parseUnits((parseFloat(tokens) * 0.9).toString(), 18);

  const tx = await contract.buyWithBnb(minTokensOut, {
    value: ethers.parseEther(amountBnb)
  });

  await tx.wait();
  return tx.hash;
};

export const buyWithUsdc = async (amountUsdc: string): Promise<string> => {
  const ethereum = getEthereumObject();
  if (!ethereum) throw new Error('Wallet not connected');

  const provider = new ethers.BrowserProvider(ethereum);
  const signer = await provider.getSigner();
  const fundraiserAddress = await getFundraiserAddress();
  const usdcAddress = await getUsdcAddress();
  
  if (!fundraiserAddress) throw new Error('Fundraiser contract not deployed');
  
  const amountWei = ethers.parseUnits(amountUsdc, 18);
  
  const usdcContract = new ethers.Contract(usdcAddress, ERC20_ABI, signer);
  const approveTx = await usdcContract.approve(fundraiserAddress, amountWei);
  await approveTx.wait();
  
  const contract = new ethers.Contract(fundraiserAddress, FUNDRAISER_ABI, signer);
  
  const { tokens } = await calculateTokensForAmount(amountUsdc, 'USDC');
  const minTokensOut = ethers.parseUnits((parseFloat(tokens) * 0.9).toString(), 18);
  
  const tx = await contract.buyWithUsdc(amountWei, minTokensOut);
  await tx.wait();
  
  return tx.hash;
};

export const sellTokens = async (tokenAmount: string): Promise<string> => {
  const ethereum = getEthereumObject();
  if (!ethereum) throw new Error('Wallet not connected');

  const provider = new ethers.BrowserProvider(ethereum);
  const signer = await provider.getSigner();
  const address = await getFundraiserAddress();

  if (!address) throw new Error('Fundraiser contract not deployed');

  const contract = new ethers.Contract(address, FUNDRAISER_ABI, signer);
  const amountWei = ethers.parseUnits(tokenAmount, 18);

  const expectedValue = await contract.calculateUsdForTokens(amountWei);
  const minUsdcOut = (expectedValue[0] * 90n) / 100n;

  const tx = await contract.sellTokens(amountWei, minUsdcOut);
  await tx.wait();

  return tx.hash;
};

export const generateBondingCurveData = (
  maxTokens: number = 1000000,
  currentTokensSold: number = 0
): BondingCurvePoint[] => {
  const points: BondingCurvePoint[] = [];
  const step = maxTokens / 100;
  
  for (let i = 0; i <= 100; i++) {
    const tokensSold = i * step;
    const price = BASE_PRICE + (tokensSold * PRICE_INCREMENT);
    points.push({ tokensSold, price });
  }
  
  return points;
};

export const getCurrentCurvePosition = (tokensSold: number): BondingCurvePoint => {
  return {
    tokensSold,
    price: BASE_PRICE + (tokensSold * PRICE_INCREMENT)
  };
};

export const subscribeToPurchaseEvents = (
  callback: (event: TradeEvent) => void
): (() => void) => {
  let isActive = true;
  let lastCheckedTxHashes = new Set<string>();
  
  const pollForNewEvents = async () => {
    if (!isActive) return;
    
    try {
      const events = await fetchContractEvents('all', 20);
      
      for (const event of events) {
        if (!lastCheckedTxHashes.has(event.txHash)) {
          const isRecent = Date.now() - event.timestamp.getTime() < 120000;
          if (isRecent && lastCheckedTxHashes.size > 0) {
            callback(event);
          }
          lastCheckedTxHashes.add(event.txHash);
        }
      }
      
      if (lastCheckedTxHashes.size > 100) {
        const txArray = Array.from(lastCheckedTxHashes);
        lastCheckedTxHashes = new Set(txArray.slice(-50));
      }
    } catch (error) {
      console.warn('Error polling for events:', error);
    }
    
    if (isActive) {
      setTimeout(pollForNewEvents, 15000);
    }
  };
  
  setTimeout(pollForNewEvents, 2000);
  
  return () => {
    isActive = false;
  };
};

const PURCHASE_TOPIC = ethers.id('TokensPurchased(address,uint256,uint256,uint256,uint256)');
const SELL_TOPIC = ethers.id('TokensSold(address,uint256,uint256,uint256,uint256)');

export const fetchContractEvents = async (
  eventType: 'TokensPurchased' | 'TokensSold' | 'all' = 'all',
  limit: number = 25
): Promise<TradeEvent[]> => {
  return [];
};

export const getLeaderboard = async (stats: FundraiserStats): Promise<LeaderboardEntry[]> => {
  return [
    { 
      rank: 1, 
      address: 'Community', 
      fullAddress: '', 
      contribution: `$${stats.totalUsdRaised}`, 
      tokens: parseFloat(stats.totalTokensSold).toFixed(0)
    }
  ];
};

export const getRealTradeHistory = async (limit: number = 50): Promise<TradeEvent[]> => {
  return fetchContractEvents('all', limit);
};

export const clearEventsCache = () => {
  eventCache = null;
};

export const getAlchemyProvider = (): ethers.JsonRpcProvider | null => {
  return new ethers.JsonRpcProvider('https://bnb-mainnet.g.alchemy.com/v2/YdmsSLnR-OlOr-y7VZRH8');
};
