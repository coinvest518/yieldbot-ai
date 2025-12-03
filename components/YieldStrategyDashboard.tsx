import React, { useState, useEffect } from 'react';
import { 
  fetchLiveYieldData, 
  getTopPoolsForStrategy,
  calculatePotentialYield,
  YIELD_STRATEGIES,
  fetchLiveVaultStats,
  type PoolData
} from '../services/yieldService';

interface YieldStrategyDashboardProps {
  investmentAmount?: number;
}

const YieldStrategyDashboard: React.FC<YieldStrategyDashboardProps> = ({ 
  investmentAmount = 100 
}) => {
  const [activeStrategy, setActiveStrategy] = useState<'lending' | 'stablecoin' | 'volatile'>('lending');
  const [pools, setPools] = useState<PoolData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [vaultStats, setVaultStats] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, [activeStrategy]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [poolsData, statsData] = await Promise.all([
        getTopPoolsForStrategy(activeStrategy, 10),
        fetchLiveVaultStats()
      ]);
      setPools(poolsData);
      setVaultStats(statsData);
    } catch (err) {
      setError('Failed to load live data. Using cached data.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getRiskBadgeColor = (risk: string) => {
    switch (risk) {
      case 'low': return 'bg-green-500/20 text-green-400 border-green-500/50';
      case 'medium': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50';
      case 'high': return 'bg-red-500/20 text-red-400 border-red-500/50';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/50';
    }
  };

  const strategyConfig = YIELD_STRATEGIES.find(s => s.id === activeStrategy);
  const potentialYield = calculatePotentialYield(investmentAmount, activeStrategy);

  return (
    <div className="bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900 rounded-2xl p-6 border border-purple-500/20">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1">
            🎯 Yield Strategies
          </h2>
          <p className="text-gray-400 text-sm">
            Live data from Venus, PancakeSwap & Beefy
          </p>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg text-white text-sm transition-all disabled:opacity-50"
        >
          {loading ? '⏳ Loading...' : '🔄 Refresh'}
        </button>
      </div>

      {/* Strategy Tabs */}
      <div className="flex gap-2 mb-6 p-1 bg-slate-800/50 rounded-xl">
        {YIELD_STRATEGIES.map((strategy) => (
          <button
            key={strategy.id}
            onClick={() => setActiveStrategy(strategy.id)}
            className={`flex-1 py-3 px-4 rounded-lg text-sm font-medium transition-all ${
              activeStrategy === strategy.id
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/25'
                : 'text-gray-400 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            <div className="flex flex-col items-center gap-1">
              <span>
                {strategy.id === 'lending' && '🏦'}
                {strategy.id === 'stablecoin' && '💎'}
                {strategy.id === 'volatile' && '🚀'}
                {' '}{strategy.name.split('(')[0].trim()}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full border ${getRiskBadgeColor(strategy.riskLevel)}`}>
                {strategy.expectedAPY.min}% - {strategy.expectedAPY.max}% APY
              </span>
            </div>
          </button>
        ))}
      </div>

      {/* Strategy Info Card */}
      {strategyConfig && (
        <div className="bg-slate-800/50 rounded-xl p-4 mb-6 border border-purple-500/10">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-semibold text-white mb-1">
                {strategyConfig.name}
              </h3>
              <p className="text-gray-400 text-sm mb-3">
                {strategyConfig.description}
              </p>
              <div className="flex gap-2 flex-wrap">
                {strategyConfig.protocols.map((protocol) => (
                  <span
                    key={protocol}
                    className="px-3 py-1 bg-purple-500/20 text-purple-300 rounded-full text-xs"
                  >
                    {protocol}
                  </span>
                ))}
              </div>
            </div>
            <div className={`px-3 py-1 rounded-full text-sm border ${getRiskBadgeColor(strategyConfig.riskLevel)}`}>
              {strategyConfig.riskLevel.toUpperCase()} RISK
            </div>
          </div>

          {/* Yield Calculator */}
          <div className="mt-4 pt-4 border-t border-slate-700">
            <h4 className="text-sm text-gray-400 mb-2">
              💰 Estimated Yield for ${investmentAmount}
            </h4>
            <div className="grid grid-cols-4 gap-4">
              <div className="bg-slate-900/50 rounded-lg p-3 text-center">
                <div className="text-xs text-gray-500 mb-1">Daily</div>
                <div className="text-green-400 font-bold">{potentialYield.daily}</div>
              </div>
              <div className="bg-slate-900/50 rounded-lg p-3 text-center">
                <div className="text-xs text-gray-500 mb-1">Monthly</div>
                <div className="text-green-400 font-bold">{potentialYield.monthly}</div>
              </div>
              <div className="bg-slate-900/50 rounded-lg p-3 text-center">
                <div className="text-xs text-gray-500 mb-1">Yearly</div>
                <div className="text-green-400 font-bold">{potentialYield.yearly}</div>
              </div>
              <div className="bg-slate-900/50 rounded-lg p-3 text-center">
                <div className="text-xs text-gray-500 mb-1">Avg APY</div>
                <div className="text-purple-400 font-bold">{potentialYield.apy}%</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pools Table */}
      <div className="bg-slate-800/30 rounded-xl overflow-hidden">
        <div className="px-4 py-3 bg-slate-800/50 border-b border-slate-700">
          <h3 className="text-white font-semibold">
            📊 Top Pools - Live Data
          </h3>
        </div>
        
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin inline-block w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full mb-3"></div>
            <p className="text-gray-400">Fetching live pool data...</p>
          </div>
        ) : error ? (
          <div className="p-4 text-center text-yellow-400">
            ⚠️ {error}
          </div>
        ) : pools.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            No pools found for this strategy
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b border-slate-700">
                  <th className="px-4 py-3">Pool</th>
                  <th className="px-4 py-3">Protocol</th>
                  <th className="px-4 py-3">APY</th>
                  <th className="px-4 py-3">TVL</th>
                  <th className="px-4 py-3">Risk</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {pools.map((pool, index) => (
                  <tr 
                    key={`${pool.name}-${index}`}
                    className="border-b border-slate-700/50 hover:bg-slate-700/20 transition-colors"
                  >
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">
                          {pool.protocol.includes('Venus') && '🏦'}
                          {pool.protocol.includes('PancakeSwap') && '🥞'}
                          {pool.protocol.includes('Beefy') && '🐮'}
                        </span>
                        <div>
                          <div className="text-white font-medium">{pool.name}</div>
                          <div className="text-xs text-gray-500">{pool.asset}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-gray-300">{pool.protocol}</span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-green-400 font-bold">
                        {pool.apy.toFixed(2)}%
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-gray-300">{pool.tvl}</span>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`px-2 py-1 rounded text-xs ${getRiskBadgeColor(pool.riskLevel)}`}>
                        {pool.riskLevel}
                        {pool.impermanentLossRisk && ` (IL: ${pool.impermanentLossRisk})`}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <button className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 rounded-lg text-white text-xs transition-all">
                        Deposit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Vault Stats Footer */}
      {vaultStats && (
        <div className="mt-6 grid grid-cols-4 gap-4">
          <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-xl p-4 border border-purple-500/20">
            <div className="text-xs text-gray-500 mb-1">Total Value Locked</div>
            <div className="text-xl font-bold text-white">${vaultStats.tvl}</div>
          </div>
          <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 rounded-xl p-4 border border-green-500/20">
            <div className="text-xs text-gray-500 mb-1">Average APY</div>
            <div className="text-xl font-bold text-green-400">{vaultStats.apy}%</div>
          </div>
          <div className="bg-gradient-to-r from-blue-500/10 to-cyan-500/10 rounded-xl p-4 border border-blue-500/20">
            <div className="text-xs text-gray-500 mb-1">Yield Distributed</div>
            <div className="text-xl font-bold text-blue-400">${vaultStats.totalYieldDistributed}</div>
          </div>
          <div className="bg-gradient-to-r from-orange-500/10 to-amber-500/10 rounded-xl p-4 border border-orange-500/20">
            <div className="text-xs text-gray-500 mb-1">Next Rebalance</div>
            <div className="text-xl font-bold text-orange-400">{vaultStats.nextRebalance}</div>
          </div>
        </div>
      )}

      {/* Data Sources */}
      <div className="mt-4 text-center text-xs text-gray-500">
        📡 Data from: DefiLlama Yields API • Venus Protocol API • Beefy Finance API
        <br />
        Last updated: {new Date().toLocaleTimeString()}
      </div>
    </div>
  );
};

export default YieldStrategyDashboard;
