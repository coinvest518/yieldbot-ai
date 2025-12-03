/**
 * API Test Component
 * Visual test interface for verifying API connections
 */

import React, { useState } from 'react';
import { testAllConnections, testDefiLlama, testVenus, testBeefy, testCoinGecko } from '../scripts/testApiConnections';

interface TestResult {
  name: string;
  status: 'success' | 'failed';
  latencyMs: number;
  dataCount?: number;
  sampleData?: any;
  error?: string;
}

const ApiTester: React.FC = () => {
  const [results, setResults] = useState<TestResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<{ passed: number; failed: number; totalTime: number } | null>(null);

  const runAllTests = async () => {
    setLoading(true);
    setResults([]);
    setSummary(null);
    
    try {
      const { results: testResults, summary: testSummary } = await testAllConnections();
      setResults(testResults);
      setSummary(testSummary);
    } catch (error) {
      console.error('Test failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const runSingleTest = async (testFn: () => Promise<TestResult>, name: string) => {
    setLoading(true);
    try {
      const result = await testFn();
      setResults(prev => {
        // Replace if exists, otherwise add
        const existing = prev.findIndex(r => r.name === name);
        if (existing >= 0) {
          const updated = [...prev];
          updated[existing] = result;
          return updated;
        }
        return [...prev, result];
      });
    } catch (error) {
      console.error('Test failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gradient-to-br from-slate-900 via-blue-900/20 to-slate-900 rounded-2xl p-6 border border-blue-500/20">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1">
            🧪 API Connection Tester
          </h2>
          <p className="text-gray-400 text-sm">
            Verify DeFi protocol API connections
          </p>
        </div>
        <button
          onClick={runAllTests}
          disabled={loading}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg text-white font-semibold transition-all disabled:opacity-50 flex items-center gap-2"
        >
          {loading ? (
            <>
              <span className="animate-spin">⏳</span> Testing...
            </>
          ) : (
            <>
              🚀 Run All Tests
            </>
          )}
        </button>
      </div>

      {/* Individual Test Buttons */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        <button
          onClick={() => runSingleTest(testDefiLlama, 'DefiLlama Yields API')}
          disabled={loading}
          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white text-sm transition-all disabled:opacity-50"
        >
          📊 DefiLlama
        </button>
        <button
          onClick={() => runSingleTest(testVenus, 'Venus Protocol API')}
          disabled={loading}
          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white text-sm transition-all disabled:opacity-50"
        >
          🏦 Venus
        </button>
        <button
          onClick={() => runSingleTest(testBeefy, 'Beefy Finance API')}
          disabled={loading}
          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white text-sm transition-all disabled:opacity-50"
        >
          🐮 Beefy
        </button>
        <button
          onClick={() => runSingleTest(testCoinGecko, 'CoinGecko Price API')}
          disabled={loading}
          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white text-sm transition-all disabled:opacity-50"
        >
          💰 CoinGecko
        </button>
      </div>

      {/* Summary */}
      {summary && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-green-400">{summary.passed}</div>
            <div className="text-sm text-gray-400">Passed</div>
          </div>
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-red-400">{summary.failed}</div>
            <div className="text-sm text-gray-400">Failed</div>
          </div>
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-blue-400">{summary.totalTime}ms</div>
            <div className="text-sm text-gray-400">Total Time</div>
          </div>
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-4">
          {results.map((result, index) => (
            <div
              key={index}
              className={`rounded-xl p-4 border ${
                result.status === 'success'
                  ? 'bg-green-500/5 border-green-500/30'
                  : 'bg-red-500/5 border-red-500/30'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">
                    {result.status === 'success' ? '✅' : '❌'}
                  </span>
                  <div>
                    <h3 className="text-white font-semibold">{result.name}</h3>
                    <p className="text-sm text-gray-400">
                      Latency: {result.latencyMs}ms
                      {result.dataCount !== undefined && ` • ${result.dataCount} records`}
                    </p>
                  </div>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  result.status === 'success'
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-red-500/20 text-red-400'
                }`}>
                  {result.status.toUpperCase()}
                </span>
              </div>

              {result.status === 'success' && result.sampleData && (
                <div className="bg-slate-800/50 rounded-lg p-3 mt-3">
                  <h4 className="text-xs text-gray-500 mb-2">Sample Data:</h4>
                  <pre className="text-xs text-gray-300 overflow-auto max-h-40">
                    {JSON.stringify(result.sampleData, null, 2)}
                  </pre>
                </div>
              )}

              {result.status === 'failed' && result.error && (
                <div className="bg-red-500/10 rounded-lg p-3 mt-3">
                  <h4 className="text-xs text-red-400 mb-1">Error:</h4>
                  <p className="text-sm text-red-300">{result.error}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {results.length === 0 && !loading && (
        <div className="text-center py-12 text-gray-400">
          <div className="text-4xl mb-3">🔌</div>
          <p>Click "Run All Tests" to verify API connections</p>
          <p className="text-sm mt-2">
            Tests will verify: DefiLlama, Venus Protocol, Beefy Finance, CoinGecko
          </p>
        </div>
      )}
    </div>
  );
};

export default ApiTester;
