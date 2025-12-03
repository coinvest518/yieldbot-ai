import { UserFinanceData, TIERS, VaultStats } from "../types";
import protocolDataService, { 
  PoolData, 
  YieldStrategyData,
  calculateEstimatedYield 
} from "./protocolDataService";

// This service simulates the "Backend" logic for the yBot Finance Ecosystem

const INITIAL_DATA: UserFinanceData = {
  balanceBNB: '0.00',
  balanceYBOT: '0.00',
  usdtBalance: '0.00',
  stakedAmount: '0.00',
  pendingYield: '0.00',
  creditScore: 0,
  creditTier: 'Iron',
  hasSBT: false
};

// Strategy configuration with real protocol data
export interface StrategyConfig {
  id: 'lending' | 'stablecoin' | 'volatile';
  name: string;
  description: string;
  riskLevel: 'low' | 'medium' | 'high';
  expectedAPY: { min: number; max: number };
  protocols: string[];
}

export const YIELD_STRATEGIES: StrategyConfig[] = [
  {
    id: 'lending',
    name: 'Safe Lending (Venus Protocol)',
    description: 'Low-risk lending on Venus Protocol - supply assets to earn interest plus XVS rewards',
    riskLevel: 'low',
    expectedAPY: { min: 2, max: 6 },
    protocols: ['Venus Protocol']
  },
  {
    id: 'stablecoin',
    name: 'Stablecoin LP Farming',
    description: 'Medium-risk LP farming with stablecoin pairs - lower impermanent loss risk',
    riskLevel: 'medium',
    expectedAPY: { min: 8, max: 20 },
    protocols: ['PancakeSwap V3', 'Beefy Finance']
  },
  {
    id: 'volatile',
    name: 'Volatile LP Farming',
    description: 'Higher-risk LP farming with volatile pairs - higher APY but IL risk',
    riskLevel: 'high',
    expectedAPY: { min: 25, max: 200 },
    protocols: ['PancakeSwap V3', 'Beefy Finance']
  }
];

// Cache for live data
let cachedStrategyData: YieldStrategyData | null = null;
let lastFetchTime: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch live yield strategy data from protocols
 */
export async function fetchLiveYieldData(): Promise<YieldStrategyData> {
  const now = Date.now();
  
  // Return cached data if still fresh
  if (cachedStrategyData && (now - lastFetchTime) < CACHE_DURATION) {
    return cachedStrategyData;
  }

  try {
    cachedStrategyData = await protocolDataService.fetchAllYieldStrategies();
    lastFetchTime = now;
    return cachedStrategyData;
  } catch (error) {
    console.error('Error fetching live yield data:', error);
    // Return cached data even if stale, or empty data
    return cachedStrategyData || {
      strategy1_safeLending: [],
      strategy2_stablecoinLP: [],
      strategy3_volatileLP: [],
      lastUpdated: new Date().toISOString()
    };
  }
}

/**
 * Get top pools for a specific strategy
 */
export async function getTopPoolsForStrategy(
  strategy: 'lending' | 'stablecoin' | 'volatile',
  limit: number = 10
): Promise<PoolData[]> {
  const data = await fetchLiveYieldData();
  
  switch (strategy) {
    case 'lending':
      return data.strategy1_safeLending.slice(0, limit);
    case 'stablecoin':
      return data.strategy2_stablecoinLP.slice(0, limit);
    case 'volatile':
      return data.strategy3_volatileLP.slice(0, limit);
    default:
      return [];
  }
}

/**
 * Calculate potential yield for an investment amount
 */
export function calculatePotentialYield(
  amount: number,
  strategy: 'lending' | 'stablecoin' | 'volatile'
): { daily: string; monthly: string; yearly: string; apy: number } {
  // Use average expected APY for the strategy
  const strategyConfig = YIELD_STRATEGIES.find(s => s.id === strategy);
  if (!strategyConfig) {
    return { daily: '$0.00', monthly: '$0.00', yearly: '$0.00', apy: 0 };
  }

  const apy = (strategyConfig.expectedAPY.min + strategyConfig.expectedAPY.max) / 2;
  const yields = calculateEstimatedYield(amount, apy);

  return {
    daily: `$${yields.daily.toFixed(4)}`,
    monthly: `$${yields.monthly.toFixed(2)}`,
    yearly: `$${yields.yearly.toFixed(2)}`,
    apy
  };
}

/**
 * Get recommended strategy based on user's risk tolerance
 */
export function getRecommendedStrategy(
  riskTolerance: 'conservative' | 'moderate' | 'aggressive'
): StrategyConfig {
  switch (riskTolerance) {
    case 'conservative':
      return YIELD_STRATEGIES[0]; // Lending
    case 'moderate':
      return YIELD_STRATEGIES[1]; // Stablecoin LP
    case 'aggressive':
      return YIELD_STRATEGIES[2]; // Volatile LP
    default:
      return YIELD_STRATEGIES[0];
  }
}

export const calculateYield = (stakedAmount: number, apy: number) => {
  // Simulate daily yield
  return (stakedAmount * (apy / 100)) / 365;
};

export const getTierFromScore = (score: number): 'Iron' | 'Bronze' | 'Silver' | 'Gold' | 'Platinum' => {
  if (score >= TIERS.Platinum.min) return 'Platinum';
  if (score >= TIERS.Gold.min) return 'Gold';
  if (score >= TIERS.Silver.min) return 'Silver';
  if (score >= TIERS.Bronze.min) return 'Bronze';
  return 'Iron';
};

// Generates a dynamic credit card image on the fly using Canvas
export const drawCreditCard = (data: UserFinanceData, walletAddress: string): Promise<string> => {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 380;
    const ctx = canvas.getContext('2d');
    if (!ctx) return resolve('');

    const tierColor = TIERS[data.creditTier].color;

    // Background Gradient based on Tier
    const grd = ctx.createLinearGradient(0, 0, 600, 380);
    grd.addColorStop(0, '#0f172a');
    grd.addColorStop(1, tierColor); // Tier color glow
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, 600, 380);

    // Noise Texture overlay
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    for(let i=0; i<500; i++) {
        ctx.beginPath();
        ctx.arc(Math.random()*600, Math.random()*380, 1, 0, Math.PI*2);
        ctx.fill();
    }

    // Border
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, 598, 378);

    // Chip
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(50, 120, 70, 50);
    // Chip details
    ctx.strokeStyle = '#92400e';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(50, 145); ctx.lineTo(120, 145); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(85, 120); ctx.lineTo(85, 170); ctx.stroke();

    // Logo Text
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 32px "Space Grotesk", sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('yBOT FINANCE', 550, 60);

    // Tier Label
    ctx.fillStyle = tierColor;
    ctx.font = 'bold 24px "Inter", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(data.creditTier.toUpperCase() + ' TIER', 50, 60);

    // Score Large
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 80px "Space Grotesk", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(data.creditScore.toString(), 300, 220);
    
    ctx.font = '16px "Inter", sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('SOULBOUND CREDIT SCORE', 300, 250);

    // Wallet Address
    ctx.font = 'mono 20px "Courier New", monospace';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'left';
    const shortAddr = walletAddress ? `${walletAddress.substring(0,6)}...${walletAddress.substring(walletAddress.length-6)}` : '0x0000...0000';
    ctx.fillText(shortAddr, 50, 340);

    // ID
    ctx.textAlign = 'right';
    ctx.fillText('ID: ' + Math.floor(Math.random()*1000000), 550, 340);

    resolve(canvas.toDataURL());
  });
};

// Generates a cool "Yield Access Key" image for the Gallery (Square 500x500)
// 10 Tiers: Iron, Bronze, Silver, Gold, Platinum, Diamond, Obsidian, Titanium, Emerald, Ruby
export const drawAccessKey = (tier: 'Iron' | 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond' | 'Obsidian' | 'Titanium' | 'Emerald' | 'Ruby', tokenId?: number): Promise<string> => {
    return new Promise((resolve) => {
        const canvas = document.createElement('canvas');
        // Square to match NFT output
        canvas.width = 500;
        canvas.height = 500;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve('');

        // 10 tier colors
        let color = '#94a3b8'; // Silver default
        if (tier === 'Iron') color = '#71717a';      // Gray
        if (tier === 'Bronze') color = '#cd7f32';    // Bronze/Orange
        if (tier === 'Silver') color = '#94a3b8';    // Silver/Slate
        if (tier === 'Gold') color = '#f59e0b';      // Gold/Amber
        if (tier === 'Platinum') color = '#06b6d4';  // Cyan
        if (tier === 'Diamond') color = '#8b5cf6';   // Purple
        if (tier === 'Obsidian') color = '#1e1e1e';  // Dark Black
        if (tier === 'Titanium') color = '#e2e8f0';  // Light Silver/White
        if (tier === 'Emerald') color = '#10b981';   // Green
        if (tier === 'Ruby') color = '#ef4444';      // Red

        // Background
        const grd = ctx.createRadialGradient(250, 250, 0, 250, 250, 350);
        grd.addColorStop(0, '#1e293b');
        grd.addColorStop(1, '#020617');
        ctx.fillStyle = grd;
        ctx.fillRect(0, 0, 500, 500);

        // Glow
        ctx.shadowBlur = 40;
        ctx.shadowColor = color;

        // Key Shape (Abstract) - centered
        ctx.strokeStyle = color;
        ctx.lineWidth = 8;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        
        // Head
        ctx.arc(250, 160, 55, 0, Math.PI * 2);
        
        // Shaft
        ctx.moveTo(250, 215);
        ctx.lineTo(250, 380);
        
        // Teeth
        ctx.moveTo(250, 280);
        ctx.lineTo(300, 280);
        ctx.moveTo(250, 320);
        ctx.lineTo(290, 320);
        ctx.moveTo(250, 355);
        ctx.lineTo(280, 355);
        
        ctx.stroke();

        // Reset Glow
        ctx.shadowBlur = 0;

        // Text - Title at top
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 32px "Space Grotesk", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${tier.toUpperCase()}`, 250, 50);
        ctx.font = 'bold 22px "Space Grotesk", sans-serif';
        ctx.fillText('ACCESS KEY', 250, 80);
        
        // Token ID at bottom - always show tier name
        ctx.font = '20px "Mono", monospace';
        ctx.fillStyle = color;
        ctx.fillText(tier.toUpperCase(), 250, 450);

        // Tech border (square)
        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.lineWidth = 1;
        ctx.strokeRect(20, 20, 460, 460);

        resolve(canvas.toDataURL());
    });
};

export const mockFetchUserFinance = async (address: string): Promise<UserFinanceData> => {
    // Simulate API delay
    await new Promise(r => setTimeout(r, 1000));
    
    // Return initial data, in real app this queries the Smart Contract
    return { ...INITIAL_DATA };
};

export const mockFetchVaultStats = async (): Promise<VaultStats> => {
    return {
        tvl: '2,450,120.45',
        apy: 12.8,
        totalYieldDistributed: '450,231.00',
        nextRebalance: '4h 12m'
    };
};

/**
 * Get live vault stats by aggregating from protocols
 */
export const fetchLiveVaultStats = async (): Promise<VaultStats & { strategies: any }> => {
    try {
        const data = await fetchLiveYieldData();
        
        // Calculate average APY across all strategies
        const allPools = [
            ...data.strategy1_safeLending,
            ...data.strategy2_stablecoinLP,
            ...data.strategy3_volatileLP
        ];
        
        const avgApy = allPools.length > 0
            ? allPools.reduce((sum, p) => sum + p.apy, 0) / allPools.length
            : 0;

        // Get top pool from each strategy
        const topLending = data.strategy1_safeLending[0];
        const topStablecoin = data.strategy2_stablecoinLP[0];
        const topVolatile = data.strategy3_volatileLP[0];

        return {
            tvl: '2,450,120.45', // Would come from vault contract
            apy: Math.round(avgApy * 100) / 100,
            totalYieldDistributed: '450,231.00', // Would come from vault contract
            nextRebalance: '4h 12m', // Would come from vault contract
            strategies: {
                lending: {
                    topPool: topLending?.name || 'Venus USDT',
                    apy: topLending?.apy || 3.5,
                    tvl: topLending?.tvl || '$100M+'
                },
                stablecoin: {
                    topPool: topStablecoin?.name || 'USDT-USDC LP',
                    apy: topStablecoin?.apy || 12,
                    tvl: topStablecoin?.tvl || '$45M+'
                },
                volatile: {
                    topPool: topVolatile?.name || 'CAKE-BNB LP',
                    apy: topVolatile?.apy || 45,
                    tvl: topVolatile?.tvl || '$85M+'
                }
            }
        };
    } catch (error) {
        console.error('Error fetching live vault stats:', error);
        // Return mock data on error
        return {
            tvl: '2,450,120.45',
            apy: 12.8,
            totalYieldDistributed: '450,231.00',
            nextRebalance: '4h 12m',
            strategies: {
                lending: { topPool: 'Venus USDT', apy: 3.5, tvl: '$100M+' },
                stablecoin: { topPool: 'USDT-USDC LP', apy: 12, tvl: '$45M+' },
                volatile: { topPool: 'CAKE-BNB LP', apy: 45, tvl: '$85M+' }
            }
        };
    }
};

// Export types and utilities
export { 
    calculateEstimatedYield,
    type PoolData,
    type YieldStrategyData
} from './protocolDataService';

export { protocolDataService };