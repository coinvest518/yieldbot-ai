/**
 * Fundraiser Page - Full Bonding Curve Token Sale Interface
 * Features: Live chart, trade feed, leaderboard, buy/sell interface
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  Activity,
  ArrowLeft,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Info,
  ExternalLink,
  Coins,
  Target,
  Trophy,
  Zap,
  Clock,
} from 'lucide-react';
import { useAccount, useBalance, useChainId } from 'wagmi';
import { formatUnits } from 'viem';
import {
  getFundraiserStats,
  getUserFundraiserData,
  calculateTokensForAmount,
  buyWithBnb,
  buyWithUsdc,
  sellTokens,
  generateBondingCurveData,
  getLeaderboard,
  subscribeToPurchaseEvents,
  fetchContractEvents,
  FUNDRAISER_CONSTANTS,
  type FundraiserStats,
  type UserFundraiserData,
  type TradeEvent,
  type LeaderboardEntry,
  type BondingCurvePoint,
} from '../services/fundraiserService';
import { getYBOTBalance } from '../services/web3Service';

// ============ BONDING CURVE CHART ============

interface BondingCurveChartProps {
  data: BondingCurvePoint[];
  currentPosition: number;
}

const BondingCurveChart: React.FC<BondingCurveChartProps> = ({ data, currentPosition }) => {
  // Handle empty data
  if (!data || data.length === 0) {
    return (
      <div className="relative h-64 w-full flex items-center justify-center">
        <p className="text-gray-500">Loading chart data...</p>
      </div>
    );
  }

  const maxPrice = Math.max(...data.map(d => d.price));
  const maxTokens = Math.max(...data.map(d => d.tokensSold));
  
  // Find current position index
  const currentIdx = data.findIndex(d => d.tokensSold >= currentPosition);
  
  // Generate path data safely
  const pathData = data.map((point, i) => {
    const x = (point.tokensSold / maxTokens) * 400;
    const y = 200 - (point.price / maxPrice) * 180;
    // Ensure coordinates are valid numbers
    const safeX = isNaN(x) ? 0 : Math.max(0, Math.min(400, x));
    const safeY = isNaN(y) ? 200 : Math.max(0, Math.min(200, y));
    return `${i === 0 ? 'M' : 'L'} ${safeX} ${safeY}`;
  }).join(' ');
  
  // Generate filled area path
  const filledAreaData = `M 0 200 ${data.map((point) => {
    const x = (point.tokensSold / maxTokens) * 400;
    const y = 200 - (point.price / maxPrice) * 180;
    const safeX = isNaN(x) ? 0 : Math.max(0, Math.min(400, x));
    const safeY = isNaN(y) ? 200 : Math.max(0, Math.min(200, y));
    return `L ${safeX} ${safeY}`;
  }).join(' ')} L 400 200 Z`;
  
  return (
    <div className="relative h-64 w-full">
      {/* Y-axis labels */}
      <div className="absolute left-0 top-0 bottom-8 w-16 flex flex-col justify-between text-xs text-gray-500">
        <span>${maxPrice.toFixed(2)}</span>
        <span>${(maxPrice / 2).toFixed(2)}</span>
        <span>${FUNDRAISER_CONSTANTS.BASE_PRICE.toFixed(2)}</span>
      </div>
      
      {/* Chart area */}
      <div className="ml-16 mr-4 h-full relative">
        <svg className="w-full h-56" viewBox="0 0 400 200" preserveAspectRatio="none">
          {/* Grid lines */}
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="0.5"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
          
          {/* Filled area under curve */}
          <path
            d={filledAreaData}
            fill="url(#curveGradient)"
            opacity="0.3"
          />
          
          {/* Gradient definition */}
          <defs>
            <linearGradient id="curveGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.8"/>
              <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0"/>
            </linearGradient>
          </defs>
          
          {/* Main curve line */}
          <path
            d={pathData}
            fill="none"
            stroke="#8b5cf6"
            strokeWidth="3"
          />
          
          {/* Current position marker */}
          {currentIdx >= 0 && currentIdx < data.length && (
            <>
              {/* Vertical line at current position */}
              <line
                x1={(currentPosition / maxTokens) * 400}
                y1="0"
                x2={(currentPosition / maxTokens) * 400}
                y2="200"
                stroke="#22c55e"
                strokeWidth="1"
                strokeDasharray="4 4"
              />
              
              {/* Dot at current position */}
              <circle
                cx={(currentPosition / maxTokens) * 400}
                cy={200 - (data[currentIdx]?.price || FUNDRAISER_CONSTANTS.BASE_PRICE) / maxPrice * 180}
                r="6"
                fill="#22c55e"
                stroke="white"
                strokeWidth="2"
              />
            </>
          )}
        </svg>
        
        {/* X-axis labels */}
        <div className="flex justify-between text-xs text-gray-500 mt-2">
          <span>0</span>
          <span>{(maxTokens / 2 / 1000).toFixed(0)}K</span>
          <span>{(maxTokens / 1000).toFixed(0)}K tokens</span>
        </div>
      </div>
      
      {/* Current price indicator */}
      <div className="absolute top-2 right-2 bg-green-500/20 border border-green-500/30 rounded-lg px-3 py-1">
        <span className="text-xs text-gray-400">Current: </span>
        <span className="text-green-400 font-bold">
          ${(FUNDRAISER_CONSTANTS.BASE_PRICE + currentPosition * FUNDRAISER_CONSTANTS.PRICE_INCREMENT).toFixed(4)}
        </span>
      </div>
    </div>
  );
};

// ============ LIVE TRADE FEED ============

interface TradeFeedProps {
  trades: TradeEvent[];
}

const TradeFeed: React.FC<TradeFeedProps> = ({ trades }) => {
  return (
    <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
      {trades.length === 0 ? (
        <div className="text-center text-gray-500 py-8">
          <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No trades yet. Be the first!</p>
        </div>
      ) : (
        trades.map((trade, idx) => (
          <a
            key={trade.txHash || idx}
            href={`https://bscscan.com/tx/${trade.txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex items-center justify-between p-3 rounded-lg cursor-pointer hover:opacity-80 transition-opacity ${
              trade.type === 'buy' 
                ? 'bg-green-500/10 border border-green-500/20' 
                : 'bg-red-500/10 border border-red-500/20'
            }`}
          >
            <div className="flex items-center gap-3">
              {trade.type === 'buy' ? (
                <ArrowUpRight className="w-5 h-5 text-green-400" />
              ) : (
                <ArrowDownRight className="w-5 h-5 text-red-400" />
              )}
              <div>
                <p className="text-sm text-white font-medium flex items-center gap-1">
                  {trade.address.slice(0, 6)}...{trade.address.slice(-4)}
                  <ExternalLink className="w-3 h-3 text-gray-500" />
                </p>
                <p className="text-xs text-gray-500">
                  {new Date(trade.timestamp).toLocaleString()}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className={`text-sm font-bold ${trade.type === 'buy' ? 'text-green-400' : 'text-red-400'}`}>
                {trade.type === 'buy' ? '+' : '-'}{parseFloat(trade.tokenAmount).toFixed(0)} YBOT
              </p>
              <p className="text-xs text-gray-500">
                ${parseFloat(trade.usdAmount).toFixed(2)}
              </p>
            </div>
          </a>
        ))
      )}
    </div>
  );
};

// ============ LEADERBOARD ============

interface LeaderboardProps {
  entries: LeaderboardEntry[];
  userAddress?: string;
}

const Leaderboard: React.FC<LeaderboardProps> = ({ entries, userAddress }) => {
  const getRankIcon = (rank: number) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
  };

  return (
    <div className="space-y-2">
      {entries.map((entry) => (
        <div
          key={entry.rank}
          className={`flex items-center justify-between p-3 rounded-lg cursor-pointer hover:opacity-80 transition-opacity ${
            entry.address === userAddress
              ? 'bg-purple-500/20 border border-purple-500/30'
              : 'bg-slate-800/50'
          }`}
          onClick={() => {
            if (entry.fullAddress && entry.fullAddress !== '') {
              window.open(`https://bscscan.com/address/${entry.fullAddress}`, '_blank');
            }
          }}
        >
          <div className="flex items-center gap-3">
            <span className="text-xl w-8 text-center">{getRankIcon(entry.rank)}</span>
            <span className="text-sm text-white font-mono">{entry.address}</span>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold text-green-400">{entry.contribution}</p>
            <p className="text-xs text-gray-500">{entry.tokens} YBOT</p>
          </div>
        </div>
      ))}
    </div>
  );
};

// ============ BUY/SELL INTERFACE ============

interface TradeInterfaceProps {
  stats: FundraiserStats;
  userData: UserFundraiserData;
  onTrade: () => void;
}

const TradeInterface: React.FC<TradeInterfaceProps> = ({ stats, userData, onTrade }) => {
  // Wrap wagmi hooks in try-catch to prevent MetaMask errors
  let address: `0x${string}` | undefined;
  let isConnected = false;
  let bnbBalance: any = null;

  try {
    const accountData = useAccount();
    address = accountData.address;
    isConnected = accountData.isConnected;
    const balanceData = useBalance({ address });
    bnbBalance = balanceData.data;
  } catch (walletError) {
    console.warn('⚠️ Trade interface wallet error:', walletError);
    // Continue with wallet features disabled
  }
  
  const [mode, setMode] = useState<'buy' | 'sell'>('buy');
  const [paymentToken, setPaymentToken] = useState<'BNB' | 'USDC'>('BNB');
  const [amount, setAmount] = useState('');
  const [preview, setPreview] = useState<{ tokens: string; fee: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Calculate preview when amount changes
  useEffect(() => {
    const calculatePreview = async () => {
      if (!amount || parseFloat(amount) <= 0) {
        setPreview(null);
        return;
      }

      try {
        const result = await calculateTokensForAmount(amount, paymentToken);
        setPreview({ tokens: result.tokens, fee: result.fee });
      } catch (e) {
        console.error('Preview calculation error:', e);
      }
    };

    const debounce = setTimeout(calculatePreview, 300);
    return () => clearTimeout(debounce);
  }, [amount, paymentToken]);

  const handleTrade = async () => {
    if (!isConnected || !amount || parseFloat(amount) <= 0) return;
    
    setLoading(true);
    setError(null);
    
    try {
      if (mode === 'buy') {
        if (paymentToken === 'BNB') {
          await buyWithBnb(amount);
        } else {
          await buyWithUsdc(amount);
        }
      } else {
        await sellTokens(amount);
      }
      
      setAmount('');
      setPreview(null);
      onTrade();
    } catch (e: any) {
      setError(e.message || 'Transaction failed');
    } finally {
      setLoading(false);
    }
  };

  const bnbBalanceFormatted = bnbBalance 
    ? parseFloat(formatUnits(bnbBalance.value, bnbBalance.decimals)).toFixed(4)
    : '0';

  return (
    <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
      {/* Mode Toggle */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setMode('buy')}
          className={`flex-1 py-3 rounded-lg font-bold transition-all ${
            mode === 'buy'
              ? 'bg-green-500 text-white'
              : 'bg-slate-700 text-gray-400 hover:bg-slate-600'
          }`}
        >
          Buy YBOT
        </button>
        <button
          onClick={() => setMode('sell')}
          className={`flex-1 py-3 rounded-lg font-bold transition-all ${
            mode === 'sell'
              ? 'bg-red-500 text-white'
              : 'bg-slate-700 text-gray-400 hover:bg-slate-600'
          }`}
        >
          Sell YBOT
        </button>
      </div>

      {mode === 'buy' && (
        <>
          {/* Payment Token Selection */}
          <div className="mb-4">
            <label className="text-sm text-gray-400 mb-2 block">Pay with</label>
            <div className="flex gap-2">
              <button
                onClick={() => setPaymentToken('BNB')}
                className={`flex-1 py-3 rounded-lg flex items-center justify-center gap-2 transition-all ${
                  paymentToken === 'BNB'
                    ? 'bg-yellow-500/20 border-2 border-yellow-500 text-yellow-400'
                    : 'bg-slate-700 text-gray-400'
                }`}
              >
                🔶 BNB
              </button>
              <button
                onClick={() => setPaymentToken('USDC')}
                className={`flex-1 py-3 rounded-lg flex items-center justify-center gap-2 transition-all ${
                  paymentToken === 'USDC'
                    ? 'bg-blue-500/20 border-2 border-blue-500 text-blue-400'
                    : 'bg-slate-700 text-gray-400'
                }`}
              >
                💵 USDC
              </button>
            </div>
          </div>

          {/* Amount Input */}
          <div className="mb-4">
            <div className="flex justify-between mb-2">
              <label className="text-sm text-gray-400">Amount</label>
              <span className="text-sm text-gray-500">
                Balance: {paymentToken === 'BNB' ? bnbBalanceFormatted : '0.00'} {paymentToken}
              </span>
            </div>
            <div className="relative">
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.0"
                className="w-full bg-slate-900 border border-slate-600 rounded-xl px-4 py-4 text-white text-xl focus:outline-none focus:border-purple-500"
              />
              <button
                onClick={() => {
                  if (paymentToken === 'BNB') {
                    setAmount((parseFloat(bnbBalanceFormatted) * 0.95).toFixed(4)); // Leave gas
                  }
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 px-3 py-1 bg-purple-500/30 text-purple-400 rounded text-sm"
              >
                MAX
              </button>
            </div>
          </div>
        </>
      )}

      {mode === 'sell' && (
        <div className="mb-4">
          <div className="flex justify-between mb-2">
            <label className="text-sm text-gray-400">YBOT Amount to Sell</label>
            <span className="text-sm text-gray-500">
              Balance: {parseFloat(userData.tokenBalance).toFixed(2)} YBOT
            </span>
          </div>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.0"
            className="w-full bg-slate-900 border border-slate-600 rounded-xl px-4 py-4 text-white text-xl focus:outline-none focus:border-purple-500"
          />
        </div>
      )}

      {/* Preview */}
      {preview && (
        <div className="bg-slate-900 rounded-lg p-4 mb-4 border border-slate-700">
          <div className="flex justify-between mb-2">
            <span className="text-gray-400">You {mode === 'buy' ? 'receive' : 'get'}</span>
            <span className="text-white font-bold text-lg">
              {mode === 'buy' 
                ? `${parseFloat(preview.tokens).toFixed(2)} YBOT`
                : `$${parseFloat(preview.tokens).toFixed(2)} USDC`
              }
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Platform fee ({stats.feePercent}%)</span>
            <span className="text-gray-400">${parseFloat(preview.fee).toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm mt-1">
            <span className="text-gray-500">Current price</span>
            <span className="text-purple-400">${parseFloat(stats.currentPrice).toFixed(4)}/YBOT</span>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Action Button */}
      {!isConnected ? (
        <button
          disabled
          className="w-full py-4 bg-slate-700 text-gray-400 rounded-xl font-bold"
        >
          Connect Wallet to Trade
        </button>
      ) : (
        <button
          onClick={handleTrade}
          disabled={loading || !amount || parseFloat(amount) <= 0}
          className={`w-full py-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${
            loading || !amount || parseFloat(amount) <= 0
              ? 'bg-slate-700 text-gray-400 cursor-not-allowed'
              : mode === 'buy'
              ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:from-green-600 hover:to-emerald-600'
              : 'bg-gradient-to-r from-red-500 to-pink-500 text-white hover:from-red-600 hover:to-pink-600'
          }`}
        >
          {loading ? (
            <>
              <RefreshCw className="w-5 h-5 animate-spin" />
              Processing...
            </>
          ) : mode === 'buy' ? (
            <>
              <Zap className="w-5 h-5" />
              Buy {preview ? parseFloat(preview.tokens).toFixed(0) : '0'} YBOT
            </>
          ) : (
            <>
              <ArrowDownRight className="w-5 h-5" />
              Sell for ${preview ? parseFloat(preview.tokens).toFixed(2) : '0'}
            </>
          )}
        </button>
      )}

      {/* Info */}
      <p className="text-xs text-gray-500 text-center mt-3">
        {mode === 'buy' 
          ? 'Price increases as more tokens are sold'
          : 'You can sell anytime at current market price'
        }
      </p>
    </div>
  );
};

// ============ MAIN PAGE ============

const FundraiserPage: React.FC = () => {
  // Wrap wagmi hooks in try-catch to prevent MetaMask errors from breaking the UI
  let address: string | undefined;
  let isConnected = false;
  let chainId: number | undefined;

  try {
    const accountData = useAccount();
    address = accountData.address;
    isConnected = accountData.isConnected;
    chainId = useChainId();
  } catch (walletError) {
    console.warn('⚠️ Wallet connection error, continuing without wallet features:', walletError);
    // Continue with wallet features disabled
  }

  const [stats, setStats] = useState<FundraiserStats | null>(null);
  const [userData, setUserData] = useState<UserFundraiserData>({ contribution: '0', tokenBalance: '0' });
  const [trades, setTrades] = useState<TradeEvent[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [curveData, setCurveData] = useState<BondingCurvePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [ybotBalance, setYbotBalance] = useState('0');

  const loadData = useCallback(async () => {
    console.log('🔄 loadData called, isConnected:', isConnected, 'address:', address);
    setLoading(true);
    try {
      // Load public data first (stats, trade history, leaderboard) - no wallet needed
      console.log('📊 Loading public data...');
      const [statsData, leaderboardData, tradeHistory] = await Promise.all([
        getFundraiserStats(), // Now works without wallet connection!
        getLeaderboardOnChain(),
        fetchContractEvents('all', 50) // Fetch REAL trade history from Moralis - PUBLIC DATA
      ]);

      console.log('📈 Stats loaded:', statsData);
      console.log('🏆 Leaderboard loaded:', leaderboardData.length, 'entries');
      console.log('💰 Trade history loaded:', tradeHistory.length, 'trades');

      setStats(statsData); // Set real stats - PUBLIC DATA
      setLeaderboard(leaderboardData);
      setTrades(tradeHistory); // Set real trades - PUBLIC DATA
      setCurveData(generateBondingCurveData(1000000, parseFloat(statsData.totalTokensSold)));

      // Only fetch wallet-specific data when wallet is connected
      if (!isConnected || !address) {
        console.log('👛 Wallet not connected, skipping wallet-specific data');
        setLoading(false);
        return;
      }

      console.log('👛 Loading wallet-specific data for:', address);
      try {
        // Wallet-specific data (requires connection)
        const [userDataResult, balance] = await Promise.all([
          getUserFundraiserData(address),
          getYBOTBalance(address)
        ]);
        setUserData(userDataResult);
        setYbotBalance(balance);
        console.log('✅ Wallet data loaded');
      } catch (walletError) {
        console.warn('⚠️ Wallet data failed to load:', walletError);
        // Don't fail the entire load if wallet data fails
      }
    } catch (error) {
      console.error('❌ Error loading fundraiser data:', error);
      // Set some fallback data so the UI doesn't break
      setTrades([]);
      setLeaderboard([]);
      setStats({
        totalUsdRaised: '0',
        totalTokensSold: '0',
        currentPrice: '0.15',
        bnbPrice: '650.00',
        progressPercent: 0,
        feePercent: 5
      });
    } finally {
      setLoading(false);
    }
  }, [address, isConnected, chainId]);

  useEffect(() => {
    loadData();
    
    // Only subscribe to live events and poll when wallet is connected
    // This prevents unnecessary blockchain calls when user is just browsing
    if (!isConnected) {
      return;
    }

    // Subscribe to live events
    const unsubscribe = subscribeToPurchaseEvents((event) => {
      setTrades((prev) => [event, ...prev].slice(0, 50));
      loadData(); // Refresh stats
    });

    // Refresh every 30 seconds
    const interval = setInterval(loadData, 30000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [loadData, isConnected]);

  if (loading && !stats) {
    return (
      <div className="min-h-screen bg-ybot-dark flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 text-purple-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading fundraiser data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ybot-dark">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-ybot-dark/80 backdrop-blur-md border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link
                to="/"
                className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
              >
                <ArrowLeft size={20} />
                <span className="hidden sm:inline">Back to Dashboard</span>
              </Link>
              <div className="h-6 w-px bg-slate-700"></div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                  <Coins className="w-5 h-5 text-white" />
                </div>
                <span className="font-display font-bold text-xl text-white">
                  YBOT <span className="text-purple-400">Fundraiser</span>
                </span>
              </div>
            </div>
            
            {/* Quick Stats */}
            <div className="hidden md:flex items-center gap-6">
              <div className="text-center">
                <p className="text-xs text-gray-500">Current Price</p>
                <p className="text-lg font-bold text-purple-400">
                  ${stats ? parseFloat(stats.currentPrice).toFixed(4) : '0.10'}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500">Total Raised</p>
                <p className="text-lg font-bold text-green-400">
                  ${stats?.totalUsdRaised || '0'}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500">Your YBOT</p>
                <p className="text-lg font-bold text-white">
                  {parseFloat(ybotBalance).toFixed(0)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Progress Banner */}
        <div className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-2xl p-6 mb-8 border border-purple-500/30">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-white mb-1">🚀 YBOT Token Sale</h1>
              <p className="text-gray-400">Invest early. Get better prices. Support the project.</p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-white">${stats?.totalUsdRaised || '0'}</p>
              <p className="text-sm text-gray-400">of ${FUNDRAISER_CONSTANTS.FUNDRAISING_GOAL.toLocaleString()} goal</p>
            </div>
          </div>
          
          {/* Progress Bar */}
          <div className="w-full h-4 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-500"
              style={{ width: `${Math.max(Math.min(stats?.progressPercent || 0, 100), stats && stats.progressPercent > 0 ? 1 : 0)}%` }}
            />
          </div>
          <div className="flex justify-between mt-2 text-sm text-gray-500">
            <span>{stats?.progressPercent.toFixed(4)}% funded</span>
            <span>{stats?.totalTokensSold ? parseFloat(stats.totalTokensSold).toLocaleString() : '0'} tokens sold</span>
          </div>
        </div>

        {/* Main Grid */}
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left Column - Chart & Stats */}
          <div className="lg:col-span-2 space-y-6">
            {/* Bonding Curve Chart */}
            <div className="bg-slate-900/50 rounded-2xl p-6 border border-slate-700/50">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-purple-400" />
                  Bonding Curve
                </h2>
                <button
                  onClick={loadData}
                  className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                >
                  <RefreshCw className={`w-5 h-5 text-gray-400 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>
              
              <BondingCurveChart 
                data={curveData} 
                currentPosition={parseFloat(stats?.totalTokensSold || '0')} 
              />
              
              <div className="grid grid-cols-4 gap-4 mt-6">
                <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-500 mb-1">Base Price</p>
                  <p className="text-lg font-bold text-white">${FUNDRAISER_CONSTANTS.BASE_PRICE}</p>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-500 mb-1">Current</p>
                  <p className="text-lg font-bold text-purple-400">
                    ${parseFloat(stats?.currentPrice || '0.10').toFixed(4)}
                  </p>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-500 mb-1">BNB Price</p>
                  <p className="text-lg font-bold text-yellow-400">
                    ${parseFloat(stats?.bnbPrice || '650').toFixed(0)}
                  </p>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-500 mb-1">Fee</p>
                  <p className="text-lg font-bold text-gray-400">{stats?.feePercent || 5}%</p>
                </div>
              </div>
            </div>

            {/* Live Trade Feed */}
            <div className="bg-slate-900/50 rounded-2xl p-6 border border-slate-700/50">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Activity className="w-5 h-5 text-green-400" />
                  Live Trades
                  <span className="ml-2 px-2 py-0.5 bg-green-500/20 border border-green-500/30 rounded text-xs text-green-400 font-normal flex items-center gap-1">
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                    LIVE from Blockchain
                  </span>
                </h2>
                <span className="text-xs text-gray-500">{trades.length} trades</span>
              </div>
              <TradeFeed trades={trades} />
            </div>

            {/* How It Works */}
            <div className="bg-slate-900/50 rounded-2xl p-6 border border-slate-700/50">
              <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-4">
                <Info className="w-5 h-5 text-blue-400" />
                How It Works
              </h2>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="bg-slate-800/50 rounded-lg p-4">
                  <div className="text-2xl mb-2">📈</div>
                  <h3 className="font-bold text-white mb-1">Bonding Curve</h3>
                  <p className="text-sm text-gray-400">
                    Price starts at $0.10 and increases as more tokens are sold. Early buyers get better prices.
                  </p>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-4">
                  <div className="text-2xl mb-2">💰</div>
                  <h3 className="font-bold text-white mb-1">Instant Liquidity</h3>
                  <p className="text-sm text-gray-400">
                    Sell anytime back to the contract. No lockups. Price determined by curve.
                  </p>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-4">
                  <div className="text-2xl mb-2">🔗</div>
                  <h3 className="font-bold text-white mb-1">Chainlink Oracle</h3>
                  <p className="text-sm text-gray-400">
                    Real-time BNB price from Chainlink. No manipulation possible.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Trade & Leaderboard */}
          <div className="space-y-6">
            {/* Trade Interface */}
            {stats && (
              <TradeInterface 
                stats={stats} 
                userData={userData}
                onTrade={loadData}
              />
            )}

            {/* Your Position */}
            {isConnected && (
              <div className="bg-slate-900/50 rounded-2xl p-6 border border-purple-500/30">
                <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
                  <Target className="w-5 h-5 text-purple-400" />
                  Your Position
                </h2>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Total Contributed</span>
                    <span className="text-white font-bold">
                      ${parseFloat(userData.contribution).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Tokens from Sale</span>
                    <span className="text-purple-400 font-bold">
                      {parseFloat(userData.tokenBalance).toFixed(2)} YBOT
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Wallet Balance</span>
                    <span className="text-white font-bold">
                      {parseFloat(ybotBalance).toFixed(2)} YBOT
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Leaderboard */}
            <div className="bg-slate-900/50 rounded-2xl p-6 border border-slate-700/50">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-yellow-400" />
                  Top Contributors
                </h2>
                <span className="px-2 py-0.5 bg-purple-500/20 border border-purple-500/30 rounded text-xs text-purple-400">
                  Real Data via Moralis
                </span>
              </div>
              <Leaderboard entries={leaderboard} userAddress={address} />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default FundraiserPage;
