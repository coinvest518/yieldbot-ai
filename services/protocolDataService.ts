/**
 * Protocol Data Service
 * Fetches live yield data from DeFi protocols on BSC
 */

import { ethers } from 'ethers';

// Types
export interface PoolData {
  name: string;
  protocol: string;
  asset: string;
  apy: number;
  tvl: string;
  volume24h?: string;
  riskLevel: 'low' | 'medium' | 'high';
  impermanentLossRisk?: string;
}

export interface VenusMarket {
  symbol: string;
  vTokenAddress: string;
  underlyingAddress: string;
  supplyApy: number;
  borrowApy: number;
  totalSupply: string;
  totalBorrow: string;
  liquidity: string;
  exchangeRate: string;
  primeApy?: number;
}

export interface PancakePool {
  poolAddress: string;
  token0: string;
  token1: string;
  fee: number;
  tvl: string;
  apr: number;
  cakeApr: number;
  feeApr: number;
  volume24h: string;
}

export interface BeefyVault {
  id: string;
  name: string;
  apy: number;
  tvl: string;
  platform: string;
  chain: string;
  assets: string[];
}

export interface YieldStrategyData {
  strategy1_safeLending: PoolData[];
  strategy2_stablecoinLP: PoolData[];
  strategy3_volatileLP: PoolData[];
  lastUpdated: string;
}

// Contract ABIs (minimal for reading)
const VTOKEN_ABI = [
  'function supplyRatePerBlock() view returns (uint256)',
  'function borrowRatePerBlock() view returns (uint256)',
  'function totalSupply() view returns (uint256)',
  'function totalBorrows() view returns (uint256)',
  'function getCash() view returns (uint256)',
  'function exchangeRateCurrent() view returns (uint256)',
  'function underlying() view returns (address)'
];

const COMPTROLLER_ABI = [
  'function getAllMarkets() view returns (address[])',
  'function venusSupplySpeeds(address) view returns (uint256)',
  'function venusBorrowSpeeds(address) view returns (uint256)'
];

const ERC20_ABI = [
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function balanceOf(address) view returns (uint256)'
];

// API endpoints
const API_ENDPOINTS = {
  defiLlama: {
    yields: 'https://yields.llama.fi/pools',
    protocols: 'https://api.llama.fi/protocols'
  },
  beefy: {
    vaults: 'https://api.beefy.finance/vaults',
    apy: 'https://api.beefy.finance/apy',
    tvl: 'https://api.beefy.finance/tvl'
  },
  venus: {
    mainnet: 'https://api.venus.io/markets?chainId=56',
    testnet: 'https://api.venus.io/markets?chainId=97'
  }
};

// Contract addresses
const CONTRACTS = {
  bscMainnet: {
    comptroller: '0xfD36E2c2a6789Db23113685031d7F16329158384',
    xvsToken: '0xcF6BB5389c92Bdda8a3747Ddb454cB7a64626C63',
    vTokens: {
      vUSDT: '0xfD5840Cd36d94D7229439859C0112a4185BC0255',
      vUSDC: '0xecA88125a5ADbe82614ffC12D0DB554E2e2867C8',
      vBNB: '0xA07c5b74C9B40447a954e1466938b865b6BBea36',
      vBTC: '0x882C173bC7Ff3b7786CA16dfeD3DFFfb9Ee7847B',
      vETH: '0xf508fCD89b8bd15579dc79A6827cB4686A3592c8'
    }
  },
  bscTestnet: {
    comptroller: '0x94d1820b2D1c7c7452A163983Dc888CEC546b77D',
    xvsToken: '0xB9e0E753630434d7863528cc73CB7AC638a7c8ff',
    vTokens: {
      vUSDT: '0xb7526572FFE56AB9D7489838Bf2E18e3323b441A',
      vUSDC: '0xD5C4C2e2facBEB59D0216D0595d63FcDc6F9A1a7',
      vBNB: '0x2E7222e51c0f6e98610A1543Aa3836E092CDe62c'
    }
  }
};

// Constants for APY calculations
const BLOCKS_PER_YEAR = 10512000; // BSC ~3 sec blocks
const MANTISSA = 1e18;

/**
 * Fetch Venus Protocol market data
 */
export async function fetchVenusMarkets(
  provider: ethers.Provider,
  isTestnet: boolean = false
): Promise<VenusMarket[]> {
  const contracts = isTestnet ? CONTRACTS.bscTestnet : CONTRACTS.bscMainnet;
  const markets: VenusMarket[] = [];

  try {
    for (const [symbol, address] of Object.entries(contracts.vTokens)) {
      const vToken = new ethers.Contract(address, VTOKEN_ABI, provider);
      
      // Fetch on-chain data
      const [supplyRate, borrowRate, totalSupply, totalBorrows, cash, exchangeRate] = await Promise.all([
        vToken.supplyRatePerBlock(),
        vToken.borrowRatePerBlock(),
        vToken.totalSupply(),
        vToken.totalBorrows(),
        vToken.getCash(),
        vToken.exchangeRateCurrent()
      ]);

      // Calculate APY
      const supplyApy = ((Number(supplyRate) / MANTISSA * BLOCKS_PER_YEAR) * 100);
      const borrowApy = ((Number(borrowRate) / MANTISSA * BLOCKS_PER_YEAR) * 100);

      // Get underlying address (for non-native tokens)
      let underlyingAddress = '';
      if (symbol !== 'vBNB') {
        try {
          underlyingAddress = await vToken.underlying();
        } catch {
          underlyingAddress = '';
        }
      }

      markets.push({
        symbol: symbol.replace('v', ''),
        vTokenAddress: address,
        underlyingAddress,
        supplyApy,
        borrowApy,
        totalSupply: ethers.formatUnits(totalSupply, 8), // vTokens have 8 decimals
        totalBorrow: ethers.formatUnits(totalBorrows, 18),
        liquidity: ethers.formatUnits(cash, 18),
        exchangeRate: ethers.formatUnits(exchangeRate, 18)
      });
    }
  } catch (error) {
    console.error('Error fetching Venus markets:', error);
  }

  return markets;
}

/**
 * Fetch DefiLlama yield pools
 */
export async function fetchDefiLlamaYields(
  project?: string
): Promise<PoolData[]> {
  try {
    let url = API_ENDPOINTS.defiLlama.yields;
    
    const response = await fetch(url);
    const data = await response.json();
    
    // Filter for BSC and optionally by project
    let pools = data.data.filter((pool: any) => 
      pool.chain === 'BSC' || pool.chain === 'Binance'
    );

    if (project) {
      pools = pools.filter((pool: any) => 
        pool.project.toLowerCase().includes(project.toLowerCase())
      );
    }

    // Transform to our format
    return pools.slice(0, 50).map((pool: any) => ({
      name: pool.symbol,
      protocol: pool.project,
      asset: pool.symbol,
      apy: pool.apy || 0,
      tvl: formatUSD(pool.tvlUsd),
      riskLevel: getRiskLevel(pool.apy),
      volume24h: pool.volumeUsd1d ? formatUSD(pool.volumeUsd1d) : undefined
    }));
  } catch (error) {
    console.error('Error fetching DefiLlama yields:', error);
    return [];
  }
}

/**
 * Fetch Beefy Finance vaults
 */
export async function fetchBeefyVaults(): Promise<BeefyVault[]> {
  try {
    // Fetch vaults, APY, and TVL in parallel
    const [vaultsRes, apyRes, tvlRes] = await Promise.all([
      fetch(API_ENDPOINTS.beefy.vaults),
      fetch(API_ENDPOINTS.beefy.apy),
      fetch(API_ENDPOINTS.beefy.tvl)
    ]);

    const vaults = await vaultsRes.json();
    const apyData = await apyRes.json();
    const tvlData = await tvlRes.json();

    // Filter for BSC vaults
    const bscVaults = vaults.filter((v: any) => v.chain === 'bsc');

    return bscVaults.slice(0, 100).map((vault: any) => ({
      id: vault.id,
      name: vault.name,
      apy: (apyData[vault.id] || 0) * 100, // Convert to percentage
      tvl: formatUSD(tvlData[vault.id] || 0),
      platform: vault.platformId || 'unknown',
      chain: vault.chain,
      assets: vault.assets || []
    }));
  } catch (error) {
    console.error('Error fetching Beefy vaults:', error);
    return [];
  }
}

/**
 * Get comprehensive yield strategy data
 */
export async function fetchAllYieldStrategies(
  provider?: ethers.Provider,
  isTestnet: boolean = false
): Promise<YieldStrategyData> {
  const [venusMarkets, defiLlamaPools, beefyVaults] = await Promise.all([
    provider ? fetchVenusMarkets(provider, isTestnet) : Promise.resolve([]),
    fetchDefiLlamaYields(),
    fetchBeefyVaults()
  ]);

  // Categorize pools by strategy
  const strategy1: PoolData[] = [];
  const strategy2: PoolData[] = [];
  const strategy3: PoolData[] = [];

  // Add Venus markets to Strategy 1 (Safe Lending)
  venusMarkets.forEach(market => {
    strategy1.push({
      name: `Venus ${market.symbol}`,
      protocol: 'Venus Protocol',
      asset: market.symbol,
      apy: market.supplyApy,
      tvl: market.totalSupply,
      riskLevel: 'low'
    });
  });

  // Categorize DefiLlama pools
  defiLlamaPools.forEach(pool => {
    // Check if it's a stablecoin pool
    const isStablecoin = /usdt|usdc|busd|dai|fdusd|frax/i.test(pool.asset);
    const isLending = pool.protocol.toLowerCase().includes('venus') || 
                      pool.protocol.toLowerCase().includes('lending');
    
    if (isLending) {
      strategy1.push(pool);
    } else if (isStablecoin && pool.apy < 30) {
      pool.impermanentLossRisk = 'Very Low';
      strategy2.push(pool);
    } else if (pool.apy >= 20) {
      pool.riskLevel = 'high';
      pool.impermanentLossRisk = 'Medium-High';
      strategy3.push(pool);
    }
  });

  // Add top Beefy vaults
  beefyVaults.forEach(vault => {
    const isStableVault = /usdt|usdc|busd|stable/i.test(vault.name);
    const pool: PoolData = {
      name: vault.name,
      protocol: 'Beefy Finance',
      asset: vault.assets.join('-'),
      apy: vault.apy,
      tvl: vault.tvl,
      riskLevel: vault.apy > 50 ? 'high' : (isStableVault ? 'low' : 'medium')
    };

    if (vault.platform === 'venus') {
      strategy1.push(pool);
    } else if (isStableVault) {
      strategy2.push(pool);
    } else {
      strategy3.push(pool);
    }
  });

  // Sort each strategy by APY
  strategy1.sort((a, b) => b.apy - a.apy);
  strategy2.sort((a, b) => b.apy - a.apy);
  strategy3.sort((a, b) => b.apy - a.apy);

  return {
    strategy1_safeLending: strategy1.slice(0, 20),
    strategy2_stablecoinLP: strategy2.slice(0, 20),
    strategy3_volatileLP: strategy3.slice(0, 20),
    lastUpdated: new Date().toISOString()
  };
}

/**
 * Get top pools for each strategy with real-time data
 */
export async function getTopPoolsByStrategy(
  strategy: 'lending' | 'stablecoin' | 'volatile',
  limit: number = 10
): Promise<PoolData[]> {
  const allData = await fetchAllYieldStrategies();
  
  switch (strategy) {
    case 'lending':
      return allData.strategy1_safeLending.slice(0, limit);
    case 'stablecoin':
      return allData.strategy2_stablecoinLP.slice(0, limit);
    case 'volatile':
      return allData.strategy3_volatileLP.slice(0, limit);
    default:
      return [];
  }
}

/**
 * Calculate estimated yield for an amount
 */
export function calculateEstimatedYield(
  amount: number,
  apy: number,
  days: number = 365
): { daily: number; monthly: number; yearly: number } {
  const dailyRate = apy / 100 / 365;
  const daily = amount * dailyRate;
  const monthly = daily * 30;
  const yearly = amount * (apy / 100);

  return {
    daily: Math.round(daily * 100) / 100,
    monthly: Math.round(monthly * 100) / 100,
    yearly: Math.round(yearly * 100) / 100
  };
}

/**
 * Get current token prices
 */
export async function getTokenPrices(
  tokens: string[]
): Promise<Record<string, number>> {
  try {
    const ids = tokens.join(',');
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`
    );
    const data = await response.json();
    
    const prices: Record<string, number> = {};
    for (const [id, price] of Object.entries(data)) {
      prices[id] = (price as any).usd;
    }
    return prices;
  } catch (error) {
    console.error('Error fetching token prices:', error);
    return {};
  }
}

// Helper functions
function formatUSD(value: number | string): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
  if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
  if (num >= 1e3) return `$${(num / 1e3).toFixed(2)}K`;
  return `$${num.toFixed(2)}`;
}

function getRiskLevel(apy: number): 'low' | 'medium' | 'high' {
  if (apy < 10) return 'low';
  if (apy < 30) return 'medium';
  return 'high';
}

// Export default instance for easy use
export default {
  fetchVenusMarkets,
  fetchDefiLlamaYields,
  fetchBeefyVaults,
  fetchAllYieldStrategies,
  getTopPoolsByStrategy,
  calculateEstimatedYield,
  getTokenPrices,
  CONTRACTS,
  API_ENDPOINTS
};
