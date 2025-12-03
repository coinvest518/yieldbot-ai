/**
 * YBOT Staking Service
 * Handles all staking contract interactions
 */

import { ethers } from 'ethers';
import { getEthereumObject } from './web3Service';

// Contract ABI
const STAKING_ABI = [
  // View functions
  "function ybotToken() view returns (address)",
  "function totalStaked() view returns (uint256)",
  "function rewardPool() view returns (uint256)",
  "function minStakeAmount() view returns (uint256)",
  "function earlyUnstakePenalty() view returns (uint256)",
  "function tierAPY(uint256) view returns (uint256)",
  "function userStakeCount(address) view returns (uint256)",
  "function userTotalStaked(address) view returns (uint256)",
  "function userStakes(address, uint256) view returns (uint256 amount, uint256 startTime, uint256 lockDuration, uint256 lastClaimTime, bool active)",
  "function calculateReward(address user, uint256 stakeId) view returns (uint256)",
  "function getTimeUntilUnlock(address user, uint256 stakeId) view returns (uint256)",
  "function getUserStakes(address user) view returns (uint256[] ids, uint256[] amounts, uint256[] startTimes, uint256[] lockDurations, uint256[] pendingRewards, bool[] activeStatus)",
  "function getStakingStats() view returns (uint256 _totalStaked, uint256 _rewardPool, uint256 _flexibleAPY, uint256 _7dayAPY, uint256 _30dayAPY, uint256 _90dayAPY)",
  // Write functions
  "function stake(uint256 amount, uint256 lockDuration)",
  "function unstake(uint256 stakeId)",
  "function claimRewards(uint256 stakeId)",
  "function fundRewardPool(uint256 amount)",
  // Events
  "event Staked(address indexed user, uint256 indexed stakeId, uint256 amount, uint256 lockDuration)",
  "event Unstaked(address indexed user, uint256 indexed stakeId, uint256 amount, uint256 reward, uint256 penalty)",
  "event RewardsClaimed(address indexed user, uint256 indexed stakeId, uint256 reward)"
];

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)"
];

// Contract addresses - DEPLOYED
const STAKING_ADDRESSES = {
  mainnet: import.meta.env.VITE_STAKING_MAINNET || '',
  testnet: import.meta.env.VITE_STAKING_TESTNET || '0x600a169769319e082A98365196db0437e7463389'
};

const YBOT_ADDRESSES = {
  mainnet: import.meta.env.VITE_YBOT_MAINNET || '',
  testnet: import.meta.env.VITE_YBOT_TESTNET || '0x5cBbBe32b2893DDCca439372F6AD120C848B2712'
};

// Lock duration constants (in seconds)
export const LOCK_TIERS = {
  FLEXIBLE: 0,
  DAYS_7: 7 * 24 * 60 * 60,   // 604800
  DAYS_30: 30 * 24 * 60 * 60, // 2592000
  DAYS_90: 90 * 24 * 60 * 60  // 7776000
};

// Types
export interface StakingStats {
  totalStaked: string;
  rewardPool: string;
  flexibleAPY: number;
  days7APY: number;
  days30APY: number;
  days90APY: number;
  minStakeAmount: string;
  earlyPenalty: number;
}

export interface UserStake {
  id: number;
  amount: string;
  startTime: Date;
  lockDuration: number;
  pendingReward: string;
  active: boolean;
  timeUntilUnlock: number;
  tierName: string;
  apy: number;
}

export interface UserStakingData {
  totalStaked: string;
  stakes: UserStake[];
  totalPendingRewards: string;
}

// ============ Utility Functions ============

const getNetworkType = async (): Promise<'mainnet' | 'testnet'> => {
  const ethereum = getEthereumObject();
  if (!ethereum) return 'testnet';
  const chainId = await ethereum.request({ method: 'eth_chainId' });
  return chainId === '0x38' ? 'mainnet' : 'testnet';
};

const getStakingAddress = async (): Promise<string> => {
  const network = await getNetworkType();
  return STAKING_ADDRESSES[network];
};

const getYBOTAddress = async (): Promise<string> => {
  const network = await getNetworkType();
  return YBOT_ADDRESSES[network];
};

const getTierName = (duration: number): string => {
  if (duration === 0) return 'Flexible';
  if (duration === LOCK_TIERS.DAYS_7) return '7 Days';
  if (duration === LOCK_TIERS.DAYS_30) return '30 Days';
  if (duration === LOCK_TIERS.DAYS_90) return '90 Days';
  return 'Unknown';
};

// ============ Read Functions ============

/**
 * Get global staking statistics
 */
export const getStakingStats = async (): Promise<StakingStats> => {
  const ethereum = getEthereumObject();
  
  if (!ethereum) {
    return getMockStats();
  }

  try {
    const provider = new ethers.BrowserProvider(ethereum);
    const address = await getStakingAddress();
    
    if (!address) {
      console.log('Staking contract not deployed yet');
      return getMockStats();
    }
    
    const contract = new ethers.Contract(address, STAKING_ABI, provider);
    
    const [stats, minStake, penalty] = await Promise.all([
      contract.getStakingStats(),
      contract.minStakeAmount(),
      contract.earlyUnstakePenalty()
    ]);

    return {
      totalStaked: ethers.formatUnits(stats._totalStaked, 18),
      rewardPool: ethers.formatUnits(stats._rewardPool, 18),
      flexibleAPY: Number(stats._flexibleAPY) / 100,
      days7APY: Number(stats._7dayAPY) / 100,
      days30APY: Number(stats._30dayAPY) / 100,
      days90APY: Number(stats._90dayAPY) / 100,
      minStakeAmount: ethers.formatUnits(minStake, 18),
      earlyPenalty: Number(penalty) / 100
    };
  } catch (error) {
    console.error('Error fetching staking stats:', error);
    return getMockStats();
  }
};

/**
 * Get user's staking data
 */
export const getUserStakingData = async (userAddress: string): Promise<UserStakingData> => {
  const ethereum = getEthereumObject();
  
  if (!ethereum) {
    return { totalStaked: '0', stakes: [], totalPendingRewards: '0' };
  }

  try {
    const provider = new ethers.BrowserProvider(ethereum);
    const address = await getStakingAddress();
    
    if (!address) {
      return { totalStaked: '0', stakes: [], totalPendingRewards: '0' };
    }
    
    const contract = new ethers.Contract(address, STAKING_ABI, provider);
    
    const [userTotal, stakesData, stats] = await Promise.all([
      contract.userTotalStaked(userAddress),
      contract.getUserStakes(userAddress),
      contract.getStakingStats()
    ]);

    const stakes: UserStake[] = [];
    let totalPending = BigInt(0);

    for (let i = 0; i < stakesData.ids.length; i++) {
      if (stakesData.activeStatus[i]) {
        const lockDuration = Number(stakesData.lockDurations[i]);
        const timeUntilUnlock = await contract.getTimeUntilUnlock(userAddress, i);
        
        // Get APY for this tier
        let apy = Number(stats._flexibleAPY) / 100;
        if (lockDuration === LOCK_TIERS.DAYS_7) apy = Number(stats._7dayAPY) / 100;
        else if (lockDuration === LOCK_TIERS.DAYS_30) apy = Number(stats._30dayAPY) / 100;
        else if (lockDuration === LOCK_TIERS.DAYS_90) apy = Number(stats._90dayAPY) / 100;

        stakes.push({
          id: Number(stakesData.ids[i]),
          amount: ethers.formatUnits(stakesData.amounts[i], 18),
          startTime: new Date(Number(stakesData.startTimes[i]) * 1000),
          lockDuration,
          pendingReward: ethers.formatUnits(stakesData.pendingRewards[i], 18),
          active: stakesData.activeStatus[i],
          timeUntilUnlock: Number(timeUntilUnlock),
          tierName: getTierName(lockDuration),
          apy
        });

        totalPending += stakesData.pendingRewards[i];
      }
    }

    return {
      totalStaked: ethers.formatUnits(userTotal, 18),
      stakes,
      totalPendingRewards: ethers.formatUnits(totalPending, 18)
    };
  } catch (error) {
    console.error('Error fetching user staking data:', error);
    return { totalStaked: '0', stakes: [], totalPendingRewards: '0' };
  }
};

// ============ Write Functions ============

/**
 * Approve YBOT spending for staking
 */
export const approveYBOTForStaking = async (amount: string): Promise<string> => {
  const ethereum = getEthereumObject();
  if (!ethereum) throw new Error('Wallet not connected');

  const provider = new ethers.BrowserProvider(ethereum);
  const signer = await provider.getSigner();
  const stakingAddress = await getStakingAddress();
  const ybotAddress = await getYBOTAddress();
  
  if (!stakingAddress) throw new Error('Staking contract not deployed');
  
  const ybotContract = new ethers.Contract(ybotAddress, ERC20_ABI, signer);
  const amountWei = ethers.parseUnits(amount, 18);
  
  const tx = await ybotContract.approve(stakingAddress, amountWei);
  await tx.wait();
  
  return tx.hash;
};

/**
 * Stake YBOT tokens
 */
export const stakeYBOT = async (amount: string, lockDuration: number): Promise<string> => {
  console.log('[Staking] Starting stake:', { amount, lockDuration });
  
  const ethereum = getEthereumObject();
  if (!ethereum) {
    console.error('[Staking] No ethereum object found - wallet not connected');
    throw new Error('Wallet not connected. Please connect your wallet first.');
  }

  try {
    console.log('[Staking] Creating provider...');
    const provider = new ethers.BrowserProvider(ethereum);
    
    console.log('[Staking] Getting signer - this should prompt wallet...');
    const signer = await provider.getSigner();
    const userAddress = await signer.getAddress();
    console.log('[Staking] Got signer for address:', userAddress);
    
    const stakingAddress = await getStakingAddress();
    const ybotAddress = await getYBOTAddress();
    
    console.log('[Staking] Contract addresses:', { stakingAddress, ybotAddress });
    
    if (!stakingAddress) throw new Error('Staking contract not deployed');
    
    const amountWei = ethers.parseUnits(amount, 18);
    console.log('[Staking] Amount in wei:', amountWei.toString());
    
    // Check and approve if needed
    const ybotContract = new ethers.Contract(ybotAddress, ERC20_ABI, signer);
    const allowance = await ybotContract.allowance(userAddress, stakingAddress);
    console.log('[Staking] Current allowance:', allowance.toString());
    
    if (allowance < amountWei) {
      console.log('[Staking] Approval needed - prompting wallet for approval...');
      const approveTx = await ybotContract.approve(stakingAddress, amountWei);
      console.log('[Staking] Approval tx sent:', approveTx.hash);
      await approveTx.wait();
      console.log('[Staking] Approval confirmed');
    }
    
    // Stake
    console.log('[Staking] Sending stake transaction - prompting wallet...');
    const stakingContract = new ethers.Contract(stakingAddress, STAKING_ABI, signer);
    const tx = await stakingContract.stake(amountWei, lockDuration);
    console.log('[Staking] Stake tx sent:', tx.hash);
    await tx.wait();
    console.log('[Staking] Stake confirmed!');
    
    return tx.hash;
  } catch (error: any) {
    console.error('[Staking] Error during stake:', error);
    
    // Provide better error messages
    if (error.code === 'ACTION_REJECTED' || error.code === 4001) {
      throw new Error('Transaction rejected by user');
    }
    if (error.message?.includes('insufficient funds')) {
      throw new Error('Insufficient BNB for gas fees');
    }
    if (error.message?.includes('transfer amount exceeds balance')) {
      throw new Error('Insufficient YBOT balance');
    }
    
    throw error;
  }
};

/**
 * Unstake tokens and claim rewards
 */
export const unstakeYBOT = async (stakeId: number): Promise<string> => {
  const ethereum = getEthereumObject();
  if (!ethereum) throw new Error('Wallet not connected');

  const provider = new ethers.BrowserProvider(ethereum);
  const signer = await provider.getSigner();
  const stakingAddress = await getStakingAddress();
  
  if (!stakingAddress) throw new Error('Staking contract not deployed');
  
  const contract = new ethers.Contract(stakingAddress, STAKING_ABI, signer);
  const tx = await contract.unstake(stakeId);
  await tx.wait();
  
  return tx.hash;
};

/**
 * Claim rewards without unstaking
 */
export const claimStakingRewards = async (stakeId: number): Promise<string> => {
  const ethereum = getEthereumObject();
  if (!ethereum) throw new Error('Wallet not connected');

  const provider = new ethers.BrowserProvider(ethereum);
  const signer = await provider.getSigner();
  const stakingAddress = await getStakingAddress();
  
  if (!stakingAddress) throw new Error('Staking contract not deployed');
  
  const contract = new ethers.Contract(stakingAddress, STAKING_ABI, signer);
  const tx = await contract.claimRewards(stakeId);
  await tx.wait();
  
  return tx.hash;
};

// ============ Mock Data ============

const getMockStats = (): StakingStats => {
  return {
    totalStaked: '50000',
    rewardPool: '10000',
    flexibleAPY: 5,
    days7APY: 12,
    days30APY: 25,
    days90APY: 50,
    minStakeAmount: '10',
    earlyPenalty: 10
  };
};

// Export tier constants for UI
export const STAKING_TIERS = [
  { duration: LOCK_TIERS.FLEXIBLE, name: 'Flexible', description: 'No lock, withdraw anytime' },
  { duration: LOCK_TIERS.DAYS_7, name: '7 Days', description: '7 day lock period' },
  { duration: LOCK_TIERS.DAYS_30, name: '30 Days', description: '30 day lock period' },
  { duration: LOCK_TIERS.DAYS_90, name: '90 Days', description: '90 day lock period' }
];
