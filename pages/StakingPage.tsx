/**
 * YBOT Staking Page
 * Stake YBOT tokens to earn more YBOT rewards
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import {
  Coins,
  Lock,
  Unlock,
  TrendingUp,
  Clock,
  Gift,
  ArrowLeft,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Wallet,
  Info,
  Zap,
} from 'lucide-react';
import { useAccount, useChainId } from 'wagmi';
import {
  getStakingStats,
  getUserStakingData,
  stakeYBOT,
  unstakeYBOT,
  claimStakingRewards,
  STAKING_TIERS,
  LOCK_TIERS,
  type StakingStats,
  type UserStakingData,
  type UserStake,
} from '../services/stakingService';
import { getYBOTBalance, switchChainToBNB } from '../services/web3Service';

// ============ TIER CARD ============

interface TierCardProps {
  tier: typeof STAKING_TIERS[0];
  apy: number;
  selected: boolean;
  onSelect: () => void;
}

const TierCard: React.FC<TierCardProps> = ({ tier, apy, selected, onSelect }) => {
  const getIcon = () => {
    if (tier.duration === 0) return <Unlock className="w-6 h-6" />;
    return <Lock className="w-6 h-6" />;
  };

  return (
    <button
      onClick={onSelect}
      className={`p-4 rounded-xl border-2 transition-all text-left ${
        selected
          ? 'border-purple-500 bg-purple-500/20'
          : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
      }`}
    >
      <div className="flex items-center gap-3 mb-2">
        <div className={`p-2 rounded-lg ${selected ? 'bg-purple-500' : 'bg-slate-700'}`}>
          {getIcon()}
        </div>
        <div>
          <h3 className="font-bold text-white">{tier.name}</h3>
          <p className="text-xs text-gray-400">{tier.description}</p>
        </div>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-bold text-green-400">{apy}%</span>
        <span className="text-sm text-gray-500">APY</span>
      </div>
    </button>
  );
};

// ============ STAKE CARD ============

interface StakeCardProps {
  stake: UserStake;
  onUnstake: (id: number) => void;
  onClaim: (id: number) => void;
  loading: boolean;
  earlyPenalty: number;
}

const StakeCard: React.FC<StakeCardProps> = ({ stake, onUnstake, onClaim, loading, earlyPenalty }) => {
  const isLocked = stake.timeUntilUnlock > 0;
  const pendingReward = parseFloat(stake.pendingReward);
  
  const formatTime = (seconds: number): string => {
    if (seconds <= 0) return 'Unlocked';
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    if (days > 0) return `${days}d ${hours}h`;
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${mins}m`;
  };

  return (
    <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
              stake.lockDuration === 0 
                ? 'bg-blue-500/20 text-blue-400' 
                : 'bg-purple-500/20 text-purple-400'
            }`}>
              {stake.tierName}
            </span>
            <span className="text-green-400 text-sm">{stake.apy}% APY</span>
          </div>
          <p className="text-2xl font-bold text-white">
            {parseFloat(stake.amount).toLocaleString()} YBOT
          </p>
          <p className="text-xs text-gray-500">
            Staked {stake.startTime.toLocaleDateString()}
          </p>
        </div>
        
        {isLocked ? (
          <div className="text-right">
            <div className="flex items-center gap-1 text-yellow-400">
              <Lock className="w-4 h-4" />
              <span className="text-sm font-medium">{formatTime(stake.timeUntilUnlock)}</span>
            </div>
            <p className="text-xs text-gray-500">until unlock</p>
          </div>
        ) : (
          <div className="flex items-center gap-1 text-green-400">
            <Unlock className="w-4 h-4" />
            <span className="text-sm">Unlocked</span>
          </div>
        )}
      </div>

      {/* Pending Rewards */}
      <div className="bg-slate-900/50 rounded-lg p-3 mb-4">
        <div className="flex items-center justify-between">
          <span className="text-gray-400 text-sm">Pending Rewards</span>
          <div className="flex items-center gap-1">
            <Gift className="w-4 h-4 text-green-400" />
            <span className="text-green-400 font-bold">
              +{pendingReward.toFixed(4)} YBOT
            </span>
          </div>
        </div>
      </div>

      {/* Warning for early unstake */}
      {isLocked && stake.lockDuration > 0 && (
        <div className="flex items-start gap-2 text-yellow-400 bg-yellow-500/10 rounded-lg p-3 mb-4">
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <p className="text-xs">
            Early unstake will incur a {earlyPenalty}% penalty and forfeit rewards
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={() => onClaim(stake.id)}
          disabled={loading || pendingReward <= 0}
          className="flex-1 py-2 px-4 bg-green-500/20 text-green-400 rounded-lg font-medium 
                     hover:bg-green-500/30 disabled:opacity-50 disabled:cursor-not-allowed
                     flex items-center justify-center gap-2"
        >
          <Gift className="w-4 h-4" />
          Claim
        </button>
        <button
          onClick={() => onUnstake(stake.id)}
          disabled={loading}
          className={`flex-1 py-2 px-4 rounded-lg font-medium flex items-center justify-center gap-2 ${
            isLocked && stake.lockDuration > 0
              ? 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30'
              : 'bg-purple-500/20 text-purple-400 hover:bg-purple-500/30'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          <Unlock className="w-4 h-4" />
          {isLocked && stake.lockDuration > 0 ? 'Early Unstake' : 'Unstake'}
        </button>
      </div>
    </div>
  );
};

// ============ MAIN PAGE ============

const StakingPage: React.FC = () => {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  
  // BSC Testnet = 97, BSC Mainnet = 56
  const isCorrectNetwork = chainId === 97 || chainId === 56;
  
  const [stats, setStats] = useState<StakingStats | null>(null);
  const [userData, setUserData] = useState<UserStakingData | null>(null);
  const [ybotBalance, setYbotBalance] = useState('0');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  
  // Stake form
  const [stakeAmount, setStakeAmount] = useState('');
  const [selectedTier, setSelectedTier] = useState(LOCK_TIERS.DAYS_30);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSwitchNetwork = async () => {
    try {
      await switchChainToBNB(true); // true = mainnet
    } catch (e: any) {
      setError('Failed to switch network. Please switch to BSC Mainnet manually.');
    }
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const statsData = await getStakingStats();
      setStats(statsData);
      
      if (address) {
        const [userDataResult, balance] = await Promise.all([
          getUserStakingData(address),
          getYBOTBalance(address)
        ]);
        setUserData(userDataResult);
        setYbotBalance(balance);
      }
    } catch (e) {
      console.error('Error loading staking data:', e);
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [loadData]);

  const handleStake = async () => {
    console.log('[StakingPage] handleStake called');
    
    if (!stakeAmount || parseFloat(stakeAmount) <= 0) {
      setError('Enter a valid amount');
      return;
    }
    
    if (parseFloat(stakeAmount) > parseFloat(ybotBalance)) {
      setError('Insufficient YBOT balance');
      return;
    }

    if (stats && parseFloat(stakeAmount) < parseFloat(stats.minStakeAmount)) {
      setError(`Minimum stake is ${stats.minStakeAmount} YBOT`);
      return;
    }

    if (!isCorrectNetwork) {
      setError('Please switch to BSC Testnet');
      return;
    }

    setActionLoading(true);
    setError(null);
    
    try {
      console.log('[StakingPage] Calling stakeYBOT with:', { stakeAmount, selectedTier });
      const txHash = await stakeYBOT(stakeAmount, selectedTier);
      console.log('[StakingPage] Stake successful:', txHash);
      setSuccess(`Successfully staked ${stakeAmount} YBOT! TX: ${txHash.slice(0, 10)}...`);
      setStakeAmount('');
      await loadData();
    } catch (e: any) {
      console.error('[StakingPage] Stake error:', e);
      setError(e.message || 'Staking failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnstake = async (stakeId: number) => {
    setActionLoading(true);
    setError(null);
    
    try {
      await unstakeYBOT(stakeId);
      setSuccess('Successfully unstaked!');
      await loadData();
    } catch (e: any) {
      setError(e.message || 'Unstake failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleClaim = async (stakeId: number) => {
    setActionLoading(true);
    setError(null);
    
    try {
      await claimStakingRewards(stakeId);
      setSuccess('Rewards claimed!');
      await loadData();
    } catch (e: any) {
      setError(e.message || 'Claim failed');
    } finally {
      setActionLoading(false);
    }
  };

  const getAPYForTier = (duration: number): number => {
    if (!stats) return 0;
    if (duration === 0) return stats.flexibleAPY;
    if (duration === LOCK_TIERS.DAYS_7) return stats.days7APY;
    if (duration === LOCK_TIERS.DAYS_30) return stats.days30APY;
    if (duration === LOCK_TIERS.DAYS_90) return stats.days90APY;
    return 0;
  };

  // Clear messages after 5 seconds
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  if (loading && !stats) {
    return (
      <div className="min-h-screen bg-ybot-dark flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 text-purple-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading staking data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ybot-dark">
      <Navbar />
      
      <main className="max-w-7xl mx-auto px-4 pt-28 pb-8">
        {/* Page Title Bar */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link to="/" className="p-2 hover:bg-slate-800 rounded-lg transition-colors text-gray-400 hover:text-white">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-2">
              <Coins className="w-7 h-7 text-purple-500" />
              <h1 className="text-2xl font-bold text-white">YBOT Staking</h1>
            </div>
          </div>
          
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-gray-400 hover:text-white transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
        
        {/* Stats Banner */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-gradient-to-br from-purple-500/20 to-purple-900/20 rounded-xl p-4 border border-purple-500/20">
            <div className="flex items-center gap-2 text-purple-400 mb-1">
              <Coins className="w-4 h-4" />
              <span className="text-sm">Total Staked</span>
            </div>
            <p className="text-2xl font-bold text-white">
              {stats ? parseFloat(stats.totalStaked).toLocaleString() : '0'} YBOT
            </p>
          </div>
          
          <div className="bg-gradient-to-br from-green-500/20 to-green-900/20 rounded-xl p-4 border border-green-500/20">
            <div className="flex items-center gap-2 text-green-400 mb-1">
              <Gift className="w-4 h-4" />
              <span className="text-sm">Reward Pool</span>
            </div>
            <p className="text-2xl font-bold text-white">
              {stats ? parseFloat(stats.rewardPool).toLocaleString() : '0'} YBOT
            </p>
          </div>
          
          <div className="bg-gradient-to-br from-blue-500/20 to-blue-900/20 rounded-xl p-4 border border-blue-500/20">
            <div className="flex items-center gap-2 text-blue-400 mb-1">
              <TrendingUp className="w-4 h-4" />
              <span className="text-sm">Max APY</span>
            </div>
            <p className="text-2xl font-bold text-white">
              {stats?.days90APY || 50}%
            </p>
          </div>
          
          <div className="bg-gradient-to-br from-yellow-500/20 to-yellow-900/20 rounded-xl p-4 border border-yellow-500/20">
            <div className="flex items-center gap-2 text-yellow-400 mb-1">
              <Wallet className="w-4 h-4" />
              <span className="text-sm">Your Balance</span>
            </div>
            <p className="text-2xl font-bold text-white">
              {parseFloat(ybotBalance).toLocaleString()} YBOT
            </p>
          </div>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/20 border border-red-500/30 rounded-lg flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            <p className="text-red-400">{error}</p>
          </div>
        )}
        
        {success && (
          <div className="mb-6 p-4 bg-green-500/20 border border-green-500/30 rounded-lg flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-green-400" />
            <p className="text-green-400">{success}</p>
          </div>
        )}

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Stake Panel */}
          <div className="bg-slate-800/30 rounded-2xl p-6 border border-slate-700/50">
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <Zap className="w-5 h-5 text-purple-500" />
              Stake YBOT
            </h2>

            {/* Tier Selection */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              {STAKING_TIERS.map((tier) => (
                <TierCard
                  key={tier.duration}
                  tier={tier}
                  apy={getAPYForTier(tier.duration)}
                  selected={selectedTier === tier.duration}
                  onSelect={() => setSelectedTier(tier.duration)}
                />
              ))}
            </div>

            {/* Amount Input */}
            <div className="mb-6">
              <label className="block text-sm text-gray-400 mb-2">Amount to Stake</label>
              <div className="relative">
                <input
                  type="number"
                  value={stakeAmount}
                  onChange={(e) => setStakeAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white 
                           placeholder-gray-500 focus:outline-none focus:border-purple-500"
                />
                <button
                  onClick={() => setStakeAmount(ybotBalance)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 px-3 py-1 bg-purple-500/20 
                           text-purple-400 rounded-lg text-sm hover:bg-purple-500/30"
                >
                  MAX
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Min: {stats?.minStakeAmount || '10'} YBOT • Balance: {parseFloat(ybotBalance).toLocaleString()} YBOT
              </p>
            </div>

            {/* Preview */}
            {stakeAmount && parseFloat(stakeAmount) > 0 && (
              <div className="bg-slate-900/50 rounded-xl p-4 mb-6">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-400">Lock Period</span>
                  <span className="text-white">{STAKING_TIERS.find(t => t.duration === selectedTier)?.name}</span>
                </div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-400">APY</span>
                  <span className="text-green-400">{getAPYForTier(selectedTier)}%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Est. Daily Reward</span>
                  <span className="text-green-400">
                    +{((parseFloat(stakeAmount) * getAPYForTier(selectedTier) / 100) / 365).toFixed(4)} YBOT
                  </span>
                </div>
              </div>
            )}

            {/* Stake Button */}
            {!isConnected ? (
              <div className="text-center py-4 bg-slate-700/50 rounded-xl">
                <Wallet className="w-6 h-6 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-400">Connect wallet to stake</p>
              </div>
            ) : !isCorrectNetwork ? (
              <button
                onClick={handleSwitchNetwork}
                className="w-full py-4 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-xl font-bold 
                         text-white hover:opacity-90 flex items-center justify-center gap-2"
              >
                <AlertTriangle className="w-5 h-5" />
                Switch to BSC Testnet
              </button>
            ) : (
              <button
                onClick={handleStake}
                disabled={actionLoading || !stakeAmount || parseFloat(stakeAmount) <= 0}
                className="w-full py-4 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl font-bold 
                         text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed
                         flex items-center justify-center gap-2"
              >
                {actionLoading ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Lock className="w-5 h-5" />
                    Stake YBOT
                  </>
                )}
              </button>
            )}

            {/* Info */}
            <div className="mt-4 p-3 bg-blue-500/10 rounded-lg flex items-start gap-2">
              <Info className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-blue-400">
                Early unstake penalty: {stats?.earlyPenalty || 10}%. Flexible tier has no penalty.
              </p>
            </div>
          </div>

          {/* Your Stakes */}
          <div className="bg-slate-800/30 rounded-2xl p-6 border border-slate-700/50">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Wallet className="w-5 h-5 text-purple-500" />
                Your Stakes
              </h2>
              {userData && (
                <div className="text-right">
                  <p className="text-sm text-gray-400">Total Staked</p>
                  <p className="text-lg font-bold text-white">
                    {parseFloat(userData.totalStaked).toLocaleString()} YBOT
                  </p>
                </div>
              )}
            </div>

            {/* Pending Rewards Summary */}
            {userData && parseFloat(userData.totalPendingRewards) > 0 && (
              <div className="bg-gradient-to-r from-green-500/20 to-emerald-500/20 rounded-xl p-4 mb-6 border border-green-500/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Gift className="w-5 h-5 text-green-400" />
                    <span className="text-green-400">Total Pending Rewards</span>
                  </div>
                  <span className="text-xl font-bold text-green-400">
                    +{parseFloat(userData.totalPendingRewards).toFixed(4)} YBOT
                  </span>
                </div>
              </div>
            )}

            {/* Stakes List */}
            <div className="space-y-4 max-h-[500px] overflow-y-auto">
              {!isConnected ? (
                <div className="text-center py-12">
                  <Wallet className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400">Connect wallet to view your stakes</p>
                </div>
              ) : userData && userData.stakes.length > 0 ? (
                userData.stakes.map((stake) => (
                  <StakeCard
                    key={stake.id}
                    stake={stake}
                    onUnstake={handleUnstake}
                    onClaim={handleClaim}
                    loading={actionLoading}
                    earlyPenalty={stats?.earlyPenalty || 10}
                  />
                ))
              ) : (
                <div className="text-center py-12">
                  <Coins className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400 mb-2">No active stakes</p>
                  <p className="text-sm text-gray-500">Stake YBOT to start earning rewards</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* How It Works */}
        <div className="mt-12 bg-slate-800/30 rounded-2xl p-6 border border-slate-700/50">
          <h2 className="text-xl font-bold text-white mb-6">How Staking Works</h2>
          <div className="grid md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl font-bold text-purple-400">1</span>
              </div>
              <h3 className="font-bold text-white mb-1">Choose Tier</h3>
              <p className="text-sm text-gray-400">Select lock period. Longer locks = higher APY</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl font-bold text-purple-400">2</span>
              </div>
              <h3 className="font-bold text-white mb-1">Stake YBOT</h3>
              <p className="text-sm text-gray-400">Deposit your tokens into the staking contract</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl font-bold text-purple-400">3</span>
              </div>
              <h3 className="font-bold text-white mb-1">Earn Rewards</h3>
              <p className="text-sm text-gray-400">Rewards accrue every second based on APY</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl font-bold text-purple-400">4</span>
              </div>
              <h3 className="font-bold text-white mb-1">Claim Anytime</h3>
              <p className="text-sm text-gray-400">Claim rewards or unstake after lock ends</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default StakingPage;
